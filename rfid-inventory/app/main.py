import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from . import api, auth, config
from .database import Base, engine
from .events import event_hub
from .reader import service as reader_module

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("rfid")

STATIC_DIR = Path(__file__).parent / "static"
TEMPLATES_DIR = Path(__file__).parent / "templates"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    event_hub.set_loop(asyncio.get_running_loop())
    service = reader_module.create_service()
    if service is not None:
        service.start()
    yield
    if service is not None:
        service.stop()


app = FastAPI(title="RFID Inventory", lifespan=lifespan)
app.include_router(api.router)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", response_class=HTMLResponse)
def dashboard():
    return (TEMPLATES_DIR / "dashboard.html").read_text()


@app.get("/login", response_class=HTMLResponse)
def login_page():
    return (TEMPLATES_DIR / "login.html").read_text()


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    # cookie-authenticated, same as the REST API
    token = websocket.cookies.get(auth.COOKIE_NAME)
    if token is None or auth.parse_token(token) is None:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    queue = event_hub.subscribe()
    try:
        while True:
            message = await queue.get()
            await websocket.send_text(message)
    except WebSocketDisconnect:
        pass
    finally:
        event_hub.unsubscribe(queue)
