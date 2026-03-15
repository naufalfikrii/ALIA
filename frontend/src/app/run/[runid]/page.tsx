"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PipelineStatus_Response, DataReviewResponse, OutputReviewResponse, PipelineStage } from "@/types";
import { getPipelineStatus, getDataForReview, getOutputForReview, getDownloadUrl } from "@/lib/api";
import { PipelineTracker }   from "@/components/pipelineTracker";
import { GuardrailCard }     from "@/components/guardrailCard";
import { DataReviewPanel }   from "@/components/dataReviewPanel";
import { OutputReviewPanel } from "@/components/outputReviewPanel";
import { STAGE_DESCRIPTIONS, isTerminal } from "@/lib/pipeline";

export default function RunPage() {
  const params = useParams();
  const runId  = ((params?.runId ?? params?.runid) as string) ?? "";
  console.log("[ALIA] params:", JSON.stringify(params), "runId:", runId);

  const [status,       setStatus]       = useState<PipelineStatus_Response | null>(null);
  const [dataReview,   setDataReview]   = useState<DataReviewResponse | null>(null);
  const [outputReview, setOutputReview] = useState<OutputReviewResponse | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [submitted,    setSubmitted]    = useState(false);
  const [booting,      setBooting]      = useState(true);

  const runIdRef    = useRef(runId);
  const statusRef   = useRef(status);
  runIdRef.current  = runId;
  statusRef.current = status;

  useEffect(() => {
    if (!runId) return;

    let stopped = false;

    async function tick() {
      const id = runIdRef.current;
      if (!id) return;
      if (stopped) return;

      // Stop if already terminal
      const cur = statusRef.current;
      if (cur && isTerminal(cur.stage, cur.status)) {
        stopped = true;
        return;
      }

      console.log("[ALIA] polling", id); // ← you should see this in browser console

      try {
        const s = await getPipelineStatus(id);
        if (stopped) return;
        setStatus(s);
        setError(null);
        setBooting(false);

        if (s.stage === "awaiting_human_data_review") {
          try {
            const dr = await getDataForReview(id);
            setDataReview(dr);
          } catch {}
        }

        if (s.stage === "awaiting_human_output_review") {
          try {
            const or = await getOutputForReview(id);
            setOutputReview(or);
          } catch {}
        }

      } catch (e: any) {
        if (stopped) return;
        setBooting(false);
        setError(e?.message ?? "Failed to reach API");
        console.error("[ALIA] fetch error", e);
      }
    }

    // Fire immediately
    tick();

    // Then every 5 seconds
    const interval = setInterval(tick, 5000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [runId]); // only re-run if runId changes

  const onReviewed = () => {
    setSubmitted(true);
    setDataReview(null);
    setOutputReview(null);
    setTimeout(() => setSubmitted(false), 1500);
  };

  const stage   = status?.stage  ?? ("initializing" as PipelineStage);
  const pstatus = status?.status ?? "running";
  const done    = status ? isTerminal(status.stage, status.status) : false;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <div className="w-8 h-8 rounded-lg bg-green-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-semibold text-gray-900 text-base">ALIA</span>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-400">
              Run <span className="font-medium text-gray-600">{runId.slice(0,8)}…</span>
            </span>
          </div>
          {status?.pdf_ready && (
            <a href={getDownloadUrl(runId)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors no-underline">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Download Report
            </a>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 flex flex-col gap-6">

        {/* Run banner */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Feasibility Run</p>
            <h1 className="text-xl font-bold text-gray-900">{runId.slice(0,8)}<span className="text-gray-300">…</span></h1>
            <p className="text-sm text-gray-500 mt-1">
              {error ? "Connection error" : STAGE_DESCRIPTIONS[stage]}
            </p>
          </div>
          <StatusPill stage={stage} pstatus={pstatus} booting={booting} />
        </div>

        {/* Tracker */}
        <PipelineTracker stage={stage} status={pstatus as "running"|"completed"|"failed"} />

        {/* Error */}
        {error && (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 flex flex-col gap-3">
            <p className="font-semibold text-red-600 text-sm">{error}</p>
            <div className="text-xs text-gray-500 flex flex-col gap-1">
              <p>• Is <code className="bg-gray-100 px-1 rounded">uvicorn main:app --reload</code> running?</p>
              <p>• Is CORS set to allow <code className="bg-gray-100 px-1 rounded">http://localhost:3000</code>?</p>
              <p>• Did the backend restart? (in-memory state lost — submit a new run)</p>
            </div>
            <button onClick={() => { setError(null); setBooting(true); }}
              className="w-fit px-4 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors">
              Retry
            </button>
          </div>
        )}

        {/* Booting */}
        {booting && !error && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col items-center gap-3">
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-2 h-2 rounded-full bg-green-300 animate-bounce" style={{animationDelay:`${i*150}ms`}}/>
              ))}
            </div>
            <p className="text-sm text-gray-500">Connecting to pipeline…</p>
            <p className="text-xs text-gray-400">Check browser console for <code className="bg-gray-100 px-1 rounded">[ALIA] polling</code> logs</p>
          </div>
        )}

        {/* Live content */}
        {status && (
          <>
            {submitted && (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                Decision submitted — pipeline resuming…
              </div>
            )}

            {/* Guardrails */}
            {(status.data_score != null || status.output_score != null) && (
              <div className="grid sm:grid-cols-2 gap-4">
                {status.data_score != null && (
                  <GuardrailCard title="Data Guardrail"
                    result={{ approved: status.data_score >= 0.7, stage: "data_check", score: status.data_score, issues: status.data_issues }}
                  />
                )}
                {status.output_score != null && (
                  <GuardrailCard title="Output Guardrail"
                    result={{ approved: status.output_score >= 0.7, stage: "output_check", score: status.output_score, issues: status.output_issues }}
                  />
                )}
              </div>
            )}

            {/* Review panels */}
            {status.stage === "awaiting_human_data_review" && !submitted && (
              dataReview
                ? <DataReviewPanel runId={runId} review={dataReview} onSubmitted={onReviewed}/>
                : <div className="bg-white rounded-2xl border border-amber-200 p-6 flex items-center gap-3 text-sm text-gray-500">
                    <svg className="animate-spin w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                    </svg>
                    Loading review data…
                  </div>
            )}
            {status.stage === "awaiting_human_output_review" && !submitted && (
              outputReview
                ? <OutputReviewPanel runId={runId} review={outputReview} onSubmitted={onReviewed}/>
                : <div className="bg-white rounded-2xl border border-amber-200 p-6 flex items-center gap-3 text-sm text-gray-500">
                    <svg className="animate-spin w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                    </svg>
                    Loading review data…
                  </div>
            )}

            {/* Agent activity */}
            {["fetching","analysing","generating_pdf"].includes(status.stage) && <AgentActivity stage={status.stage}/>}

            {/* Completed */}
            {status.stage === "completed" && (
              <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-10 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Feasibility Study Complete</h2>
                <a href={getDownloadUrl(runId)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-8 py-3.5 bg-green-700 hover:bg-green-800 text-white font-semibold text-sm rounded-xl transition-colors no-underline">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Download PDF Report
                </a>
              </div>
            )}

            {/* Failed */}
            {status.stage === "failed" && (
              <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-10 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Pipeline Stopped</h2>
                <Link href="/" className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-xl transition-colors no-underline">
                  ← Start New Analysis
                </Link>
              </div>
            )}
          </>
        )}

        {/* Poll indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className={`w-1.5 h-1.5 rounded-full ${done ? "bg-gray-300" : "bg-green-400 animate-pulse"}`}/>
          {done ? "Polling stopped — pipeline finished" : `Polling every 5s`}
        </div>

      </main>
    </div>
  );
}

function StatusPill({ stage, pstatus, booting }: { stage: string; pstatus: string; booting: boolean }) {
  if (booting) return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-400">
      <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse"/> Connecting…
    </div>
  );
  const isWaiting = stage === "awaiting_human_data_review" || stage === "awaiting_human_output_review";
  const isDone    = stage === "completed" || pstatus === "completed";
  const isFailed  = stage === "failed"   || pstatus === "failed";
  const c = isFailed  ? {bg:"bg-red-100",   text:"text-red-600",   dot:"bg-red-400",   label:"Failed",          pulse:false}
    : isDone    ? {bg:"bg-green-100", text:"text-green-700", dot:"bg-green-500", label:"Completed",       pulse:false}
    : isWaiting ? {bg:"bg-amber-100", text:"text-amber-700", dot:"bg-amber-400", label:"Action Required", pulse:true }
    :             {bg:"bg-blue-100",  text:"text-blue-700",  dot:"bg-blue-400",  label:"Running",         pulse:true };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot} ${c.pulse?"animate-pulse":""}`}/>
      {c.label}
    </div>
  );
}

const AGENTS: Record<string,{label:string;items:string[]}> = {
  fetching:       {label:"Data agents running in parallel",      items:["🏗  Physical Data Fetcher","⚖️  Legal Permit Researcher","📊  Land Price & Economic Searcher"]},
  analysing:      {label:"Analysis agents running sequentially", items:["🏗  Physical Analyst","⚖️  Legal Analyst","💰  Financial Analyst"]},
  generating_pdf: {label:"Compiling final report",               items:["📄  PDF Generator"]},
};

function AgentActivity({ stage }: { stage: string }) {
  const info = AGENTS[stage];
  if (!info) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{info.label}</p>
      <div className="flex flex-col gap-3">
        {info.items.map((name,i) => (
          <div key={name} className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" style={{animationDelay:`${i*250}ms`}}/>
            <span className="text-sm text-gray-700">{name}</span>
            <span className="ml-auto text-xs text-gray-300">running…</span>
          </div>
        ))}
      </div>
    </div>
  );
}