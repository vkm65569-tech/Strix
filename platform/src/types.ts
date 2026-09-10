/** Shared bindings and shapes. */

export interface Env {
  DB: D1Database;
  GITHUB_TOKEN: string;
  DASHBOARD_TOKEN: string;
  CALLBACK_SECRET: string;
  GITHUB_REPO: string;
  WORKFLOW_FILE: string;
}

/** One scan target as sent to the workflow inside targets_json. */
export interface DispatchTarget {
  type: string;
  label: string;
  target: string;
  extra_targets?: string[];
}
