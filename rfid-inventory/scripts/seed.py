"""Create tables and seed the pilot dataset: locations, ~55 items, users.

Usage:  python -m scripts.seed            (from the rfid-inventory directory)
"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import Item, Location, User

CATEGORIES = {
    "Hand Tools": ["Torque Wrench", "Screwdriver Set", "Pliers", "Hammer", "Allen Key Set"],
    "Power Tools": ["Drill Machine", "Angle Grinder", "Heat Gun", "Soldering Station"],
    "Measurement": ["Multimeter", "Oscilloscope Probe", "Vernier Caliper", "Micrometer"],
    "Consumables": ["Solder Wire Spool", "Cable Ties Pack", "Insulation Tape", "Fuse Box"],
    "Safety": ["Safety Helmet", "Welding Gloves", "Face Shield", "Ear Muffs"],
}


def fake_epc(n: int) -> str:
    """96-bit EPC-looking hex string, deterministic per index."""
    return f"E28011{n:018X}"


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Item).count() > 0:
            print("Database already seeded, nothing to do.")
            return

        locations = []
        for floor in (1, 2):
            for cupboard_n in range(1, 4):
                for rack_n in range(1, 3):
                    locations.append(Location(
                        building="Main Block",
                        floor_number=floor,
                        cupboard_id=f"C-{floor}{cupboard_n:02d}",
                        rack_id=f"R-{rack_n}",
                        zone_label="Tool Crib A" if floor == 1 and cupboard_n == 1 else None,
                    ))
        db.add_all(locations)
        db.flush()

        items = []
        n = 0
        for category, names in CATEGORIES.items():
            for name in names:
                for copy in range(1, 4):  # 3 copies of each -> ~57 items
                    n += 1
                    items.append(Item(
                        epc=fake_epc(n),
                        name=f"{name} #{copy}",
                        category=category,
                        is_consumable=(category == "Consumables"),
                        quantity=random.randint(1, 20) if category == "Consumables" else 1,
                        location_id=random.choice(locations).location_id,
                        status="present",
                    ))
        db.add_all(items)

        db.add_all([
            User(username="manager", full_name="Main Manager", role="manager",
                 password_hash=hash_password("manager123")),
            User(username="worker1", full_name="Worker One", role="worker",
                 password_hash=hash_password("worker123"),
                 epc="E280AA000000000000000001"),
            User(username="worker2", full_name="Worker Two", role="worker",
                 password_hash=hash_password("worker123"),
                 epc="E280AA000000000000000002"),
        ])
        db.commit()
        print(f"Seeded {len(locations)} locations, {len(items)} items, 3 users.")
        print("Logins:  manager / manager123   |   worker1 / worker123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
