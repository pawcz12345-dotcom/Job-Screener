import axios from "axios";
import {
  ResumeUploadResponse,
  ScanParameters,
  ScanStartResponse,
  ScanStatus,
} from "./types";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

export async function uploadResume(
  file: File,
  onUploadProgress?: (percent: number) => void
): Promise<ResumeUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<ResumeUploadResponse>(
    "/api/resume/upload",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onUploadProgress(percent);
        }
      },
    }
  );

  return response.data;
}

export async function startScan(
  resumeId: string,
  params: ScanParameters
): Promise<ScanStartResponse> {
  const response = await api.post<ScanStartResponse>("/api/scan/start", {
    resume_id: resumeId,
    params,
  });
  return response.data;
}

export async function getScanStatus(scanId: string): Promise<ScanStatus> {
  const response = await api.get<ScanStatus>(`/api/scan/${scanId}`);
  return response.data;
}

export default api;
