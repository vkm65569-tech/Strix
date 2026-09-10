-- Strix Platform schema. Apply with:
--   npx wrangler d1 execute strix-platform-db --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS targets (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,             -- github | web | supabase | vercel
  label         TEXT NOT NULL,
  target        TEXT NOT NULL,             -- repo URL or website URL
  extra_targets TEXT NOT NULL DEFAULT '[]',-- JSON array of extra target lines
  instructions  TEXT NOT NULL DEFAULT '',  -- extra agent instructions for this target
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id              TEXT PRIMARY KEY,
  status          TEXT NOT NULL,           -- queued | running | complete | failed | error
  scan_mode       TEXT NOT NULL,
  budget          REAL NOT NULL,
  targets_json    TEXT NOT NULL,
  instructions    TEXT NOT NULL DEFAULT '',
  gh_run_id       INTEGER,
  gh_run_url      TEXT,
  exit_code       INTEGER,
  run_dir         TEXT,                    -- strix_runs/<name> dir name from the agent
  findings_json   TEXT,                    -- vulnerabilities.json contents
  report_md       TEXT,                    -- penetration_test_report.md contents
  run_record_json TEXT,                    -- run.json contents
  coverage_json   TEXT,                    -- coverage.json contents
  payload_json    TEXT,                    -- remaining collected files (csv, sarif, console log)
  error           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  finished_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_created ON runs (created_at DESC);

-- Per-finding deep dive files: strix_runs/<run>/vulnerabilities/<id>.md
CREATE TABLE IF NOT EXISTS finding_docs (
  run_id     TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  markdown   TEXT NOT NULL,
  PRIMARY KEY (run_id, finding_id)
);
