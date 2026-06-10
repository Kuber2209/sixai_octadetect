"""Tiny thread-safe pub/sub bridge between the reader threads and the
WebSocket clients on the asyncio event loop."""
import asyncio
import json
import logging
import threading
from datetime import datetime

log = logging.getLogger(__name__)


class EventHub:
    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._subscribers: set[asyncio.Queue] = set()
        self._lock = threading.Lock()

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        with self._lock:
            self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        with self._lock:
            self._subscribers.discard(q)

    def publish(self, event_type: str, data: dict) -> None:
        """Safe to call from any thread."""
        if self._loop is None:
            return
        message = json.dumps({
            "type": event_type,
            "at": datetime.utcnow().isoformat() + "Z",
            "data": data,
        })
        self._loop.call_soon_threadsafe(self._fan_out, message)

    def _fan_out(self, message: str) -> None:
        with self._lock:
            subscribers = list(self._subscribers)
        for q in subscribers:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                pass


event_hub = EventHub()
