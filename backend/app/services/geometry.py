import hashlib
import hmac
import math
import statistics
from typing import Any, Dict, List, Optional, Tuple

from pyproj import CRS, Geod, Transformer
from shapely.geometry import Point, Polygon, mapping
from shapely.ops import transform
from shapely.strtree import STRtree

from app.config import settings

# WGS84 Reference Ellipsoid for all geodesic calculations (Part A Rule #3)
GEOD = Geod(ellps="WGS84")

SQM_PER_HECTARE = 10_000.0
SQM_PER_ACRE = 4_046.8564224


def get_utm_epsg_for_lon_lat(lon: float, lat: float) -> int:
    """Return the WGS84 UTM EPSG code for a given longitude and latitude (Nigeria spans 31N, 32N, 33N)."""
    zone = int((lon + 180.0) // 6.0) + 1
    zone = max(1, min(60, zone))
    return (32600 + zone) if lat >= 0 else (32700 + zone)


def get_utm_transformers(lon: float, lat: float) -> Tuple[Transformer, Transformer]:
    """Return forward (WGS84 -> UTM metres) and inverse (UTM metres -> WGS84) transformers."""
    epsg = get_utm_epsg_for_lon_lat(lon, lat)
    wgs84 = CRS.from_epsg(4326)
    utm = CRS.from_epsg(epsg)
    to_utm = Transformer.from_crs(wgs84, utm, always_xy=True)
    to_wgs84 = Transformer.from_crs(utm, wgs84, always_xy=True)
    return to_utm, to_wgs84


def filter_and_aggregate_gps_samples(
    samples: List[Dict[str, float]],
    max_accuracy_m: Optional[float] = None,
) -> Dict[str, Any]:
    """
    B2: Filter GPS watchPosition samples for a single corner.
    Discards samples with accuracy worse than max_accuracy_m (default 15m),
    and returns the median (lat, lon) and mean accuracy_m.
    """
    threshold = max_accuracy_m if max_accuracy_m is not None else settings.GPS_MAX_ACCURACY_M
    valid = [
        s
        for s in samples
        if float(s.get("accuracy_m", 999.0)) <= threshold
        and -90.0 <= float(s["lat"]) <= 90.0
        and -180.0 <= float(s["lon"]) <= 180.0
    ]
    if not valid:
        raise ValueError(
            f"No GPS samples met the required accuracy threshold (<= {threshold} m). "
            "Move to an open sky area or adjust the accuracy threshold."
        )

    median_lat = statistics.median(float(s["lat"]) for s in valid)
    median_lon = statistics.median(float(s["lon"]) for s in valid)
    mean_acc = statistics.mean(float(s["accuracy_m"]) for s in valid)

    return {
        "lat": round(median_lat, 8),
        "lon": round(median_lon, 8),
        "accuracy_m": round(mean_acc, 2),
        "total_samples": len(samples),
        "kept_samples": len(valid),
        "discarded_samples": len(samples) - len(valid),
    }


def geodesic_area_and_perimeter(coords_lon_lat: List[Tuple[float, float]]) -> Tuple[float, float]:
    """
    Compute geodesic area (m²) and perimeter (m) on the WGS84 ellipsoid using pyproj.Geod.
    No flat-earth approximations.
    """
    if len(coords_lon_lat) < 3:
        raise ValueError("At least 3 corners are required to form a polygon.")
    lons = [pt[0] for pt in coords_lon_lat]
    lats = [pt[1] for pt in coords_lon_lat]
    raw_area, perimeter = GEOD.polygon_area_perimeter(lons, lats)
    return abs(float(raw_area)), abs(float(perimeter))


def convert_area_units(area_m2: float, sqm_per_plot: float) -> Dict[str, float]:
    """
    B1: Convert area in m² to m², hectares, acres, and custom plots (sqm_per_plot).
    """
    if sqm_per_plot <= 0:
        raise ValueError("sqm_per_plot must be a positive number configured for the listing.")
    return {
        "m2": round(area_m2, 2),
        "hectares": round(area_m2 / SQM_PER_HECTARE, 6),
        "acres": round(area_m2 / SQM_PER_ACRE, 6),
        "plots": round(area_m2 / sqm_per_plot, 4),
    }


def compute_polygon_metrics(
    vertices: List[Dict[str, Any]],
    sqm_per_plot: float,
    measurement_method: str,
    declared_area_m2: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Validate polygon geometry, compute WGS84 geodesic area & perimeter,
    and compute inward/outward accuracy-buffered area uncertainty range (area_low_m2, area_high_m2).
    """
    if sqm_per_plot <= 0:
        raise ValueError("sqm_per_plot must be greater than 0 (no hardcoded default allowed).")

    if len(vertices) < settings.MIN_POLYGON_CORNERS:
        raise ValueError(f"At least {settings.MIN_POLYGON_CORNERS} corners are required.")

    # Extract ring (lon, lat) and accuracies
    ring_lon_lat: List[Tuple[float, float]] = []
    accuracies: List[float] = []

    default_acc = (
        settings.SATELLITE_DEFAULT_ACCURACY_M
        if measurement_method == "satellite_trace"
        else settings.SURVEYOR_PLAN_DEFAULT_ACCURACY_M
        if measurement_method == "surveyor_plan"
        else 5.0
    )

    for v in vertices:
        lat = float(v["lat"])
        lon = float(v["lon"])
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            raise ValueError(f"Invalid coordinate ({lat}, {lon}).")
        ring_lon_lat.append((lon, lat))
        acc = float(v.get("accuracy_m") or default_acc)
        accuracies.append(max(0.1, acc))

    # Deduplicate closing vertex if caller already closed the ring
    if len(ring_lon_lat) > 1 and ring_lon_lat[0] == ring_lon_lat[-1]:
        ring_lon_lat = ring_lon_lat[:-1]
        accuracies = accuracies[:-1]

    if len(ring_lon_lat) < settings.MIN_POLYGON_CORNERS:
        raise ValueError(f"At least {settings.MIN_POLYGON_CORNERS} distinct corners are required.")

    wgs84_poly = Polygon(ring_lon_lat)
    if not wgs84_poly.is_valid or wgs84_poly.is_empty:
        raise ValueError("Polygon is self-intersecting or geometrically invalid.")

    centroid_lon = float(wgs84_poly.centroid.x)
    centroid_lat = float(wgs84_poly.centroid.y)
    to_utm, to_wgs84 = get_utm_transformers(centroid_lon, centroid_lat)
    utm_poly = transform(to_utm.transform, wgs84_poly)

    if not utm_poly.is_valid or not utm_poly.exterior.is_simple:
        raise ValueError("Polygon boundary self-intersects.")

    computed_area_m2, computed_perimeter_m = geodesic_area_and_perimeter(ring_lon_lat)
    if computed_area_m2 < settings.MIN_PLOT_AREA_M2:
        raise ValueError(
            f"Polygon area ({computed_area_m2:.2f} m²) is too small (minimum {settings.MIN_PLOT_AREA_M2} m²)."
        )

    mean_accuracy_m = float(statistics.mean(accuracies))

    # Buffer outward (+mean_accuracy_m) and inward (-mean_accuracy_m) in local UTM metres (join_style=2 mitre)
    outward_utm = utm_poly.buffer(mean_accuracy_m, join_style=2)
    outward_wgs84 = transform(to_wgs84.transform, outward_utm)
    area_high_m2, _ = geodesic_area_and_perimeter(list(outward_wgs84.exterior.coords)[:-1])

    inward_utm = utm_poly.buffer(-mean_accuracy_m, join_style=2)
    if inward_utm.is_empty or inward_utm.geom_type != "Polygon" or inward_utm.area <= 0:
        area_low_m2 = 0.0
    else:
        inward_wgs84 = transform(to_wgs84.transform, inward_utm)
        area_low_m2, _ = geodesic_area_and_perimeter(list(inward_wgs84.exterior.coords)[:-1])

    # Ensure monotonic ordering
    area_low_m2 = min(area_low_m2, computed_area_m2)
    area_high_m2 = max(area_high_m2, computed_area_m2)

    declared_diff_pct: Optional[float] = None
    if declared_area_m2 and declared_area_m2 > 0:
        declared_diff_pct = round(abs(computed_area_m2 - declared_area_m2) / declared_area_m2, 4)

    return {
        "polygon_geojson": mapping(wgs84_poly),
        "centroid_lat": round(centroid_lat, 7),
        "centroid_lon": round(centroid_lon, 7),
        "mean_accuracy_m": round(mean_accuracy_m, 2),
        "computed_area_m2": round(computed_area_m2, 2),
        "area_low_m2": round(area_low_m2, 2),
        "area_high_m2": round(area_high_m2, 2),
        "computed_perimeter_m": round(computed_perimeter_m, 2),
        "sqm_per_plot": round(sqm_per_plot, 2),
        "units": {
            "nominal": convert_area_units(computed_area_m2, sqm_per_plot),
            "low": convert_area_units(area_low_m2, sqm_per_plot),
            "high": convert_area_units(area_high_m2, sqm_per_plot),
        },
        "declared_area_m2": declared_area_m2,
        "declared_vs_measured_diff_pct": declared_diff_pct,
        "confidence_label": (
            "Field GPS Walk (Medium-High Confidence)"
            if measurement_method == "gps_walk"
            else "Surveyor Plan Digitisation (Pending Admin Review)"
            if measurement_method == "surveyor_plan"
            else "Satellite Imagery Trace (Lower Confidence — Approximate)"
        ),
        "disclaimer": settings.MEASUREMENT_DISCLAIMER,
    }


def geodesic_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute WGS84 geodesic distance in metres between two (lat, lon) points."""
    _, _, dist_m = GEOD.inv(lon1, lat1, lon2, lat2)
    return abs(float(dist_m))


def distance_point_to_polygon_m(
    point_lat: float,
    point_lon: float,
    polygon_coords_lon_lat: List[Tuple[float, float]],
) -> float:
    """Compute metric distance from a GPS point to a polygon (0.0 if inside)."""
    poly_wgs84 = Polygon(polygon_coords_lon_lat)
    to_utm, _ = get_utm_transformers(float(poly_wgs84.centroid.x), float(poly_wgs84.centroid.y))
    poly_utm = transform(to_utm.transform, poly_wgs84)
    pt_utm = Point(*to_utm.transform(point_lon, point_lat))
    return round(float(poly_utm.distance(pt_utm)), 2)


def compute_fuzzed_coordinates(plot_id: str, lat: float, lon: float) -> Tuple[float, float]:
    """
    Part A #7 (NDPA 2023): Deterministically fuzz public coordinates by ~300 m
    so occupied homes never expose exact GPS coordinates publicly.
    """
    digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"fuzz:{plot_id}".encode("utf-8"),
        hashlib.sha256,
    ).digest()
    angle_deg = (int.from_bytes(digest[:4], "big") / 0xFFFFFFFF) * 360.0
    # Offset between 275 m and 325 m (centred at 300 m)
    dist_m = settings.PUBLIC_FUZZ_RADIUS_M - 25.0 + (int.from_bytes(digest[4:8], "big") / 0xFFFFFFFF) * 50.0
    fuzzed_lon, fuzzed_lat, _ = GEOD.fwd(lon, lat, angle_deg, dist_m)
    return round(float(fuzzed_lat), 6), round(float(fuzzed_lon), 6)


def make_rectangle_near(
    origin_lat: float,
    origin_lon: float,
    width_east_m: float,
    height_north_m: float,
) -> List[Tuple[float, float]]:
    """
    Helper to construct an exact geodesic rectangle of width_east_m x height_north_m
    starting from (origin_lat, origin_lon) on the WGS84 ellipsoid.
    Returns list of (lon, lat) vertices.
    """
    lon_se, lat_se, _ = GEOD.fwd(origin_lon, origin_lat, 90.0, width_east_m)
    lon_ne, lat_ne, _ = GEOD.fwd(lon_se, lat_se, 0.0, height_north_m)
    lon_nw, lat_nw, _ = GEOD.fwd(origin_lon, origin_lat, 0.0, height_north_m)
    return [
        (origin_lon, origin_lat),
        (lon_se, lat_se),
        (lon_ne, lat_ne),
        (lon_nw, lat_nw),
    ]


def detect_spatial_conflicts(
    candidate_id: str,
    candidate_coords_lon_lat: List[Tuple[float, float]],
    candidate_accuracy_m: float,
    existing_plots: List[Dict[str, Any]],
    overlap_threshold: Optional[float] = None,
    duplicate_distance_m: Optional[float] = None,
    duplicate_area_diff: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    B5: Overlap and duplicate detection using a spatial index (Shapely STRtree).
    - Buffers polygons by accuracy and compares against indexed plots.
    - Plots that only share a border (1D edge or 0D corner touch with zero interior overlap) do NOT flag.
    - Flags `possible_overlap` if intersection >= 10% (configurable) of the smaller polygon.
    - Flags `possible_duplicate` if centroids are within 30 m and areas within 10%.
    - Never uses the word "fraud".
    """
    ov_thresh = overlap_threshold if overlap_threshold is not None else settings.OVERLAP_RATIO_THRESHOLD
    dup_dist_thresh = (
        duplicate_distance_m if duplicate_distance_m is not None else settings.DUPLICATE_CENTROID_DISTANCE_M
    )
    dup_area_thresh = (
        duplicate_area_diff if duplicate_area_diff is not None else settings.DUPLICATE_AREA_DIFF_THRESHOLD
    )

    cand_wgs84 = Polygon(candidate_coords_lon_lat)
    cand_c_lon = float(cand_wgs84.centroid.x)
    cand_c_lat = float(cand_wgs84.centroid.y)
    cand_area_m2, _ = geodesic_area_and_perimeter(candidate_coords_lon_lat)

    to_utm, _ = get_utm_transformers(cand_c_lon, cand_c_lat)
    cand_utm = transform(to_utm.transform, cand_wgs84)
    cand_buf_utm = cand_utm.buffer(max(0.0, candidate_accuracy_m), join_style=2)

    other_records: List[Dict[str, Any]] = []
    other_buffered_geoms: List[Polygon] = []

    for item in existing_plots:
        if item["id"] == candidate_id:
            continue
        coords = item["coords_lon_lat"]
        poly_wgs84 = Polygon(coords)
        poly_utm = transform(to_utm.transform, poly_wgs84)
        acc = float(item.get("mean_accuracy_m", 0.0))
        buf_utm = poly_utm.buffer(max(0.0, acc), join_style=2)
        other_records.append(
            {
                "id": item["id"],
                "title": item.get("title", "Plot"),
                "wgs84": poly_wgs84,
                "utm": poly_utm,
                "buf_utm": buf_utm,
                "area_m2": float(item.get("computed_area_m2") or poly_utm.area),
                "centroid_lat": float(poly_wgs84.centroid.y),
                "centroid_lon": float(poly_wgs84.centroid.x),
            }
        )
        other_buffered_geoms.append(buf_utm)

    if not other_buffered_geoms:
        return []

    # Build R-tree spatial index over buffered geometries
    tree = STRtree(other_buffered_geoms)
    candidate_query_box = cand_buf_utm.buffer(dup_dist_thresh + 50.0)
    matched_indices = tree.query(candidate_query_box)

    flags: List[Dict[str, Any]] = []

    for idx in matched_indices:
        other = other_records[int(idx)]

        # 1. Check if the two unbuffered polygons ONLY share a border/corner or are disjoint.
        # Plots that only share a border (touches == True or unbuffered interior intersection == 0) must NOT flag.
        unbuffered_inter_area = cand_utm.intersection(other["utm"]).area
        shares_border_only = cand_utm.touches(other["utm"]) or unbuffered_inter_area < 1e-2

        smaller_area = min(cand_area_m2, other["area_m2"])
        if not shares_border_only and smaller_area > 0:
            # Compute overlap ratio on unbuffered and accuracy-buffered polygons
            unbuffered_ratio = unbuffered_inter_area / smaller_area
            buffered_inter_area = cand_buf_utm.intersection(other["buf_utm"]).area
            buffered_smaller = min(cand_buf_utm.area, other["buf_utm"].area)
            buffered_ratio = buffered_inter_area / buffered_smaller if buffered_smaller > 0 else 0.0

            effective_ratio = max(unbuffered_ratio, min(buffered_ratio, unbuffered_ratio * 1.25))
            if unbuffered_ratio >= ov_thresh or effective_ratio >= ov_thresh:
                ratio_val = round(unbuffered_ratio if unbuffered_ratio >= ov_thresh else effective_ratio, 4)
                flags.append(
                    {
                        "flag_type": "possible_overlap",
                        "conflicting_plot_id": other["id"],
                        "metric_value": ratio_val,
                        "public_summary": "May overlap another listing; an admin will review.",
                        "admin_detail": (
                            f"Possible overlap detected ({ratio_val * 100:.1f}% of smaller plot) "
                            f"between plot {candidate_id} and plot {other['id']} ({other['title']})."
                        ),
                    }
                )

        # 2. Check possible_duplicate: centroids within 30 m AND areas within 10%
        centroid_dist_m = geodesic_distance_m(
            cand_c_lat, cand_c_lon, other["centroid_lat"], other["centroid_lon"]
        )
        area_diff_ratio = (
            abs(cand_area_m2 - other["area_m2"]) / smaller_area if smaller_area > 0 else 1.0
        )
        if centroid_dist_m <= dup_dist_thresh and area_diff_ratio <= dup_area_thresh:
            flags.append(
                {
                    "flag_type": "possible_duplicate",
                    "conflicting_plot_id": other["id"],
                    "metric_value": round(centroid_dist_m, 2),
                    "public_summary": "Possible duplicate listing detected; an admin will review.",
                    "admin_detail": (
                        f"Possible duplicate detected: centroids are {centroid_dist_m:.1f} m apart "
                        f"and areas differ by {area_diff_ratio * 100:.1f}% with plot {other['id']} ({other['title']})."
                    ),
                }
            )

    return flags


# ==============================================================================
# PART C (PHASE 2): BUILDING FOOTPRINT CONTAINMENT & ROOM AREA SUM CHECKS
# ==============================================================================


def check_footprint_inside_plot(
    footprint_coords_lon_lat: List[Tuple[float, float]],
    plot_coords_lon_lat: List[Tuple[float, float]],
    tolerance_m: float = 0.25,
) -> Dict[str, Any]:
    """
    C1 Acceptance Criterion:
    The building footprint polygon must fall inside the linked plot polygon, otherwise flag.
    Returns `inside_plot` (bool), `outside_area_m2`, `outside_ratio`, and descriptive message.
    """
    footprint_wgs84 = Polygon(footprint_coords_lon_lat)
    plot_wgs84 = Polygon(plot_coords_lon_lat)

    c_lon = float(plot_wgs84.centroid.x)
    c_lat = float(plot_wgs84.centroid.y)
    to_utm, _ = get_utm_transformers(c_lon, c_lat)

    fp_utm = transform(to_utm.transform, footprint_wgs84)
    plot_utm = transform(to_utm.transform, plot_wgs84)

    # Allow sub-decimetre boundary touch tolerance
    plot_buffered_utm = plot_utm.buffer(max(0.0, tolerance_m))
    is_inside = bool(plot_buffered_utm.covers(fp_utm))

    outside_geom = fp_utm.difference(plot_buffered_utm)
    outside_area_m2 = float(outside_geom.area) if not outside_geom.is_empty else 0.0
    fp_area_m2 = max(1e-6, float(fp_utm.area))
    outside_ratio = round(outside_area_m2 / fp_area_m2, 4)

    if outside_ratio > 0.005:
        is_inside = False

    return {
        "footprint_inside_plot": is_inside,
        "footprint_area_m2": round(fp_area_m2, 2),
        "outside_area_m2": round(outside_area_m2, 2),
        "outside_ratio": outside_ratio,
        "flag_summary": (
            None
            if is_inside
            else (
                f"Building footprint extends outside the linked plot boundary "
                f"({outside_ratio * 100:.1f}% / {outside_area_m2:.1f} m² outside plot). Routed for admin review."
            )
        ),
    }


def evaluate_room_areas_vs_declared(
    rooms: List[Dict[str, float]],
    declared_unit_area_m2: Optional[float],
    threshold_ratio: Optional[float] = None,
) -> Dict[str, Any]:
    """
    C2 Acceptance Criterion:
    Compute area per room (length * width) and sum of room areas.
    Flag if the sum of room areas differs from the declared unit area by more than 20% (configurable).
    """
    thresh = threshold_ratio if threshold_ratio is not None else settings.ROOM_AREA_DIFF_THRESHOLD
    computed_rooms = []
    total_room_area = 0.0

    for rm in rooms:
        length_m = float(rm["length_m"])
        width_m = float(rm["width_m"])
        height_m = float(rm.get("height_m", 3.0))
        if length_m <= 0 or width_m <= 0 or height_m <= 0:
            raise ValueError("Room length, width, and height must be positive numbers.")
        area_m2 = round(length_m * width_m, 2)
        total_room_area += area_m2
        computed_rooms.append(
            {
                "room_name": rm.get("room_name", "Room"),
                "length_m": length_m,
                "width_m": width_m,
                "height_m": height_m,
                "computed_area_m2": area_m2,
                "measurement_source": rm.get("measurement_source", "manual"),
            }
        )

    total_room_area = round(total_room_area, 2)
    diff_ratio = 0.0
    flagged = False

    if declared_unit_area_m2 is not None and declared_unit_area_m2 > 0:
        diff_ratio = abs(total_room_area - declared_unit_area_m2) / declared_unit_area_m2
        flagged = diff_ratio > thresh

    return {
        "rooms": computed_rooms,
        "computed_room_area_sum_m2": total_room_area,
        "declared_area_m2": declared_unit_area_m2,
        "room_area_diff_pct": round(diff_ratio * 100.0, 2),
        "room_area_discrepancy_flagged": flagged,
    }


# ==============================================================================
# PART D (PHASE 3): INSPECTOR 100M GEOFENCE & PRICE PER M² BENCHMARKING (D1, D3)
# ==============================================================================


def verify_inspector_start_geofence(
    inspector_lat: float,
    inspector_lon: float,
    target_lat: float,
    target_lon: float,
    target_polygon_coords_lon_lat: Optional[List[Tuple[float, float]]] = None,
    max_distance_m: Optional[float] = None,
) -> Dict[str, Any]:
    """
    D1: Verify that the assigned inspector is within 100 m (configurable) of the target
    plot polygon or building entrance before starting an on-site inspection.
    """
    limit_m = max_distance_m if max_distance_m is not None else settings.INSPECTOR_START_GEOFENCE_M
    if target_polygon_coords_lon_lat and len(target_polygon_coords_lon_lat) >= 3:
        dist_m = distance_point_to_polygon_m(
            inspector_lat, inspector_lon, target_polygon_coords_lon_lat
        )
    else:
        dist_m = round(geodesic_distance_m(inspector_lat, inspector_lon, target_lat, target_lon), 2)

    within = dist_m <= limit_m
    return {
        "distance_to_target_m": dist_m,
        "max_allowed_distance_m": limit_m,
        "within_start_geofence": within,
    }


def _percentile(sorted_vals: List[float], pct: float) -> float:
    """Compute linear-interpolated percentile (0 <= pct <= 100) on a non-empty sorted list."""
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * (pct / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    d0 = sorted_vals[int(f)] * (c - k)
    d1 = sorted_vals[int(c)] * (k - f)
    return d0 + d1


def compute_price_benchmark(
    target_id: str,
    target_type: str,
    target_price_ngn: float,
    target_area_m2: float,
    target_lat: float,
    target_lon: float,
    target_state: str,
    target_lga: str,
    candidates: List[Dict[str, Any]],
    radius_km: Optional[float] = None,
    min_comps: Optional[int] = None,
    ngn_per_usd: Optional[float] = None,
) -> Dict[str, Any]:
    """
    D3: Price benchmarking per m² compared with comparable listings
    (same type, state/LGA, or within configurable geodesic radius, default 3 km).
    - With 8 or more comps (`min_comps = 8`), shows the percentile band (P5-P95, Q1-Q3, median)
      and flags extreme outliers (outside P5-P95).
    - With fewer than 8 comps, returns `status = "insufficient_data"`.
    - Always labelled "Indicative only — not a formal valuation."
    """
    rad_km = radius_km if radius_km is not None else settings.BENCHMARK_DEFAULT_RADIUS_KM
    req_comps = min_comps if min_comps is not None else settings.BENCHMARK_MIN_COMPS
    rate = ngn_per_usd if (ngn_per_usd and ngn_per_usd > 0) else settings.DEFAULT_NGN_PER_USD

    if target_area_m2 <= 0:
        raise ValueError("Target area must be positive to compute price per m².")

    target_ppm2_ngn = round(target_price_ngn / target_area_m2, 2)
    target_ppm2_usd = round(target_ppm2_ngn / rate, 2)

    matched_comps: List[Dict[str, Any]] = []
    for c in candidates:
        if c.get("id") == target_id:
            continue
        if c.get("type") != target_type:
            continue
        c_area = float(c.get("area_m2") or 0.0)
        c_price_ngn = float(c.get("price_ngn") or 0.0)
        if c_area <= 0 or c_price_ngn <= 0:
            continue

        dist_m = geodesic_distance_m(
            target_lat, target_lon, float(c["lat"]), float(c["lon"])
        )
        dist_km = round(dist_m / 1000.0, 2)
        same_lga = (
            str(c.get("state", "")).lower() == target_state.lower()
            and str(c.get("lga", "")).lower() == target_lga.lower()
        )
        if dist_km <= rad_km or same_lga:
            ppm2_ngn = round(c_price_ngn / c_area, 2)
            matched_comps.append(
                {
                    "id": c["id"],
                    "title": c.get("title", "Comparable Listing"),
                    "distance_km": dist_km,
                    "area_m2": round(c_area, 2),
                    "price_ngn": round(c_price_ngn, 2),
                    "price_per_m2_ngn": ppm2_ngn,
                    "price_per_m2_usd": round(ppm2_ngn / rate, 2),
                }
            )

    comp_count = len(matched_comps)
    if comp_count < req_comps:
        return {
            "target_id": target_id,
            "target_type": target_type,
            "status": "insufficient_data",
            "status_label": f"Insufficient data ({comp_count} of {req_comps} required comparable listings within {rad_km} km / {target_lga})",
            "label": "Indicative only — not a formal valuation.",
            "radius_km": rad_km,
            "required_minimum_comps": req_comps,
            "comparable_count": comp_count,
            "target_price_per_m2_ngn": target_ppm2_ngn,
            "target_price_per_m2_usd": target_ppm2_usd,
            "percentile_band": None,
            "is_extreme_outlier": False,
            "outlier_direction": None,
            "comparables": matched_comps,
        }

    sorted_ppm2 = sorted(item["price_per_m2_ngn"] for item in matched_comps)
    p5_ngn = round(_percentile(sorted_ppm2, 5.0), 2)
    p25_ngn = round(_percentile(sorted_ppm2, 25.0), 2)
    median_ngn = round(_percentile(sorted_ppm2, 50.0), 2)
    p75_ngn = round(_percentile(sorted_ppm2, 75.0), 2)
    p95_ngn = round(_percentile(sorted_ppm2, 95.0), 2)

    # Percentile rank of target among comparables
    less_or_equal = sum(1 for v in sorted_ppm2 if v <= target_ppm2_ngn)
    percentile_rank = round((less_or_equal / comp_count) * 100.0, 1)

    below_p5 = target_ppm2_ngn < p5_ngn
    above_p95 = target_ppm2_ngn > p95_ngn
    is_outlier = below_p5 or above_p95
    outlier_direction = (
        "below_p5" if below_p5 else "above_p95" if above_p95 else "within_p5_p95"
    )

    return {
        "target_id": target_id,
        "target_type": target_type,
        "status": "ok",
        "status_label": (
            f"Extreme outlier ({'Below P5' if below_p5 else 'Above P95'} percentile band)"
            if is_outlier
            else f"Within P5–P95 comparable band (P{int(round(percentile_rank))})"
        ),
        "label": "Indicative only — not a formal valuation.",
        "radius_km": rad_km,
        "required_minimum_comps": req_comps,
        "comparable_count": comp_count,
        "target_price_per_m2_ngn": target_ppm2_ngn,
        "target_price_per_m2_usd": target_ppm2_usd,
        "percentile_band": {
            "p5_ngn": p5_ngn,
            "q1_ngn": p25_ngn,
            "median_ngn": median_ngn,
            "q3_ngn": p75_ngn,
            "p95_ngn": p95_ngn,
            "p5_usd": round(p5_ngn / rate, 2),
            "q1_usd": round(p25_ngn / rate, 2),
            "median_usd": round(median_ngn / rate, 2),
            "q3_usd": round(p75_ngn / rate, 2),
            "p95_usd": round(p95_ngn / rate, 2),
            "percentile_rank": percentile_rank,
        },
        "is_extreme_outlier": is_outlier,
        "outlier_direction": outlier_direction,
        "comparables": matched_comps,
    }



