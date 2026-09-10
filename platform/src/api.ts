/** Authenticated dashboard API: targets, runs, and dispatch. */

import type { Env, DispatchTarget } from './types';

import { json, errorResponse } from './util';
import { dispatchScan, syncRunStatus } from './github';
export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;

  try {
    // ---------- targets ----------
    if (method === 'GET' && path === '/api/targets') {
      const { results } = await env.DB.prepare(
        'SELECT id, type, label, target, extra_targets, instructions, created_at FROM targets ORDER BY created_at DESC',
      ).all();
      return json({ targets: results });
    }

    if (method === 'POST' && path === '/api/targets') {
      const body = await readJson(request);
      const type = String(body.type ?? '').trim();
      const label = String(body.label ?? '').trim();
      const target = String(body.target ?? '').trim();
      if (!['github', 'web', 'supabase', 'vercel'].includes(type)) {
        return errorResponse(400, 'type must be github, web, supabase or vercel.');
      }
      if (!label || !target) return errorResponse(400, 'label and target are required.');
      if (!/^(https?:\/\/|github\.com\/)/i.test(target)) {
        return errorResponse(400, 'target must be an https:// URL or a github.com/owner/repo path.');
      }
      const normalized = target.startsWith('github.com/') ? `https://${target}` : target;
      const id = newId('t');
      await env.DB.prepare(
        'INSERT INTO targets (id, type, label, target, extra_targets, instructions, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
      )
        .bind(
          id,
          type,
          label,
          normalized,
          JSON.stringify(toLines(body.extra_targets)),
          String(body.instructions ?? ''),
          new Date().toISOString(),
        )
        .run();
      return json({ ok: true, id }, 201);
    }

    const targetDelete = /^\/api\/targets\/([a-zA-Z0-9_-]+)$/.exec(path);
    if (method === 'DELETE' && targetDelete) {
      await env.DB.prepare('DELETE FROM targets WHERE id = ?1').bind(targetDelete[1]).run();
      return json({ ok: true });
    }

    // ---------- runs ----------
    if (method === 'POST' && path === '/api/runs') {
      return startRun(request, env);
    }

    if (method === 'GET' && path === '/api/runs') {
      const { results } = await env.DB.prepare(
        `SELECT id, status, scan_mode, budget, targets_json, gh_run_id, gh_run_url,
                exit_code, run_dir, error, created_at, updated_at, finished_at
         FROM runs ORDER BY created_at DESC LIMIT 100`,
      ).all();
      return json({ runs: results });
    }

    const runDetail = /^\/api\/runs\/([a-zA-Z0-9_-]+)$/.exec(path);
    if (method === 'GET' && runDetail) {
      const run = await env.DB.prepare(
        `SELECT id, status, scan_mode, budget, targets_json, gh_run_id, gh_run_url, exit_code,
                run_dir, findings_json, report_md, run_record_json, coverage_json, error,
                created_at, updated_at, finished_at
         FROM runs WHERE id = ?1`,
      )
        .bind(runDetail[1])
        .first();
      if (!run) return errorResponse(404, 'Run not found.');
      return json({ run });
    }

    const findingDoc = /^\/api\/runs\/([a-zA-Z0-9_-]+)\/docs\/([a-zA-Z0-9._-]+)$/.exec(path);
    if (method === 'GET' && findingDoc) {
      const doc = await env.DB.prepare(
        'SELECT markdown FROM finding_docs WHERE run_id = ?1 AND finding_id = ?2',
      )
        .bind(findingDoc[1], findingDoc[2])
        .first<{ markdown: string }>();
      if (!doc) return errorResponse(404, 'Finding document not found.');
      return json({ markdown: doc.markdown });
    }

    const runSync = /^\/api\/runs\/([a-zA-Z0-9_-]+)\/sync$/.exec(path);
    if (method === 'POST' && runSync) {
      return syncRun(request, env, runSync[1]);
    }

    return errorResponse(404, 'Unknown API route.');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return errorResponse(500, message);
  }
}

interface RunRow {
  id: string;
  status: string;
  gh_run_id: number | null;
  error: string | null;
}

