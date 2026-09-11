# 40-StrixScanner

Your own private Strix platform — like a self-hosted strix.ai. A dashboard runs
on Cloudflare Workers where you register targets (GitHub repos, live websites,
Vercel deployments, Supabase projects). Click **Run scan** and it dispatches a
GitHub Actions workflow in this repo; Strix pentests the target on GitHub's
machines; when it finishes, the report is POSTed back and appears in the
dashboard with severity counts, findings, and the full write-up.

**Dashboard:** https://strix-platform.novamint.workers.dev

## How the pieces fit

```
 Dashboard (Cloudflare Worker)  ──dispatch──▶  GitHub Action (this repo)
        ▲                                              │
        │  POST /api/scan-callback                     ▼  strix -n
        └────────────── report ◀──────────────  Strix sandbox (Docker)
```

- `platform/` — the Cloudflare Worker: dashboard UI, REST API, D1 database
  (`strix-platform-db`), GitHub dispatch, report ingestion.
- `.github/workflows/strix-scan.yml` — the scan job. Reads its targets from the
  platform's dispatch, runs Strix headless, collects
  `vulnerabilities.json` + `penetration_test_report.md` + per-finding docs from
  `strix_runs/<name>/`, and sends them back.
- `targets.txt` / `strix.instructions.md` — still used when you run the workflow
  manually from the Actions tab instead of through the platform.

## Sign in

The dashboard asks for the **dashboard token**. Its current value is stored in
`platform/.dev.vars` as `DASHBOARD_TOKEN=` (that file is gitignored and never
committed). Change it any time:

```bash
cd platform
printf 'new-token-here' | npx wrangler secret put DASHBOARD_TOKEN
```

## Secrets — where everything lives

| Secret | Where | What it is |
| --- | --- | --- |
| `STRIX_LLM` | GitHub repo secrets | Model string, e.g. `openrouter/z-ai/glm-5.3` |
| `LLM_API_KEY` | GitHub repo secrets | The provider API key matching `STRIX_LLM` |
| `PLATFORM_CALLBACK_SECRET` | GitHub repo secrets | Shared secret the Action sends reports with |
| `GITHUB_TOKEN` | Worker secrets | Token with `workflow` scope, used to dispatch runs |
| `DASHBOARD_TOKEN` | Worker secrets | Your dashboard login |
| `CALLBACK_SECRET` | Worker secrets | Must match `PLATFORM_CALLBACK_SECRET` |

**Currently set:** `STRIX_LLM` = `nvidia_nim/deepseek-ai/deepseek-v4-flash-0731`
with your existing NVIDIA NIM key. Everything is wired; scans can run now.

## LLM providers (verified 2026-09-11)

Strix routes any model string through LiteLLM, so providers beyond the
documented list work — Strix copies `LLM_API_KEY` into the env var the provider
expects. Tested against live APIs with your keys:

| `STRIX_LLM` value | Verdict |
| --- | --- |
| `nvidia_nim/deepseek-ai/deepseek-v4-flash-0731` | ✅ **active** — fast (sub-second), solid tool calling |
| `nvidia_nim/nvidia/nemotron-3-super-120b-a12b` | ✅ good alternate — agent-tuned, ~1s responses |
| `nvidia_nim/moonshotai/kimi-k3` | ⛔ avoid — endpoint queued >5 min, unusable for agent loops |
| `groq/openai/gpt-oss-120b` | ⚠️ works, but your Groq key is free tier (8k tokens/min) — every agent turn exceeds that, so scans crawl on rate limits. Only viable on a paid Groq tier |

To switch provider: update the two repo secrets `STRIX_LLM` and `LLM_API_KEY`
(Settings → Secrets and variables → Actions) — no code changes needed.

**NIM credit caveat:** build.nvidia.com keys work on a request-credit balance.
A scan makes hundreds of LLM calls; if the balance runs out mid-scan the run
fails. Also note Strix's USD budget cap estimates $0 for NIM models (unknown
pricing), so the cap will not trigger — the credit balance is the real limit.

## Costs

## Using it

1. Open the dashboard and sign in with the dashboard token.
2. **New target** — pick a type, give it a label, paste the URL:
   - *GitHub repository* — scans the source code (`https://github.com/owner/repo`).
   - *Website / Vercel deployment* — black-box test of the live site.
   - *Supabase project API* — black-box test of the project's REST endpoint
     (RLS gaps, auth flows). Paste the project URL; add anything else (e.g. an
     OpenAPI spec URL) under extra targets.
   - *Vercel project* — same as website; paste the production domain.
   - Extra targets and per-target agent instructions are optional.
3. **Run a scan** — tick targets, pick depth (`quick` / `standard` / `deep`),
   set a spend cap, click Run. The run appears as `running` immediately.
4. When the Action finishes (minutes to hours depending on depth), the run
   flips to `complete` and shows: exit code, findings grouped by severity
   (Critical → Info), each finding's impact / PoC / remediation, the agent's
   per-finding deep dives, and the full markdown report.
5. A run stuck on `running` can be reconciled with **Sync from GitHub**.

The run also leaves a `strix-report` artifact on the GitHub run page as a
backup of the raw report files.

## Costs

- Strix itself is free and runs on GitHub's free `ubuntu-latest` runner.
- LLM cost depends on the provider: metered keys (OpenRouter, OpenAI, …) pay
  per token and respect the run's USD `budget` cap; credit-based keys (NVIDIA
  NIM) burn one credit per request instead — see the caveat above.
- `quick` is the cheap default; `deep` on a big app can burn real money or the
  whole credit balance, so start with `quick`.
- Cloudflare: Workers free plan + one D1 database — effectively $0 at this scale.

## Deploying changes to the platform

```bash
cd platform
npm install        # once
npx wrangler d1 execute strix-platform-db --remote --file=schema.sql   # schema changes only
npx wrangler deploy
```

Committing to this repo does **not** redeploy the Worker automatically — run
`npx wrangler deploy` after editing `platform/src/`. The GitHub workflow, by
contrast, takes effect from the repo immediately.

## Non-negotiable rules

- **Only scan systems you own or have written permission to test.** Strix sends
  real attack traffic.
- **Live-target scans hit production.** Testing a deployed app creates test
  data, can trip rate limits, and can trigger alerts. Use `quick` first.
- **The report is a lead list, not a verdict.** Validate findings before acting,
  and treat "no findings" as "nothing found this pass", not "secure".
