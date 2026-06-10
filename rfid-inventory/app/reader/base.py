from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Protocol


@dataclass
class TagRead:
    epc: str
    rssi: float | None = None
    antenna: int | None = None
    read_at: datetime = field(default_factory=datetime.utcnow)


ReadCallback = Callable[[TagRead], None]


class ReaderBackend(Protocol):
    """A source of tag reads: the real M6E via Mercury API, or a simulator."""

    def start(self, callback: ReadCallback) -> None: ...

    def stop(self) -> None: ...
