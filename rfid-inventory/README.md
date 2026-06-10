# RFID Inventory System

Offline, LAN-only inventory tracking for ~9,000 items using a **ThingMagic
M6E** reader (Mercury API), a **FastAPI** server, **PostgreSQL**, and a
browser dashboard served on the local network. No internet required anywhere.

```
M6E reader ──USB/serial──► Reader service (Mercury API, Python thread)
                                 │  read events, presence, checkout attribution
                                 ▼
                            PostgreSQL  ◄── FastAPI (REST + WebSocket)
                                                  ▲
                     workers' browsers on the LAN ┘  http://<server-ip>:8000
```

## Features

- **Continuous reading** of all tags via Mercury API; every read is logged to
  the append-only `read_events` audit table, and `items.last_seen` /
  `items.status` are kept up to date.
- **Option B checkout detection (proximity attribution):** when an item tag
  disappears from an antenna and a worker's ID-card tag was seen at the same
  antenna within the attribution window, a `checkouts` record is written for
  that worker. Items taken in one trip are grouped into a single checkout
  *session*. Disappearances with no worker nearby raise a **missing** alert.
- **Returns:** when a checked-out tag reappears, the open checkout is closed
  as returned and the item goes back to `present`. Consumables decrement
  quantity instead.
- **Web dashboard** (no installation on worker machines): live inventory
  table with status badges and building/status/search filters, reads-per-minute
  chart, alerts panel with resolve, recent checkouts, and a manager-only
  **scan-to-register** form that auto-fills the EPC from the tag held at the
  antenna.
- **Roles:** `manager` (register items/locations/users, resolve, mark
  returns) and `worker` (view). Session-cookie auth, PBKDF2 password hashes.

## Quick start (development, no hardware)

```bash
cd rfid-inventory
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m scripts.seed                     # tables + ~57 items + demo users
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` — log in as `manager / manager123` (or
`worker1 / worker123`). The default `READER_MODE=simulator` feeds realistic
reads and runs a scripted scenario: ~20 s after startup, *worker1*'s card
appears at an antenna, two items vanish (watch the checkout appear and items
flip to `checked-out`), and one is returned a minute later.

## Production setup (institute server)

1. **PostgreSQL:** create a DB + user, set `DATABASE_URL` in `.env`
   (`cp .env.example .env`), `pip install psycopg2-binary`.
2. **Seed:** `python -m scripts.seed`, then change the default passwords by
   creating real users via `POST /api/users`.
3. **Reader (M6E) — Mercury API bindings** (not on PyPI, build once):
   ```bash
   sudo apt install patch xsltproc gcc libreadline-dev python3-dev python3-setuptools
   git clone https://github.com/gotthardp/python-mercuryapi.git
   cd python-mercuryapi && make PYTHON=python3 && sudo make install
   ```
   Then in `.env`: `READER_MODE=mercury`, `READER_URI=tmr:///dev/ttyUSB0`
   (give your user dialout access: `sudo usermod -aG dialout $USER`), set
   `READER_REGION` to your regulatory region and `READER_ANTENNAS` to the
   connected ports.
4. **Run as a service:** systemd unit running
   `venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`, optionally
   behind nginx on port 80. UFW: allow 22 and 80 only.
5. **Backups:** nightly `pg_dump` via cron.

## Configuration

All knobs are env vars (see `.env.example`). The checkout-detection tuning:

| Variable | Default | Meaning |
|---|---|---|
| `ABSENCE_TIMEOUT_S` | 30 | Item not read for this long ⇒ it left the field |
| `ATTRIBUTION_WINDOW_S` | 20 | Worker card seen on the same antenna within this window gets the checkout |
| `SESSION_WINDOW_S` | 30 | Items taken within this window join one checkout session |

Tune these against real RF behaviour during the 50–60-item pilot.

## API overview

| Method & path | Role | Purpose |
|---|---|---|
| `POST /api/auth/login` / `logout` / `GET me` | all | session auth |
| `GET /api/items?building=&floor=&cupboard=&category=&status=&q=` | all | filtered inventory |
| `GET /api/items/{epc}` | all | single item lookup |
| `POST /api/items` | manager | register item (scan-to-register) |
| `GET /api/reader/scan` | manager | last unknown EPC seen (autofill) |
| `GET/POST /api/locations` | all / manager | building–floor–cupboard–rack zones |
| `GET /api/alerts`, `PATCH /api/alerts/{id}/resolve` | all | alert handling |
| `GET /api/checkouts`, `PATCH /api/checkouts/{id}/return` | all / manager | audit trail |
| `GET /api/stats/summary`, `GET /api/stats/read-rate` | all | dashboard data |
| `WS /ws/live` | all | live push (item status, checkouts, alerts) |

## Schema

`locations` (building, floor_number, cupboard_id, rack_id, zone_label) ·
`items` (epc UK, status, last_seen, location FK, is_consumable) ·
`read_events` (append-only audit: epc, read_at, rssi, antenna_port, reader) ·
`rfid_readers` · `alerts` · `users` (role, password_hash, card `epc`) ·
`checkouts` (session_id, user, item, from_location, taken_at, returned_at,
return_status).

Scaling to 9k items: the hot dashboard queries hit indexed columns on
`items`; `read_events` is the only fast-growing table — on PostgreSQL,
partition it by month and aggregate/purge raw events older than ~90 days.
