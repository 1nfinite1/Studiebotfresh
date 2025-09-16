"""
Server entry point for the FastAPI backend.
This module imports and exposes the FastAPI app instance for uvicorn.
"""

from app.main import app

__all__ = ["app"]