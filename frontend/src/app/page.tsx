"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { startFeasibility } from "@/lib/api";
import { UserInput, LatLng } from "@/types";

// SSR-safe: Leaflet touches `window`, must be client-only
const MapPicker = dynamic(
  () => import("@/components/mapPicker").then(m => m.MapPicker),
  { 
    ssr: false,
    loading: () => <div style={{ height: 340 }} className="bg-gray-100 animate-pulse rounded-xl" />
  }
);

const PROJECT_TYPES = [
  "Residential Complex",
  "Commercial Tower",
  "Mixed-Use Development",
  "Industrial Facility",
  "Hospitality / Hotel",
  "Retail Center",
  "Data Center",
  "Logistics Hub",
];

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [coordinates, setCoords]  = useState<LatLng[]>([]);
  const [form, setForm]           = useState<UserInput>({
    project_name: "",
    location: "",
    land_area_sqm: 0,
    project_type: "",
    coordinates: [{lat: 0, lng: 0}],
    additional_notes: "",
  });

  // ── Area Calculation Logic ────────────────────────────────────
  // Calculates area as points are clicked/removed
  useEffect(() => {
    const calcArea = (pts: LatLng[]): number => {
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
    };

    const calculatedArea = Math.round(calcArea(coordinates));
    setForm(f => ({ ...f, land_area_sqm: calculatedArea }));
  }, [coordinates]);

  const set = (k: keyof UserInput, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    // Note: land_area_sqm is now required to be > 0 (needs at least 3 points for a polygon)
    if (!form.project_name || !form.location || form.land_area_sqm === 0 || !form.project_type) {
      setError("Please fill in all fields and define a valid site area on the map (min. 3 points).");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const payload: UserInput = {
        ...form,
        coordinates: coordinates, // Coordinates are now central to the submission
      };
      console.log(payload)
      const res = await startFeasibility(payload);
      router.push(`/run/${res.run_id}`);
    } catch {
      setError("Could not reach the pipeline API. Make sure your backend is running.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Navbar ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg tracking-tight">ALIA</span>
            <span className="hidden sm:inline text-xs text-gray-400 font-normal ml-1">Feasibility Intelligence</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hover:text-gray-800 cursor-pointer transition-colors">Docs</span>
            <button className="text-sm px-4 py-2 rounded-lg border border-green-700 text-green-700 hover:bg-green-700 hover:text-white transition-all font-medium">
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-green-50 via-white to-emerald-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col lg:flex-row gap-16 items-start">

          {/* Left — marketing copy */}
          <div className="flex-1 pt-4">
            <span className="inline-block text-xs font-semibold tracking-widest text-green-600 uppercase mb-5">
              Real Estate · Multi-Agent AI
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-5">
              Feasibility Studies<br />
              <span className="text-green-700">Done in Minutes</span>
            </h1>
            <p className="text-gray-500 text-base leading-relaxed max-w-md mb-10">
              Submit your project parameters. Our AI agents gather physical, legal and economic data,
              then pause at each critical step for your expert review before generating the final report.
            </p>

            <div className="flex flex-col gap-5">
              {[
                {
                  icon: <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
                  title: "Parallel Data Fetch",
                  body: "Physical, legal & economic agents run simultaneously",
                },
                {
                  icon: <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                  title: "Precise Site Boundary",
                  body: "Pin the exact polygon on the map for geo-accurate analysis",
                },
                {
                  icon: <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
                  title: "Human Checkpoints",
                  body: "Review, edit or reject data before the pipeline proceeds",
                },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="mt-0.5 w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">{item.icon}</div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm mb-0.5">{item.title}</p>
                    <p className="text-gray-400 text-sm">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form card */}
          <div className="w-full lg:w-[500px] shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-green-900/5 overflow-hidden">

              <div className="bg-green-700 px-6 py-4">
                <h2 className="text-white font-semibold text-base">New Feasibility Analysis</h2>
                <p className="text-green-200 text-xs mt-0.5">Fill in your project parameters to begin</p>
              </div>

              <div className="p-6 flex flex-col gap-4">

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Project Name <span className="text-green-600">*</span></label>
                  <input type="text" placeholder="e.g. Central Park Tower" value={form.project_name} onChange={e => set("project_name", e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location <span className="text-green-600">*</span></label>
                    <input type="text" placeholder="City, Country" value={form.location} onChange={e => set("location", e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type <span className="text-green-600">*</span></label>
                    <select value={form.project_type} onChange={e => set("project_type", e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm bg-gray-50 cursor-pointer focus:ring-2 focus:ring-green-500 outline-none">
                      <option value="">Select…</option>
                      {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* ── Integrated Map Picker ────────────────────────── */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Site Boundary & Land Area <span className="text-green-600">*</span></label>
                    {form.land_area_sqm > 0 && (
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                        {form.land_area_sqm.toLocaleString()} sqm
                      </span>
                    )}
                  </div>
                  <MapPicker points={coordinates} onChange={setCoords} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Additional Notes</label>
                  <textarea placeholder="Special constraints..." rows={3} value={form.additional_notes} onChange={e => set("additional_notes", e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm bg-gray-50 resize-none focus:ring-2 focus:ring-green-500 outline-none" />
                </div>

                {error && (
                  <div className="flex items-start gap-2 px-3.5 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                    {error}
                  </div>
                )}

                <button onClick={handleSubmit} disabled={loading} className="w-full mt-1 py-3 rounded-xl bg-green-700 hover:bg-green-800 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md">
                  {loading ? "Starting pipeline…" : "Launch Analysis"}
                </button>

              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto bg-white border-t border-gray-100 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-green-700 flex items-center justify-center"><span className="text-white font-bold text-xs">A</span></div>
            <span className="text-gray-700 font-semibold text-sm">ALIA</span>
          </div>
          <p className="text-xs text-gray-300">Human-in-the-loop · Confidential</p>
        </div>
      </footer>
    </div>
  );
}