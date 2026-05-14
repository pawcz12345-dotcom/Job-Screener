export interface ScanParameters {
  job_titles: string[];
  location: string;
  remote_preference: "remote" | "onsite" | "hybrid" | "any";
  min_salary?: number;
  max_salary?: number;
  experience_level: "any" | "entry" | "mid" | "senior" | "staff";
  job_type: "any" | "full_time" | "part_time" | "contract" | "internship";
  results_per_site: number; // 1-50
  sites: string[]; // ["linkedin","indeed","glassdoor","zip_recruiter","google"]
  hours_old: number; // 24, 72, 168, 720
}

export interface ResumeUploadResponse {
  resume_id: string;
  filename: string;
  extracted_text_length: number;
  skills_preview: string[];
}

export interface ScanStartResponse {
  scan_id: string;
}

export interface JobResult {
  id: string;
  site: string;
  job_url: string;
  title: string;
  company: string;
  location: string;
  date_posted?: string;
  is_remote: boolean;
  job_type?: string;
  min_salary?: number;
  max_salary?: number;
  description?: string;
  match_score?: number; // 0-100
  match_reasoning?: string;
  matching_skills: string[];
  missing_skills: string[];
  recommendation?: "apply" | "maybe" | "skip";
}

export interface ScanStatus {
  scan_id: string;
  status: "pending" | "running" | "scoring" | "completed" | "failed";
  progress: number; // 0-100
  total_found: number;
  total_scored: number;
  results: JobResult[];
  error?: string;
  resume_summary?: string;
}

export type AppStep = 1 | 2 | 3;
