---
description: Audit current code against the CLAUDE.md Security rules; report each gap with file:line.
---

Audit the current code against the Security rules in CLAUDE.md: secrets
server-side only, RLS on every table, two-layer authorization, PIN-gated
sensitive actions, Zod validation, audit_log on all mutations, httpOnly
sessions, and rate limiting. Report each gap with file and line number.
