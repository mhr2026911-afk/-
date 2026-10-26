"""Pytest fixtures for the Mersal API.

The tests never touch the application database: ``DATABASE_URL`` is rewritten
to a disposable ``<db>_test`` database that is created on demand and truncated
after every test.
"""

import os
from urllib.parse import urlsplit, urlunsplit

import psycopg
import pytest
from psycopg import sql


def _database_url() -> str:
    return os.environ.get("TEST_DATABASE_URL") or os.environ["DATABASE_URL"]


def _split(base: str):
    parts = urlsplit(base)
    name = (parts.path or "/mersal").lstrip("/")
    if not name.endswith("_test"):
        name = f"{name}_test"
    return name, parts


def _libpq_url(url: str) -> str:
    return url.replace("postgresql+psycopg://", "postgresql://")


DB_NAME, _PARTS = _split(_database_url())
TEST_URL = urlunsplit(_PARTS._replace(path=f"/{DB_NAME}"))

# app.config reads the environment at import time, so prepare it before the
# application modules are imported.
os.environ["DATABASE_URL"] = TEST_URL
os.environ["MEDIA_DIR"] = os.environ.get("TEST_MEDIA_DIR", "/tmp/mersal-media-test")
os.environ["BASE44_PREVIEW_MODE"] = "1"  # the tests rely on dev_code
os.environ.setdefault("SECRET_KEY", "mersal-test-secret")


def _ensure_database() -> None:
    admin = urlunsplit(_PARTS._replace(path="/postgres"))
    with psycopg.connect(_libpq_url(admin), autocommit=True) as conn:
        exists = conn.execute(
            "select 1 from pg_database where datname = %s", (DB_NAME,)
        ).fetchone()
        if not exists:
            conn.execute(sql.SQL("create database {}").format(sql.Identifier(DB_NAME)))


_ensure_database()


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _clean_database(client):
    yield
    from sqlalchemy import text

    from app.db import engine
    from app.models import Base

    tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
