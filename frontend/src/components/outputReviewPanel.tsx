"use client";

import { useEffect, useRef, useState } from "react";
import { OutputReviewResponse, HumanReviewDecision, ReviewAction } from "@/types";
import { submitOutputReview } from "@/lib/api";

interface OutputReviewPanelProps {
  runId: string;
  review: OutputReviewResponse;
  onSubmitted: () => void;
}

export function OutputReviewPanel({ runId, review, onSubmitted }: OutputReviewPanelProps) {
  const [action, setAction]     = useState<ReviewAction>("approve");
  const [notes, setNotes]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab]           = useState<"physical"|"legal"|"financial">("physical");

  const [editedPhysical,  setEditedPhysical]  = useState(JSON.stringify(review.analysis_result?.physical_analysis  ?? {}, null, 2));
  const [editedLegal,     setEditedLegal]     = useState(JSON.stringify(review.analysis_result?.legal_analysis     ?? {}, null, 2));
  const [editedFinancial, setEditedFinancial] = useState(JSON.stringify(review.analysis_result?.financial_analysis ?? {}, null, 2));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const decision: HumanReviewDecision = { action, notes: notes || undefined };
      if (action === "edit") {
        decision.edited_analysis_result = {
          physical_analysis:  safeJSON(editedPhysical),
          legal_analysis:     safeJSON(editedLegal),
          financial_analysis: safeJSON(editedFinancial),
        };
      }
      await submitOutputReview(runId, decision);
      onSubmitted();
    } catch {
      setError("Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  const score = review.guardrail_score;
  const scoreColor = score === undefined ? "text-gray-400"
    : score >= 0.8 ? "text-green-600" : score >= 0.6 ? "text-amber-500" : "text-red-500";

  const ar       = review.analysis_result;
  const physical = ar?.physical_analysis  as any;
  const legal    = ar?.legal_analysis     as any;
  const financial= ar?.financial_analysis as any;


  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Stage 2 — Analysis Output Review</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Guardrail: <span className={`font-bold ${scoreColor}`}>
                {score !== undefined ? `${Math.round(score * 100)}%` : "N/A"}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditMode(e => !e)}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
            editMode ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700"
          }`}
        >
          {editMode ? "✎ Editing" : "✎ Edit JSON"}
        </button>
      </div>

      <div className="p-6 flex flex-col gap-5">

        {/* Guardrail issues */}
        {review.guardrail_issues?.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {review.guardrail_issues.map((iss, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <span className="shrink-0">⚠</span><span>{iss}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs or edit mode */}
        {editMode ? (
          <div className="flex flex-col gap-3">
            {[
              { label: "🏗 Physical", value: editedPhysical,  onChange: setEditedPhysical  },
              { label: "⚖️ Legal",    value: editedLegal,     onChange: setEditedLegal     },
              { label: "💰 Financial",value: editedFinancial, onChange: setEditedFinancial },
            ].map(s => (
              <div key={s.label} className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">{s.label}</label>
                <textarea value={s.value} onChange={e => s.onChange(e.target.value)} rows={7}
                  className="w-full px-3 py-2 text-xs font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"/>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {([
                { id: "physical",  label: "🏗 Physical"  },
                { id: "legal",     label: "⚖️ Legal"      },
                { id: "financial", label: "💰 Financial"  },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === "physical"  && <PhysicalTab  data={physical}  review={review}/>}
            {tab === "legal"     && <LegalTab     data={legal}/>}
            {tab === "financial" && <FinancialTab data={financial}/>}
          </>
        )}

        {/* Decision */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Your Decision</p>
          <div className="flex gap-2">
            <ActionBtn action="approve" selected={action==="approve"} onClick={()=>{setAction("approve");setEditMode(false);}}/>
            <ActionBtn action="edit"    selected={action==="edit"}    onClick={()=>{setAction("edit");   setEditMode(true); }}/>
            <ActionBtn action="reject"  selected={action==="reject"}  onClick={()=>{setAction("reject"); setEditMode(false);}}/>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes (optional)</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Add comments about your decision…"
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"/>
        </div>

        {error && <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">{error}</div>}

        <button onClick={handleSubmit} disabled={loading}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
            action==="reject" ? "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
            : "bg-green-700 text-white hover:bg-green-800 shadow-md shadow-green-900/20"
          }`}>
          {loading ? (<><Spinner/>Submitting…</>) : `Submit: ${action.charAt(0).toUpperCase()+action.slice(1)}`}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PHYSICAL TAB — map + site details
