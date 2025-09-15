import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse

from app.routers.llm import router as llm_router


def get_cors_origins():
    raw = os.environ.get("CORS_ORIGINS", "")
    if not raw.strip():
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


def create_app() -> FastAPI:
    limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])  # 60 req/min per IP

    app = FastAPI(title="Studiebot Backend", version="1.0.0")
    app.state.limiter = limiter

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting middleware
    app.add_middleware(SlowAPIMiddleware)

    # Exception handler for rate limit
    @app.exception_handler(RateLimitExceeded)
    def _rate_limit_handler(request: Request, exc: RateLimitExceeded):  # type: ignore
        return JSONResponse(status_code=429, content={"error": "rate_limited"})

    # Mount routers
    app.include_router(llm_router, prefix="/api/llm", tags=["llm"])

    return app


app = create_app()