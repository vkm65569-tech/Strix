# Scan instructions for Strix

These instructions are passed to the agent with `--instruction-file`. They keep
runs focused and make the report easier to act on. Edit freely.

## Goal

Produce a clear, prioritised vulnerability report for an owner-operated web
application (Next.js on Vercel, Supabase Postgres, Stripe/Cashfree payments,
third-party OAuth and webhook integrations).

## Priorities, highest first

1. Authentication and session handling — JWT/session flaws, auth bypass,
   privilege escalation, insecure password or token reset flows.
2. Broken access control — IDOR, missing authorisation checks on API routes,
   row-level security gaps between tenants.
3. Payment and webhook integrity — signature verification, replay, amount
   tampering, fulfilment triggered without a valid payment.
4. Secret exposure — keys shipped to the client bundle, secrets in logs or
   error responses, permissive CORS, exposed debug endpoints.
5. Injection — SQL/NoSQL injection, SSRF, command injection, template injection.
6. File upload and content handling — unrestricted types, path traversal,
   stored XSS through user content.

## Rules for the report

- Only report a finding you can back with actual evidence. No speculative
  "this might be vulnerable" entries.
- For each finding include: a short title, severity (Critical/High/Medium/Low),
  the exact file and line or endpoint, what an attacker could do, a working
  proof-of-concept or reproduction steps, and a concrete fix.
- If you cannot reproduce it, put it in a separate "Unconfirmed / needs manual
  review" section instead of the main findings.
- Do not test destructive actions against real user data, and do not attempt
  denial-of-service or brute-force attacks.

## Out of scope

- Third-party services you cannot modify (Supabase, Vercel, payment providers).
- Social engineering.
- Anything requiring access to another customer's account.
