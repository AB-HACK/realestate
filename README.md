# AecrenEvidence — Evidence-First Nigerian Land & Property Platform (Phases 1, 2 & 3)

An evidence-first real estate registry designed for the Nigerian property market. Rather than making unverifiable claims of legal title (which requires state land registries such as Lagos Lands Bureau, AGIS Abuja, or Oyo Lands Registry), **AecrenEvidence** captures **verifiable physical evidence**, detects **spatial overlaps and duplicates**, links **built houses & units** to parent land plots, enforces **100 m geofenced field inspections & manual regulator checks**, and logs every action in a **tamper-evident SHA-256 hash chain**.

---

## Non-Negotiable Principles Enforced

1. **No Blanket "Verified" Badge**:
   - User-uploaded data is **never** labelled `"verified"`.
   - Allowed item statuses are strictly: `not_provided`, `uploaded`, `under_review`, `reviewed_by_admin`, and `externally_verified` (only permitted when an external registry search or licensed surveyor/solicitor report reference is attached and confirmed by an Admin).
2. **Careful Conflict Wording**:
   - Spatial or listing conflicts are always worded **`possible overlap`** or **`possible duplicate`**, never `"fraud"`.
3. **Mandatory Measurement Disclaimer**:
   - Every measurement and map view displays:
     > *"Approximate. Not a survey. A licensed surveyor's plan is the legal document."*
4. **Geodesic Math & Uncertainty Ranges**:
   - All polygon areas and perimeters are computed on the **WGS84 ellipsoid** (`pyproj.Geod(ellps="WGS84")` on the Python backend and authalic/ellipsoidal geodesic math on the frontend) — no flat-earth approximations.
   - Polygons are buffered inward and outward by the mean vertex accuracy (`±accuracy_m`) to display **`area_low_m2` – `area_high_m2`** uncertainty ranges alongside `m²`, `hectares`, `acres`, and custom `plots` (using a per-listing configurable `sqm_per_plot`, with no hardcoded default).
5. **Nigeria Data Protection Act (NDPA) 2023 Compliance**:
   - Minimal personal data collection with explicit recorded consent (`ndpa_consent_at` + version).
   - Occupied residential properties publicly display only an approximate **~300 m fuzzed location zone**.
   - Land title documents are stored in a **private vault** (`backend/private_vault/`) and served exclusively via short-lived **HMAC-SHA256 signed access tokens**, never public URLs.

---

## Satellite Imagery Provider Justification (B3)

