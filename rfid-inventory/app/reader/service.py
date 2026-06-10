"""Reader service: consumes tag reads from the backend (M6E via Mercury API,
or the simulator), logs them to READ_EVENTS, keeps a live presence map and
implements the Option B checkout flow:

  * item EPC not read for ABSENCE_TIMEOUT_S  -> it disappeared
  * a worker-card EPC was seen on the same antenna within
    ATTRIBUTION_WINDOW_S before the disappearance -> CHECKOUT attributed
    to that worker; disappearances within SESSION_WINDOW_S of each other
    join the same checkout session
  * no worker nearby -> item marked missing + alert raised

Reappearing items are marked present again and any open checkout is
closed as returned.
"""
import logging
import queue
import threading
import time
import uuid
from datetime import datetime

from .. import config
from ..database import SessionLocal
from ..events import event_hub
from ..models import Alert, Checkout, Item, ReadEvent, RFIDReader, User
from .base import TagRead

log = logging.getLogger(__name__)


class _Session:
    """An open checkout session for one worker at one antenna."""

    def __init__(self, user_id: int, antenna: int | None):
        self.id = uuid.uuid4().hex[:12]
        self.user_id = user_id
        self.antenna = antenna
        self.last_item_at = time.monotonic()


class ReaderService:
    def __init__(self, backend) -> None:
        self.backend = backend
        self.queue: queue.Queue[TagRead] = queue.Queue(maxsize=10000)
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []
        self.reader_id: int | None = None

        # epc -> (last monotonic time, last antenna, last rssi)
        self.presence: dict[str, tuple[float, int | None, float | None]] = {}
        self._presence_lock = threading.Lock()

        self.known_item_epcs: set[str] = set()
        self.worker_epcs: dict[str, int] = {}  # epc -> user_id
        self._absent: set[str] = set()         # item EPCs currently out of field
        self._open_sessions: dict[int, _Session] = {}  # user_id -> session
        self._dirty_last_seen: dict[str, datetime] = {}
        self.last_unknown: tuple[str, datetime] | None = None  # for scan-to-register

    # -- lifecycle -----------------------------------------------------------
    def start(self) -> None:
        self._register_reader()
        self.refresh_epc_caches()
        self.backend.start(self._on_read)
        for target, name in [(self._consume_loop, "rfid-consumer"),
                             (self._sweep_loop, "rfid-sweeper")]:
            t = threading.Thread(target=target, name=name, daemon=True)
            t.start()
            self._threads.append(t)
        log.info("Reader service started (mode=%s)", config.READER_MODE)

    def stop(self) -> None:
        self._stop.set()
        self.backend.stop()
        for t in self._threads:
            t.join(timeout=3)

    def _register_reader(self) -> None:
        db = SessionLocal()
        try:
            reader = db.query(RFIDReader).filter_by(reader_name=config.READER_NAME).first()
            if reader is None:
                reader = RFIDReader(reader_name=config.READER_NAME, uri=config.READER_URI)
                db.add(reader)
                db.commit()
            self.reader_id = reader.reader_id
        finally:
            db.close()

    def refresh_epc_caches(self) -> None:
        """Reload item/worker EPC sets (called after registering items/users)."""
        db = SessionLocal()
        try:
            self.known_item_epcs = {epc for (epc,) in db.query(Item.epc).all()}
            self.worker_epcs = {
                u.epc: u.user_id
                for u in db.query(User).filter(User.epc.isnot(None)).all()
            }
        finally:
            db.close()

    # -- ingest ----------------------------------------------------------------
    def _on_read(self, read: TagRead) -> None:
        """Called from the Mercury/simulator thread for every tag report."""
        try:
            self.queue.put_nowait(read)
        except queue.Full:
            log.warning("Read queue full, dropping report for %s", read.epc)

    def _consume_loop(self) -> None:
        """Batch-insert read events and maintain the live presence map."""
        last_flush = time.monotonic()
        batch: list[TagRead] = []
        while not self._stop.is_set():
            try:
                read = self.queue.get(timeout=0.5)
                batch.append(read)
                self._track_presence(read)
            except queue.Empty:
                pass

            now = time.monotonic()
            if batch and (len(batch) >= 200 or now - last_flush >= 1.0):
                self._flush(batch)
                batch = []
                last_flush = now

    def _track_presence(self, read: TagRead) -> None:
        epc = read.epc
        now = time.monotonic()
        with self._presence_lock:
            self.presence[epc] = (now, read.antenna, read.rssi)

        if epc in self.known_item_epcs:
            self._dirty_last_seen[epc] = read.read_at
            if epc in self._absent:
                self._absent.discard(epc)
                self._handle_item_returned(epc)
        elif epc not in self.worker_epcs:
            self.last_unknown = (epc, read.read_at)

    def _flush(self, batch: list[TagRead]) -> None:
        db = SessionLocal()
        try:
            db.bulk_insert_mappings(ReadEvent, [
                {"epc": r.epc, "read_at": r.read_at, "rssi": r.rssi,
                 "antenna_port": r.antenna, "reader_id": self.reader_id}
                for r in batch
            ])
            if self._dirty_last_seen:
                dirty, self._dirty_last_seen = self._dirty_last_seen, {}
                for epc, seen_at in dirty.items():
                    db.query(Item).filter(Item.epc == epc).update(
                        {Item.last_seen: seen_at}, synchronize_session=False
                    )
            db.commit()
        except Exception:
            db.rollback()
            log.exception("Failed to flush read batch")
        finally:
            db.close()

    # -- disappearance sweep (the heart of Option B) ---------------------------
    def _sweep_loop(self) -> None:
        while not self._stop.is_set():
            time.sleep(config.SWEEP_INTERVAL_S)
            try:
                self._sweep()
            except Exception:
                log.exception("Sweep failed")

    def _sweep(self) -> None:
        now = time.monotonic()
        with self._presence_lock:
            snapshot = dict(self.presence)

        # expire finished checkout sessions
        for uid in [uid for uid, s in self._open_sessions.items()
                    if now - s.last_item_at > config.SESSION_WINDOW_S]:
            del self._open_sessions[uid]

        for epc, (last_t, antenna, _rssi) in snapshot.items():
            if epc not in self.known_item_epcs or epc in self._absent:
                continue
            if now - last_t < config.ABSENCE_TIMEOUT_S:
                continue
            self._absent.add(epc)
            user_id = self._attribute_worker(antenna, last_t, snapshot)
            self._handle_item_disappeared(epc, antenna, user_id)

    def _attribute_worker(self, antenna: int | None, item_last_t: float,
                          snapshot: dict) -> int | None:
        """Find the worker card seen on the same antenna closest in time to
        the item's disappearance, within ATTRIBUTION_WINDOW_S."""
        best: tuple[float, int] | None = None
        for w_epc, user_id in self.worker_epcs.items():
            seen = snapshot.get(w_epc)
            if seen is None:
                continue
            w_t, w_antenna, _ = seen
            if antenna is not None and w_antenna is not None and w_antenna != antenna:
                continue
            gap = abs(w_t - item_last_t)
            if gap <= config.ATTRIBUTION_WINDOW_S and (best is None or gap < best[0]):
                best = (gap, user_id)
        return best[1] if best else None

    def _handle_item_disappeared(self, epc: str, antenna: int | None,
                                 user_id: int | None) -> None:
        db = SessionLocal()
        try:
            item = db.query(Item).filter(Item.epc == epc).first()
            if item is None:
                return
            if user_id is not None:
                session = self._open_sessions.get(user_id)
                if session is None or (antenna is not None and session.antenna
                                       not in (None, antenna)):
                    session = _Session(user_id, antenna)
                    self._open_sessions[user_id] = session
                session.last_item_at = time.monotonic()

                item.status = "checked-out"
                checkout = Checkout(
                    session_id=session.id, user_id=user_id, item_id=item.item_id,
                    epc=epc, from_location_id=item.location_id, antenna_port=antenna,
                    return_status="consumed" if item.is_consumable else "open",
                )
                if item.is_consumable:
                    item.quantity = max(0, item.quantity - 1)
                db.add(checkout)
                db.commit()
                user = db.get(User, user_id)
                log.info("CHECKOUT %s by %s (session %s)", epc, user.username, session.id)
                event_hub.publish("checkout", {
                    "epc": epc, "item": item.name, "user": user.username,
                    "session_id": session.id,
                })
            else:
                item.status = "missing"
                db.add(Alert(
                    alert_type="missing", epc=epc,
                    message=f"Item '{item.name}' ({epc}) disappeared from "
                            f"antenna {antenna} with no worker card nearby.",
                ))
                db.commit()
                log.warning("MISSING %s (%s), no worker nearby", item.name, epc)
                event_hub.publish("alert", {"epc": epc, "item": item.name,
                                            "type": "missing"})
            event_hub.publish("item_status", {"epc": epc, "status": item.status})
        except Exception:
            db.rollback()
            log.exception("Failed handling disappearance of %s", epc)
        finally:
            db.close()

    def _handle_item_returned(self, epc: str) -> None:
        db = SessionLocal()
        try:
            item = db.query(Item).filter(Item.epc == epc).first()
            if item is None:
                return
            item.status = "present"
            open_checkout = (
                db.query(Checkout)
                .filter(Checkout.epc == epc, Checkout.return_status == "open")
                .order_by(Checkout.taken_at.desc())
                .first()
            )
            if open_checkout:
                open_checkout.returned_at = datetime.utcnow()
                open_checkout.return_status = "returned"
            # auto-resolve open 'missing' alerts for this tag
            db.query(Alert).filter(
                Alert.epc == epc, Alert.alert_type == "missing",
                Alert.resolved.is_(False),
            ).update({Alert.resolved: True, Alert.resolved_at: datetime.utcnow(),
                      Alert.resolved_by: "system"}, synchronize_session=False)
            db.commit()
            log.info("RETURNED %s (%s)", item.name, epc)
            event_hub.publish("item_status", {"epc": epc, "status": "present"})
        except Exception:
            db.rollback()
            log.exception("Failed handling return of %s", epc)
        finally:
            db.close()


# Global instance, created by app.main on startup.
reader_service: ReaderService | None = None


def create_service() -> ReaderService | None:
    global reader_service
    if config.READER_MODE == "off":
        return None
    if config.READER_MODE == "mercury":
        from .mercury_backend import MercuryReader
        backend = MercuryReader()
    else:
        from .simulator import SimulatedReader
        backend = SimulatedReader()
    reader_service = ReaderService(backend)
    return reader_service