══════════════════════════════════════════════════════════ */
function PhysicalTab({ data, review }: { data: any; review: OutputReviewResponse }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Load Leaflet once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).L) { setMapReady(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => setMapReady(true);
    document.head.appendChild(s);
  }, []);

  // Init map
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapObj.current) return;
    const L = (window as any).L;

    // Try to get coords from review fetched_data or fall back to 0,0
    // cast to any to access nested dynamic fields without TS errors
    const coords: {lat:number;lng:number}[] =
      (review as any)?.fetched_data?.physical_data?.raw?.coordinates ||
      (review as any)?.fetched_data?.physical_data?.coordinates ||
      [];

    const center = coords.length > 0
      ? [coords[0].lat, coords[0].lng]
      : [-6.2, 106.816]; // Jakarta fallback

    const map = L.map(mapRef.current, { zoomControl: true }).setView(center, coords.length > 0 ? 16 : 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", noWrap: true
    }).addTo(map);

    // Draw site polygon if we have coords
    if (coords.length >= 2) {
      const latlngs = coords.map((c: any) => [c.lat, c.lng]);
      if (coords.length >= 3) {
        L.polygon(latlngs, { color: "#15803d", fillColor: "#15803d", fillOpacity: 0.15, weight: 2 }).addTo(map);
      }
      coords.forEach((c: any, i: number) => {
        L.circleMarker([c.lat, c.lng], { radius: 6, fillColor: "#15803d", color: "#fff", weight: 2, fillOpacity: 1 })
          .bindTooltip(`${i+1}`, { permanent: true, className: "map-pin-label", direction: "top" })
          .addTo(map);
      });
      map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] });
    }

    // Add nearby amenities as markers if available
    const amenities: any[] = data?.nearby_amenities || [];
    amenities.forEach((a: any) => {
      if (a.lat && a.lng) {
        const iconMap: Record<string, string> = { school:"🏫", hospital:"🏥", market:"🛒", transport:"🚉" };
        const icon = iconMap[a.type as string] ?? "📍";
        L.marker([a.lat, a.lng]).bindPopup(`${icon} ${a.name} (${a.distance})`).addTo(map);
      }
    });

    mapObj.current = map;
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <NoData/>;

  const riskColor = (r: string) =>
    r === "low" ? "text-green-600 bg-green-50 border-green-200"
    : r === "high" ? "text-red-600 bg-red-50 border-red-200"
    : "text-amber-600 bg-amber-50 border-amber-200";

  return (
    <div className="flex flex-col gap-4">
      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200 relative" style={{height:260}}>
        <div ref={mapRef} className="w-full h-full bg-gray-100"/>
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <Spinner/><span className="ml-2 text-xs text-gray-400">Loading map…</span>
          </div>
        )}
      </div>

      {/* Site suitability */}
      {data.site_suitability && (
        <div>
          <SectionLabel>Site Suitability</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Soil",       data.site_suitability.soil_condition],
              ["Flood Risk", data.site_suitability.flood_risk],
              ["Topography", data.site_suitability.topography],
            ].map(([k,v]) => v && (
              <div key={k as string} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{k as string}</p>
                <p className="text-xs text-gray-700">{v as string}</p>
              </div>
            ))}
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Overall</p>
              <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full border ${riskColor(data.site_suitability.overall_score)}`}>
                {data.site_suitability.overall_score}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Infrastructure */}
      {data.infrastructure && (
        <div>
          <SectionLabel>Infrastructure</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.infrastructure).filter(([k]) => k !== "readiness_score").map(([k, v]) => (
              <div key={k} className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-400">{k.replace(/_/g," ")}</span>
                <span className="text-xs font-medium text-gray-700">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk + Recommendations */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Physical Risk Score</span>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${riskColor(data.physical_risk_score)}`}>
          {data.physical_risk_score}
        </span>
      </div>

      {data.recommendations?.length > 0 && (
        <div>
          <SectionLabel>Recommendations</SectionLabel>
          {data.recommendations.map((r: string, i: number) => (
            <p key={i} className="text-xs text-gray-700 flex gap-2"><span className="text-green-500 shrink-0">✓</span>{r}</p>
          ))}
        </div>
      )}

      <style>{`.map-pin-label{background:#15803d!important;border:none!important;color:#fff!important;font-size:10px!important;font-weight:700!important;padding:2px 5px!important;border-radius:4px!important;}.map-pin-label::before{display:none!important;}`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   LEGAL TAB — permits table + risk matrix
══════════════════════════════════════════════════════════ */
function LegalTab({ data }: { data: any }) {
  if (!data) return <NoData/>;

  const riskColor = (r: string) =>
    r === "low" || r === "compliant" ? "text-green-700 bg-green-50 border-green-200"
    : r === "high" || r === "non-compliant" ? "text-red-700 bg-red-50 border-red-200"
    : "text-amber-700 bg-amber-50 border-amber-200";

  const diffColor = (d: string) =>
    d === "easy" ? "text-green-600" : d === "hard" ? "text-red-500" : "text-amber-500";

  return (
    <div className="flex flex-col gap-4">

      {/* Zoning block */}
      {data.zoning && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Zoning Classification</p>
              <p className="text-sm font-bold text-gray-900">{data.zoning.classification || "N/A"}</p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${riskColor(data.zoning.compliance_status)}`}>
              {data.zoning.compliance_status}
            </span>
          </div>
          {data.zoning.compliance_note && (
            <p className="text-xs text-gray-500 italic">{data.zoning.compliance_note}</p>
          )}
        </div>
      )}

      {/* Building parameters */}
      {data.building_parameters && (
        <div>
          <SectionLabel>Building Parameters</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["KDB / BCR Allowed", data.building_parameters.kdb_bcr_allowed],
              ["KLB / FAR Allowed", data.building_parameters.klb_far_allowed],
              ["Max Floors",        data.building_parameters.max_floors],
              ["GSB Setback",       data.building_parameters.gsb_setback],
            ].map(([label, val]) => val && (
              <div key={label as string} className="flex justify-between items-center border border-gray-200 rounded-lg px-3 py-2 bg-white">
                <span className="text-xs text-gray-400">{label as string}</span>
                <span className="text-xs font-bold text-gray-800">{val as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permits table */}
      {data.required_permits?.length > 0 && (
        <div>
          <SectionLabel>Required Permits</SectionLabel>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Permit</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Issuer</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Duration</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {data.required_permits.map((p: any, i: number) => (
                  <tr key={i} className={`border-b border-gray-100 last:border-0 ${i%2===0?"bg-white":"bg-gray-50"}`}>
                    <td className="px-3 py-2 font-medium text-gray-800">{p.permit}</td>
                    <td className="px-3 py-2 text-gray-500">{p.issuer}</td>
                    <td className="px-3 py-2 text-gray-600">{p.est_duration}</td>
                    <td className={`px-3 py-2 font-semibold capitalize ${diffColor(p.difficulty)}`}>{p.difficulty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legal risks */}
      {data.legal_risks?.length > 0 && (
        <div>
          <SectionLabel>Legal Risks</SectionLabel>
          <div className="flex flex-col gap-2">
            {data.legal_risks.map((r: any, i: number) => (
              <div key={i} className={`rounded-xl border px-4 py-3 flex flex-col gap-1 ${riskColor(r.severity)}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">{r.risk}</p>
                  <span className="text-[10px] uppercase tracking-wider font-bold">{r.severity}</span>
                </div>
                {r.mitigation && <p className="text-xs opacity-75">→ {r.mitigation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overall risk */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Overall Legal Risk</span>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${riskColor(data.overall_legal_risk)}`}>
          {data.overall_legal_risk}
        </span>
      </div>

      {/* Recommendations */}
      {data.compliance_recommendations?.length > 0 && (
        <div>
          <SectionLabel>Compliance Recommendations</SectionLabel>
          {data.compliance_recommendations.map((r: string, i: number) => (
            <p key={i} className="text-xs text-gray-700 flex gap-2"><span className="text-green-500 shrink-0">✓</span>{r}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   FINANCIAL TAB — revenue chart + cost breakdown + verdict
══════════════════════════════════════════════════════════ */
function FinancialTab({ data }: { data: any }) {
  if (!data) return <NoData/>;

  // Normalize: handle both nested (expected) and flat (actual LLM) formats
  const norm = {
    recommendation: data.recommendation && typeof data.recommendation === "object"
      ? data.recommendation
      : {
          verdict:   String(data.recommendation ?? data.verdict ?? "GO").toUpperCase(),
          rationale: data.rationale ?? "",
          conditions: [],
        },
    returns: data.returns ?? {
      roi_pct:        data.roi_estimate  != null ? `${data.roi_estimate}%`  : null,
      irr_pct:        data.irr_estimate  != null ? `${data.irr_estimate}%`  : null,
      equity_multiple: null,
    },
    projected_revenue: data.projected_revenue ?? {
      year_1:    data.projected_revenue_year_1  != null ? `IDR ${Number(data.projected_revenue_year_1).toLocaleString()}`  : null,
      year_5:    data.projected_revenue_year_5  != null ? `IDR ${Number(data.projected_revenue_year_5).toLocaleString()}`  : null,
      year_10:   data.projected_revenue_year_10 != null ? `IDR ${Number(data.projected_revenue_year_10).toLocaleString()}` : null,
      gdv_total: data.projected_revenue_gdv     != null ? `IDR ${Number(data.projected_revenue_gdv).toLocaleString()}`     : null,
      basis: null,
    },
    project_cost: data.project_cost ?? (
      data.total_estimated_project_cost != null
        ? { total: `IDR ${Number(data.total_estimated_project_cost).toLocaleString()}` }
        : null
    ),
    payback: data.payback ?? {
      payback_period_years:    data.payback_period_years ?? null,
      break_even_units_or_sqm: data.break_even_analysis?.break_even_units
        ? `${data.break_even_analysis.break_even_units} units` : null,
      break_even_revenue: data.break_even_analysis?.break_even_revenue
        ? `IDR ${Number(data.break_even_analysis.break_even_revenue).toLocaleString()}` : null,
      break_even_note: null,
    },
    risk: data.risk ?? {
      overall_rating:    data.financial_risk_assessment ?? null,
      market_risk:       null,
      construction_risk: null,
      regulatory_risk:   null,
      reasoning:         null,
    },
  };

  const riskColor = (r: string) =>
    !r ? "text-gray-400 bg-gray-50 border-gray-200"
    : r === "low"  ? "text-green-700 bg-green-50 border-green-200"
    : r === "high" ? "text-red-700 bg-red-50 border-red-200"
    :                "text-amber-700 bg-amber-50 border-amber-200";

  const verdictColor = (v: string) =>
    !v                             ? "bg-green-600"
    : v.toUpperCase().includes("NO-GO")       ? "bg-red-600"
    : v.toUpperCase().includes("CONDITIONAL") ? "bg-amber-500"
    :                                           "bg-green-600";

  const parseIDR = (s: string | number | null | undefined): number => {
    if (s == null || s === "N/A") return 0;
    if (typeof s === "number") return s;
    return parseInt(String(s).replace(/[^0-9]/g, "")) || 0;
  };

  const revenueData = [
    { label: "Year 1",  value: parseIDR(norm.projected_revenue?.year_1)    },
    { label: "Year 5",  value: parseIDR(norm.projected_revenue?.year_5)    },
    { label: "Year 10", value: parseIDR(norm.projected_revenue?.year_10)   },
    { label: "GDV",     value: parseIDR(norm.projected_revenue?.gdv_total) },
  ].filter(d => d.value > 0);

  const maxRev = Math.max(...revenueData.map(d => d.value), 1);

  const costItems = norm.project_cost
    ? Object.entries(norm.project_cost)
        .filter(([k]) => k !== "total")
        .map(([k, v]) => ({ label: k.replace(/_/g," ").replace(/\b\w/g, c=>c.toUpperCase()), value: v as string }))
    : [];


  return (
    <div className="flex flex-col gap-5">

      {/* Verdict banner */}
      {norm.recommendation && (
        <div className={`${verdictColor(norm.recommendation.verdict)} rounded-2xl p-5 text-white`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-black tracking-wider">{norm.recommendation.verdict}</span>
          </div>
          <p className="text-sm opacity-90 leading-relaxed">{norm.recommendation.rationale}</p>
          {norm.recommendation.conditions?.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              {norm.recommendation.conditions.map((c: string, i: number) => (
                <p key={i} className="text-xs opacity-80 flex gap-2"><span>→</span>{c}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key metrics row */}
      {norm.returns && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "ROI",      value: norm.returns.roi_pct },
            { label: "IRR",      value: norm.returns.irr_pct },
            { label: "Equity ×", value: norm.returns.equity_multiple },
          ].map(m => (
            <div key={m.label} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{m.label}</p>
              <p className="text-lg font-black text-gray-900">{m.value ?? "N/A"}</p>
            </div>
          ))}
        </div>
      )}

      {/* Revenue bar chart */}
      {revenueData.length > 0 && (
        <div>
          <SectionLabel>Projected Revenue</SectionLabel>
          <div className="flex flex-col gap-2">
            {revenueData.map(d => (
              <div key={d.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-12 shrink-0 text-right">{d.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                    style={{ width: `${(d.value / maxRev) * 100}%`, minWidth: d.value > 0 ? "2rem" : "0" }}
                  >
                    {d.value > 0 && (
                      <span className="text-[10px] text-white font-bold">
                        {formatIDR(d.value)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {norm.projected_revenue?.basis && (
            <p className="text-xs text-gray-400 italic mt-2">{norm.projected_revenue.basis}</p>
          )}
        </div>
      )}

      {/* Cost breakdown */}
      {costItems.length > 0 && (
        <div>
          <SectionLabel>Project Cost Breakdown</SectionLabel>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {costItems.map((item, i) => (
              <div key={item.label} className={`flex justify-between items-center px-4 py-2.5 ${i%2===0?"bg-white":"bg-gray-50"} border-b border-gray-100 last:border-0`}>
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-semibold text-gray-800">{item.value}</span>
              </div>
            ))}
            {norm.project_cost?.total && (
              <div className="flex justify-between items-center px-4 py-3 bg-green-50 border-t-2 border-green-200">
                <span className="text-xs font-bold text-green-800 uppercase tracking-wide">Total</span>
                <span className="text-sm font-black text-green-800">{norm.project_cost.total}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payback */}
      {norm.payback && (
        <div>
          <SectionLabel>Payback & Break-even</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Payback Period",   norm.payback.payback_period_years ? `${norm.payback.payback_period_years} years` : null],
              ["Break-even",       norm.payback.break_even_units_or_sqm],
              ["Break-even Rev",   norm.payback.break_even_revenue],
            ].filter(([,v]) => v).map(([k, v]) => (
              <div key={k as string} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{k as string}</p>
                <p className="text-xs font-bold text-gray-800">{v as string}</p>
              </div>
            ))}
          </div>
          {norm.payback.break_even_note && (
            <p className="text-xs text-gray-400 italic mt-2">{norm.payback.break_even_note}</p>
          )}
        </div>
      )}

      {/* Risk assessment */}
      {norm.risk && (
        <div>
          <SectionLabel>Risk Assessment</SectionLabel>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              ["Market Risk",       norm.risk.market_risk],
              ["Construction Risk", norm.risk.construction_risk],
              ["Regulatory Risk",   norm.risk.regulatory_risk],
              ["Overall Risk",      norm.risk.overall_rating],
            ].map(([k, v]) => v && (
              <div key={k as string} className={`flex justify-between items-center border rounded-lg px-3 py-2 ${riskColor(v as string)}`}>
                <span className="text-xs">{k as string}</span>
                <span className="text-xs font-bold capitalize">{v as string}</span>
              </div>
            ))}
          </div>
          {norm.risk.reasoning && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-600 leading-relaxed">{norm.risk.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{children}</p>;
}

function NoData() {
  return <p className="text-sm text-gray-400 italic text-center py-8">No analysis data available</p>;
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
    </svg>
  );
}

function formatIDR(n: number): string {
  if (n >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n/1_000_000).toFixed(0)}M`;
  if (n >= 1_000)         return `${(n/1_000).toFixed(0)}K`;
  return String(n);
}

function ActionBtn({ action, selected, onClick }: { action: ReviewAction; selected: boolean; onClick: () => void }) {
  const cfg = {
    approve: { base:"border-gray-200 text-gray-500", active:"bg-green-50 border-green-300 text-green-700 font-semibold", label:"✓ Approve" },
    edit:    { base:"border-gray-200 text-gray-500", active:"bg-amber-50 border-amber-300 text-amber-700 font-semibold", label:"✎ Edit"    },
    reject:  { base:"border-gray-200 text-gray-500", active:"bg-red-50 border-red-300 text-red-600 font-semibold",       label:"✕ Reject"  },
  }[action];
  return (
    <button onClick={onClick}
      className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${selected ? cfg.active : cfg.base+" hover:bg-gray-50"}`}>
      {cfg.label}
    </button>
  );
}

function safeJSON(s: string): Record<string, unknown> | undefined {
  try { return JSON.parse(s); } catch { return undefined; }
}