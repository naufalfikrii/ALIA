"use client";

import { useState } from "react";
import { DataReviewResponse, HumanReviewDecision, ReviewAction, FetchedData } from "@/types";
import { submitDataReview } from "@/lib/api";

interface DataReviewPanelProps {
  runId: string;
  review: DataReviewResponse;
  onSubmitted: () => void;
}

export function DataReviewPanel({ runId, review, onSubmitted }: DataReviewPanelProps) {
  const [action, setAction]   = useState<ReviewAction>("approve");
  const [notes, setNotes]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Edit state — raw JSON strings for power users
  const [editedPhysical,  setEditedPhysical]  = useState(
    JSON.stringify(review.fetched_data?.physical_data  ?? {}, null, 2)
  );
  const [editedLegal,     setEditedLegal]     = useState(
    JSON.stringify(review.fetched_data?.legal_data     ?? {}, null, 2)
  );
  const [editedEconomic,  setEditedEconomic]  = useState(
    JSON.stringify(review.fetched_data?.economic_data  ?? {}, null, 2)
  );

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const decision: HumanReviewDecision = { action, notes: notes || undefined };
      if (action === "edit") {
        decision.edited_fetched_data = {
          physical_data:  safeJSON(editedPhysical),
          legal_data:     safeJSON(editedLegal),
          economic_data:  safeJSON(editedEconomic),
        };
      }
      await submitDataReview(runId, decision);
      onSubmitted();
    } catch {
      setError("Failed to submit review. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const score = review.guardrail_score;
  const scoreLabel = score !== undefined ? `${Math.round(score * 100)}%` : "N/A";
  const scoreColor = score === undefined ? "text-gray-400"
    : score >= 0.8 ? "text-green-600" : score >= 0.6 ? "text-amber-500" : "text-red-500";

  const fd = review.fetched_data;
  const physical = (fd?.physical_data as any)?.summary ?? fd?.physical_data;
  const legal    = (fd?.legal_data    as any)?.summary ?? fd?.legal_data;
  const economic = (fd?.economic_data as any)?.summary ?? fd?.economic_data;
  const missing  = (fd?.economic_data as any)?.missing ?? [];

  const physicalQuality = (fd?.physical_data as any)?.quality;
  const legalQuality    = (fd?.legal_data    as any)?.quality;
  const economicQuality = (fd?.economic_data as any)?.quality;

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Stage 1 — Fetched Data Review</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Guardrail score: <span className={`font-bold ${scoreColor}`}>{scoreLabel}</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditMode(e => !e)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
            editMode
              ? "bg-amber-50 border-amber-300 text-amber-700"
              : "bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700"
          }`}
        >
          {editMode ? "✎ Editing" : "✎ Edit JSON"}
        </button>
      </div>

      <div className="p-6 flex flex-col gap-5">

        {/* Issues from guardrail */}
        {review.guardrail_issues?.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {review.guardrail_issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{issue}</span>
              </div>
            ))}
          </div>
        )}

        {/* Data cards or JSON editor */}
        {editMode ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Edit Raw Data</p>
            {[
              { label: "🏗 Physical Data",  value: editedPhysical,  onChange: setEditedPhysical  },
              { label: "⚖️ Legal Data",     value: editedLegal,     onChange: setEditedLegal     },
              { label: "📊 Economic Data",  value: editedEconomic,  onChange: setEditedEconomic  },
            ].map(s => (
              <div key={s.label} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">{s.label}</label>
                <textarea
                  value={s.value}
                  onChange={e => s.onChange(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 text-xs font-mono text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-y leading-relaxed"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DataCard
              icon="🏗"
              title="Physical"
              quality={physicalQuality}
              content={physical ? <PhysicalView data={physical}/> : <NoData/>}
            />
            <DataCard
              icon="⚖️"
              title="Legal"
              quality={legalQuality}
              content={legal ? <LegalView data={legal}/> : <NoData/>}
            />
            <DataCard
              icon="📊"
              title="Economic"
              quality={economicQuality}
              content={economic ? <EconomicView data={economic}/> : <NoData/>}
            />
          </div>
        )}

        {/* Missing fields warning */}
        {missing.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
            <span className="text-gray-400 text-xs mt-0.5 shrink-0">Missing:</span>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((m: string) => (
                <span key={m} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500">{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Decision buttons */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Your Decision</p>
          <div className="flex gap-2">
            <ActionBtn action="approve" selected={action === "approve"} onClick={() => { setAction("approve"); setEditMode(false); }}/>
            <ActionBtn action="edit"    selected={action === "edit"}    onClick={() => { setAction("edit");    setEditMode(true);  }}/>
            <ActionBtn action="reject"  selected={action === "reject"}  onClick={() => { setAction("reject");  setEditMode(false); }}/>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Notes (optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add comments about your decision…"
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        {error && (
          <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            action === "reject"
              ? "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
              : "bg-green-700 text-white hover:bg-green-800 shadow-md shadow-green-900/20"
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
              </svg>
              Submitting…
            </>
          ) : (
            `Submit: ${action.charAt(0).toUpperCase() + action.slice(1)}`
          )}
        </button>

      </div>
    </div>
  );
}

/* ── Data card wrapper ──────────────────────────────────────────────────── */
function DataCard({ icon, title, quality, content }: {
  icon: string; title: string; quality?: string; content: React.ReactNode;
}) {
  const qColor = quality === "high" ? "text-green-600 bg-green-50 border-green-200"
    : quality === "medium" ? "text-amber-600 bg-amber-50 border-amber-200"
    : quality === "low"    ? "text-red-500 bg-red-50 border-red-200"
    : "text-gray-400 bg-gray-50 border-gray-200";

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">{icon} {title}</span>
        {quality && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${qColor}`}>
            {quality}
          </span>
        )}
      </div>
      <div className="px-4 py-3 flex-1 text-xs text-gray-600 leading-relaxed flex flex-col gap-2">
        {content}
      </div>
    </div>
  );
}

