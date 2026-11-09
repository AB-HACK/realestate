# AecrenEvidence Hardening & Core-Focus Cleanup Log

This document records every stage's baseline findings, architectural changes, test results, and verification steps on the `cleanup/core-focus` branch.

---

## Stage 0: Baseline and Safety

### 1. Baseline Test Results
- **Command**: `python -m pytest backend/tests/test_phase1.py backend/tests/test_phase2.py backend/tests/test_phase3.py -v`
- **Outcome**: **`13 passed, 56 warnings in 3.69s`**
  - `backend/tests/test_phase1.py`: 5/5 passed
    - `test_acceptance_ibadan_30x20_rectangle_and_unit_conversions`
    - `test_gps_boundary_walk_sample_filtering`
    - `test_acceptance_overlap_vs_shared_border_and_duplicate_detection`
    - `test_acceptance_audit_chain_tamper_detection`
    - `test_rbac_document_status_rules_and_photo_reuse_and_ndpa_fuzzing`
  - `backend/tests/test_phase2.py`: 4/4 passed
    - `test_acceptance_footprint_inside_plot`
    - `test_acceptance_room_area_sum_vs_declared_unit_area`
    - `test_acceptance_db_level_uniqueness_and_one_active_listing_rule`
    - `test_condition_checklist_labels_and_ownership_and_monitoring_timeline`
  - `backend/tests/test_phase3.py`: 4/4 passed
    - `test_d1_inspector_100m_geofence_and_immutable_audit_report`
    - `test_d2_agent_verification_exact_badge_and_no_self_approval`
    - `test_d3_price_benchmarking_min_8_comps_and_p5_p95_outlier`
    - `test_d4_d5_d6_payment_receipt_trail_suspicious_reports_and_upload_validation`
- **Observed Warnings**: 56 `DeprecationWarning` instances from `shapely.ops.transform()` in `backend/app/services/geometry.py` (to be replaced with `shapely.transform()` in Stage 1).

---

### 2. Stage 0 "VERIFY FIRST" Audit Findings

#### (a) How database tables are created (`create_all` vs migrations)
- No Alembic migrations exist in the repository.
- Database tables and SQLite append-only triggers are created dynamically on import/startup inside `init_and_seed_db()` in `backend/app/main.py` (`lines 116–120`):
  - `Base.metadata.create_all(bind=engine)`
  - `install_append_only_audit_triggers(engine)`
- Existing pytest suites (`test_phase1.py`, `test_phase2.py`, `test_phase3.py`) create local SQLite files (`test_aecren_phase1.db`, etc.) in the working directory and write uploaded test files into `backend/private_vault/` (to be isolated via `tmp_path` fixtures in Stage 1).

#### (b) Whether `RATE_LIMIT_MAX_REQUESTS_PER_MINUTE` is actually enforced anywhere
- `RATE_LIMIT_MAX_REQUESTS_PER_MINUTE` (default `120` in `backend/app/config.py`) is read by `enforce_rate_limit(actor_id)` in `backend/app/main.py` (`lines 1949–1968`) using an in-memory dictionary (`_RATE_LIMIT_BUCKETS`).
- However, it is only called on 3 Phase-3 endpoints:
  1. `POST /api/v1/inspections` (`main.py:2013`)
  2. `POST /api/v1/payment-receipts` (`main.py:2522`)
  3. `POST /api/v1/reports/suspicious` (`main.py:2648`)
- Because it keys by `actor["id"]` taken from the unauthenticated `X-Actor-Id` request header, any caller can bypass it by changing the header, and none of the core endpoints or authentication routes enforce it.

#### (c) Locations of payment, ownership-claim, monitoring, and benchmark UI sections
1. **`src/pages/properties/property-detail.tsx`**:
   - **Benchmark & Suspicious Report UI (`D3 & D6`)**: Lines `322–327` render `<PriceBenchmarkCard targetType="plot" targetId={plot.id} targetTitle={plot.title} />` (defined in `src/components/evidence/price-benchmark-card.tsx`).
2. **`src/pages/buildings/building-detail.tsx`**:
   - **Benchmark & Suspicious Report UI (`D3 & D6`)**: Lines `303–308` render `<PriceBenchmarkCard targetType="building" targetId={bld.id} targetTitle={bld.title} />`.
   - **Agent Authorization UI (`C5`)**: Lines `445–572` inside the unit card render the *"1. Owner Authorize Agent"* and *"2. List as Authorized Agent"* controls.
   - **Ownership / Status Claim Timeline (`C6`)**: Lines `776–879` render the `C6. Ownership & Status Claim Timeline` card and form (`handleAddOwnershipClaim`, `adminReviewOwnershipClaim`).
   - **Construction & Maintenance Monitoring Timeline (`C7`)**: Lines `881–967` render the `C7. Construction & Maintenance Monitoring Timeline` card and form (`handleAddMonitoring`).
3. **`src/pages/dashboard/dashboard.tsx`**:
   - **Phase 3 Trust Layer Quick Access Cards (`D1, D2, D4`)**: Lines `197–252` render the 3-column grid linking to `/inspections` (`D1`), `/agents` (`D2`), and `/documents` (`D4`).
4. **Additional Locations**:
   - **Proof-of-Payment Receipt Ledger (`D4`)**: `src/pages/documents/documents.tsx` (`lines 211–395`).
   - **Admin Trust Overview & Suspicious Reports Queue (`D5 & D6`)**: `src/pages/admin/admin-review.tsx` (`lines 92–157` metrics bar and `lines 489–594` suspicious reports queue).

