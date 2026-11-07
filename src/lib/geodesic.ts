import { PlotVertex } from '../types';

export interface GpsSample {
  lat: number;
  lon: number;
  accuracy_m: number;
  timestamp: number;
}

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);
const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Local meridional & prime-vertical curvature radii at reference latitude on WGS84 ellipsoid
function getLocalMetreRadii(latDeg: number): { mPerDegLat: number; mPerDegLon: number } {
  const phi = degToRad(latDeg);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const denom = Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);

  // Meridional radius of curvature M
  const M = (WGS84_A * (1 - WGS84_E2)) / Math.pow(denom, 3);
  // Prime vertical radius of curvature N
  const N = WGS84_A / denom;

  return {
    mPerDegLat: M * (Math.PI / 180),
    mPerDegLon: N * cosPhi * (Math.PI / 180),
  };
}

export function projectToLocalMetres(
  vertices: Array<{ lat: number; lon: number }>,
  originLat?: number,
  originLon?: number
): Array<{ x: number; y: number }> {
  const refLat =
    originLat ?? vertices.reduce((s, v) => s + v.lat, 0) / Math.max(1, vertices.length);
  const refLon =
    originLon ?? vertices.reduce((s, v) => s + v.lon, 0) / Math.max(1, vertices.length);
  const { mPerDegLat, mPerDegLon } = getLocalMetreRadii(refLat);

  return vertices.map((v) => ({
    x: (v.lon - refLon) * mPerDegLon,
    y: (v.lat - refLat) * mPerDegLat,
  }));
}

