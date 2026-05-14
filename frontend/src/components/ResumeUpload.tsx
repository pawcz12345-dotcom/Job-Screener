import React, { useCallback, useRef, useState } from "react";
import {
  CloudUpload,
  FileText,
  FileType,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { uploadResume } from "../api";
import { ResumeUploadResponse } from "../types";

interface Props {
  onResumeUploaded: (data: ResumeUploadResponse) => void;
  onNext: () => void;
  resumeData: ResumeUploadResponse | null;
}

type UploadState = "idle" | "uploading" | "success" | "error";

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    return (
      <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl">
        <FileType className="w-7 h-7 text-red-500" />
      </div>
    );
  }
  if (ext === "docx" || ext === "doc") {
    return (
      <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
        <FileText className="w-7 h-7 text-blue-500" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-12 h-12 bg-slate-100 rounded-xl">
      <FileText className="w-7 h-7 text-slate-500" />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResumeUpload({ onResumeUploaded, onNext, resumeData }: Props) {
  const [uploadState, setUploadState] = useState<UploadState>(
    resumeData ? "success" : "idle"
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [localResumeData, setLocalResumeData] = useState<ResumeUploadResponse | null>(resumeData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
  ];
  const ACCEPTED_EXTS = [".pdf", ".docx", ".doc", ".txt"];

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTS.includes(ext)) {
      return `Unsupported file type. Please upload PDF, DOCX, or TXT.`;
    }
    if (file.size > 10 * 1024 * 1024) {
      return "File is too large. Maximum size is 10 MB.";
    }
    return null;
  };

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setErrorMsg(validationError);
        setUploadState("error");
        return;
      }

      setCurrentFile(file);
      setUploadState("uploading");
      setUploadProgress(0);
      setErrorMsg("");

      try {
        const data = await uploadResume(file, (pct) => {
          setUploadProgress(pct);
        });
        setLocalResumeData(data);
        onResumeUploaded(data);
        setUploadState("success");
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          "Upload failed. Please try again.";
        setErrorMsg(msg);
        setUploadState("error");
      }
    },
    [onResumeUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so re-selecting same file fires onChange
    e.target.value = "";
  };

  const handleReset = () => {
    setUploadState("idle");
    setLocalResumeData(null);
    setCurrentFile(null);
    setUploadProgress(0);
    setErrorMsg("");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Upload Your Resume
        </h2>
        <p className="text-slate-500">
          We'll extract your skills and experience to match you with relevant
          jobs.
        </p>
      </div>

      {/* Drop Zone */}
      {uploadState === "idle" || uploadState === "error" ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-200 group
            ${dragOver
              ? "border-blue-500 bg-blue-50 scale-[1.01]"
              : uploadState === "error"
              ? "border-red-300 bg-red-50 hover:border-red-400"
              : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            className="hidden"
            onChange={handleInputChange}
          />

          <div className="flex flex-col items-center gap-4">
            <div
              className={`
              p-4 rounded-2xl transition-colors duration-200
              ${dragOver
                ? "bg-blue-100"
                : uploadState === "error"
                ? "bg-red-100"
                : "bg-slate-100 group-hover:bg-blue-100"
              }
            `}
            >
              {uploadState === "error" ? (
                <AlertCircle className="w-10 h-10 text-red-500" />
              ) : (
                <CloudUpload
                  className={`w-10 h-10 transition-colors ${
                    dragOver ? "text-blue-500" : "text-slate-400 group-hover:text-blue-500"
                  }`}
                />
              )}
            </div>

            {uploadState === "error" ? (
              <>
                <div>
                  <p className="text-base font-semibold text-red-600 mb-1">
                    Upload Failed
                  </p>
                  <p className="text-sm text-red-500">{errorMsg}</p>
                </div>
                <span className="text-sm text-slate-500 mt-1">
                  Click to try again
                </span>
              </>
            ) : (
              <>
                <div>
                  <p className="text-base font-semibold text-slate-700 mb-1">
                    {dragOver ? "Drop your file here" : "Drag & drop your resume"}
                  </p>
                  <p className="text-sm text-slate-500">
                    or{" "}
                    <span className="text-blue-600 font-medium">
                      browse to upload
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="px-2 py-0.5 bg-slate-100 rounded font-mono">PDF</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded font-mono">DOCX</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded font-mono">TXT</span>
                  <span className="text-slate-300">·</span>
                  <span>Max 10 MB</span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Uploading State */}
      {uploadState === "uploading" && (
        <div className="border-2 border-blue-300 bg-blue-50 rounded-2xl p-10 text-center">
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">
                Uploading{currentFile ? ` "${currentFile.name}"` : ""}...
              </p>
              <p className="text-sm text-slate-500">
                Extracting text and identifying skills
              </p>
            </div>
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Progress</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {uploadState === "success" && localResumeData && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Success Header */}
          <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-emerald-800">Resume uploaded successfully</p>
              <p className="text-sm text-emerald-600">
                {localResumeData.extracted_text_length.toLocaleString()} characters extracted
              </p>
            </div>
            <button
              onClick={handleReset}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 flex-shrink-0"
              title="Upload a different resume"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* File Info */}
          <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-100">
            {getFileIcon(localResumeData.filename)}
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">
                {localResumeData.filename}
              </p>
              {currentFile && (
                <p className="text-sm text-slate-500">
                  {formatBytes(currentFile.size)}
                </p>
              )}
            </div>
          </div>

          {/* Skills Preview */}
          {localResumeData.skills_preview.length > 0 && (
            <div className="px-6 py-5">
              <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">
                Detected Skills
              </p>
              <div className="flex flex-wrap gap-2">
                {localResumeData.skills_preview.map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-medium rounded-full border border-blue-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
              {localResumeData.skills_preview.length === 0 && (
                <p className="text-sm text-slate-500 italic">
                  No specific skills detected — you can still proceed.
                </p>
              )}
            </div>
          )}

          {/* Continue Button */}
          <div className="px-6 pb-6 pt-2">
            <button
              onClick={onNext}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-150 shadow-sm"
            >
              Continue to Search Configuration
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Tips */}
      {uploadState === "idle" && (
        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-600 mb-3">
            Tips for best results
          </p>
          <ul className="space-y-2 text-sm text-slate-500">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
              Use an ATS-friendly format with clear section headings
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
              Include a skills section with specific technologies and tools
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
              List years of experience and education clearly
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
