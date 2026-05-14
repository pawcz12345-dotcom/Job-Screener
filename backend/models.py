from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class ScanParameters(BaseModel):
    job_titles: list[str] = Field(..., description="List of job titles to search for")
    location: str = Field(..., description="Location to search in")
    remote_preference: Literal["remote", "onsite", "hybrid", "any"] = Field(
        default="any", description="Remote work preference"
    )
    min_salary: Optional[int] = Field(default=None, description="Minimum salary filter")
    max_salary: Optional[int] = Field(default=None, description="Maximum salary filter")
    experience_level: Literal["any", "entry", "mid", "senior", "staff"] = Field(
        default="any", description="Experience level filter"
    )
    job_type: Literal["any", "full_time", "part_time", "contract", "internship"] = Field(
        default="any", description="Job type filter"
    )
    results_per_site: int = Field(
        default=20, ge=1, le=50, description="Number of results to fetch per site"
    )
    sites: list[str] = Field(
        default=["linkedin", "indeed", "glassdoor", "zip_recruiter", "google"],
        description="Job sites to scrape",
    )
    hours_old: int = Field(
        default=72, ge=1, description="Only fetch jobs posted within this many hours"
    )


class JobResult(BaseModel):
    id: str
    site: str
    job_url: Optional[str] = None
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    date_posted: Optional[str] = None
    is_remote: Optional[bool] = None
    job_type: Optional[str] = None
    min_salary: Optional[float] = None
    max_salary: Optional[float] = None
    description: Optional[str] = None
    match_score: Optional[int] = None
    match_reasoning: Optional[str] = None
    matching_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    recommendation: Optional[Literal["apply", "maybe", "skip"]] = None


class ScanStatus(BaseModel):
    scan_id: str
    status: Literal["pending", "running", "scoring", "completed", "failed"]
    progress: int = Field(default=0, ge=0, le=100)
    total_found: int = Field(default=0)
    total_scored: int = Field(default=0)
    results: list[JobResult] = Field(default_factory=list)
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resume_summary: Optional[str] = None


class ResumeUploadResponse(BaseModel):
    resume_id: str
    filename: str
    extracted_text_length: int
    skills_preview: list[str]


class StartScanRequest(BaseModel):
    resume_id: str
    params: ScanParameters