function segmentsProperlyIntersect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): boolean {
  const ccw = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) =>
    (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

export function isPolygonSelfIntersecting(pts: Array<{ x: number; y: number }>): boolean {
  const n = pts.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      // Skip adjacent edges sharing a vertex
      if (i === 0 && j === n - 1) continue;
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

export function computePolygonAreaAndPerimeterXY(pts: Array<{ x: number; y: number }>): {
  areaM2: number;
  perimeterM: number;
} {
  const n = pts.length;
  let twoArea = 0;
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    twoArea += p1.x * p2.y - p2.x * p1.y;
    perimeter += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }
  return {
    areaM2: Math.abs(twoArea) / 2,
    perimeterM: perimeter,
  };
}

export function computePlotGeometryMetrics(
  vertices: PlotVertex[],
  sqmPerPlot: number,
  minAreaM2: number = 15.0
) {
  if (vertices.length < 3) {
    throw new Error('At least 3 corners are required to form a plot polygon.');
  }
  if (!sqmPerPlot || sqmPerPlot <= 0) {
    throw new Error('A positive sqm_per_plot value is required for plot unit conversion.');
  }

  const xy = projectToLocalMetres(vertices);
  if (isPolygonSelfIntersecting(xy)) {
    throw new Error(
      'Polygon edges self-intersect. Please walk or trace corners in sequential perimeter order.'
    );
  }

  const { areaM2, perimeterM } = computePolygonAreaAndPerimeterXY(xy);
  if (areaM2 < minAreaM2) {
    throw new Error(
      `Computed polygon area (${areaM2.toFixed(1)} m²) is below the minimum valid threshold (${minAreaM2} m²).`
    );
  }

  const meanAcc =
    vertices.reduce((sum, v) => sum + (v.accuracy_m || 3.5), 0) / vertices.length;

  // Inward and outward buffer approximation on local planar polygon:
  // A(d) ≈ A ± P*d + π*d²
  const areaLow = Math.max(0, areaM2 - perimeterM * meanAcc + Math.PI * meanAcc * meanAcc * 0.25);
  const areaHigh = areaM2 + perimeterM * meanAcc + Math.PI * meanAcc * meanAcc;

  return {
    computed_area_m2: Number(areaM2.toFixed(2)),
    computed_perimeter_m: Number(perimeterM.toFixed(2)),
    area_low_m2: Number(areaLow.toFixed(2)),
    area_high_m2: Number(areaHigh.toFixed(2)),
    computed_area_hectares: Number((areaM2 / 10000).toFixed(6)),
    computed_area_acres: Number((areaM2 / 4046.8564224).toFixed(6)),
    computed_area_plots: Number((areaM2 / sqmPerPlot).toFixed(4)),
    mean_vertex_accuracy_m: Number(meanAcc.toFixed(2)),
  };
}

// B2: Filter GPS samples (>maxAllowedAccuracyM discarded), return median position & mean accuracy
export function processGpsCornerSamples(
  samples: GpsSample[],
  maxAllowedAccuracyM: number = 15.0
): PlotVertex {
  const valid = samples.filter((s) => s.accuracy_m <= maxAllowedAccuracyM);
  if (valid.length === 0) {
    throw new Error(
      `All ${samples.length} GPS samples had accuracy worse than ${maxAllowedAccuracyM}m. Wait for clearer sky view.`
    );
  }

  const sortedLat = [...valid].map((s) => s.lat).sort((a, b) => a - b);
  const sortedLon = [...valid].map((s) => s.lon).sort((a, b) => a - b);
  const mid = Math.floor(valid.length / 2);

  const medianLat =
    valid.length % 2 !== 0 ? sortedLat[mid] : (sortedLat[mid - 1] + sortedLat[mid]) / 2;
  const medianLon =
    valid.length % 2 !== 0 ? sortedLon[mid] : (sortedLon[mid - 1] + sortedLon[mid]) / 2;
  const meanAcc = valid.reduce((sum, s) => sum + s.accuracy_m, 0) / valid.length;

  return {
    lat: Number(medianLat.toFixed(7)),
    lon: Number(medianLon.toFixed(7)),
    accuracy_m: Number(meanAcc.toFixed(2)),
    sample_count: valid.length,
  };
}

// Sutherland-Hodgman polygon clipping for overlap area calculation in local metre space
function clipPolygon(
  subjectPolygon: Array<{ x: number; y: number }>,
  clipPolygonPts: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  // Ensure counter-clockwise orientation for clipPolygonPts
  const signedArea = clipPolygonPts.reduce((acc, p1, idx) => {
    const p2 = clipPolygonPts[(idx + 1) % clipPolygonPts.length];
    return acc + (p1.x * p2.y - p2.x * p1.y);
  }, 0);
  const clip = signedArea < 0 ? [...clipPolygonPts].reverse() : clipPolygonPts;

  let outputList = subjectPolygon;
  for (let i = 0; i < clip.length; i++) {
    const cp1 = clip[i];
    const cp2 = clip[(i + 1) % clip.length];
    const inputList = outputList;
    outputList = [];
    if (inputList.length === 0) break;

    let s = inputList[inputList.length - 1];
    for (const e of inputList) {
      const insideE = (cp2.x - cp1.x) * (e.y - cp1.y) >= (cp2.y - cp1.y) * (e.x - cp1.x);
      const insideS = (cp2.x - cp1.x) * (s.y - cp1.y) >= (cp2.y - cp1.y) * (s.x - cp1.x);

      if (insideE) {
        if (!insideS) {
          outputList.push(lineIntersection(cp1, cp2, s, e));
        }
        outputList.push(e);
      } else if (insideS) {
        outputList.push(lineIntersection(cp1, cp2, s, e));
      }
      s = e;
    }
  }
  return outputList;
}

function lineIntersection(
  cp1: { x: number; y: number },
  cp2: { x: number; y: number },
  s: { x: number; y: number },
  e: { x: number; y: number }
): { x: number; y: number } {
  const dc = { x: cp1.x - cp2.x, y: cp1.y - cp2.y };
  const dp = { x: s.x - e.x, y: s.y - e.y };
  const n1 = cp1.x * cp2.y - cp1.y * cp2.x;
  const n2 = s.x * e.y - s.y * e.x;
  const denom = dc.x * dp.y - dc.y * dp.x;
  if (Math.abs(denom) < 1e-9) return e;
  return {
    x: (n1 * dp.x - n2 * dc.x) / denom,
    y: (n1 * dp.y - n2 * dc.y) / denom,
  };
}

export function comparePolygonsSpatial(
  verticesA: PlotVertex[],
  verticesB: PlotVertex[],
  overlapThresholdPct: number = 10.0,
  duplicateCentroidM: number = 30.0,
  duplicateAreaDiffPct: number = 10.0
): {
  is_possible_overlap: boolean;
  is_possible_duplicate: boolean;
  overlap_pct: number;
  centroid_distance_m: number;
  area_diff_pct: number;
} {
  const refLat = verticesA[0].lat;
  const refLon = verticesA[0].lon;
  const xyA = projectToLocalMetres(verticesA, refLat, refLon);
  const xyB = projectToLocalMetres(verticesB, refLat, refLon);

  const areaA = computePolygonAreaAndPerimeterXY(xyA).areaM2;
  const areaB = computePolygonAreaAndPerimeterXY(xyB).areaM2;

  const centA = {
    x: xyA.reduce((s, p) => s + p.x, 0) / xyA.length,
    y: xyA.reduce((s, p) => s + p.y, 0) / xyA.length,
  };
  const centB = {
    x: xyB.reduce((s, p) => s + p.x, 0) / xyB.length,
    y: xyB.reduce((s, p) => s + p.y, 0) / xyB.length,
  };

  const centroidDistM = Math.hypot(centA.x - centB.x, centA.y - centB.y);
  const smallerArea = Math.min(areaA, areaB);
  const largerArea = Math.max(areaA, areaB);
  const areaDiffPct = largerArea > 0 ? ((largerArea - smallerArea) / largerArea) * 100 : 100;

  const clipped = clipPolygon(xyA, xyB);
  const intersectionArea =
    clipped.length >= 3 ? computePolygonAreaAndPerimeterXY(clipped).areaM2 : 0;
  const overlapPct = smallerArea > 0 ? (intersectionArea / smallerArea) * 100 : 0;

  const isDuplicate =
    centroidDistM <= duplicateCentroidM && areaDiffPct <= duplicateAreaDiffPct;
  const isOverlap = overlapPct >= overlapThresholdPct;

  return {
    is_possible_overlap: isOverlap,
    is_possible_duplicate: isDuplicate,
    overlap_pct: Number(overlapPct.toFixed(2)),
    centroid_distance_m: Number(centroidDistM.toFixed(2)),
    area_diff_pct: Number(areaDiffPct.toFixed(2)),
  };
}

export function distancePointToPolygonM(
  lat: number,
  lon: number,
  vertices: PlotVertex[]
): number {
  const xy = projectToLocalMetres(vertices, lat, lon);
  // Point is at (0,0)
  // Ray casting point-in-polygon check
  let inside = false;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    const xi = xy[i].x,
      yi = xy[i].y;
    const xj = xy[j].x,
      yj = xy[j].y;
    const intersect = yi > 0 !== yj > 0 && 0 < ((xj - xi) * -yi) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  if (inside) return 0;

  let minDist = Infinity;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    const b = xy[(i + 1) % xy.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((-a.x * dx - a.y * dy) / lenSq) : 0;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    minDist = Math.min(minDist, Math.hypot(projX, projY));
  }
  return Number(minDist.toFixed(1));
}

// NDPA 2023 ~300m deterministic coordinate fuzzing for occupied homes
export function fuzzOccupiedLocation(
  lat: number,
  lon: number,
  seedId: string,
  radiusM: number = 300
): { fuzzed_lat: number; fuzzed_lon: number; radius_m: number } {
  let hash = 0;
  for (let i = 0; i < seedId.length; i++) {
    hash = (hash * 31 + seedId.charCodeAt(i)) % 100000;
  }
  const angleRad = ((hash % 360) * Math.PI) / 180;
  const offsetM = radiusM * 0.55;
  const { mPerDegLat, mPerDegLon } = getLocalMetreRadii(lat);

  return {
    fuzzed_lat: Number((lat + (offsetM * Math.sin(angleRad)) / mPerDegLat).toFixed(5)),
    fuzzed_lon: Number((lon + (offsetM * Math.cos(angleRad)) / mPerDegLon).toFixed(5)),
    radius_m: radiusM,
  };
}

// ============================================================================
// PART C (PHASE 2): FOOTPRINT CONTAINMENT, ROOM SUM & ENTRANCE GEOFENCE
// ============================================================================

export function checkFootprintInsidePlot(
  footprintVertices: PlotVertex[],
  plotVertices: PlotVertex[]
): { footprint_inside_plot: boolean; footprint_outside_pct: number } {
  if (footprintVertices.length < 3 || plotVertices.length < 3) {
    return { footprint_inside_plot: false, footprint_outside_pct: 100 };
  }
  const refLat = plotVertices[0].lat;
  const refLon = plotVertices[0].lon;
  const fpXY = projectToLocalMetres(footprintVertices, refLat, refLon);
  const plotXY = projectToLocalMetres(plotVertices, refLat, refLon);

  const fpArea = computePolygonAreaAndPerimeterXY(fpXY).areaM2;
  if (fpArea <= 0) {
    return { footprint_inside_plot: false, footprint_outside_pct: 100 };
  }

  const clipped = clipPolygon(fpXY, plotXY);
  const insideArea =
    clipped.length >= 3 ? computePolygonAreaAndPerimeterXY(clipped).areaM2 : 0;
  const outsideArea = Math.max(0, fpArea - insideArea);
  const outsidePct = Number(((outsideArea / fpArea) * 100).toFixed(2));

  return {
    footprint_inside_plot: outsidePct <= 0.5,
    footprint_outside_pct: outsidePct,
  };
}

export function evaluateRoomAreaSum(
  rooms: Array<{
    id?: string;
    room_name: string;
    length_m: number;
    width_m: number;
    height_m: number;
    measurement_source?: 'manual' | 'webxr_experimental';
  }>,
  declaredAreaM2?: number,
  thresholdPct: number = 20.0
) {
  const computedRooms = rooms.map((rm, idx) => {
    const area = Number((rm.length_m * rm.width_m).toFixed(2));
    return {
      id: rm.id || `rm-${Date.now()}-${idx}`,
      room_name: rm.room_name,
      length_m: Number(rm.length_m),
      width_m: Number(rm.width_m),
      height_m: Number(rm.height_m || 3.0),
      computed_area_m2: area,
      measurement_source: rm.measurement_source || ('manual' as const),
    };
  });

  const sumM2 = Number(
    computedRooms.reduce((acc, r) => acc + r.computed_area_m2, 0).toFixed(2)
  );
  let diffPct = 0;
  let flagged = false;

  if (declaredAreaM2 && declaredAreaM2 > 0) {
    diffPct = Number(
      ((Math.abs(sumM2 - declaredAreaM2) / declaredAreaM2) * 100).toFixed(2)
    );
    flagged = diffPct > thresholdPct;
  }

  return {
    rooms: computedRooms,
    computed_room_area_sum_m2: sumM2,
    room_area_diff_pct: diffPct,
    room_area_discrepancy_flagged: flagged,
  };
}

export function geodesicDistancePointToPointM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const { mPerDegLat, mPerDegLon } = getLocalMetreRadii((lat1 + lat2) / 2);
  const dx = (lon2 - lon1) * mPerDegLon;
  const dy = (lat2 - lat1) * mPerDegLat;
  return Number(Math.hypot(dx, dy).toFixed(1));
}

