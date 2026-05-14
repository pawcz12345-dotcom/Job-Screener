from __future__ import annotations

import logging
from datetime import date
from typing import Any

from models import ScanParameters

logger = logging.getLogger(__name__)

# Map our experience_level values to search-term suffixes
EXPERIENCE_SUFFIXES: dict[str, str] = {
    "entry": "junior entry-level",
    "mid": "mid-level",
    "senior": "senior",
    "staff": "staff principal",
    "any": "",
}

# Map our job_type values to jobspy's job_type strings
JOB_TYPE_MAP: dict[str, str | None] = {
    "any": None,
    "full_time": "fulltime",
    "part_time": "parttime",
    "contract": "contract",
    "internship": "internship",
}

# Map our remote_preference to jobspy's is_remote parameter
REMOTE_MAP: dict[str, bool | None] = {
    "remote": True,
    "onsite": False,
    "hybrid": None,   # jobspy doesn't distinguish hybrid; return all, filter later
    "any": None,
}


def scrape_jobs(params: ScanParameters) -> list[dict[str, Any]]:
    """
    Scrape job listings from multiple sites using python-jobspy.

    Returns a deduplicated list of job dicts, each containing:
        site, job_url, title, company, location, date_posted,
        is_remote, job_type, min_salary, max_salary, description
    """
    from jobspy import scrape_jobs as jobspy_scrape  # type: ignore

    experience_suffix = EXPERIENCE_SUFFIXES.get(params.experience_level, "")
    is_remote = REMOTE_MAP.get(params.remote_preference)
    job_type = JOB_TYPE_MAP.get(params.job_type)

    all_jobs: list[dict[str, Any]] = []

    for job_title in params.job_titles:
        search_term = job_title.strip()
        if experience_suffix:
            search_term = f"{experience_suffix} {search_term}"

        try:
            df = jobspy_scrape(
                site_name=params.sites,
                search_term=search_term,
                location=params.location,
                results_wanted=params.results_per_site,
                hours_old=params.hours_old,
                is_remote=is_remote,
                job_type=job_type,
                country_indeed="USA",
                verbose=0,
            )
        except Exception as exc:
            logger.warning(
                "jobspy scrape failed for title=%r sites=%r: %s",
                job_title,
                params.sites,
                exc,
            )
            continue

        if df is None or df.empty:
            logger.info("No results for job_title=%r", job_title)
            continue

        for _, row in df.iterrows():
            job = _row_to_dict(row)
            if job:
                all_jobs.append(job)

    # Filter out jobs with no description — we need it for scoring
    jobs_with_desc = [j for j in all_jobs if j.get("description") and j["description"].strip()]

    # Deduplicate by (title, company) — keep first occurrence
    seen: set[tuple[str, str]] = set()
    unique_jobs: list[dict[str, Any]] = []
    for job in jobs_with_desc:
        key = (
            (job.get("title") or "").strip().lower(),
            (job.get("company") or "").strip().lower(),
        )
        if key not in seen:
            seen.add(key)
            unique_jobs.append(job)

    logger.info(
        "Scraped %d total jobs, %d with descriptions, %d unique",
        len(all_jobs),
        len(jobs_with_desc),
        len(unique_jobs),
    )

    return unique_jobs


def _row_to_dict(row: Any) -> dict[str, Any] | None:
    """Convert a DataFrame row to a plain dict, coercing types safely."""

    def _safe_str(val: Any) -> str | None:
        if val is None:
            return None
        s = str(val).strip()
        return s if s and s.lower() not in ("none", "nan", "nat") else None

    def _safe_float(val: Any) -> float | None:
        try:
            f = float(val)
            return f if f == f else None  # NaN check
        except (TypeError, ValueError):
            return None

    def _safe_bool(val: Any) -> bool | None:
        if val is None:
            return None
        if isinstance(val, bool):
            return val
        s = str(val).strip().lower()
        if s in ("true", "yes", "1"):
            return True
        if s in ("false", "no", "0"):
            return False
        return None

    def _safe_date(val: Any) -> str | None:
        if val is None:
            return None
        if isinstance(val, date):
            return val.isoformat()
        s = str(val).strip()
        return s if s and s.lower() not in ("none", "nan", "nat") else None

    title = _safe_str(row.get("title"))
    if not title:
        return None  # A job without a title is useless

    return {
        "site": _safe_str(row.get("site")) or "unknown",
        "job_url": _safe_str(row.get("job_url")),
        "title": title,
        "company": _safe_str(row.get("company")),
        "location": _safe_str(row.get("location")),
        "date_posted": _safe_date(row.get("date_posted")),
        "is_remote": _safe_bool(row.get("is_remote")),
        "job_type": _safe_str(row.get("job_type")),
        "min_salary": _safe_float(row.get("min_amount")),
        "max_salary": _safe_float(row.get("max_amount")),
        "description": _safe_str(row.get("description")),
    }
