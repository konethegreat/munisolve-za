# Phase 2B: duplicate detection and guarded auto-assignment

**Status:** approved direction from the overhaul roadmap; implemented after Phase 2A.
**Depends on:** Phase 1 contracts and Phase 2A outbox/tick.

## Goal

Stop the same pothole being worked twice, and let the system assign straightforward
reports without a human while keeping every decision explainable and reversible.

## Non-goals

- No PostGIS and no geohash index. At pilot volume (<100k reports) an indexed
  bounding box plus Haversine refinement is exact enough. Geohash columns can be
  added later without changing this API.
- No machine-learned scoring. The score is a documented weighted sum.
- No automatic archive or deletion. A duplicate becomes a link; nothing is removed.

## Duplicate detection

On report creation, if the new report has coordinates, look for open reports
(`PENDING`, `ASSIGNED`, `IN_PROGRESS`) in the same category family, created inside
the family window, within a latitude/longitude bounding box of the family radius.
Refine with Haversine and score each candidate:

- distance: `1 - distance / radius`, weight 0.5
- recency: `1 - age / window`, weight 0.3
- title similarity: Dice coefficient over lowercase word sets, weight 0.2

Candidates at or above `0.65` are stored as `DuplicateCandidate` rows (`SUGGESTED`)
and returned with the creation response. The reporter confirms or dismisses them.

Confirming links the new report to the canonical one: status `CLOSED`, closure reason
`DUPLICATE`, `duplicateOfId` set, SLA windows cleared so no false breach fires, a
`ReportStatusHistory` row and an `ActivityLog` row written, a `MergeRecord` created,
and the reporter added as a `ReportFollower` of the canonical report. Admins can
unmerge: the report returns to `PENDING` with fresh SLA windows and the merge record
is marked undone.

The same reporter submitting the same place twice within the window is merged
immediately when the score is at least `0.9`; the response carries `mergedInto` so
the client can say which report was reused.

Families and windows:

| Family | Categories | Window | Radius |
|---|---|---|---|
| Roads | `POTHOLE` | 30 days | 50 m |
| Water | `WATER_LEAK` | 7 days | 100 m |
| Sewage | `SEWAGE` | 14 days | 100 m |
| Power | `ELECTRICITY_OUTAGE` | 6 hours | 250 m |
| Lighting | `STREETLIGHT`, `TRAFFIC_LIGHT` | 72 hours | 100 m |
| Waste | `REFUSE_COLLECTION`, `ILLEGAL_DUMPING` | 48 hours | 100 m |
| Other | `GRAFFITI`, `PARK_MAINTENANCE`, `OTHER` | 14 days | 100 m |

Categories outside the table are treated as `Other`.

## Guarded auto-assignment

The tick evaluates `PENDING`, unassigned reports created at least 5 minutes ago.
Teams are filtered to active, same municipality (when both set), staffed with the
category skill, inside their radius, and below capacity. The winner is scored:

- skill match: 40 points for a keyword match, 10 otherwise
- municipality: 20 points
- distance: up to 30 points, linear inside `maxRadiusKm` (default 20)
- load: up to 10 points, `1 - activeTickets / capacity`

Auto-assign only when the global switch `AUTO_ASSIGN_ENABLED=true`, the team has
`autoAssignEnabled`, the top score is at least 70, the lead over the runner-up is at
least 15, coordinates are present, the category is not `OTHER`, and no
`SUGGESTED` duplicate candidate exists for the report. Every evaluated report gets
one `AssignmentDecision` row with the mode (`AUTO` or `SKIPPED`), chosen team, score,
runner-up score, and JSON reasons. Assignment runs through the existing report
service so it writes the same history and activity rows; the audit actor is
`SYSTEM` (activity description says so). Auto-assigned reports notify active admins
through the outbox with dedupe key `autoassign:r<reportId>:t<teamId>`.

The flag is off by default; the demo sets it to `true` so the behaviour is visible.

## API

| Method | Path | Who | Purpose |
|---|---|---|---|
| `GET` | `/api/reports/:id/duplicates` | owner or admin | List candidates with canonical summaries |
| `POST` | `/api/reports/:id/duplicates/:candidateId/confirm` | owner or admin | Merge into the canonical report |
| `POST` | `/api/reports/:id/duplicates/:candidateId/dismiss` | owner or admin | Keep both reports |
| `POST` | `/api/admin/reports/:id/unmerge` | admin | Restore a merged duplicate |

## Acceptance criteria

- Duplicate candidates are returned on creation and never created for reports
  without coordinates.
- Confirming cancels the duplicate's SLA and keeps the canonical clock.
- Unmerge restores `PENDING` and stamps fresh windows.
- Auto-assignment is off unless explicitly enabled and every decision is persisted.
- The full suite, typecheck, build and disposable-PostgreSQL demo stay green.
