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
      if (!safeEqual(request.headers.get('authorization') ?? '', `Bearer ${env.DASHBOARD_TOKEN}`)) {
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
  if (!provided || !safeEqual(provided, env.CALLBACK_SECRET)) {
    return errorResponse(401, 'Invalid callback token.');
  }

  let body: {
    run_id?: string;
    exit_code?: string;
    run_dir?: string | null;
    files?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'Body is not valid JSON.');
  }

  const runId = (body.run_id ?? '').trim();
  if (!runId) return errorResponse(400, 'run_id is required.');

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

  await env.DB.prepare(
    `UPDATE runs SET
       status = ?2, exit_code = ?3, run_dir = ?4,
       findings_json = ?5, report_md = ?6, run_record_json = ?7,
       coverage_json = ?8, payload_json = ?9,
       error = ?10, updated_at = ?11, finished_at = ?11
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
      status === 'error' ? `Scan exited with code ${body.exit_code}. See the strix-report artifact on GitHub.` : null,
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
