import os
from dataclasses import dataclass
from pathlib import Path

# Automatically load root .env file (which is gitignored) if present
_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
if _ROOT_ENV.exists():
    for _line in _ROOT_ENV.read_text(encoding="utf-8").splitlines():
        _stripped = _line.strip()
        if _stripped and not _stripped.startswith("#") and "=" in _stripped:
            _key, _val = _stripped.split("=", 1)
            os.environ.setdefault(_key.strip(), _val.strip())


@dataclass
class Settings:
    """Configurable system thresholds for Phase 1 Land Evidence (Part A & B)."""

    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./aecren_evidence.db")
    SECRET_KEY: str = os.getenv("AECREN_SECRET_KEY", "ndpa-2023-evidence-secret-key-change-in-prod")
    PRIVATE_VAULT_DIR: str = os.getenv(
        "PRIVATE_VAULT_DIR",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "private_vault")),
    )

    # B2: GPS Boundary Walk configurable thresholds
    GPS_MAX_ACCURACY_M: float = float(os.getenv("GPS_MAX_ACCURACY_M", "15.0"))
    GPS_SAMPLE_DURATION_S: int = int(os.getenv("GPS_SAMPLE_DURATION_S", "10"))
    MIN_POLYGON_CORNERS: int = int(os.getenv("MIN_POLYGON_CORNERS", "3"))
    MIN_PLOT_AREA_M2: float = float(os.getenv("MIN_PLOT_AREA_M2", "15.0"))

    # B3: Satellite trace default vertex uncertainty (metres)
    SATELLITE_DEFAULT_ACCURACY_M: float = float(os.getenv("SATELLITE_DEFAULT_ACCURACY_M", "3.5"))
    SURVEYOR_PLAN_DEFAULT_ACCURACY_M: float = float(os.getenv("SURVEYOR_PLAN_DEFAULT_ACCURACY_M", "0.75"))

    # B4: Surveyor plan stated vs measured area discrepancy threshold (15%)
    SURVEYOR_AREA_DIFF_THRESHOLD: float = float(os.getenv("SURVEYOR_AREA_DIFF_THRESHOLD", "0.15"))

    # B5: Spatial overlap & duplicate configurable thresholds
    OVERLAP_RATIO_THRESHOLD: float = float(os.getenv("OVERLAP_RATIO_THRESHOLD", "0.10"))
    DUPLICATE_CENTROID_DISTANCE_M: float = float(os.getenv("DUPLICATE_CENTROID_DISTANCE_M", "30.0"))
    DUPLICATE_AREA_DIFF_THRESHOLD: float = float(os.getenv("DUPLICATE_AREA_DIFF_THRESHOLD", "0.10"))

    # B6: Photo evidence configurable thresholds
    PHOTO_GEOFENCE_MAX_DISTANCE_M: float = float(os.getenv("PHOTO_GEOFENCE_MAX_DISTANCE_M", "50.0"))
    MIN_IN_APP_PHOTOS: int = int(os.getenv("MIN_IN_APP_PHOTOS", "4"))
    PHASH_HAMMING_THRESHOLD: int = int(os.getenv("PHASH_HAMMING_THRESHOLD", "6"))

    # Part A: Mandatory disclaimer & NDPA 2023 fuzzing
    MEASUREMENT_DISCLAIMER: str = (
        "Approximate. Not a survey. A licensed surveyor's plan is the legal document."
    )
    PUBLIC_FUZZ_RADIUS_M: float = float(os.getenv("PUBLIC_FUZZ_RADIUS_M", "300.0"))

    # Currency default exchange rate (NGN per 1 USD)
    DEFAULT_NGN_PER_USD: float = float(os.getenv("DEFAULT_NGN_PER_USD", "1600.0"))

    # Part C (Phase 2): Built Houses & Apartments configurable thresholds
    ROOM_AREA_DIFF_THRESHOLD: float = float(os.getenv("ROOM_AREA_DIFF_THRESHOLD", "0.20"))
    BUILDING_PHOTO_GEOFENCE_M: float = float(os.getenv("BUILDING_PHOTO_GEOFENCE_M", "50.0"))
    DEFAULT_REINSPECTION_DAYS: int = int(os.getenv("DEFAULT_REINSPECTION_DAYS", "90"))

    # Part D (Phase 3): Trust Layer configurable thresholds (D1 - D6)
    INSPECTOR_START_GEOFENCE_M: float = float(os.getenv("INSPECTOR_START_GEOFENCE_M", "100.0"))
    BENCHMARK_DEFAULT_RADIUS_KM: float = float(os.getenv("BENCHMARK_DEFAULT_RADIUS_KM", "3.0"))
    BENCHMARK_MIN_COMPS: int = int(os.getenv("BENCHMARK_MIN_COMPS", "8"))
    MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))  # 10 MB
    ALLOWED_UPLOAD_MIME_TYPES: tuple = (
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "video/mp4",
        "video/webm",
    )
    RATE_LIMIT_MAX_REQUESTS_PER_MINUTE: int = int(
        os.getenv("RATE_LIMIT_MAX_REQUESTS_PER_MINUTE", "120")
    )


settings = Settings()
os.makedirs(settings.PRIVATE_VAULT_DIR, exist_ok=True)

