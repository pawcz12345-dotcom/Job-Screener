from __future__ import annotations

import json
import logging
import os
import re
import uuid
from collections.abc import Callable
from typing import Any

import anthropic

from models import JobResult

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
BATCH_SIZE = 5

SYSTEM_PROMPT = """\
You are an expert technical recruiter and career coach. \
Your job is to evaluate how well a candidate's resume matches a job listing and \
return a structured JSON assessment. Be honest and precise. \
Always respond with valid JSON only — no markdown fences, no extra commentary.\
"""

JOB_PROMPT_TEMPLATE = """\
## Candidate Resume
{resume_text}

---

## Job Listing
**Title:** {title}
**Company:** {company}
**Location:** {location}
**Job Type:** {job_type}
**Remote:** {is_remote}
**Salary Range:** {salary_range}

**Description:**
{description}

---

## Your Task
Evaluate how well this candidate's resume matches the job listing above.
Return a JSON object with exactly this structure:

{{
  "match_score": <integer 0-100>,
  "matching_skills": [<list of skills/keywords present in both resume and job>],
  "missing_skills": [<list of skills mentioned in job but absent from resume>],
  "recommendation": "<apply|maybe|skip>",
  "reasoning": "<2-4 sentences explaining the score and recommendation>"
}}

Guidelines:
- match_score 80-100 → "apply"
- match_score 50-79  → "maybe"
- match_score 0-49   → "skip"
- matching_skills and missing_skills: be specific, list concrete technologies/skills
- reasoning: be concise but informative

Respond with ONLY the JSON object.\
"""


def _build_prompt(resume_text: str, job: dict[str, Any]) -> str:
    salary_parts: list[str] = []
    if job.get("min_salary") is not None:
        salary_parts.append(f"${job['min_salary']:,.0f}")
    if job.get("max_salary") is not None:
        salary_parts.append(f"${job['max_salary']:,.0f}")
    salary_range = " – ".join(salary_parts) if salary_parts else "Not specified"

    # Truncate description to avoid very long prompts (keep ~4000 chars)
    description = (job.get("description") or "").strip()
    if len(description) > 4000:
        description = description[:4000] + "\n[... truncated ...]"

    # Truncate resume too (keep ~3000 chars)
    resume_snippet = resume_text.strip()
    if len(resume_snippet) > 3000:
        resume_snippet = resume_snippet[:3000] + "\n[... truncated ...]"

    return JOB_PROMPT_TEMPLATE.format(
        resume_text=resume_snippet,
        title=job.get("title") or "N/A",
        company=job.get("company") or "N/A",
        location=job.get("location") or "N/A",
        job_type=job.get("job_type") or "N/A",
        is_remote="Yes" if job.get("is_remote") else ("No" if job.get("is_remote") is False else "N/A"),
        salary_range=salary_range,
        description=description,
    )


def _parse_ai_response(content: str) -> dict[str, Any]:
    """
    Extract and parse the JSON object from the AI response.
    Handles cases where the model accidentally wraps in markdown fences.
    """
    # Strip markdown code fences if present
    text = content.strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fence_match:
        text = fence_match.group(1).strip()

    # Find first JSON object in the string
    obj_match = re.search(r"\{[\s\S]+\}", text)
    if obj_match:
        text = obj_match.group(0)

    data = json.loads(text)
    return data


def _fallback_result(job: dict[str, Any], job_id: str, error_note: str) -> JobResult:
    """Return a safe default JobResult when scoring fails."""
    return JobResult(
        id=job_id,
        site=job.get("site") or "unknown",
        job_url=job.get("job_url"),
        title=job.get("title") or "Unknown",
        company=job.get("company"),
        location=job.get("location"),
        date_posted=job.get("date_posted"),
        is_remote=job.get("is_remote"),
        job_type=job.get("job_type"),
        min_salary=job.get("min_salary"),
        max_salary=job.get("max_salary"),
        description=job.get("description"),
        match_score=None,
        match_reasoning=f"Scoring unavailable: {error_note}",
        matching_skills=[],
        missing_skills=[],
        recommendation="maybe",
    )


def score_jobs(
    resume_text: str,
    jobs: list[dict[str, Any]],
    progress_callback: Callable[[int], None],
) -> list[JobResult]:
    """
    Score each job in `jobs` against the `resume_text` using Claude.

    Jobs are processed in batches of BATCH_SIZE.
    `progress_callback(pct)` is called with an integer 0-100 representing
    overall scoring progress (the caller maps this to the 30-95% window).
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "ANTHROPIC_API_KEY is not set. "
            "Please add it to your .env file or environment."
        )

    client = anthropic.Anthropic(api_key=api_key)
    results: list[JobResult] = []
    total = len(jobs)

    if total == 0:
        progress_callback(100)
        return results

    for batch_start in range(0, total, BATCH_SIZE):
        batch = jobs[batch_start : batch_start + BATCH_SIZE]

        for job in batch:
            job_id = str(uuid.uuid4())
            prompt = _build_prompt(resume_text, job)

            try:
                message = client.messages.create(
                    model=MODEL,
                    max_tokens=1024,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": prompt}],
                )
                raw_content = message.content[0].text
                data = _parse_ai_response(raw_content)

                # Clamp and validate score
                score = int(data.get("match_score", 50))
                score = max(0, min(100, score))

                # Validate recommendation
                rec = data.get("recommendation", "").lower()
                if rec not in ("apply", "maybe", "skip"):
                    # Derive from score
                    if score >= 80:
                        rec = "apply"
                    elif score >= 50:
                        rec = "maybe"
                    else:
                        rec = "skip"

                result = JobResult(
                    id=job_id,
                    site=job.get("site") or "unknown",
                    job_url=job.get("job_url"),
                    title=job.get("title") or "Unknown",
                    company=job.get("company"),
                    location=job.get("location"),
                    date_posted=job.get("date_posted"),
                    is_remote=job.get("is_remote"),
                    job_type=job.get("job_type"),
                    min_salary=job.get("min_salary"),
                    max_salary=job.get("max_salary"),
                    description=job.get("description"),
                    match_score=score,
                    match_reasoning=data.get("reasoning"),
                    matching_skills=data.get("matching_skills") or [],
                    missing_skills=data.get("missing_skills") or [],
                    recommendation=rec,  # type: ignore[arg-type]
                )

            except anthropic.RateLimitError as exc:
                logger.warning("Rate limit hit scoring job %r: %s", job.get("title"), exc)
                result = _fallback_result(job, job_id, "rate limit reached")

            except anthropic.APIError as exc:
                logger.warning("Anthropic API error scoring job %r: %s", job.get("title"), exc)
                result = _fallback_result(job, job_id, f"API error: {exc}")

            except (json.JSONDecodeError, KeyError, ValueError) as exc:
                logger.warning(
                    "Failed to parse AI response for job %r: %s", job.get("title"), exc
                )
                result = _fallback_result(job, job_id, "response parse error")

            except Exception as exc:
                logger.exception("Unexpected error scoring job %r: %s", job.get("title"), exc)
                result = _fallback_result(job, job_id, str(exc))

            results.append(result)

        # Report progress after each batch
        scored_so_far = min(batch_start + BATCH_SIZE, total)
        pct = int((scored_so_far / total) * 100)
        progress_callback(pct)

    return results