// ============================================================================
// PART D (PHASE 3): PRICE PER M² BENCHMARKING (D3)
// ============================================================================

function computeLinearPercentile(sortedVals: number[], pct: number): number {
  if (sortedVals.length === 0) return 0;
  if (sortedVals.length === 1) return sortedVals[0];
  const k = (sortedVals.length - 1) * (pct / 100);
  const f = Math.floor(k);
  const c = Math.ceil(k);
  if (f === c) return sortedVals[Math.floor(k)];
  return sortedVals[f] * (c - k) + sortedVals[c] * (k - f);
}

export function computeListingBenchmark(params: {
  target_id: string;
  target_type: 'plot' | 'building';
  target_price_ngn: number;
  target_area_m2: number;
  target_lat: number;
  target_lon: number;
  target_state: string;
  target_lga: string;
  candidates: Array<{
    id: string;
    title: string;
    type: 'plot' | 'building';
    state: string;
    lga: string;
    lat: number;
    lon: number;
    area_m2: number;
    price_ngn: number;
  }>;
  radius_km?: number;
  min_comps?: number;
  exchange_rate_ngn_per_usd?: number;
}) {
  const radiusKm = params.radius_km ?? 3.0;
  const minComps = params.min_comps ?? 8;
  const rate = params.exchange_rate_ngn_per_usd && params.exchange_rate_ngn_per_usd > 0
    ? params.exchange_rate_ngn_per_usd
    : 1600;

  const safeArea = Math.max(1, params.target_area_m2);
  const targetPpm2Ngn = Number((params.target_price_ngn / safeArea).toFixed(2));
  const targetPpm2Usd = Number((targetPpm2Ngn / rate).toFixed(2));

  const matched = params.candidates
    .filter((c) => c.id !== params.target_id && c.type === params.target_type && c.area_m2 > 0 && c.price_ngn > 0)
    .map((c) => {
      const distM = geodesicDistancePointToPointM(
        params.target_lat,
        params.target_lon,
        c.lat,
        c.lon
      );
      const distKm = Number((distM / 1000).toFixed(2));
      const ppm2Ngn = Number((c.price_ngn / c.area_m2).toFixed(2));
      return {
        id: c.id,
        title: c.title,
        state: c.state,
        lga: c.lga,
        distance_km: distKm,
        area_m2: Number(c.area_m2.toFixed(1)),
        price_ngn: Number(c.price_ngn.toFixed(0)),
        price_per_m2_ngn: ppm2Ngn,
        price_per_m2_usd: Number((ppm2Ngn / rate).toFixed(2)),
      };
    })
    .filter((c) => c.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);

  const compCount = matched.length;
  if (compCount < minComps) {
    return {
      target_id: params.target_id,
      target_type: params.target_type,
      status: 'insufficient_data' as const,
      status_label: `Insufficient data (${compCount} of ${minComps} required comparables within ${radiusKm} km)`,
      indicative_disclaimer: 'Indicative only — not a formal valuation.',
      radius_km: radiusKm,
      required_minimum_comps: minComps,
      comparable_count: compCount,
      target_price_per_m2_ngn: targetPpm2Ngn,
      target_price_per_m2_usd: targetPpm2Usd,
      percentile_band: null,
      is_extreme_outlier: false,
      outlier_direction: null,
      comparables: matched,
    };
  }

  const sortedPpm2 = [...matched].map((m) => m.price_per_m2_ngn).sort((a, b) => a - b);
  const p5Ngn = Number(computeLinearPercentile(sortedPpm2, 5).toFixed(2));
  const q1Ngn = Number(computeLinearPercentile(sortedPpm2, 25).toFixed(2));
  const medianNgn = Number(computeLinearPercentile(sortedPpm2, 50).toFixed(2));
  const q3Ngn = Number(computeLinearPercentile(sortedPpm2, 75).toFixed(2));
  const p95Ngn = Number(computeLinearPercentile(sortedPpm2, 95).toFixed(2));

  const lessOrEqual = sortedPpm2.filter((v) => v <= targetPpm2Ngn).length;
  const percentileRank = Number(((lessOrEqual / compCount) * 100).toFixed(1));

  const belowP5 = targetPpm2Ngn < p5Ngn;
  const aboveP95 = targetPpm2Ngn > p95Ngn;
  const isOutlier = belowP5 || aboveP95;
  const outlierDirection: 'below_p5' | 'above_p95' | 'within_p5_p95' = belowP5
    ? 'below_p5'
    : aboveP95
    ? 'above_p95'
    : 'within_p5_p95';

  return {
    target_id: params.target_id,
    target_type: params.target_type,
    status: 'ok' as const,
    status_label: isOutlier
      ? `Extreme outlier (${belowP5 ? 'Below P5' : 'Above P95'} comparable band)`
      : `Within P5–P95 comparable band (P${Math.round(percentileRank)})`,
    indicative_disclaimer: 'Indicative only — not a formal valuation.',
    radius_km: radiusKm,
    required_minimum_comps: minComps,
    comparable_count: compCount,
    target_price_per_m2_ngn: targetPpm2Ngn,
    target_price_per_m2_usd: targetPpm2Usd,
    percentile_band: {
      p5_ngn: p5Ngn,
      q1_ngn: q1Ngn,
      median_ngn: medianNgn,
      q3_ngn: q3Ngn,
      p95_ngn: p95Ngn,
      p5_usd: Number((p5Ngn / rate).toFixed(2)),
      q1_usd: Number((q1Ngn / rate).toFixed(2)),
      median_usd: Number((medianNgn / rate).toFixed(2)),
      q3_usd: Number((q3Ngn / rate).toFixed(2)),
      p95_usd: Number((p95Ngn / rate).toFixed(2)),
      percentile_rank: percentileRank,
    },
    is_extreme_outlier: isOutlier,
    outlier_direction: outlierDirection,
    comparables: matched,
  };
}


