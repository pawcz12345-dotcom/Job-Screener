from __future__ import annotations

import asyncio
import logging
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory before anything else
_backend_dir = Path(__file__).parent
load_dotenv(_backend_dir / ".env")

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models import ResumeUploadResponse, ScanStatus, StartScanRequest
from services.ai_scorer import score_jobs
from services.job_scraper import scrape_jobs
from services.resume_parser import extract_skills_preview, parse_resume

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Job Screener API",
    description="Resume-based job scanning and AI scoring backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------

resumes: dict[str, str] = {}          # resume_id  ->  extracted text
scans: dict[str, ScanStatus] = {}     # scan_id    ->  ScanStatus

# Thread pool for blocking I/O (scraping + Anthropic calls)
_executor = ThreadPoolExecutor(max_workers=4)

# ---------------------------------------------------------------------------
# Allowed file extensions / MIME types
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE_MB = 10


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------

def _run_scan(scan_id: str, resume_text: str, params) -> None:  # noqa: ANN001
    """
    Blocking function executed in the thread-pool.
    Updates `scans[scan_id]` in place.
    """
    scan = scans[scan_id]

    try:
        # ------------------------------------------------------------------
        # Phase 1 – Scraping
        # ------------------------------------------------------------------
        scan.status = "running"
        scan.progress = 5
        logger.info("[%s] Starting scrape for %d job title(s)", scan_id, len(params.job_titles))

        jobs = scrape_jobs(params)

        scan.total_found = len(jobs)
        scan.progress = 30
        logger.info("[%s] Scrape complete — %d unique jobs with descriptions", scan_id, len(jobs))

        if not jobs:
            # Nothing to score
            scan.status = "completed"
            scan.progress = 100
            scan.resume_summary = f"Scan complete. No jobs with descriptions were found."
            return

        # ------------------------------------------------------------------
        # Phase 2 – AI Scoring
        # ------------------------------------------------------------------
        scan.status = "scoring"

        def _progress_callback(scoring_pct: int) -> None:
            """Map scoring progress (0-100) to the overall 30-95% window."""
            overall = 30 + int(scoring_pct * 0.65)
            scan.progress = min(overall, 95)
            scan.total_scored = int((scoring_pct / 100) * len(jobs))

        logger.info("[%s] Starting AI scoring of %d jobs", scan_id, len(jobs))
        results = score_jobs(resume_text, jobs, _progress_callback)

        # Sort by match_score descending (None scores go last)
        results.sort(
            key=lambda r: (r.match_score is None, -(r.match_score or 0))
        )

        scan.results = results
        scan.total_scored = len(results)
        scan.status = "completed"
        scan.progress = 100
        scan.resume_summary = (
            f"Scan complete. Found {len(jobs)} jobs, scored {len(results)}."
        )
        logger.info("[%s] Scan completed successfully", scan_id)

    except Exception as exc:
        logger.exception("[%s] Scan failed: %s", scan_id, exc)
        scan.status = "failed"
        scan.error = str(exc)
        scan.progress = 0


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/api/health", tags=["meta"])
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "version": "1.0.0"}


@app.post("/api/resume/upload", response_model=ResumeUploadResponse, tags=["resume"])
async def upload_resume(file: UploadFile = File(...)):
    """
    Upload a resume (PDF, DOCX, or TXT).

    Returns a `resume_id` that must be passed to `/api/scan/start`.
    """
    # Validate extension
    filename = file.filename or ""
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{suffix}'. "
                "Please upload a PDF, DOCX, or TXT file."
            ),
        )

    # Read bytes
    file_bytes = await file.read()

    # Guard against overly large uploads
    size_mb = len(file_bytes) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum allowed is {MAX_FILE_SIZE_MB} MB.",
        )

    # Parse text
    try:
        text = parse_resume(file_bytes, filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from the uploaded file.",
        )

    # Store and return
    resume_id = str(uuid.uuid4())
    resumes[resume_id] = text

    skills_preview = extract_skills_preview(text, limit=10)

    logger.info(
        "Resume uploaded: id=%s filename=%r chars=%d skills_preview=%s",
        resume_id,
        filename,
        len(text),
        skills_preview,
    )

    return ResumeUploadResponse(
        resume_id=resume_id,
        filename=filename,
        extracted_text_length=len(text),
        skills_preview=skills_preview,
    )


@app.post("/api/scan/start", tags=["scan"])
async def start_scan(request: StartScanRequest, background_tasks: BackgroundTasks):
    """
    Start a background job scan.

    Returns `{ "scan_id": "<uuid>" }` immediately.
    Poll `/api/scan/{scan_id}` to get progress and results.
    """
    resume_id = request.resume_id
    if resume_id not in resumes:
        raise HTTPException(
            status_code=404,
            detail=f"Resume '{resume_id}' not found. Please upload a resume first.",
        )

    resume_text = resumes[resume_id]
    params = request.params

    if not params.job_titles:
        raise HTTPException(status_code=400, detail="At least one job title is required.")

    if not params.sites:
        raise HTTPException(status_code=400, detail="At least one job site must be selected.")

    scan_id = str(uuid.uuid4())
    scan = ScanStatus(scan_id=scan_id, status="pending")
    scans[scan_id] = scan

    logger.info(
        "Scan started: id=%s resume=%s titles=%s sites=%s",
        scan_id,
        resume_id,
        params.job_titles,
        params.sites,
    )

    # Run the blocking scan in a background thread so FastAPI stays responsive
    loop = asyncio.get_event_loop()
    background_tasks.add_task(
        loop.run_in_executor,
        _executor,
        _run_scan,
        scan_id,
        resume_text,
        params,
    )

    return {"scan_id": scan_id}


@app.get("/api/scan/{scan_id}", response_model=ScanStatus, tags=["scan"])
def get_scan_status(scan_id: str):
    """
    Poll for the current status of a scan.

    Returns the full `ScanStatus` object including any results scored so far.
    """
    scan = scans.get(scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found.")
    return scan


@app.delete("/api/scan/{scan_id}", tags=["scan"])
def delete_scan(scan_id: str):
    """Remove a scan record from memory."""
    if scan_id not in scans:
        raise HTTPException(status_code=404, detail=f"Scan '{scan_id}' not found.")
    del scans[scan_id]
    logger.info("Scan deleted: id=%s", scan_id)
    return {"deleted": scan_id}


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------


@app.exception_handler(Exception)
async def generic_exception_handler(request, exc: Exception):  # noqa: ANN001
    logger.exception("Unhandled exception on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Check the server logs."},
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
