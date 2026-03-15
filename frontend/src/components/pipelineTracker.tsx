"use client";

import { PipelineStage } from "@/types";
import { STAGE_LABELS, DISPLAY_STAGES } from "@/lib/pipeline";

interface PipelineTrackerProps {
  stage: PipelineStage;
  status: "running" | "completed" | "failed";
}

function getDisplayIndex(stage: PipelineStage): number {
  const idx = DISPLAY_STAGES.indexOf(stage);
  // "initializing" / "idle" map to -1 → treat as before step 0 (nothing lit yet)
  return idx === -1 ? -1 : idx;
}

export function PipelineTracker({ stage, status }: PipelineTrackerProps) {
  const isFailed  = status === "failed" || stage === "failed";
  const activeIdx = getDisplayIndex(stage);

  // Progress line width: 0% if not started yet, 100% if failed
  const progressPct = isFailed
    ? 100
    : activeIdx < 0
    ? 0
    : (activeIdx / (DISPLAY_STAGES.length - 1)) * 100;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Pipeline Progress
        </p>
        {stage === "initializing" || stage === "idle" ? (
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
            Starting up…
          </span>
        ) : null}
      </div>

      <div className="relative">
        {/* Base track */}
        <div className="absolute top-4 left-4 right-4 h-px bg-gray-200" />

        {/* Progress fill */}
        <div
          className={`absolute top-4 left-4 h-px transition-all duration-700 ${isFailed ? "bg-red-400" : "bg-green-600"}`}
          style={{ width: `calc(${progressPct}% - 2rem)` }}
        />

        {/* Step nodes */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${DISPLAY_STAGES.length}, 1fr)` }}
        >
          {DISPLAY_STAGES.map((s, i) => {
            const isComplete = !isFailed && i < activeIdx;
            const isCurrent  = s === stage && !isFailed;
            const isHuman    = s === "awaiting_human_data_review" || s === "awaiting_human_output_review";
            const isFuture   = activeIdx < 0 || i > activeIdx;

            const nodeCls = isFailed && isCurrent
              ? "bg-red-100 border-red-400 text-red-500"
              : isFailed && i <= activeIdx
              ? "bg-red-50 border-red-300 text-red-400"
              : isComplete
              ? "bg-green-600 border-green-600 text-white"
              : isCurrent
              ? "bg-green-50 border-green-600 text-green-700 animate-pulse"
              : "bg-white border-gray-200 text-gray-300";

            return (
              <div key={s} className="flex flex-col items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${nodeCls}`}>
                  {isComplete ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isFailed && isCurrent ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : isHuman ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span className={`text-center text-[10px] leading-tight font-medium transition-colors max-w-[72px] ${
                  isCurrent && !isFailed ? "text-green-700"
                  : isComplete           ? "text-gray-500"
                  : isFailed && isCurrent ? "text-red-500"
                  :                        "text-gray-300"
                }`}>
                  {STAGE_LABELS[s]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}