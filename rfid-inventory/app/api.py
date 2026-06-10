"""REST API: items, locations, alerts, checkouts, stats, users, reader utils."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from . import auth, schemas
from .database import get_db
from .models import Alert, Checkout, Item, Location, ReadEvent, User
from .reader import service as reader_module

router = APIRouter(prefix="/api")


# --- auth -------------------------------------------------------------------
@router.post("/auth/login")
def login(body: schemas.LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if user is None or not auth.verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    response.set_cookie(
        auth.COOKIE_NAME, auth.make_token(user.user_id),
        httponly=True, samesite="lax",
    )
    return {"username": user.username, "role": user.role}


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(auth.COOKIE_NAME)
    return {"ok": True}


@router.get("/auth/me", response_model=schemas.UserOut)
def me(user: User = Depends(auth.current_user)):
    return user


# --- users (manager only) -----------------------------------------------------
@router.post("/users", response_model=schemas.UserOut, status_code=201)
def create_user(body: schemas.UserIn, db: Session = Depends(get_db),
                _: User = Depends(auth.manager_required)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = User(
        username=body.username, full_name=body.full_name, role=body.role,
        password_hash=auth.hash_password(body.password),
        epc=body.epc.upper() if body.epc else None,
    )
    db.add(user)
    db.commit()
    if reader_module.reader_service:
        reader_module.reader_service.refresh_epc_caches()
    return user


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(auth.manager_required)):
    return db.query(User).order_by(User.username).all()


# --- locations ----------------------------------------------------------------
@router.get("/locations", response_model=list[schemas.LocationOut])
def list_locations(db: Session = Depends(get_db), _: User = Depends(auth.current_user)):
    return db.query(Location).order_by(
        Location.building, Location.floor_number, Location.cupboard_id
    ).all()


@router.post("/locations", response_model=schemas.LocationOut, status_code=201)
def create_location(body: schemas.LocationIn, db: Session = Depends(get_db),
                    _: User = Depends(auth.manager_required)):
    location = Location(**body.model_dump())
    db.add(location)
    db.commit()
    return location


# --- items ----------------------------------------------------------------------
def _item_out(item: Item) -> schemas.ItemOut:
    out = schemas.ItemOut.model_validate(item)
    out.location_address = item.location.address if item.location else None
    return out


@router.get("/items", response_model=list[schemas.ItemOut])
def list_items(
    building: str | None = None,
    floor: int | None = None,
    cupboard: str | None = None,
    category: str | None = None,
    status: str | None = None,
    q: str | None = None,
    limit: int = 500,
    db: Session = Depends(get_db),
    _: User = Depends(auth.current_user),
):
    query = db.query(Item).options(joinedload(Item.location))
    if building or floor is not None or cupboard:
        query = query.join(Location)
        if building:
            query = query.filter(Location.building == building)
        if floor is not None:
            query = query.filter(Location.floor_number == floor)
        if cupboard:
            query = query.filter(Location.cupboard_id == cupboard)
    if category:
        query = query.filter(Item.category == category)
    if status:
        query = query.filter(Item.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(Item.name.ilike(like) | Item.epc.ilike(like))
    items = query.order_by(Item.name).limit(min(limit, 2000)).all()
    return [_item_out(i) for i in items]


@router.get("/items/{epc}", response_model=schemas.ItemOut)
def get_item(epc: str, db: Session = Depends(get_db),
             _: User = Depends(auth.current_user)):
    item = (db.query(Item).options(joinedload(Item.location))
            .filter(Item.epc == epc.upper()).first())
    if item is None:
        raise HTTPException(status_code=404, detail="Unknown EPC")
    return _item_out(item)


@router.post("/items", response_model=schemas.ItemOut, status_code=201)
def register_item(body: schemas.ItemIn, db: Session = Depends(get_db),
                  _: User = Depends(auth.manager_required)):
    epc = body.epc.upper()
    if db.query(Item).filter(Item.epc == epc).first():
        raise HTTPException(status_code=409, detail="EPC already registered")
    item = Item(**{**body.model_dump(), "epc": epc})
    db.add(item)
    db.commit()
    if reader_module.reader_service:
        reader_module.reader_service.refresh_epc_caches()
        # let the simulator "see" the freshly tagged item immediately
        backend = reader_module.reader_service.backend
        if hasattr(backend, "place_tag"):
            backend.place_tag(epc)
    db.refresh(item)
    return _item_out(item)


# --- reader helpers ----------------------------------------------------------
@router.get("/reader/scan")
def last_unknown_epc(_: User = Depends(auth.manager_required)):
    """Scan-to-register: returns the most recent EPC seen by the reader that
    is not yet a known item or worker card (hold the new tag at the antenna)."""
    service = reader_module.reader_service
    if service is None:
        raise HTTPException(status_code=503, detail="Reader service is off")
    if service.last_unknown is None:
        return {"epc": None}
    epc, seen_at = service.last_unknown
    if datetime.utcnow() - seen_at > timedelta(seconds=30):
        return {"epc": None}
    return {"epc": epc, "seen_at": seen_at.isoformat() + "Z"}


# --- alerts --------------------------------------------------------------------
@router.get("/alerts", response_model=list[schemas.AlertOut])
def list_alerts(include_resolved: bool = False, db: Session = Depends(get_db),
                _: User = Depends(auth.current_user)):
    query = db.query(Alert)
    if not include_resolved:
        query = query.filter(Alert.resolved.is_(False))
    return query.order_by(Alert.triggered_at.desc()).limit(200).all()


@router.patch("/alerts/{alert_id}/resolve", response_model=schemas.AlertOut)
def resolve_alert(alert_id: int, db: Session = Depends(get_db),
                  user: User = Depends(auth.current_user)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = user.username
    db.commit()
    return alert


# --- checkouts -------------------------------------------------------------------
@router.get("/checkouts", response_model=list[schemas.CheckoutOut])
def list_checkouts(open_only: bool = False, db: Session = Depends(get_db),
                   _: User = Depends(auth.current_user)):
    query = db.query(Checkout).options(
        joinedload(Checkout.user), joinedload(Checkout.item),
        joinedload(Checkout.from_location),
    )
    if open_only:
        query = query.filter(Checkout.return_status == "open")
    rows = query.order_by(Checkout.taken_at.desc()).limit(200).all()
    return [
        schemas.CheckoutOut(
            checkout_id=c.checkout_id, session_id=c.session_id, epc=c.epc,
            item_name=c.item.name if c.item else None,
            username=c.user.username if c.user else None,
            from_location=c.from_location.address if c.from_location else None,
            antenna_port=c.antenna_port, taken_at=c.taken_at,
            returned_at=c.returned_at, return_status=c.return_status,
        )
        for c in rows
    ]


@router.patch("/checkouts/{checkout_id}/return")
def mark_returned(checkout_id: int, db: Session = Depends(get_db),
                  _: User = Depends(auth.manager_required)):
    checkout = db.get(Checkout, checkout_id)
    if checkout is None:
        raise HTTPException(status_code=404, detail="Checkout not found")
    checkout.returned_at = datetime.utcnow()
    checkout.return_status = "returned"
    db.commit()
    return {"ok": True}


# --- stats -----------------------------------------------------------------------
@router.get("/stats/read-rate")
def read_rate(minutes: int = 60, db: Session = Depends(get_db),
              _: User = Depends(auth.current_user)):
    """Reads-per-minute for the rolling chart."""
    since = datetime.utcnow() - timedelta(minutes=min(minutes, 24 * 60))
    if db.bind.dialect.name == "sqlite":
        minute = func.strftime("%H:%M", ReadEvent.read_at)
    else:
        minute = func.to_char(ReadEvent.read_at, "HH24:MI")
    rows = (
        db.query(minute, func.count(ReadEvent.event_id))
        .filter(ReadEvent.read_at >= since)
        .group_by(minute)
        .order_by(minute)
        .all()
    )
    return {"buckets": {m: c for m, c in rows}}


@router.get("/stats/summary")
def summary(db: Session = Depends(get_db), _: User = Depends(auth.current_user)):
    total = db.query(func.count(Item.item_id)).scalar()
    by_status = dict(
        db.query(Item.status, func.count(Item.item_id)).group_by(Item.status).all()
    )
    open_alerts = db.query(func.count(Alert.alert_id)).filter(
        Alert.resolved.is_(False)).scalar()
    open_checkouts = db.query(func.count(Checkout.checkout_id)).filter(
        Checkout.return_status == "open").scalar()
    return {
        "total_items": total,
        "present": by_status.get("present", 0),
        "checked_out": by_status.get("checked-out", 0),
        "missing": by_status.get("missing", 0),
        "open_alerts": open_alerts,
        "open_checkouts": open_checkouts,
    }
