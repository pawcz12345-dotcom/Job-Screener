# Job Screener

AI-powered job scanner that matches your resume against live job postings across LinkedIn, Indeed, Glassdoor, ZipRecruiter, and Google Jobs.

## How it works

1. **Upload** your resume (PDF, DOCX, or TXT)
2. **Configure** search parameters: job titles, location, remote preference, salary range, experience level, and more
3. **Scan** — the backend scrapes all selected job boards in real time
4. **Review** — Claude AI scores each job 0–100 against your resume, lists matching/missing skills, and recommends "Apply", "Maybe", or "Skip"

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.11 · FastAPI · uvicorn |
| Job scraping | [python-jobspy](https://github.com/Bunsly/JobSpy) (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs) |
| AI scoring | Claude (`claude-sonnet-4-6`) via Anthropic SDK |
| Resume parsing | pdfplumber (PDF) · python-docx (DOCX) |
| Frontend | React 18 · TypeScript · Tailwind CSS |

## Quick start

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Backend

```bash
cd backend
cp .env.example .env        # add your ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm start
```

App: http://localhost:3000

## Configuration

| Parameter | Description |
|-----------|-------------|
| Job titles | One or more search terms (e.g. "Senior Software Engineer") |
| Location | City, state, or country |
| Remote | Remote / Hybrid / Onsite / Any |
| Experience | Entry / Mid / Senior / Staff / Any |
| Job type | Full-time / Part-time / Contract / Internship |
| Sites | Select which job boards to scrape |
| Results/site | 5–50 listings per site |
| Posted within | Last 24h / 3 days / 1 week / 1 month |
| Salary range | Optional min/max filter |

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key for Claude scoring |
