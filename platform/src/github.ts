/** GitHub Actions API: dispatch the scan workflow and read its status. */

import type { Env } from './types';

const GH_API = 'https://api.github.com';

function ghHeaders(env: Env): HeadersInit {
  return {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'strix-platform',
  };
}

/** Trigger strix-scan.yml. Returns the queued workflow run, or an error. */
export async function dispatchScan(
  env: Env,
  inputs: {
    run_id: string;
    targets_json: string;
    scan_mode: string;
    budget: string;
    instructions: string;
    callback_url: string;
  },
): Promise<{ ok: true; gh_run_id: number | null; gh_run_url: string | null } | { ok: false; status: number; message: string }> {
  const repo = env.GITHUB_REPO;
  const workflow = env.WORKFLOW_FILE;

  const dispatch = await fetch(`${GH_API}/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: ghHeaders(env),
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        targets_json: inputs.targets_json,
        scan_mode: inputs.scan_mode,
        budget: inputs.budget,
        instructions: inputs.instructions.slice(0, 30_000),
        callback_url: inputs.callback_url,
        run_id: inputs.run_id,
      },
    }),
  });

  if (dispatch.status !== 204) {
    const text = await dispatch.text();
    return { ok: false, status: dispatch.status, message: text.slice(0, 500) || `GitHub returned ${dispatch.status}` };
  }

  // A dispatch response carries no run id; pick up the newest dispatch run.
  const run = await findLatestDispatchRun(env);
  return { ok: true, gh_run_id: run?.id ?? null, gh_run_url: run?.html_url ?? null };
}

async function findLatestDispatchRun(env: Env): Promise<{ id: number; html_url: string } | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(
      `${GH_API}/repos/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=1`,
      { headers: ghHeaders(env) },
    );
    if (!res.ok) continue;
    const data = (await res.json()) as {
      workflow_runs?: { id: number; html_url: string; created_at: string }[];
    };
    const run = data.workflow_runs?.[0];
    if (run && Date.now() - new Date(run.created_at).getTime() < 5 * 60_000) {
      return { id: run.id, html_url: run.html_url };
    }
  }
  return null;
}

/**
 * Reconcile a run that is still marked running: ask GitHub whether the job
 * finished. Used when the callback never arrived (for example a network hiccup
 * after the scan), so runs cannot get stuck as "running" forever.
 */
export async function syncRunStatus(
  env: Env,
  ghRunId: number,
): Promise<{ status: string; message: string | null } | null> {
  const res = await fetch(`${GH_API}/repos/${env.GITHUB_REPO}/actions/runs/${ghRunId}`, {
    headers: ghHeaders(env),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { status: string; conclusion: string | null };
  if (data.status !== 'completed') return { status: 'running', message: null };

  // The workflow deliberately exits non-zero when findings exist, so a
  // "failure" conclusion usually means the scan worked and found something —
  // the report itself arrives by callback, never through this path.
  const message =
    data.conclusion === 'success'
      ? 'GitHub run finished successfully, but no report was received by the platform. Check the strix-report artifact on GitHub.'
      : `GitHub run finished with conclusion "${data.conclusion}". If no report arrived, check the strix-report artifact and the run log on GitHub.`;
  return { status: 'error', message };
}
