# Incident Triage — Product Requirements

**Version:** 0.1  
**Status:** POC-first  
**Author:** Engineering

---

## TL;DR

Build an npm package that turns production alerts (Prometheus, PostHog, deploy failures) into AI-driven triage sessions. Output: root-cause report + telemetry improvement PRs. No auto-remediation. No live telemetry pipe. Structured payloads only.

**POC constraint:** Ship a working end-to-end flow without real traffic. Fixtures everywhere. Validate the loop before asking anyone to wire up Prometheus.

---

## Problem

MTTR is dominated by discovery and context-gathering. Engineers spend 30+ minutes pulling logs, diffs, and dashboards before they can hypothesize. By the time they have context, the incident may have self-healed or gotten worse.

We can compress that: alert → structured evidence bundle → AI triage → human-approved patch/rollback + telemetry PR.

---

## Solution

**Incident Triage** — `@devinnn/incident-triage`

1. **Signal layer** — Accept webhooks (Prometheus, PostHog-style, deploy). Normalize to a single `IncidentPayload`.
2. **Normalizer** — Fetch commits, logs (pluggable), package into evidence bundle.
3. **Devin** — Run deterministic triage playbook. Structured output: root cause, confidence, suggested action, telemetry gaps.
4. **Outputs** — Markdown report, optional patch PR, telemetry improvement PR.

Human always approves. No auto-merge.

---

## POC Strategy: Fixture-First

You don't have Prometheus. You don't have a live app. That's fine.

| Component | POC Approach | Notes |
|-----------|--------------|-------|
| Signals | Fixture JSON files | Real Alertmanager/PostHog format; paste from docs |
| Logs | Fixture `logs.json` | Hand-crafted incident narratives; prove the AI can infer cause |
| Commits | Real git | Use this repo or any checkout; no mock needed |
| Devin | Real API or `--dry-run` | Dry-run prints bundle + prompt; no ACU spent |
| Outputs | File-based or test repo | Skip PRs for POC; write reports to disk |

### Fixture Layout

```
fixtures/
├── signals/
│   ├── prometheus/
│   │   ├── high-error-rate.json
│   │   ├── latency-spike.json
│   │   └── pod-oom.json
│   ├── deploy/
│   │   ├── vercel-build-failure.json
│   │   └── gh-actions-failure.json
│   └── posthog/
│       └── funnel-drop.json
└── logs/
    ├── high-error-rate.json    # 500s, stack traces, timestamps
    ├── latency-spike.json      # Slow queries, timeouts
    └── deploy-failure.json    # Build logs, env errors
```

Fixtures tell a story. Example: `high-error-rate.json` has a spike of 500s at 14:32; `high-error-rate-incident.json` logs show `NullPointerException` in `PaymentService.validate()`. Devin should surface that and suggest adding error counters.

### CLI: Demo + Dry-Run

```
incident-triage run --fixture high-error-rate    # Full flow with fixtures
incident-triage run --demo                       # Single baked scenario
incident-triage run --dry-run --fixture ...      # No Devin call; dump bundle + prompt
```

**Ship the POC in Phase 1.** If `run --demo` produces a plausible triage report, we've validated the loop. Real webhooks can plug in later.

---

## Architecture

### Data Flow

```
[Webhook / Fixture] → Parse → Normalize (commits + logs) → Evidence Bundle
                                                              ↓
[Devin API] ← Prompt + Attachments ← Package
      ↓
[Triage Report] + [Patch PR] + [Telemetry PR]
```

### Signal Sources (Real + Fixture)

