"""Guards for _run_migrations.

Regression: is_demo was declared INTEGER for every dialect. That is right on
SQLite, where booleans are integers, but on PostgreSQL it creates a real
integer column while models/user.py maps the attribute to Boolean. Every
INSERT then fails with

    column "is_demo" is of type integer but expression is of type boolean

which broke registration outright on Postgres deployments. It stayed hidden
because the demo instance drops and recreates its schema nightly, so it gets
the column from create_all (boolean) and never runs the migration.
"""

from types import SimpleNamespace

import main


def _statements(dialect: str, monkeypatch) -> list[str]:
    """Collect the SQL _run_migrations would execute for a given dialect."""
    captured: list[str] = []

    class _FakeConn:
        def execute(self, stmt):
            captured.append(str(stmt))

        def commit(self):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    engine_stub = SimpleNamespace(
        dialect=SimpleNamespace(name=dialect),
        connect=_FakeConn,
    )
    monkeypatch.setattr(main, "engine", engine_stub)
    main._run_migrations()
    return captured


def test_is_demo_is_boolean_on_postgres(monkeypatch):
    sql = " ".join(_statements("postgresql", monkeypatch))
    assert "is_demo BOOLEAN" in sql
    assert "is_demo INTEGER" not in sql


def test_is_demo_stays_integer_on_sqlite(monkeypatch):
    # SQLite has no boolean type; INTEGER is the correct declaration there.
    sql = " ".join(_statements("sqlite", monkeypatch))
    assert "is_demo INTEGER" in sql


def test_postgres_repairs_an_existing_integer_column(monkeypatch):
    sql = " ".join(_statements("postgresql", monkeypatch))
    assert "TYPE boolean USING is_demo <> 0" in sql
    # Guarded, so it is a no-op rather than an error once already converted.
    assert "data_type = 'integer'" in sql


def test_sqlite_does_not_attempt_the_postgres_repair(monkeypatch):
    sql = " ".join(_statements("sqlite", monkeypatch))
    assert "DO $$" not in sql
