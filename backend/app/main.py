import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import dispose_engine
from app.core.logging import setup_logging

from app.domains.firm.router import router as firm_router
from app.domains.reporting.router import router as reporting_router
from app.domains.documents.router import router as documents_router
from app.domains.activity.router import router as activity_router
from app.domains.evidence.router import router as evidence_router
from app.domains.engine.router import router as engine_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: configure centralized logging
    setup_logging(log_level=settings.LOG_LEVEL)
    logger = logging.getLogger("app.main")
    logger.info("QuadCore API starting up with log level: %s", settings.LOG_LEVEL)
    yield
    # Shutdown: cleanly close database connection pool
    logger.info("QuadCore API shutting down...")
    await dispose_engine()


app = FastAPI(
    title="QuadCore-Backend-API",
    description="Project Quadcore backend API",
    version="0.0.1",
    lifespan=lifespan,
)

logger = logging.getLogger("app.access")


# Request tracing and timing middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.perf_counter()

    logger.info(
        "Started %s %s [request_id=%s]",
        request.method,
        request.url.path,
        request_id,
    )

    response = await call_next(request)
    duration_ms = (time.perf_counter() - start_time) * 1000

    logger.info(
        "Completed %s %s | status=%d | duration=%.2fms [request_id=%s]",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request_id,
    )
    response.headers["X-Request-ID"] = request_id
    return response


# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health-check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Domain Routers
app.include_router(firm_router)
app.include_router(reporting_router)
app.include_router(documents_router)
app.include_router(activity_router)
app.include_router(evidence_router)
app.include_router(engine_router)