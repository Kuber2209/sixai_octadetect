"""ThingMagic M6E backend using the official Mercury API Python bindings.

Install the bindings on the server (they are built from source, not pip):

    sudo apt install patch xsltproc gcc libreadline-dev python3-dev python3-setuptools
    git clone https://github.com/gotthardp/python-mercuryapi.git
    cd python-mercuryapi && make PYTHON=python3 && sudo make install

After that `import mercury` works. Connection URIs:
    tmr:///dev/ttyUSB0      M6E on USB/serial (Linux)
    tmr://192.168.1.50      M6E behind a network host
"""
import logging
from datetime import datetime

from .. import config
from .base import ReadCallback, TagRead

log = logging.getLogger(__name__)


class MercuryReader:
    def __init__(self) -> None:
        self._reader = None
        self._callback: ReadCallback | None = None

    def start(self, callback: ReadCallback) -> None:
        import mercury  # imported lazily so the portal runs without the SDK

        self._callback = callback
        log.info("Connecting to M6E at %s ...", config.READER_URI)
        self._reader = mercury.Reader(config.READER_URI, baudrate=115200)
        self._reader.set_region(config.READER_REGION)
        self._reader.set_read_plan(
            config.READER_ANTENNAS, "GEN2", read_power=config.READER_POWER_CDBM
        )
        log.info(
            "M6E connected (model=%s, region=%s, antennas=%s, power=%s cdBm)",
            self._reader.get_model(), config.READER_REGION,
            config.READER_ANTENNAS, config.READER_POWER_CDBM,
        )
        # Continuous read: Mercury invokes our callback from its own thread
        # for every tag report.
        self._reader.start_reading(self._on_tag, on_time=250, off_time=0)

    def _on_tag(self, tag) -> None:
        try:
            epc = tag.epc.decode("ascii") if isinstance(tag.epc, bytes) else str(tag.epc)
            self._callback(TagRead(
                epc=epc.upper(),
                rssi=float(tag.rssi) if tag.rssi is not None else None,
                antenna=getattr(tag, "antenna", None),
                read_at=datetime.utcnow(),
            ))
        except Exception:
            log.exception("Failed to handle tag report")

    def stop(self) -> None:
        if self._reader is not None:
            try:
                self._reader.stop_reading()
            finally:
                self._reader = None
