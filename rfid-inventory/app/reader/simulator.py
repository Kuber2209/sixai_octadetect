"""Simulated reader for development and scale testing without the M6E.

Behaviour: every cycle it "reads" all item tags currently in the field at
~1 Hz with realistic RSSI jitter. A scripted scenario runs in the
background: a worker card appears at an antenna, a couple of items vanish
shortly after (checkout), and later reappear (return). This exercises the
full Option B attribution pipeline end to end.
"""
import logging
import random
import threading
import time

from ..database import SessionLocal
from ..models import Item, User
from .base import ReadCallback, TagRead

log = logging.getLogger(__name__)


class SimulatedReader:
    def __init__(self, scenario: bool = True) -> None:
        self._scenario = scenario
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        # epc -> antenna currently visible on; removed = out of field
        self._in_field: dict[str, int] = {}
        self._lock = threading.Lock()

    # -- manual controls (also handy for tests) -----------------------------
    def place_tag(self, epc: str, antenna: int = 1) -> None:
        with self._lock:
            self._in_field[epc.upper()] = antenna

    def remove_tag(self, epc: str) -> None:
        with self._lock:
            self._in_field.pop(epc.upper(), None)

    # -----------------------------------------------------------------------
    def start(self, callback: ReadCallback) -> None:
        db = SessionLocal()
        try:
            for item in db.query(Item).all():
                self._in_field[item.epc] = random.choice([1, 2])
        finally:
            db.close()
        log.info("Simulator started with %d tags in field", len(self._in_field))

        self._thread = threading.Thread(
            target=self._run, args=(callback,), name="sim-reader", daemon=True
        )
        self._thread.start()
        if self._scenario:
            threading.Thread(target=self._run_scenario, name="sim-scenario",
                             daemon=True).start()

    def _run(self, callback: ReadCallback) -> None:
        while not self._stop.is_set():
            with self._lock:
                snapshot = dict(self._in_field)
            for epc, antenna in snapshot.items():
                if random.random() < 0.97:  # occasional missed read
                    callback(TagRead(epc=epc, rssi=random.uniform(-70, -45),
                                     antenna=antenna))
            time.sleep(1.0)

    def _run_scenario(self) -> None:
        """Worker walks up, takes two items, returns one a minute later."""
        time.sleep(20)
        db = SessionLocal()
        try:
            worker = db.query(User).filter(User.epc.isnot(None)).first()
            items = db.query(Item).limit(2).all()
        finally:
            db.close()
        if not worker or len(items) < 2:
            return

        antenna = self._in_field.get(items[0].epc, 1)
        log.info("[scenario] worker %s card appears at antenna %d", worker.username, antenna)
        self.place_tag(worker.epc, antenna)
        time.sleep(8)
        log.info("[scenario] items %s, %s leave the field", items[0].epc, items[1].epc)
        self.remove_tag(items[0].epc)
        time.sleep(3)
        self.remove_tag(items[1].epc)
        time.sleep(10)
        self.remove_tag(worker.epc)
        time.sleep(60)
        log.info("[scenario] item %s is returned", items[0].epc)
        self.place_tag(items[0].epc, antenna)

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=3)
