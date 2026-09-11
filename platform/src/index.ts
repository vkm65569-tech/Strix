/**
 * Strix Platform — Cloudflare Worker
 *
 * Dashboard + API that:
 *   1. stores scan targets (GitHub repos, live websites, Supabase projects),
 *   2. dispatches the strix-scan.yml GitHub Actions workflow,
 *   3. receives the finished report back from the Action,
 *   4. renders findings.
 *
 * Secrets (wrangler secret put):
 *   GITHUB_TOKEN      — token with `workflow` scope on the scanner repo
 *   DASHBOARD_TOKEN   — the dashboard login token
 *   CALLBACK_SECRET   — shared secret the GitHub Action sends back with reports
 */

import { json, errorResponse, safeEqual } from './util';
import { handleApi } from './api';
import { dashboardHtml } from './ui';
import type { Env } from './types';

export type { Env };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Static dashboard shell. The token check happens on every /api call, so
    // serving the HTML publicly leaks nothing but the login form.
    if (request.method === 'GET' && (path === '/' || path === '/index.html')) {
      return new Response(dashboardHtml(), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
        },
      });
    }

    // Report receiver, called by the GitHub Action with the shared secret.
    if (request.method === 'POST' && path === '/api/scan-callback') {
      return handleCallback(request, env);
    }

    if (path.startsWith('/api/')) {
      // Liveness probe — no auth, returns no data.
      if (request.method === 'GET' && path === '/api/ping') {
        return json({ ok: true });
      }
      if (!(await safeEqual(request.headers.get('authorization') ?? '', `Bearer ${env.DASHBOARD_TOKEN}`))) {
        return errorResponse(401, 'Invalid or missing dashboard token.');
      }
      return handleApi(request, env);
    }

    return errorResponse(404, 'Not found.');
  },
};

/** Ingest a finished scan: decode the artifacts and persist them. */
async function handleCallback(request: Request, env: Env): Promise<Response> {
  const provided = request.headers.get('x-strix-token') ?? '';
  if (!provided || !(await safeEqual(provided, env.CALLBACK_SECRET))) {
    return errorResponse(401, 'Invalid callback token.');
  }

  let body: {
    run_id?: string;
    exit_code?: string;
    run_dir?: string | null;
    files?: Record<string, string>;
    phase?: string;
    note?: string;
    next_gh_run_id?: number | string | null;
    next_run_url?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'Body is not valid JSON.');
  }

  const runId = (body.run_id ?? '').trim();
  if (!runId) return errorResponse(400, 'run_id is required.');

  // ---- continuation callbacks from a scan that hit its time budget ----
  // "progress": the scan continues in a fresh GitHub run; keep the platform
  //            run alive and point the dashboard link at the new attempt.
  // "gave_up": the attempt cap was reached; the scan never finished.
  const phase = (body.phase ?? '').trim();
  if (phase === 'progress' || phase === 'gave_up') {
    const note = (body.note ?? '').slice(0, 1000) || null;
    const nextRunId = Number(body.next_gh_run_id);
    const nextRunUrl = typeof body.next_run_url === 'string' ? body.next_run_url : null;
    const now = new Date().toISOString();

    if (phase === 'gave_up') {
      await env.DB.prepare('UPDATE runs SET status = ?2, error = ?3, progress = ?4, updated_at = ?5 WHERE id = ?1')
        .bind(runId, 'error', note, note, now)
        .run();
      return json({ ok: true, run_id: runId, status: 'error' });
    }

    await env.DB.prepare(
      'UPDATE runs SET gh_run_id = COALESCE(?2, gh_run_id), gh_run_url = COALESCE(?3, gh_run_url), progress = ?4, updated_at = ?5 WHERE id = ?1',
    )
      .bind(runId, Number.isFinite(nextRunId) ? nextRunId : null, nextRunUrl, note, now)
      .run();
    return json({ ok: true, run_id: runId, status: 'running' });
  }

  // ---- final report callback ----
  const files = body.files ?? {};
  const b64decode = (name: string): string | null => {
    const value = files[name];
    if (!value) return null;
    try {
      return atob(value);
    } catch {
      return null;
    }
  };

  const findingsRaw = b64decode('vulnerabilities.json');
  const reportMd = b64decode('penetration_test_report.md');
  const runRecordRaw = b64decode('run.json');
  const coverageRaw = b64decode('coverage.json');

  // Everything not promoted to its own column stays reachable through the API.
  const rest: Record<string, string> = {};
  for (const [name, value] of Object.entries(files)) {
    if (name === 'console.log' || name.endsWith('.csv') || name.endsWith('.sarif')) {
      try {
        rest[name] = atob(value);
      } catch {
        /* skip undecodable */
      }
    }
  }

  const exitCode = Number.parseInt(body.exit_code ?? '', 10);
  const status = Number.isFinite(exitCode) && (exitCode === 0 || exitCode === 2) ? 'complete' : 'error';
  const now = new Date().toISOString();
  const errorMessage = Number.isFinite(exitCode)
    ? `Scan exited with code ${exitCode}. See the strix-report artifact on GitHub.`
    : 'The workflow failed before the scan step ran. Check the run log on GitHub (most often a missing STRIX_LLM / LLM_API_KEY secret).';

  await env.DB.prepare(
    `UPDATE runs SET
       status = ?2, exit_code = ?3, run_dir = ?4,
       findings_json = ?5, report_md = ?6, run_record_json = ?7,
       coverage_json = ?8, payload_json = ?9,
       error = ?10, progress = NULL, updated_at = ?11, finished_at = ?11
     WHERE id = ?1`,
  )
    .bind(
      runId,
      status,
      Number.isFinite(exitCode) ? exitCode : null,
      body.run_dir ?? null,
      findingsRaw,
      reportMd?.slice(0, 2_000_000) ?? null,
      runRecordRaw,
      coverageRaw,
      JSON.stringify(rest).slice(0, 4_000_000),
      status === 'error' ? errorMessage : null,
      now,
    )
    .run();

  // Per-finding deep dives: vulnerabilities/<id>.md
  const docs = Object.entries(files).filter(([name]) => name.startsWith('vulnerabilities/'));
  for (const [name, value] of docs) {
    const findingId = name.replace('vulnerabilities/', '').replace(/\.md$/, '');
    let markdown: string;
    try {
      markdown = atob(value);
    } catch {
      continue;
    }
    await env.DB.prepare(
      `INSERT INTO finding_docs (run_id, finding_id, markdown) VALUES (?1, ?2, ?3)
       ON CONFLICT (run_id, finding_id) DO UPDATE SET markdown = excluded.markdown`,
    )
      .bind(runId, findingId, markdown.slice(0, 300_000))
      .run();
  }

  return json({ ok: true, run_id: runId, status });
}