/** Create a run row and dispatch the GitHub workflow for the chosen targets. */
async function startRun(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const modeRaw = String(body.scan_mode ?? 'quick');
  const scanMode = ['quick', 'standard', 'deep'].includes(modeRaw) ? modeRaw : 'quick';
  const budgetNum = Number(body.budget);
  const budget = Number.isFinite(budgetNum) && budgetNum > 0 ? Math.min(budgetNum, 100) : 10;
  const targetIds: string[] = Array.isArray(body.target_ids) ? body.target_ids.map(String) : [];
  const extra: DispatchTarget | null = body.custom_target
    ? {
        type: String(body.custom_type ?? 'web'),
        label: String(body.custom_label ?? 'Ad-hoc target'),
        target: String(body.custom_target),
        extra_targets: toLines(body.custom_extra_targets),
      }
    : null;

  if (targetIds.length === 0 && !extra) {
    return errorResponse(400, 'Pick at least one target, or provide a custom_target.');
  }

  const placeholders = targetIds.map(() => '?').join(',');
  const rows =
    targetIds.length > 0
      ? (
          await env.DB.prepare(
            `SELECT id, type, label, target, extra_targets, instructions FROM targets WHERE id IN (${placeholders})`,
          )
            .bind(...targetIds)
            .all()
        ).results
      : [];

  const targets: DispatchTarget[] = rows.map((row) => {
    const r = row as { id: string; type: string; label: string; target: string; extra_targets: string };
    let extraTargets: string[] = [];
    try {
      extraTargets = JSON.parse(r.extra_targets ?? '[]');
    } catch {
      /* ignore malformed */
    }
    return { type: r.type, label: r.label, target: r.target, extra_targets: extraTargets };
  });
  if (extra) targets.push(extra);
  if (targets.length === 0) return errorResponse(400, 'No valid targets resolved.');

  const id = newId('r');
  const now = new Date().toISOString();
  const targetsJson = JSON.stringify(targets);
  const instructions = rows
    .map((row) => (row as { label: string; instructions: string }).instructions)
    .filter(Boolean)
    .map((text) => `### Target-specific instructions\n${text}`)
    .join('\n\n');

  const callbackUrl = `${new URL(request.url).origin}/api/scan-callback`;
  const dispatch = await dispatchScan(env, {
    run_id: id,
    targets_json: targetsJson,
    scan_mode: scanMode,
    budget: String(budget),
    instructions,
    callback_url: callbackUrl,
  });

  if (!dispatch.ok) {
    return errorResponse(dispatch.status === 401 ? 401 : 502, `GitHub dispatch failed: ${dispatch.message}`);
  }

  await env.DB.prepare(
    `INSERT INTO runs (id, status, scan_mode, budget, targets_json, instructions,
                       gh_run_id, gh_run_url, created_at, updated_at)
     VALUES (?1, 'running', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
  )
    .bind(id, scanMode, budget, targetsJson, instructions, dispatch.gh_run_id, dispatch.gh_run_url, now)
    .run();

  return json({ ok: true, run_id: id, gh_run_url: dispatch.gh_run_url }, 201);
}

/** Ask GitHub what happened to a run that never sent a callback. */
async function syncRun(request: Request, env: Env, runId: string): Promise<Response> {
  const run = (await env.DB.prepare('SELECT id, status, gh_run_id, error FROM runs WHERE id = ?1')
    .bind(runId)
    .first()) as RunRow | null;
  if (!run) return errorResponse(404, 'Run not found.');
  if (run.status !== 'running') return json({ ok: true, status: run.status });
  if (!run.gh_run_id) {
    return json({ ok: true, status: 'running', note: 'No GitHub run id recorded yet; try again in a minute.' });
  }

  const result = await syncRunStatus(env, run.gh_run_id);
  if (!result) return errorResponse(502, 'Could not read the run from GitHub.');
  if (result.status === 'running') return json({ ok: true, status: 'running' });

  await env.DB.prepare('UPDATE runs SET status = ?2, error = ?3, updated_at = ?4 WHERE id = ?1').bind(
    runId,
    result.status,
    result.message,
    new Date().toISOString(),
  );
  return json({ ok: true, status: result.status, message: result.message });
}

// ---------- helpers ----------

function readJson(request: Request): Promise<Record<string, unknown>> {
  return request
    .json()
    .then((data) => (data && typeof data === 'object' ? (data as Record<string, unknown>) : {}))
    .catch(() => ({}));
}

function toLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('#'));
  }
  return [];
}

function newId(prefix: string): string {
  const time = Date.now().toString(36);
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
    b.toString(36).padStart(2, '0'),
  ).join('');
  return `${prefix}_${time}${rand}`;
}
