"""SQLAlchemy models implementing the agreed schema:

LOCATIONS, ITEMS, RFID_READERS, READ_EVENTS, ALERTS, USERS plus the
CHECKOUTS table for the Option B (proximity attribution) checkout flow.
"""
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (
        UniqueConstraint("building", "floor_number", "cupboard_id", "rack_id",
                         name="uq_location_address"),
    )

    location_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    building: Mapped[str] = mapped_column(String(50), index=True)
    floor_number: Mapped[int] = mapped_column(Integer, index=True)
    cupboard_id: Mapped[str] = mapped_column(String(50), index=True)
    rack_id: Mapped[str] = mapped_column(String(50))
    zone_label: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)

    items: Mapped[list["Item"]] = relationship(back_populates="location")

    @property
    def address(self) -> str:
        return f"{self.building} / F{self.floor_number} / {self.cupboard_id} / {self.rack_id}"


class Item(Base):
    __tablename__ = "items"

    item_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    epc: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(100), index=True)
    subcategory: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.location_id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    quantity_unit: Mapped[str] = mapped_column(String(20), default="pcs")
    is_consumable: Mapped[bool] = mapped_column(Boolean, default=False)
    # present | missing | checked-out | in-transit
    status: Mapped[str] = mapped_column(String(20), default="present", index=True)
    date_added: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime, index=True)

    location: Mapped[Location | None] = relationship(back_populates="items")


class RFIDReader(Base):
    __tablename__ = "rfid_readers"

    reader_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reader_name: Mapped[str] = mapped_column(String(100), unique=True)
    uri: Mapped[str | None] = mapped_column(String(200))
    location_hint: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ReadEvent(Base):
    __tablename__ = "read_events"

    event_id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True
    )
    epc: Mapped[str] = mapped_column(String(64), index=True)
    read_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    rssi: Mapped[float | None] = mapped_column(Float)
    antenna_port: Mapped[int | None] = mapped_column(Integer)
    reader_id: Mapped[int | None] = mapped_column(ForeignKey("rfid_readers.reader_id"))


class Alert(Base):
    __tablename__ = "alerts"

    alert_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # missing | low-stock | moved | reader-offline | unknown-tag
    alert_type: Mapped[str] = mapped_column(String(30), index=True)
    epc: Mapped[str | None] = mapped_column(String(64), index=True)
    message: Mapped[str] = mapped_column(Text)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    resolved_by: Mapped[str | None] = mapped_column(String(100))


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    full_name: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="worker")  # manager | worker
    password_hash: Mapped[str] = mapped_column(String(300))
    # EPC of the RFID tag on the worker's ID card (used for attribution).
    epc: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Checkout(Base):
    """Audit trail: who took what, from where, when — and whether it came back.

    Items disappearing within SESSION_WINDOW_S of each other while the same
    worker card is present share a session_id (one trip to the cupboard).
    """
    __tablename__ = "checkouts"

    checkout_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(String(40), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"))
    item_id: Mapped[int] = mapped_column(ForeignKey("items.item_id"))
    epc: Mapped[str] = mapped_column(String(64), index=True)
    from_location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.location_id"))
    antenna_port: Mapped[int | None] = mapped_column(Integer)
    taken_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime)
    # open | returned | consumed | written-off
    return_status: Mapped[str] = mapped_column(String(20), default="open", index=True)

    user: Mapped[User | None] = relationship()
    item: Mapped[Item] = relationship()
    from_location: Mapped[Location | None] = relationship()
