import React, { useState } from "react";
import {
  ExternalLink,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  Wifi,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { JobResult } from "../types";

const SITE_COLORS: Record<string, string> = {
  linkedin: "bg-blue-600 text-white",
  indeed: "bg-indigo-600 text-white",
  glassdoor: "bg-emerald-600 text-white",
  zip_recruiter: "bg-violet-600 text-white",
  google: "bg-red-500 text-white",
  unknown: "bg-slate-500 text-white",
};

const SITE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  zip_recruiter: "ZipRecruiter",
  google: "Google Jobs",
};

function ScoreCircle({ score }: { score: number | undefined }) {
  if (score === undefined || score === null) {
    return (
      <div className="flex items-center justify-center w-14 h-14 rounded-full border-4 border-slate-200 bg-white flex-shrink-0">
        <span className="text-xs text-slate-400 font-medium">N/A</span>
      </div>
    );
  }

  const color =
    score >= 75
      ? "border-emerald-400 text-emerald-600"
      : score >= 50
      ? "border-amber-400 text-amber-600"
      : "border-red-400 text-red-500";

  return (
    <div
      className={`flex flex-col items-center justify-center w-14 h-14 rounded-full border-4 bg-white flex-shrink-0 ${color}`}
    >
      <span className="text-sm font-bold leading-none">{score}</span>
      <span className="text-[9px] font-medium leading-none mt-0.5 opacity-70">/ 100</span>
    </div>
  );
}

function RecBadge({ rec }: { rec: JobResult["recommendation"] }) {
  if (!rec) return null;
  const styles: Record<string, string> = {
    apply: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    maybe: "bg-amber-100 text-amber-700 border border-amber-200",
    skip: "bg-slate-100 text-slate-500 border border-slate-200",
  };
  const labels = { apply: "Apply", maybe: "Maybe", skip: "Skip" };
  return (
    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${styles[rec]}`}>
      {labels[rec]}
    </span>
  );
}

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

interface Props {
  job: JobResult;
}

export default function JobCard({ job }: Props) {
  const [expanded, setExpanded] = useState(false);

  const siteKey = (job.site || "unknown").toLowerCase().replace(/ /g, "_");
  const siteColor = SITE_COLORS[siteKey] || SITE_COLORS.unknown;
  const siteLabel = SITE_LABELS[siteKey] || job.site;
  const salary = formatSalary(job.min_salary, job.max_salary);

  const visibleMatching = job.matching_skills.slice(0, 5);
  const visibleMissing = job.missing_skills.slice(0, 3);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
      {/* Card Header */}
      <div className="p-5 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${siteColor}`}>
              {siteLabel}
            </span>
            {job.is_remote && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                <Wifi className="w-3 h-3" />
                Remote
              </span>
            )}
            <RecBadge rec={job.recommendation} />
          </div>

          <h3 className="font-bold text-slate-900 text-base leading-snug truncate">
            {job.title}
          </h3>

          {job.company && (
            <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-sm">
              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{job.company}</span>
            </div>
          )}
        </div>

        <ScoreCircle score={job.match_score} />
      </div>

      {/* Meta Row */}
      <div className="px-5 pb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
        {job.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {job.location}
          </span>
        )}
        {salary && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            {salary}
          </span>
        )}
        {job.date_posted && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {job.date_posted}
          </span>
        )}
      </div>

      {/* Skills */}
      {(visibleMatching.length > 0 || visibleMissing.length > 0) && (
        <div className="px-5 pb-4 space-y-2.5">
          {visibleMatching.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleMatching.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs rounded-full font-medium"
                >
                  {s}
                </span>
              ))}
              {job.matching_skills.length > 5 && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
                  +{job.matching_skills.length - 5} more
                </span>
              )}
            </div>
          )}
          {visibleMissing.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleMissing.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 text-xs rounded-full font-medium"
                >
                  {s}
                </span>
              ))}
              {job.missing_skills.length > 3 && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
                  +{job.missing_skills.length - 3} missing
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reasoning */}
      {job.match_reasoning && (
        <div className="px-5 pb-4">
          <p
            className={`text-sm text-slate-600 leading-relaxed ${
              !expanded ? "line-clamp-2" : ""
            }`}
          >
            {job.match_reasoning}
          </p>
          {job.match_reasoning.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto px-5 py-3 bg-slate-50 border-t border-slate-100">
        {job.job_url ? (
          <a
            href={job.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-colors duration-150"
          >
            View Job
            <ExternalLink className="w-4 h-4" />
          </a>
        ) : (
          <div className="text-center text-xs text-slate-400">No URL available</div>
        )}
      </div>
    </div>
  );
}
