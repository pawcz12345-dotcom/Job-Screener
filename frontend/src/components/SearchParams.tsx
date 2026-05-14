import React, { useState } from "react";
import {
  Search,
  MapPin,
  X,
  Plus,
  ChevronLeft,
  Loader2,
  Briefcase,
  DollarSign,
  Clock,
} from "lucide-react";
import { ScanParameters } from "../types";
import { startScan } from "../api";

interface Props {
  resumeId: string;
  params: ScanParameters;
  onParamsChange: (params: ScanParameters) => void;
  onScanStarted: (scanId: string) => void;
  onBack: () => void;
}

const ALL_SITES = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "indeed", label: "Indeed" },
  { id: "glassdoor", label: "Glassdoor" },
  { id: "zip_recruiter", label: "ZipRecruiter" },
  { id: "google", label: "Google Jobs" },
];

const REMOTE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
] as const;

const EXPERIENCE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "staff", label: "Staff" },
] as const;

const HOURS_OPTIONS = [
  { value: 24, label: "Last 24h" },
  { value: 72, label: "Last 3 days" },
  { value: 168, label: "Last week" },
  { value: 720, label: "Last month" },
];

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
            value === opt.value
              ? "bg-white text-blue-600 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-2">
      {children}
    </label>
  );
}

export default function SearchParams({
  resumeId,
  params,
  onParamsChange,
  onScanStarted,
  onBack,
}: Props) {
  const [titleInput, setTitleInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<ScanParameters>) =>
    onParamsChange({ ...params, ...patch });

  const addTitle = () => {
    const trimmed = titleInput.trim();
    if (trimmed && !params.job_titles.includes(trimmed)) {
      update({ job_titles: [...params.job_titles, trimmed] });
    }
    setTitleInput("");
  };

  const removeTitle = (t: string) =>
    update({ job_titles: params.job_titles.filter((x) => x !== t) });

  const toggleSite = (id: string) => {
    const next = params.sites.includes(id)
      ? params.sites.filter((s) => s !== id)
      : [...params.sites, id];
    update({ sites: next });
  };

  const handleStart = async () => {
    if (params.job_titles.length === 0) {
      setError("Add at least one job title.");
      return;
    }
    if (params.sites.length === 0) {
      setError("Select at least one job site.");
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const res = await startScan(resumeId, params);
      onScanStarted(res.scan_id);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || err?.message || "Failed to start scan."
      );
      setStarting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Configure Your Search
        </h2>
        <p className="text-slate-500">
          Tune the parameters below to find the best matching jobs for your
          resume.
        </p>
      </div>

      <div className="space-y-6">
        {/* Job Titles */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <SectionLabel>
            <span className="flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-500" />
              Job Titles / Keywords
            </span>
          </SectionLabel>
          <div className="flex gap-2">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTitle();
                }
              }}
              placeholder='e.g. "Software Engineer" — press Enter to add'
              className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <button
              type="button"
              onClick={addTitle}
              disabled={!titleInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          {params.job_titles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {params.job_titles.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium rounded-full"
                >
                  {t}
                  <button
                    onClick={() => removeTitle(t)}
                    className="text-blue-400 hover:text-blue-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <SectionLabel>
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              Location
            </span>
          </SectionLabel>
          <input
            type="text"
            value={params.location}
            onChange={(e) => update({ location: e.target.value })}
            placeholder="e.g. San Francisco, CA or New York, NY"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
        </div>

        {/* Remote & Experience */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <SectionLabel>Work Arrangement</SectionLabel>
            <SegmentedControl
              options={REMOTE_OPTIONS}
              value={params.remote_preference}
              onChange={(v) => update({ remote_preference: v })}
            />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <SectionLabel>Experience Level</SectionLabel>
            <SegmentedControl
              options={EXPERIENCE_OPTIONS}
              value={params.experience_level}
              onChange={(v) => update({ experience_level: v })}
            />
          </div>
        </div>

        {/* Job Type & Posted Within */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <SectionLabel>
              <span className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-500" />
                Job Type
              </span>
            </SectionLabel>
            <select
              value={params.job_type}
              onChange={(e) =>
                update({ job_type: e.target.value as ScanParameters["job_type"] })
              }
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="any">Any</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <SectionLabel>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Posted Within
              </span>
            </SectionLabel>
            <div className="flex flex-wrap gap-2">
              {HOURS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ hours_old: opt.value })}
                  className={`px-3 py-2 text-sm rounded-xl border font-medium transition-all ${
                    params.hours_old === opt.value
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Salary Range */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <SectionLabel>
            <span className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-500" />
              Salary Range (USD/year, optional)
            </span>
          </SectionLabel>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="number"
                min={0}
                step={5000}
                value={params.min_salary ?? ""}
                onChange={(e) =>
                  update({
                    min_salary: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="Min (e.g. 80000)"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <span className="text-slate-400 text-sm font-medium">to</span>
            <div className="flex-1">
              <input
                type="number"
                min={0}
                step={5000}
                value={params.max_salary ?? ""}
                onChange={(e) =>
                  update({
                    max_salary: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="Max (e.g. 150000)"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        {/* Sites */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <SectionLabel>Job Sites to Scan</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ALL_SITES.map((site) => {
              const checked = params.sites.includes(site.id);
              return (
                <label
                  key={site.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                    checked
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSite(site.id)}
                    className="w-4 h-4 accent-blue-600 flex-shrink-0"
                  />
                  <span
                    className={`text-sm font-medium ${
                      checked ? "text-blue-700" : "text-slate-600"
                    }`}
                  >
                    {site.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Results per site */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Results per Site</SectionLabel>
            <span className="text-sm font-bold text-blue-600 tabular-nums">
              {params.results_per_site}
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={params.results_per_site}
            onChange={(e) => update({ results_per_site: parseInt(e.target.value) })}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>5 (faster)</span>
            <span>50 (more results)</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pb-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-3 border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800 font-medium rounded-xl transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={
              starting ||
              params.job_titles.length === 0 ||
              params.sites.length === 0
            }
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-150 shadow-sm text-sm"
          >
            {starting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting scan...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Start Scanning
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
