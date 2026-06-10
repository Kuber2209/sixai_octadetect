from datetime import datetime

from pydantic import BaseModel, Field


class LocationIn(BaseModel):
    building: str
    floor_number: int
    cupboard_id: str
    rack_id: str
    zone_label: str | None = None
    description: str | None = None


class LocationOut(LocationIn):
    location_id: int
    address: str

    class Config:
        from_attributes = True


class ItemIn(BaseModel):
    epc: str = Field(min_length=4, max_length=64)
    name: str
    category: str | None = None
    subcategory: str | None = None
    description: str | None = None
    location_id: int | None = None
    quantity: int = 1
    quantity_unit: str = "pcs"
    is_consumable: bool = False


class ItemOut(BaseModel):
    item_id: int
    epc: str
    name: str
    category: str | None
    subcategory: str | None
    description: str | None
    location_id: int | None
    location_address: str | None = None
    quantity: int
    quantity_unit: str
    is_consumable: bool
    status: str
    date_added: datetime
    last_seen: datetime | None

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    alert_id: int
    alert_type: str
    epc: str | None
    message: str
    triggered_at: datetime
    resolved: bool
    resolved_at: datetime | None
    resolved_by: str | None

    class Config:
        from_attributes = True


class CheckoutOut(BaseModel):
    checkout_id: int
    session_id: str
    epc: str
    item_name: str | None = None
    username: str | None = None
    from_location: str | None = None
    antenna_port: int | None
    taken_at: datetime
    returned_at: datetime | None
    return_status: str


class LoginIn(BaseModel):
    username: str
    password: str


class UserIn(BaseModel):
    username: str
    password: str
    full_name: str | None = None
    role: str = "worker"
    epc: str | None = None


class UserOut(BaseModel):
    user_id: int
    username: str
    full_name: str | None
    role: str
    epc: str | None

    class Config:
        from_attributes = True
