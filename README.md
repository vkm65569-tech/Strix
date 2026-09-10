# 40-StrixScanner

Runs the [Strix](https://github.com/usestrix/strix) AI pentest agent against your
projects to get a vulnerability report — the "does my project have loopholes"
answer, with proof-of-concepts and fixes rather than a static-scan checklist.

This folder is standalone. Nothing here is added to ChirplyMint or any other
project repo.

## What is in here

| Path | Purpose |
| --- | --- |
| `.github/workflows/strix-scan.yml` | The GitHub Actions workflow that runs Strix |
| `targets.txt` | The list of repos/sites to scan — edit this |
| `strix.instructions.md` | Priorities and reporting rules given to the AI agent |
| `RUN-LOCALLY.md` | How to scan on your own PC instead (needs Docker) |

## Setup — do these once

### 1. Create a GitHub repo for this folder

Create an empty repo, for example `StrixScanner`, in your `VikashMeena777`
account. Do **not** initialise it with a README.

```bash
cd "C:/Users/Vikash Meena/Desktop/Automations/40-StrixScanner"
git init -b main
git add .
git commit -m "Add Strix security scan workflow"
git remote add origin https://github.com/VikashMeena777/StrixScanner.git
git push -u origin main
```

### 2. Get an LLM API key

Strix drives the scan with an LLM, so it needs a paid key. Supported providers:
OpenAI, Anthropic, OpenRouter, Google Vertex, AWS Bedrock, Azure OpenAI,
Novita, or a local model.

**It does not support Groq or NVIDIA NIM**, so the keys in your other `.env`
files will not work here. The cheapest practical route is OpenRouter, which gives
one key access to many models:

- Sign up at https://openrouter.ai, add ~$10 credit, create a key.

### 3. Add two repo secrets

In the new repo: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret name | Value |
| --- | --- |
| `STRIX_LLM` | `openrouter/z-ai/glm-5.3` (the recommended default) |
| `LLM_API_KEY` | your OpenRouter API key |

The names must match exactly. The workflow checks for them and tells you clearly
if either is missing.

### 4. Pick what to scan

Edit `targets.txt`. It currently scans `ChirplyMint-NovaMint`'s GitHub repo.
Add other projects by uncommenting lines.

## Running a scan

Go to the repo's **Actions** tab → **Strix Security Scan** → **Run workflow**.
You get four choices:

- **scan_mode** — `quick` (minutes, only the changed files on a PR), `standard`
  (~30 min), or `deep` (1–4 hours, for a release).
- **target_mode** — `targets_file` (scan everything in `targets.txt`),
  `this_repo` (scan the scanner repo itself), or `custom_url` (scan one URL or
  repo you type in).
- **custom_target** — only used with `custom_url`.
- **budget** — a hard USD cap for that single run. The default `10` means the run
  stops at $10 of model usage no matter what.

A weekly scan also runs automatically every Monday at 03:00 UTC. Delete the
`schedule:` block in the workflow if you only want manual runs.

## Reading the result

Two places, both filled in after every run:

1. **The job summary** — open the finished run and you get a table plus the tail
   of the console output, at a glance.
2. **The `strix-report` artifact** — the full findings. Download it from the
   bottom of the run page. It contains `strix_runs/<run-name>/` with the report
   and the raw console log.

A run turns **red** when Strix found vulnerabilities (exit code 2), **green**
when it found none. That is deliberate: red means "read the report", not
"something broke". A genuine tool failure also shows red but with a different
message in the log.

## Cost and time expectations

- A `quick` scan is the cheap default and is usually enough for a first look or a
  PR check.
- `standard` and `deep` scan much more aggressively and cost correspondingly
  more. Always set a `budget` for those.
- Each run downloads the Strix sandbox Docker image (~a few GB). The workflow
  frees disk space on the runner first because the image is large.

## Important caveats

- **Only scan systems you own or have written permission to test.** Strix
  actively sends attack traffic. This covers your own projects and deployed
  sites; it does not cover anyone else's.
- **Scanning a live URL hits production.** The `https://chirplymint...` line in
  `targets.txt` is commented out for that reason. Uncomment it only when you
  deliberately want a black-box test against the running app — it will create
  test data and could trigger rate limits.
- **The report is a starting point, not a verdict.** An AI pentester can miss
  things and can be wrong. Treat every finding as a lead to verify.
- **Never commit an API key into this repo.** Keys belong in Actions secrets.
