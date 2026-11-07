import React, { useState, useRef } from 'react';
import { PlotVertex } from '../../types';
import { Layers, ZoomIn, ZoomOut, Compass, ShieldAlert, Trash2 } from 'lucide-react';
import { ESRI_ATTRIBUTION_TEXT, MEASUREMENT_DISCLAIMER } from '../../lib/nigeria-data';

interface InteractivePlotMapProps {
  vertices: PlotVertex[];
  comparisonVertices?: PlotVertex[];
  comparisonTitle?: string;
  editable?: boolean;
  onAddVertex?: (vertex: PlotVertex) => void;
  onClearVertices?: () => void;
  fuzzedCenter?: { lat: number; lon: number; radiusM: number } | null;
  photoPoints?: Array<{ id: string; lat: number; lon: number; withinGeofence: boolean }>;
  heightClass?: string;
}

// Convert lat/lon to Web Mercator fractional tile coordinates at zoom z
function latLonToTileXY(lat: number, lon: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function tileXYToLatLon(x: number, y: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const lon = (x / n) * 360 - 180;
  const n2 = Math.PI - (2 * Math.PI * y) / n;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n2) - Math.exp(-n2)));
  return { lat, lon };
}

export const InteractivePlotMap: React.FC<InteractivePlotMapProps> = ({
  vertices,
  comparisonVertices,
  comparisonTitle,
  editable = false,
  onAddVertex,
  onClearVertices,
  fuzzedCenter = null,
  photoPoints = [],
  heightClass = 'h-96',
}) => {
  const [zoom, setZoom] = useState<number>(18);
  const [showSatellite, setShowSatellite] = useState<boolean>(true);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Determine map center from vertices, fuzzedCenter, or default to Ibadan (7.3878 N, 3.8964 E)
  const allPts = [...vertices, ...(comparisonVertices || [])];
  const centerLat = fuzzedCenter
    ? fuzzedCenter.lat
    : allPts.length > 0
    ? allPts.reduce((acc, v) => acc + v.lat, 0) / allPts.length
    : 7.3878;
  const centerLon = fuzzedCenter
    ? fuzzedCenter.lon
    : allPts.length > 0
    ? allPts.reduce((acc, v) => acc + v.lon, 0) / allPts.length
    : 3.8964;

  const viewWidth = 768;
  const viewHeight = 460;
  const centerTile = latLonToTileXY(centerLat, centerLon, zoom);

  // Convert any lat/lon to pixel coordinates inside the SVG viewport
  const toScreenXY = (lat: number, lon: number) => {
    const ptTile = latLonToTileXY(lat, lon, zoom);
    const dx = (ptTile.x - centerTile.x) * 256;
    const dy = (ptTile.y - centerTile.y) * 256;
    return {
      x: viewWidth / 2 + dx,
      y: viewHeight / 2 + dy,
    };
  };

  // Convert screen click to lat/lon for Satellite Trace mode
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!editable || !onAddVertex || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = viewWidth / rect.width;
    const scaleY = viewHeight / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const tileX = centerTile.x + (clickX - viewWidth / 2) / 256;
    const tileY = centerTile.y + (clickY - viewHeight / 2) / 256;
    const { lat, lon } = tileXYToLatLon(tileX, tileY, zoom);

    onAddVertex({
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      accuracy_m: 4.5, // Standard satellite trace positional uncertainty (~4.5m)
      sample_count: 1,
    });
  };

  // Compute surrounding Esri World Imagery 256x256 tiles to fill the viewport
  const baseTileX = Math.floor(centerTile.x);
  const baseTileY = Math.floor(centerTile.y);
  const tiles: Array<{ tx: number; ty: number; left: number; top: number; url: string }> = [];

  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const tx = baseTileX + dx;
      const ty = baseTileY + dy;
      const left = viewWidth / 2 + (tx - centerTile.x) * 256;
      const top = viewHeight / 2 + (ty - centerTile.y) * 256;
      const url = showSatellite
        ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`
        : `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
      tiles.push({ tx, ty, left, top, url });
    }
  }

  // Metres per pixel at this latitude and zoom
  const metresPerPixel =
    (156543.03392 * Math.cos((centerLat * Math.PI) / 180)) / Math.pow(2, zoom);

  const primaryScreenPts = vertices.map((v) => ({
    ...toScreenXY(v.lat, v.lon),
    accuracy_m: v.accuracy_m,
    lat: v.lat,
    lon: v.lon,
  }));

  const comparisonScreenPts = (comparisonVertices || []).map((v) => ({
    ...toScreenXY(v.lat, v.lon),
    accuracy_m: v.accuracy_m,
    lat: v.lat,
    lon: v.lon,
  }));

  const polygonPointsAttr = primaryScreenPts.map((p) => `${p.x},${p.y}`).join(' ');
  const comparisonPointsAttr = comparisonScreenPts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-950 shadow-sm">
      {/* Top Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900 text-slate-100 text-xs border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-emerald-400" />
          <span className="font-medium">
            {fuzzedCenter
              ? 'NDPA Privacy Zone (~300m Fuzzed Public View)'
              : editable
              ? 'Satellite Trace Mode — Click on map to place plot corners'
              : 'Geodesic Boundary & Accuracy Buffer Map (WGS84)'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSatellite((s) => !s)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            <Layers className="h-3.5 w-3.5 text-emerald-400" />
            {showSatellite ? 'Esri Satellite' : 'Street Map'}
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(19, z + 1))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(14, z - 1))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          {editable && onClearVertices && vertices.length > 0 && (
            <button
              type="button"
              onClick={onClearVertices}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-900/70 hover:bg-rose-800 text-rose-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear ({vertices.length})
            </button>
          )}
        </div>
      </div>

      {/* Main Map Viewport */}
      <div className={`relative w-full ${heightClass} overflow-hidden select-none bg-slate-900`}>
        {/* SVG Layer containing Tiles + Vector Polygons + Accuracy Rings */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid slice"
          onClick={handleSvgClick}
          className={`w-full h-full ${editable ? 'cursor-crosshair' : 'cursor-default'}`}
        >
          <defs>
            <pattern id="grid-fallback" width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="rgba(148, 163, 184, 0.15)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Fallback surveyor coordinate grid if offline */}
          <rect width={viewWidth} height={viewHeight} fill="url(#grid-fallback)" />

          {/* Esri World Imagery / OSM Slippy Tiles */}
          {tiles.map((t) => (
            <image
              key={`${zoom}-${t.tx}-${t.ty}`}
              href={t.url}
              x={t.left}
              y={t.top}
              width={256}
              height={256}
              preserveAspectRatio="none"
            />
          ))}

          {/* Dark subtle contrast overlay for crisp vector readability */}
          <rect width={viewWidth} height={viewHeight} fill="rgba(15, 23, 42, 0.18)" />

          {/* NDPA ~300m Fuzzed Circle if occupied home */}
          {fuzzedCenter && (
            <g>
              <circle
                cx={viewWidth / 2}
                cy={viewHeight / 2}
                r={Math.max(40, fuzzedCenter.radiusM / metresPerPixel)}
                fill="rgba(245, 158, 11, 0.22)"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray="6 4"
              />
              <text
                x={viewWidth / 2}
                y={viewHeight / 2}
                textAnchor="middle"
                fill="#fef3c7"
                fontSize="12"
                fontWeight="bold"
              >
                ~{fuzzedCenter.radiusM}m Approximate Location Zone (NDPA 2023)
              </text>
            </g>
          )}

          {/* Side-by-side / Overlay Comparison Polygon (Admin Conflict View) */}
          {!fuzzedCenter && comparisonScreenPts.length >= 3 && (
            <g>
              <polygon
                points={comparisonPointsAttr}
                fill="rgba(244, 63, 94, 0.28)"
                stroke="#f43f5e"
                strokeWidth="3"
                strokeDasharray="7 4"
              />
              {comparisonScreenPts.map((pt, idx) => (
                <circle
                  key={`comp-${idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={5}
                  fill="#f43f5e"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              ))}
            </g>
          )}

          {/* Primary Plot Polygon & Per-Vertex GPS Uncertainty Halos */}
          {!fuzzedCenter && primaryScreenPts.length > 0 && (
            <g>
              {primaryScreenPts.length >= 3 && (
                <polygon
                  points={polygonPointsAttr}
                  fill="rgba(16, 185, 129, 0.28)"
                  stroke="#10b981"
                  strokeWidth="3"
                />
              )}
              {primaryScreenPts.length === 2 && (
                <line
                  x1={primaryScreenPts[0].x}
                  y1={primaryScreenPts[0].y}
                  x2={primaryScreenPts[1].x}
                  y2={primaryScreenPts[1].y}
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                />
              )}

              {primaryScreenPts.map((pt, idx) => {
                const haloRadiusPx = Math.max(8, pt.accuracy_m / metresPerPixel);
                return (
                  <g key={`vertex-${idx}`}>
                    {/* Uncertainty buffer circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={haloRadiusPx}
                      fill="rgba(16, 185, 129, 0.15)"
                      stroke="rgba(52, 211, 153, 0.65)"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    {/* Corner Pin */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={5.5}
                      fill="#059669"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={pt.x + 8}
                      y={pt.y - 8}
                      fill="#ecfdf5"
                      fontSize="11"
                      fontWeight="700"
                      style={{ textShadow: '0px 1px 3px rgba(0,0,0,0.9)' }}
                    >
                      C{idx + 1} (±{pt.accuracy_m.toFixed(1)}m)
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* In-App Photo Geofence Markers */}
          {!fuzzedCenter &&
            photoPoints.map((photo, i) => {
              const p = toScreenXY(photo.lat, photo.lon);
              return (
                <g key={photo.id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    fill={photo.withinGeofence ? '#3b82f6' : '#f59e0b'}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={p.x + 8}
                    y={p.y + 4}
                    fill="#dbeafe"
                    fontSize="10"
                    fontWeight="600"
                    style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.9)' }}
                  >
                    P{i + 1}
                  </text>
                </g>
              );
            })}
        </svg>

        {/* Legend & Coordinates Overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-[11px] border border-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              Plot Polygon & ±Accuracy Halo
            </span>
            {comparisonVertices && comparisonVertices.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-rose-300 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Possible Overlap / Duplicate: {comparisonTitle || 'Other Listing'}
              </span>
            )}
            {photoPoints.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sky-300">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                Geotagged Photos ({photoPoints.length})
              </span>
            )}
          </div>

          <div className="bg-slate-900/90 text-slate-300 px-2.5 py-1 rounded text-[10px] border border-slate-700">
            Center: {centerLat.toFixed(5)}°N, {centerLon.toFixed(5)}°E · Zoom {zoom}x
          </div>
        </div>
      </div>

      {/* Mandatory Measurement Disclaimer & Esri Attribution Footer */}
      <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-amber-900">
        <div className="flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-700 shrink-0" />
          <span>{MEASUREMENT_DISCLAIMER}</span>
        </div>
        <span className="text-[10px] text-slate-500">{ESRI_ATTRIBUTION_TEXT}</span>
      </div>
    </div>
  );
};
