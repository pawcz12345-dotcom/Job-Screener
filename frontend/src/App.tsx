import React, { useState } from "react";
import { FileText, Settings, BarChart3, Check } from "lucide-react";
import { AppStep, ResumeUploadResponse, ScanParameters } from "./types";
import ResumeUpload from "./components/ResumeUpload";
import SearchParams from "./components/SearchParams";
import ResultsDashboard from "./components/ResultsDashboard";

const DEFAULT_PARAMS: ScanParameters = {
  job_titles: [],
  location: "",
  remote_preference: "any",
  min_salary: undefined,
  max_salary: undefined,
  experience_level: "any",
  job_type: "any",
  results_per_site: 20,
  sites: ["linkedin", "indeed", "glassdoor"],
  hours_old: 72,
};

const STEPS = [
  { id: 1, label: "Upload Resume", icon: FileText },
  { id: 2, label: "Configure Search", icon: Settings },
  { id: 3, label: "Results", icon: BarChart3 },
] as const;

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>(1);
  const [resumeData, setResumeData] = useState<ResumeUploadResponse | null>(null);
  const [scanParams, setScanParams] = useState<ScanParameters>(DEFAULT_PARAMS);
  const [scanId, setScanId] = useState<string | null>(null);

  const handleResumeUploaded = (data: ResumeUploadResponse) => {
    setResumeData(data);
  };

  const handleResumeNext = () => {
    setCurrentStep(2);
  };

  const handleScanStarted = (id: string) => {
    setScanId(id);
    setCurrentStep(3);
  };

  const handleStartOver = () => {
    setCurrentStep(1);
    setResumeData(null);
    setScanId(null);
    setScanParams(DEFAULT_PARAMS);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Job Screener
                </h1>
                <p className="text-slate-400 text-xs">
                  AI-powered resume matching
                </p>
              </div>
            </div>
            {currentStep === 3 && (
              <button
                onClick={handleStartOver}
                className="text-sm text-slate-400 hover:text-white transition-colors border border-slate-600 hover:border-slate-400 px-4 py-1.5 rounded-lg"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center justify-center gap-0" aria-label="Progress">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isActive = currentStep === step.id;
              const isLast = idx === STEPS.length - 1;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`
                        flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300
                        ${isCompleted
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : isActive
                          ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200"
                          : "bg-white border-slate-300 text-slate-400"
                        }
                      `}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" strokeWidth={2.5} />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${
                        isActive
                          ? "text-blue-600"
                          : isCompleted
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`h-0.5 w-24 sm:w-36 mx-2 mb-5 transition-all duration-500 ${
                        currentStep > step.id
                          ? "bg-emerald-400"
                          : "bg-slate-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === 1 && (
          <ResumeUpload
            onResumeUploaded={handleResumeUploaded}
            onNext={handleResumeNext}
            resumeData={resumeData}
          />
        )}
        {currentStep === 2 && resumeData && (
          <SearchParams
            resumeId={resumeData.resume_id}
            params={scanParams}
            onParamsChange={setScanParams}
            onScanStarted={handleScanStarted}
            onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && scanId && (
          <ResultsDashboard
            scanId={scanId}
            resumeSummary={undefined}
          />
        )}
      </main>
    </div>
  );
}