/* ── Domain-specific views ──────────────────────────────────────────────── */
function PhysicalView({ data }: { data: any }) {
  return (
    <>
      {data.roads?.length > 0 && (
        <div>
          <p className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-1">Roads</p>
          {data.roads.map((r: string, i: number) => (
            <p key={i} className="text-gray-700">• {r}</p>
          ))}
        </div>
      )}
      {data.amenities?.length > 0 && (
        <div>
          <p className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-1">Amenities</p>
          {data.amenities.map((a: string, i: number) => (
            <p key={i} className="text-gray-700">• {a}</p>
          ))}
        </div>
      )}
      {data.transport?.length > 0 && (
        <div>
          <p className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-1">Transport</p>
          {data.transport.map((t: string, i: number) => (
            <p key={i} className="text-gray-700">• {t}</p>
          ))}
        </div>
      )}
      {data.terrain && (
        <div>
          <p className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-1">Terrain</p>
          <p className="text-gray-700">{data.terrain}</p>
        </div>
      )}
    </>
  );
}

function LegalView({ data }: { data: any }) {
  return (
    <>
      {data.zoning ? (
        <Row label="Zoning" value={data.zoning}/>
      ) : (
        <p className="text-gray-400 italic">Zoning not found</p>
      )}
      {data.kdb && <Row label="KDB / BCR" value={data.kdb}/>}
      {data.klb && <Row label="KLB / FAR" value={data.klb}/>}
      {data.notes && (
        <p className="text-gray-500 italic text-[11px] mt-1">{data.notes}</p>
      )}
    </>
  );
}

function EconomicView({ data }: { data: any }) {
  return (
    <>
      {data.price_per_sqm && (
        <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wider mb-0.5">Price / m²</p>
          <p className="text-base font-bold text-green-700">{data.price_per_sqm}</p>
        </div>
      )}
      {data.price_range && <Row label="Range" value={data.price_range}/>}
      {data.sample_listings?.length > 0 && (
        <div>
          <p className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] mb-1">Sample Listings</p>
          {data.sample_listings.map((l: string, i: number) => (
            <p key={i} className="text-gray-700">• {l}</p>
          ))}
        </div>
      )}
      {data.market_note && (
        <p className="text-gray-500 italic text-[11px] mt-1">{data.market_note}</p>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium text-right">{value}</span>
    </div>
  );
}

function NoData() {
  return <p className="text-gray-400 italic text-xs">No data available</p>;
}

/* ── Action buttons ─────────────────────────────────────────────────────── */
function ActionBtn({ action, selected, onClick }: { action: ReviewAction; selected: boolean; onClick: () => void }) {
  const cfg = {
    approve: { base: "border-gray-200 text-gray-500", active: "bg-green-50 border-green-300 text-green-700 font-semibold", label: "✓ Approve" },
    edit:    { base: "border-gray-200 text-gray-500", active: "bg-amber-50 border-amber-300 text-amber-700 font-semibold", label: "✎ Edit"    },
    reject:  { base: "border-gray-200 text-gray-500", active: "bg-red-50 border-red-300 text-red-600 font-semibold",       label: "✕ Reject"  },
  }[action];
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${selected ? cfg.active : cfg.base + " hover:bg-gray-50"}`}
    >
      {cfg.label}
    </button>
  );
}

function safeJSON(s: string): Record<string, unknown> | undefined {
  try { return JSON.parse(s); } catch { return undefined; }
}