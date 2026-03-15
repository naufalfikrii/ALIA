"use client";

import { useEffect, useRef, useState } from "react";
import { LatLng } from "@/types";

interface MapPickerProps {
  points: LatLng[];
  onChange: (points: LatLng[]) => void;
}

declare global {
  interface Window { L: any; }
}

/** Normalize lng into [-180, 180] — fixes Leaflet's infinite pan wrapping */
function normalizeLng(lng: number): number {
  lng = lng % 360;
  if (lng > 180)  lng -= 360;
  if (lng < -180) lng += 360;
  return lng;
}

function calcArea(pts: LatLng[]): number {
  if (pts.length < 3) return 0;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = toRad(pts[i].lng) * Math.cos(toRad(pts[i].lat));
    const yi = toRad(pts[i].lat);
    const xj = toRad(pts[j].lng) * Math.cos(toRad(pts[j].lat));
    const yj = toRad(pts[j].lat);
    area += xi * yj - xj * yi;
  }
  return Math.abs((area / 2) * R * R);
}

export function MapPicker({ points, onChange }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const layerRef     = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode]   = useState<"polygon" | "points">("polygon");

  const pointsRef = useRef(points);
  pointsRef.current = points;

  /* ── Load Leaflet from CDN ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.L) { setReady(true); return; }

    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  /* ── Init map ── */
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const L = window.L;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      // Prevent panning into the repeated world copies
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1.0,   // hard clamp — can't drag past boundary
    }).setView([-6.2, 106.816], 11); // default to Jakarta

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 20,
      // Disable tile wrapping so the world doesn't repeat
      noWrap: true,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);

    map.on("click", (e: any) => {
      const lat = e.latlng.lat;
      const lng = normalizeLng(e.latlng.lng); // ← always normalize on click
      const newPts = [...pointsRef.current, { lat, lng }];
      onChange(newPts);
    });

    mapRef.current = map;
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Redraw markers + polygon ── */
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    const L = window.L;
    layerRef.current.clearLayers();

    points.forEach((p, i) => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        fillColor: "#15803d",
        color: "#fff",
        weight: 2,
        fillOpacity: 1,
      }).addTo(layerRef.current);

      marker.bindTooltip(`${i + 1}`, {
        permanent: true,
        className: "map-label",
        direction: "top",
      });

      marker.on("click", (e: any) => {
        e.originalEvent.stopPropagation();
        onChange(points.filter((_, idx) => idx !== i));
      });
    });

    if (points.length >= 2) {
      const latlngs = points.map(p => [p.lat, p.lng]);
      if (mode === "polygon" && points.length >= 3) {
        L.polygon(latlngs, {
          color: "#15803d",
          fillColor: "#15803d",
          fillOpacity: 0.15,
          weight: 2,
        }).addTo(layerRef.current);
      } else {
        L.polyline(latlngs, {
          color: "#15803d",
          weight: 2,
          dashArray: "6 4",
        }).addTo(layerRef.current);
      }
    }
  }, [points, mode]);

  /* ── Fit bounds ── */
  useEffect(() => {
    if (!mapRef.current || !window.L || points.length === 0) return;
    const L = window.L;
    if (points.length === 1) {
      mapRef.current.setView([points[0].lat, points[0].lng], 16);
    } else {
      mapRef.current.fitBounds(
        L.latLngBounds(points.map(p => [p.lat, p.lng])),
        { padding: [40, 40] }
      );
    }
  }, [points.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const area    = calcArea(points);
  const areaStr = area >= 10000
    ? `${(area / 10000).toFixed(2)} ha`
    : `${Math.round(area).toLocaleString()} m²`;

  // Warn if any stored point still has bad coords (already-saved bad data)
  const hasBadCoords = points.some(
    p => p.lng < -180 || p.lng > 180 || p.lat < -90 || p.lat > 90
  );

  return (
    <div className="flex flex-col gap-2">

      {/* Bad coords warning */}
      {hasBadCoords && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          Invalid coordinates detected (lng out of range). Please clear and re-draw.
          <button onClick={() => onChange([])} className="ml-auto font-semibold underline">Clear</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(["polygon", "points"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === m
                  ? "bg-white text-green-700 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {m === "polygon" ? "⬡ Polygon" : "⬤ Multi-Point"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {points.length > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              {points.length} point{points.length !== 1 ? "s" : ""}
              {area > 0 && <span className="ml-1 text-green-600 font-medium">· {areaStr}</span>}
            </span>
          )}
          {points.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div ref={containerRef} style={{ height: 340 }} className="w-full bg-gray-100" />

        {!ready && (
          <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity=".2" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
              <p className="text-xs">Loading map…</p>
            </div>
          </div>
        )}

        {ready && points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-3 shadow-sm text-center">
              <p className="text-sm font-medium text-gray-600">Click on the map to add points</p>
              <p className="text-xs text-gray-400 mt-0.5">Click a marker to remove it</p>
            </div>
          </div>
        )}
      </div>

      {/* Coordinates list */}
      {points.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Coordinates
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            {points.map((p, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 text-xs border rounded-md px-2 py-1 font-mono ${
                  p.lng < -180 || p.lng > 180
                    ? "bg-red-50 border-red-200 text-red-600"
                    : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                <span className="text-green-600 font-bold">{i + 1}</span>
                {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                <button
                  onClick={() => onChange(points.filter((_, idx) => idx !== i))}
                  className="text-gray-300 hover:text-red-400 transition-colors ml-0.5"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .map-label {
          background: #15803d !important;
          border: none !important;
          color: white !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          padding: 2px 5px !important;
          border-radius: 4px !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2) !important;
        }
        .map-label::before { display: none !important; }
        .leaflet-tooltip-top.map-label::before { display: none !important; }
      `}</style>
    </div>
  );
}