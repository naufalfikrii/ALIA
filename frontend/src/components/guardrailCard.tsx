"use client";

import { GuardrailResult } from "@/types";

interface GuardrailCardProps {
  result: GuardrailResult;
  title: string;
}

export function GuardrailCard({ result, title }: GuardrailCardProps) {
  const pct = Math.round(result.score * 100);

  const barColor  = pct >= 80 ? "bg-green-500"  : pct >= 60 ? "bg-amber-400"  : "bg-red-400";
  const scoreText = pct >= 80 ? "text-green-600" : pct >= 60 ? "text-amber-500" : "text-red-500";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">

      {/* Title + badge */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          result.approved
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-600"
        }`}>
          {result.approved ? "Approved" : "Flagged"}
        </span>
      </div>

      {/* Score bar */}
      <div>
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-xs text-gray-400">Confidence Score</span>
          <span className={`text-sm font-bold tabular-nums ${scoreText}`}>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Issues */}
      {result.issues.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Issues</p>
          {result.issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
              <svg className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span className="text-xs text-red-600 leading-relaxed">{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestion */}
      {result.suggestion && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg">
          <svg className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-blue-600 leading-relaxed">{result.suggestion}</span>
        </div>
      )}

    </div>
  );
}