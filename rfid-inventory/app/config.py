"""Central configuration, loaded from environment variables (.env supported).

Everything runs on the in-premise LAN; no internet is assumed anywhere.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Load a .env file sitting next to the project root, if present.
_env_file = BASE_DIR / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def _get(name: str, default: str) -> str:
    return os.environ.get(name, default)


# --- Database -------------------------------------------------------------
# Production: postgresql+psycopg2://rfid:password@localhost:5432/rfid_inventory
# Development fallback: local SQLite file (zero setup).
DATABASE_URL = _get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'rfid.db'}")

# --- Web server -----------------------------------------------------------
SECRET_KEY = _get("SECRET_KEY", "change-me-on-the-real-server")
SESSION_TTL_HOURS = int(_get("SESSION_TTL_HOURS", "12"))

# --- RFID reader ----------------------------------------------------------
# READER_MODE: "mercury" for the real ThingMagic M6E, "simulator" for testing
# without hardware, "off" to run the portal alone.
READER_MODE = _get("READER_MODE", "simulator")

# Mercury API connection URI for the M6E:
#   USB/serial:  tmr:///dev/ttyUSB0   (Linux)  or  tmr:///COM4 (Windows)
#   Network:     tmr://192.168.1.50   (via a reader host / Vantiq-style box)
READER_URI = _get("READER_URI", "tmr:///dev/ttyUSB0")
READER_REGION = _get("READER_REGION", "open")  # e.g. "NA", "EU3", "IN", "open"
READER_ANTENNAS = [int(a) for a in _get("READER_ANTENNAS", "1").split(",")]
READER_POWER_CDBM = int(_get("READER_POWER_CDBM", "2700"))  # centi-dBm, 2700 = 27 dBm
READER_NAME = _get("READER_NAME", "m6e-main")

# --- Presence / checkout detection (Option B: proximity attribution) ------
# An item is considered absent if not read for this many seconds.
ABSENCE_TIMEOUT_S = int(_get("ABSENCE_TIMEOUT_S", "30"))
# A worker card seen on the same antenna within this many seconds before the
# item disappeared gets attributed the checkout.
ATTRIBUTION_WINDOW_S = int(_get("ATTRIBUTION_WINDOW_S", "20"))
# Items taken by the same worker within this window are grouped into one
# checkout session (worker grabbing 5 things from one cupboard).
SESSION_WINDOW_S = int(_get("SESSION_WINDOW_S", "30"))
# How often the sweeper checks for disappeared items.
SWEEP_INTERVAL_S = float(_get("SWEEP_INTERVAL_S", "2"))
# How often denormalised items.last_seen is flushed to the DB.
LAST_SEEN_FLUSH_S = float(_get("LAST_SEEN_FLUSH_S", "5"))
