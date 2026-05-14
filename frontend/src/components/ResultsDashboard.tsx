import React, { useEffect, useRef, useState } from "react";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { getScanStatus } from "../api";
import { JobResult, ScanStatus } from "../types";
import JobCard from "./JobCard";

interface Props {
  scanId: string;
  resumeSummary?: string;
}

type RecFilter = "all" | "apply" | "maybe" | "skip";
type SortKey = "score_desc" | "score_asc" | "date_desc";

const STATUS_LABELS: Record<ScanStatus["status"], string> = {
  pending: "Preparing scan...",
  running: "Scraping job boards...",
  scoring: "Scoring jobs with AI...",
  completed: "Scan complete",
  failed: "Scan failed",
};

function ProgressBar({ progress, status }: { progress: number; status: ScanStatus["status"] }) {
  const isActive = status === "running" || status === "scoring" || status === "pending";
  const isFailed = status === "failed";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${isFailed ? "text-red-600" : "text-slate-700"}`}>
          {STATUS_LABELS[status]}
        </span>
        <span className="text-sm font-bold text-slate-500 tabular-nums">{progress}%</span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isFailed
              ? "bg-red-400"
              : status === "completed"
              ? "bg-emerald-500"
              : "bg-blue-500"
          } ${isActive && progress < 100 ? "animate-pulse" : ""}`}
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>
    </div>
  );
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center p-4 bg-white border border-slate-200 rounded-2xl min-w-[90px]">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-slate-500 mt-0.5 text-center leading-tight">{label}</span>
    </div>
  );
}

function sortJobs(jobs: JobResult[], key: SortKey): JobResult[] {
  const copy = [...jobs];
  if (key === "score_desc") {
    return copy.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
  }
  if (key === "score_asc") {
    return copy.sort((a, b) => (a.match_score ?? 101) - (b.match_score ?? 101));
  }
  if (key === "date_desc") {
    return copy.sort((a, b) => {
      const da = a.date_posted ?? "";
      const db = b.date_posted ?? "";
      return db.localeCompare(da);
    });
  }
  return copy;
}

export default function ResultsDashboard({ scanId }: Props) {
  const [scan, setScan] = useState<ScanStatus | null>(null);
  const [recFilter, setRecFilter] = useState<RecFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("score_desc");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getScanStatus(scanId);
        if (!cancelled) {
          setScan(data);
          if (data.status === "completed" || data.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || err?.message || "Failed to fetch scan status.");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [scanId]);

  const isLoading = !scan || scan.status === "pending" || scan.status === "running" || scan.status === "scoring";
  const isDone = scan?.status === "completed";
  const isFailed = scan?.status === "failed";

  const allResults = scan?.results ?? [];
  const applyCount = allResults.filter((j) => j.recommendation === "apply").length;
  const maybeCount = allResults.filter((j) => j.recommendation === "maybe").length;
  const skipCount = allResults.filter((j) => j.recommendation === "skip").length;

  const filtered =
    recFilter === "all"
      ? allResults
      : allResults.filter((j) => j.recommendation === recFilter);

  const sorted = sortJobs(filtered, sortKey);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Status Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-0.5">
            {isFailed ? (
              <AlertCircle className="w-6 h-6 text-red-500" />
            ) : isDone ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <ProgressBar progress={scan?.progress ?? 0} status={scan?.status ?? "pending"} />
            {isFailed && scan?.error && (
              <p className="mt-2 text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-200">
                {scan.error}
              </p>
            )}
            {scan?.resume_summary && isDone && (
              <p className="mt-2 text-sm text-slate-500">{scan.resume_summary}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        {allResults.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-3">
            <StatBadge label="Jobs Found" value={scan?.total_found ?? 0} color="text-slate-700" />
            <StatBadge label="Jobs Scored" value={scan?.total_scored ?? 0} color="text-blue-600" />
            <StatBadge label="Apply" value={applyCount} color="text-emerald-600" />
            <StatBadge label="Maybe" value={maybeCount} color="text-amber-600" />
            <StatBadge label="Skip" value={skipCount} color="text-slate-400" />
          </div>
        )}
      </div>

      {/* Filter & Sort Bar */}
      {allResults.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filter:</span>
          </div>
          {(["all", "apply", "maybe", "skip"] as RecFilter[]).map((f) => {
            const counts: Record<RecFilter, number> = {
              all: allResults.length,
              apply: applyCount,
              maybe: maybeCount,
              skip: skipCount,
            };
            return (
              <button
                key={f}
                onClick={() => setRecFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  recFilter === f
                    ? f === "apply"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : f === "maybe"
                      ? "bg-amber-500 text-white border-amber-500"
                      : f === "skip"
                      ? "bg-slate-500 text-white border-slate-500"
                      : "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-500" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="score_desc">Score: High to Low</option>
              <option value="score_asc">Score: Low to High</option>
              <option value="date_desc">Most Recent</option>
            </select>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {sorted.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <BarChart3 className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Scanning job boards...</p>
          <p className="text-sm mt-1">Results will appear here as they're scored</p>
        </div>
      ) : isFailed ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <AlertCircle className="w-12 h-12 mb-4 text-red-300" />
          <p className="text-lg font-medium text-red-500">Scan failed</p>
          <p className="text-sm mt-1">{scan?.error}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <BarChart3 className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No jobs found</p>
          <p className="text-sm mt-1">
            Try broadening your search — add more titles, change the location, or extend the date range.
          </p>
        </div>
      )}
    </div>
  );
}
