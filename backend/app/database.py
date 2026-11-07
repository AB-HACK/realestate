from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def install_append_only_audit_triggers(db_engine):
    """Install DB-level triggers to prevent UPDATE or DELETE on audit_events where supported."""
    dialect = db_engine.dialect.name
    with db_engine.begin() as conn:
        if dialect == "sqlite":
            conn.execute(
                text(
                    """
                    CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_update
                    BEFORE UPDATE ON audit_events
                    BEGIN
                        SELECT RAISE(ABORT, 'audit_events is append-only: UPDATE is prohibited');
                    END;
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_delete
                    BEFORE DELETE ON audit_events
                    BEGIN
                        SELECT RAISE(ABORT, 'audit_events is append-only: DELETE is prohibited');
                    END;
                    """
                )
            )
        elif dialect == "postgresql":
            conn.execute(
                text(
                    """
                    CREATE OR REPLACE FUNCTION prevent_audit_mutation()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        RAISE EXCEPTION 'audit_events is append-only: % is prohibited', TG_OP;
                    END;
                    $$ LANGUAGE plpgsql;
                    """
                )
            )
            conn.execute(
                text(
                    """
                    DROP TRIGGER IF EXISTS trg_audit_events_no_mutation ON audit_events;
                    CREATE TRIGGER trg_audit_events_no_mutation
                    BEFORE UPDATE OR DELETE ON audit_events
                    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
                    """
                )
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

