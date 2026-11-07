import hashlib
import json
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEvent, utcnow_iso

GENESIS_PREV_HASH = "0" * 64


def canonicalize_payload(payload: Dict[str, Any]) -> str:
    """Serialize payload dictionary into deterministic canonical JSON."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def compute_event_hash(
    prev_hash: str,
    entity_type: str,
    entity_id: str,
    actor_id: Optional[str],
    event_type: str,
    canonical_payload_json: str,
    created_at: str,
) -> str:
    """
    B8: Compute SHA-256(prev_hash + canonical event envelope).
    Describes a tamper-evident hash chain where mutating any field breaks all subsequent hashes.
    """
    envelope = json.dumps(
        {
            "prev_hash": prev_hash,
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "actor_id": str(actor_id) if actor_id else None,
            "event_type": event_type,
            "payload_json": canonical_payload_json,
            "created_at": created_at,
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    message = f"{prev_hash}:{envelope}".encode("utf-8")
    return hashlib.sha256(message).hexdigest()


def append_audit_event(
    db: Session,
    entity_type: str,
    entity_id: str,
    event_type: str,
    payload: Dict[str, Any],
    actor_id: Optional[str] = None,
    actor_role: Optional[str] = None,
    created_at: Optional[str] = None,
) -> AuditEvent:
    """
    Append an immutable event to the audit_events chain.
    """
    last_event = db.execute(
        select(AuditEvent).order_by(AuditEvent.seq.desc()).limit(1)
    ).scalar_one_or_none()

    prev_hash = last_event.hash if last_event is not None else GENESIS_PREV_HASH
    ts = created_at or utcnow_iso()
    canonical_payload = canonicalize_payload(payload)
    event_hash = compute_event_hash(
        prev_hash=prev_hash,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        event_type=event_type,
        canonical_payload_json=canonical_payload,
        created_at=ts,
    )

    event_row = AuditEvent(
        entity_type=entity_type,
        entity_id=str(entity_id),
        actor_id=str(actor_id) if actor_id else None,
        actor_role=actor_role,
        event_type=event_type,
        payload_json=canonical_payload,
        created_at=ts,
        prev_hash=prev_hash,
        hash=event_hash,
    )
    db.add(event_row)
    db.flush()
    return event_row


def verify_audit_chain(db: Session) -> Dict[str, Any]:
    """
    B8: Recompute the entire SHA-256 hash chain from genesis and report the first mismatch.
    """
    events = (
        db.execute(select(AuditEvent).order_by(AuditEvent.seq.asc())).scalars().all()
    )

    expected_prev_hash = GENESIS_PREV_HASH
    expected_seq = 1

    for ev in events:
        if ev.seq != expected_seq:
            return {
                "valid": False,
                "description": "Tamper-evident hash chain verification failed (sequence gap detected).",
                "total_events": len(events),
                "first_mismatch_seq": ev.seq,
                "reason": f"Expected seq {expected_seq} but found {ev.seq} (possible row deletion).",
            }

        if ev.prev_hash != expected_prev_hash:
            return {
                "valid": False,
                "description": "Tamper-evident hash chain verification failed (broken prev_hash link).",
                "total_events": len(events),
                "first_mismatch_seq": ev.seq,
                "reason": (
                    f"Row seq={ev.seq} has prev_hash={ev.prev_hash[:16]}..., "
                    f"expected {expected_prev_hash[:16]}..."
                ),
            }

        # Verify canonical JSON integrity and recompute hash
        try:
            parsed = json.loads(ev.payload_json)
            re_canonical = canonicalize_payload(parsed)
        except Exception:
            return {
                "valid": False,
                "description": "Tamper-evident hash chain verification failed (corrupted payload JSON).",
                "total_events": len(events),
                "first_mismatch_seq": ev.seq,
                "reason": f"Row seq={ev.seq} contains invalid JSON payload.",
            }

        recomputed_hash = compute_event_hash(
            prev_hash=ev.prev_hash,
            entity_type=ev.entity_type,
            entity_id=ev.entity_id,
            actor_id=ev.actor_id,
            event_type=ev.event_type,
            canonical_payload_json=re_canonical,
            created_at=ev.created_at,
        )

        if recomputed_hash != ev.hash or re_canonical != ev.payload_json:
            return {
                "valid": False,
                "description": "Tamper-evident hash chain verification failed (hash mismatch).",
                "total_events": len(events),
                "first_mismatch_seq": ev.seq,
                "reason": (
                    f"Row seq={ev.seq} ({ev.event_type} on {ev.entity_type}:{ev.entity_id}) "
                    f"stored hash {ev.hash[:16]}... does not match recomputed hash {recomputed_hash[:16]}..."
                ),
            }

        expected_prev_hash = ev.hash
        expected_seq += 1

    return {
        "valid": True,
        "description": (
            "Tamper-evident audit log verified. All event hashes and prev_hash links match from genesis."
        ),
        "total_events": len(events),
        "first_mismatch_seq": None,
        "head_hash": expected_prev_hash if events else GENESIS_PREV_HASH,
        "reason": None,
    }