- **Selected Provider**: **Esri World Imagery** (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`).
- **Why Esri World Imagery**: Esri's ArcGIS Online Master Agreement / Terms of Use explicitly permit interactive web mapping and vector digitizing/tracing over base tiles when attribution (*"Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"*) is visibly displayed (unlike Google Maps tiles, which prohibit derivative polygon tracing outside the Google Maps JS SDK). Polygon boundaries traced from satellite imagery are automatically badged `satellite_trace` with a **Lower Confidence** indicator.

---

## Security Notice: Client GPS Spoofing (B6)

> **Important Signal vs. Proof Distinction**: Client-side GNSS/GPS coordinates reported by mobile browsers (`navigator.geolocation`) and EXIF headers can be spoofed using mock-location apps or developer tools. Accordingly, in-app geotagged photos (`captured_in_app` within 50 m of the plot polygon) and GPS boundary walks (`gps_walk`) are treated as **physical consistency signals**, not standalone legal proof. Authoritative server timestamps, SHA-256 file hashes, and 64-bit perceptual hashes (`pHash`) are recorded on every capture to detect cross-listing image reuse.

---

## Architecture & Repository Structure

```text
realestate-1/
├── backend/
│   ├── app/
│   │   ├── config.py           # Configurable thresholds (15m GPS, 10% overlap, 30m duplicate, 300m NDPA fuzz)
│   │   ├── database.py         # SQLAlchemy 2.0 + SQLite/PostgreSQL append-only triggers on audit_events
│   │   ├── models.py           # User, ConsentRecord, Plot, EvidencePhoto, DocumentChecklistItem, SpatialFlag, AuditEvent
│   │   ├── schemas.py          # Pydantic v2 request/response schemas & validation
│   │   ├── main.py             # FastAPI endpoints with 6-role RBAC enforcement
│   │   └── services/
│   │       ├── geometry.py     # pyproj.Geod WGS84 area/perimeter, UTM buffer, Shapely STRtree spatial index
│   │       ├── audit.py        # Canonical JSON + SHA-256(prev_hash + payload) chain & /audit/verify
│   │       └── media.py        # SHA-256 + 64-bit perceptual hash (pHash) + HMAC signed private vault URLs
│   ├── tests/
│   │   └── test_phase1.py      # Automated pytest suite for geodesic math, overlap index, audit chain & RBAC
│   └── requirements.txt
└── src/
    ├── components/
    │   ├── evidence/
    │   │   ├── interactive-plot-map.tsx         # Esri World Imagery + polygon trace + side-by-side Admin conflict view
    │   │   ├── evidence-completeness-panel.tsx  # B9 Public Evidence Completeness Panel
    │   │   └── in-app-camera.tsx                # B6 getUserMedia + canvas compression + SHA256/pHash + fallback
    │   └── layout/
    │       ├── app-layout.tsx                   # Top bar with NGN (₦) <-> USD ($) switcher & 6-Role RBAC selector
    │       └── sidebar.tsx                      # Strict Evidence-First navigation
    ├── lib/
    │   ├── geodesic.ts                          # Client-side WGS84 geodesic engine & GPS sample median filter
    │   ├── nigeria-data.ts                      # Nigerian States/LGAs, status configs, mandatory disclaimers
    │   └── mock-data.ts                         # Pre-seeded Nigerian plots (Ibadan, Lekki, Maitama) & audit chain
    ├── pages/
    │   ├── dashboard/dashboard.tsx              # Evidence Overview Hub
    │   ├── properties/properties.tsx            # Land & Plot Evidence Registry
    │   ├── properties/property-form.tsx         # B1-B4 New Plot Evidence Wizard (GPS walk, Satellite trace, Surveyor plan)
    │   ├── properties/property-detail.tsx       # Plot Dossier, Geodesic Units, B6 Photos, B7 Vault, B9 Completeness
    │   ├── admin/admin-review.tsx               # B5 Side-by-Side Conflict Map & B7 Admin Document Review Queue
    │   ├── admin/audit-log.tsx                  # B8 Tamper-Evident Audit Chain Viewer & Row Tamper Simulator
    │   ├── documents/documents.tsx              # Private Vault Registry & Signed Access Tokens
    │   └── settings/settings.tsx                # NDPA 2023 Consent, Currency Rate & RBAC Switcher
    └── stores/
        ├── auth-store.ts                        # 6 RBAC roles (visitor, buyer_renter, owner, agent, inspector, admin)
        ├── currency-store.ts                    # Naira (₦) <-> US Dollar ($) live conversion store
        └── data-store.ts                        # Plot, Photo, Document, Spatial Conflict & Audit Chain state
```

---

## Environment Variables

Create a `.env` file (or rely on the defaults in `backend/app/config.py`):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./aecren_evidence.db` | SQLite default (or `postgresql://user:pass@localhost:5432/aecren` with PostGIS) |
| `SECRET_KEY` | `aecren-ndpa-2023-hmac-signing-secret-key` | HMAC signing key for private document vault URLs |
| `GPS_MAX_ACCURACY_M` | `15.0` | Discard GPS corner samples with accuracy worse than this threshold (m) |
| `OVERLAP_THRESHOLD_PCT` | `10.0` | Flag `possible_overlap` if buffered intersection ≥ 10% of smaller polygon |
| `DUPLICATE_CENTROID_M` | `30.0` | Flag `possible_duplicate` if centroids are within 30 m and areas within 10% |
| `SURVEYOR_AREA_DIFF_THRESHOLD_PCT` | `15.0` | Flag surveyor plan if stated vs measured area differs by > 15% |
| `PHOTO_GEOFENCE_M` | `50.0` | Maximum distance (m) from plot polygon for geofenced site photos |
| `NDPA_FUZZ_RADIUS_M` | `300.0` | Public coordinate fuzz radius (m) for occupied homes |
| `INSPECTOR_START_GEOFENCE_M` | `100.0` | Maximum distance (m) for an inspector to start an assigned field inspection (D1) |
| `BENCHMARK_DEFAULT_RADIUS_KM` | `3.0` | Default radius (km) for price-per-m² comparable search (D3) |
| `BENCHMARK_MIN_COMPS` | `8` | Minimum comparable listings required before showing P5–P95 bands (D3) |
| `MAX_UPLOAD_BYTES` | `10485760` | Maximum file upload size (10 MB) for vault documents & receipts (D6) |

---

## How to Run & View the Project

### 1. Start the Frontend (React + TypeScript + Vite)

```powershell
npm.cmd install
npm.cmd run dev
```
Open **`http://localhost:5173`** in your browser.
- Use the **Active Role** selector in the top header (or login page quick-select) to switch seamlessly between `admin`, `owner`, `agent`, `inspector`, `buyer_renter`, and `visitor`.
- Use the **Currency Switcher (`₦ NGN` ↔ `$ USD`)** in the top header to toggle all prices between Nigerian Naira and US Dollars.

### 2. Start the Python FastAPI Backend

```powershell
pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```
- Interactive OpenAPI documentation is served at **`http://localhost:8000/docs`**.

---

## How to Run Automated Tests

Run the Phase 1, Phase 2, and Phase 3 automated test suites (`pytest`):

```powershell
python -m pytest backend/tests/test_phase1.py backend/tests/test_phase2.py backend/tests/test_phase3.py -v
```

### What the Automated Tests Verify (Part B, Part C & Part D Acceptance Criteria):
1. **`test_ibadan_30x20_geodesic_rectangle_and_units`** (Phase 1):
   - Verifies that a 30 m × 20 m rectangle near Ibadan (`7.38°N, 3.90°E`) computes to **`600.0 m²` within 0.5%** (`597 m² – 603 m²`), and verifies `hectares` (`0.06`), `acres` (`0.1483`), and custom `plots` conversions.
2. **`test_gps_sample_filtering_and_self_intersection_rejection`** (Phase 1):
   - Verifies that GPS corner samples with accuracy `> 15 m` are discarded, median coordinates and mean accuracy are computed, and self-intersecting ("bowtie") polygons are rejected.
3. **`test_spatial_overlap_and_shared_border_non_flagging`** (Phase 1):
   - Verifies via `STRtree` spatial index that overlapping plots flag `possible_overlap`, while two adjacent plots that **only share a border** do **not** trigger a false overlap flag.
4. **`test_tamper_evident_audit_chain_and_tamper_detection`** (Phase 1):
   - Verifies that the SQLite `BEFORE UPDATE` trigger prevents normal mutation of `audit_events`, and when a row is altered at the raw storage level, **`/audit/verify` immediately fails** and reports the exact sequence number (`first_mismatch_seq = 1`).
5. **`test_rbac_document_promotion_and_photo_reuse_and_ndpa_fuzzing`** (Phase 1):
   - Verifies that owners cannot promote their own document statuses (`403 Forbidden`), `externally_verified` requires an external report reference, reused photo hashes are flagged across listings, and occupied home coordinates are fuzzed by ~300 m for public visitors.
6. **`test_acceptance_footprint_inside_plot`** (Phase 2 — C1):
   - Verifies that a building footprint polygon inside its linked plot polygon passes (`footprint_inside_plot = True`), while a building footprint protruding outside the linked plot polygon is automatically flagged (`footprint_inside_plot = False`).
7. **`test_acceptance_room_area_sum_vs_declared_unit_area`** (Phase 2 — C2):
   - Verifies that per-room `length × width × height` areas sum accurately and automatically flag when the sum of room areas differs from the declared unit area by `> 20%`.
8. **`test_acceptance_db_level_uniqueness_and_one_active_listing_rule`** (Phase 2 — C5):
   - Verifies both the **DB-level partial unique index** (`ix_one_active_primary_listing_per_unit` raising `IntegrityError` on duplicate active primary rows) and the application workflow (blocking a second unauthorized active listing with HTTP `409` and routing it to Admin as a conflicting claim, while linking an explicitly authorized agent's listing to the owner's).
9. **`test_condition_checklist_labels_and_ownership_and_monitoring_timeline`** (Phase 2 — C3, C6, C7):
   - Verifies `"self-declared"` vs `"inspected by <inspector>"` checklist labels, ownership claim timeline, and dated geotagged plot-to-building construction monitoring timeline.
10. **`test_d1_inspector_workflow_geofence_and_immutable_report`** (Phase 3 — D1):
    - Verifies that an inspector `> 100 m` away is blocked from starting an inspection (`400 Bad Request`), an inspector `<= 100 m` away starts and submits a report that is permanently anchored in the SHA-256 audit chain (`report_audit_hash`), and the buyer rates the completed inspection (`1–5` stars).
11. **`test_d2_agent_verification_rbac_and_exact_badge_text`** (Phase 3 — D2):
    - Verifies that an agent is blocked (`403 Forbidden`) from changing their own status, and when an Admin records a manual register check (`LASRERA`, `NIESV`, etc.), the badge text states **exactly** `"Registration number checked by admin on <YYYY-MM-DD>"`.
12. **`test_d3_price_benchmarking_min_8_comps_and_outliers`** (Phase 3 — D3):
    - Verifies that `< 8` comparable listings within the radius returns `"insufficient_data"`, while `>= 8` comparable listings computes the `P5–P95` percentile band, flags extreme outliers outside `P5–P95`, and includes `"Indicative only — not a formal valuation."`
13. **`test_d4_d5_d6_payment_receipts_suspicious_reports_and_upload_validation`** (Phase 3 — D4, D5, D6):
    - Verifies dual-party proof-of-payment receipt confirmation/dispute, suspicious listing reports routed to Admin review, upload MIME/size validation, Unified Admin Trust Overview metrics, and full SHA-256 audit chain integrity (`/audit/verify`).

---

## Known Limitations (Phases 1–3)

1. **No Direct State Registry Integration**: Because Nigerian state land registries do not expose public verification APIs, `externally_verified` relies on an Admin confirming a physical/official registry search report or SURCON surveyor report uploaded to the private vault.
2. **Client GNSS Hardware Variance**: Consumer smartphones typically achieve 3 m – 10 m horizontal GPS accuracy under open sky; hence every boundary measurement displays an explicit inward/outward buffered uncertainty range (`area_low_m2` – `area_high_m2`) and the mandatory legal disclaimer.
3. **Tamper-Evident vs. Tamper-Proof**: The SHA-256 hash chain in `audit_events` makes any database tampering immediately detectable via `/audit/verify`, though a superuser with raw disk access could theoretically rewrite the entire database file from genesis unless external anchor snapshots are exported periodically.