| Source | Format | POC |
|--------|--------|-----|
| Prometheus Alertmanager | [v4 webhook](https://prometheus.io/docs/alerting/latest/notification_examples/) | `fixtures/signals/prometheus/*.json` |
| PostHog funnel regression | Custom `{ source, funnel_id, drop_pct }` | Zapier/Make → webhook; fixture for POC |
| Deploy failure | `{ source: "deploy", provider, error_message }` | Vercel/GHA webhook; fixture for POC |
| SLO breach | Prometheus alert with `slo_breach=true` | No separate path |

### Normalizer

| Data | Source | POC |
|------|--------|-----|
| Alert metadata | Webhook / fixture | Pass-through |
| Time window | `startsAt` ± config | Parse + expand |
| Commits | `git log` or GitHub API | Real; use current repo |
| Logs | Pluggable adapter | Fixture file adapter first |
| Dashboards | Config URL template | Placeholder or public demo |

**Logs adapter:** Interface only. First impl: load from `fixtures/logs/{scenario}.json`. Real providers (Datadog, Loki) in v2.

---

## Project Structure

```
incident-triage/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── cli.ts
│   ├── config/
│   ├── signals/
│   ├── normalizer/
│   ├── devin/
│   ├── outputs/
│   └── github/
├── fixtures/              # POC: baked scenarios
│   ├── signals/
│   └── logs/
├── .github/workflows/
├── incident-triage.yaml.example
└── docs/
    └── PRD.md
```

---

## Configuration

```yaml
# incident-triage.yaml
version: 1
devin:
  apiVersion: v1
  unlisted: true
  maxAcuLimit: 3
  tags: [incident-triage]
signals:
  prometheus:
    enabled: true
    labelFilters: { severity: critical }
  posthog:
    enabled: false
  deploy:
    enabled: true
services:
  - name: api
    repo: owner/repo
    paths: [src/api]
normalizer:
  timeWindowMinutes: 30
  commitDepth: 10
  logsAdapter: file    # POC: fixture or user-placed logs.json
outputs:
  createPatchPr: false   # POC: false
  createTelemetryPr: false
  reportPath: .incident-triage/reports
```

---

## CLI

| Command | Purpose |
|---------|---------|
| `validate` | Validate config |
| `run --fixture <name>` | Run with fixture signal + logs |
| `run --demo` | Run single built-in scenario |
| `run --payload <path>` | Run with raw JSON payload |
| `run --dry-run` | No Devin; output bundle + prompt |
| `webhook-server --port 3000` | HTTP server (Phase 3) |
| `status --since 24h` | List Devin sessions |

---

## Devin Playbook (Deterministic)

1. Identify impacted services from context
2. Diff recent commits in those services
3. Correlate logs for errors/timeouts
4. Propose: root cause hypothesis, confidence, suggested action (patch | rollback)
5. List missing telemetry (counters, spans, etc.)

**Structured output:** `TriageReport` + `TelemetryGap[]`. One session, one schema. Split into two PRs if needed.

---

## Implementation Phases

### Phase 1: POC (Week 1) — Ship with fixtures

- Scaffold, config schema, signal parsers
- Fixture layout + 2–3 scenarios
- `run --fixture`, `run --demo`, `--dry-run`
- Normalizer: commits (real) + logs (fixture adapter)
- Devin client, single triage prompt + schema
- Triage report to file

**Definition of done:** `incident-triage run --demo` produces a triage report from fixture data.

### Phase 2: Full Loop (Week 2)

- Patch PR + Telemetry PR creation
- Evidence bundle (tar.gz)
- CLI `status`

### Phase 3: Webhooks (Week 3)

- `webhook-server`
- GitHub Action
- Generic PostHog payload support

### Phase 4: Polish (Week 4)

- Logs adapter interface + file-based impl for user-placed logs
- Dashboards templating
- Docs

---

## Out of Scope (MVP)

- Real-time telemetry ingestion
- Auto-remediation / auto-merge
- Logs provider impls (Datadog, Loki) — interface only
- Slack/Jira — v2

---

## Success Criteria

**POC:** Run `incident-triage run --demo` → get triage report that correctly identifies cause + telemetry gaps from fixture data.

**Product:** % reduction in time-to-root-cause; % of incidents where AI suggests correct service in top 2; % of telemetry PRs accepted.

---

## Reuse from docdrift

| From | Use |
|------|-----|
| `src/devin/v1.ts` | Copy; same API |
| `src/github/client.ts` | PR creation |
| `src/utils/git.ts` | gitCommitList, gitDiffSummary |
| `src/evidence/bundle.ts` | Evidence tarball pattern |
| `src/config/load.ts` | Config loading |

---

*Build the loop. Validate with fixtures. Wire real signals when someone cares.*
