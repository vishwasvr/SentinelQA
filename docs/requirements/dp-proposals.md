# Decisions Pending — APPROVED answers (were PROPOSED)

| Item | Value |
|---|---|
| Status | **APPROVED by Vishwas on 2026-10-13** as recommended (Developer review notes adopted where recommended; items marked GUESS below are now Decided). Changes from the proposal: **DP-01** soft-deleted records keep their ID reserved; **DP-12** workspace timezone **America/New_York** (not Chicago); **DP-20** option (b): `dueDate` defaults to open date + N days (SSM `capa-ncmr/default-due-days`, PLACEHOLDER 30), no new form field, Overdue from step 1. Folded into [BRD.md](BRD.md) v1.5 §13.7, which is authoritative. Confidence labels below record the original evidence basis |
| Author | Business Analyst |
| Date | 2026-10-13 |
| Basis | [BRD.md](BRD.md) v1.4.3 §13.3 (proposal basis; decisions in v1.5 §13.7) (DP list), §4–§8, §11 (OQs), screenshots; [developer-review](../reviews/developer-review.md) (DEV-n), [qa-review](../reviews/qa-review.md) (QA-n), [ba-review](../reviews/ba-review.md) (BA-n), [architecture-overview](../architecture/architecture-overview.md), [openapi.yaml](../architecture/api/openapi.yaml) |

**Confidence legend.** *Observed* = the recommendation restates behaviour seen in a screenshot or written in the BRD/architecture. *Inferred* = follows from observed behaviour or an existing rule, but the exact rule was not seen. **GUESS** = no evidence; a BA proposal for Vishwas to accept or replace.

Out of this doc: DP-05 and DP-18 (decided v1.4.3; the /compare table content and fixture publication parts of DP-05 are not covered by the decision and remain open), DP-15 (resolved v1.4).

## API contract impact
These DPs change [openapi.yaml](../architecture/api/openapi.yaml) when decided: **DP-01, DP-02, DP-03, DP-06, DP-07, DP-08, DP-10, DP-11, DP-12.** (openapi already marks stage-advance rules "TBD (DP-02)".) The others are UI/derivation rules only.

## Summary
| DP | Recommended | Confidence | API |
|---|---|---|---|
| DP-01 | `<PREFIX>-<YYYY>-<NNNN>` sequential per type and year, no `DEMO`; user IDs unique per workspace | Inferred | Yes |
| DP-02 | Forward-only, one step at a time; backward move to Investigation from QM Review only; QM closes; specs below | Inferred / **GUESS** | Yes |
| DP-03 | Sign off CFR ranges; normalise case/whitespace/punctuation; screen all free text, exempt IDs/names | Inferred / **GUESS** | Yes |
| DP-04 | Names ≤ 100 chars, titles ≤ 200, IDs ≤ 64, free text ≤ 32 KB | **GUESS** (32 KB Observed, A-06) | No |
| DP-06 | Bands at integer cut-offs 1–5; round mean to 1 dp; no result until 8/8 | Inferred / **GUESS** | Yes |
| DP-07 | Per-course recurrence in months; Not started = no completion and start-by date not reached | **GUESS** | Yes |
| DP-08 | Independent = different normalised name from author and preparer; hard block | Inferred | Yes |
| DP-09 | Signed FAI is locked; edits need un-sign (audited); FAIL row cannot clear NCR | Inferred | No |
| DP-10 | Supplier master is a create/edit record; on-time % and SCAR count entered; links by supplierId | **GUESS** | Yes |
| DP-11 | Doc number/revision immutable after create; no re-release of same/older revision; revisions compared numeric/numeric or alpha/alpha, mixed rejected | Inferred | Yes |
| DP-12 | Workspace TZ America/New_York (decided; proposed Chicago); thresholds inclusive; due today = Due soon; EOM clamp | Inferred / **GUESS** | Yes |
| DP-13 | Oldest first by openedAt; filters AND; tie-break by name | Inferred | No |
| DP-14 | ISO weeks (Mon) in workspace TZ; opened = createdAt; Pareto cut 80% cumulative | Inferred | No |
| DP-16 | Three bands: At risk < 60, Watch 60–79, Approved ≥ 80; SSM JSON schema | **GUESS** (bands Observed) | No |
| DP-17 | FAI tile = FAI records not fully signed; Effectiveness tile = 0/hidden until entity exists | Inferred | No |
| DP-19 | Re-evaluation date must be after approval date; approval date not in the future | **GUESS** | No |
| DP-20 | Open CAPA/NCMR with dueDate < today = Overdue, counted in Needs attention | Inferred | No |

---

## DP-01 — Record ID format
- **Question:** What is the production ID format per entity, and must user-entered IDs be unique?
- **Recommended:** System IDs `CAPA-YYYY-NNNN`, `NCMR-YYYY-NNNN`, `SCAR-YYYY-NNNN`, `SQ-YYYY-NNN`, `CAL-YYYY-NNN`, `FAIR-YYYY-NNNN`, `DOC-YYYY-NNNN`: year of creation (workspace TZ, DP-12), zero-padded sequence per type and year, no `DEMO` literal; immutable (BR-12). User-entered Equipment ID and Document number must be unique within the workspace (case-insensitive); a duplicate is rejected with 409.
- **Alternatives:** (a) keep the observed random suffix (`CAL-DEMO-MV5YVOKD`, `FAIR-2026-1576064A`) minus `DEMO`; (b) ULID suffix (no counter).
- **Rationale:** The sample records (NCMR-2026-0087, SQ-2025-014, CAL-2026-001) all use year + sequence, the format a QM would cite in an audit.
- **Evidence:** BRD §4.5, §4.8, §4.11, BR-12, BR-22, BR-39; screenshots 35, 13, 43, 41; DEV-10, QA-15, BA-15.
- **Confidence:** Inferred (pattern Observed in samples; that prod should use it is inferred). Digit widths for FAIR/DOC are **GUESS**. A sequence counter needs a counter item (Architect).
- **Developer review note:** the sequence counter item is incremented in the **same transaction** as the record and its audit event. Unique Equipment IDs and Document numbers each get a **reservation item**. Recommended: a soft-deleted record **keeps its ID reserved** (records are audited, so an ID must never point to two records). Alternative: release the ID on delete. Confidence: **GUESS**.

## DP-02 — CAPA/NCMR steps 2–6 and SQ steps 3, 4, 6; transitions
- **Question:** What fields does each unobserved step hold, and what stage moves are allowed?
- **Recommended:** The proposed specs below. Transitions: forward one stage at a time; no skipping; a single backward move QM Review → Investigation ("returned for rework"), with a required reason; Closed is terminal; only a named reviewer different from the record author may move QM Review → Closed (DP-08); NCMR needs a disposition before leaving Draft Ready. SQ: forward-only; re-evaluation starts a new SQ record for the same supplier.
- **Alternatives:** (a) a generic stage advance only (current build fallback, §13.2a), with free-text notes per stage; (b) allow any backward move with a reason.
- **Rationale:** Stage names and order are observed, and the existing gates (named approver, disposition approver) give the natural validation points; everything else stays minimal.
- **Evidence:** BRD §4.6, §4.8, BR-10, BR-13, BR-35, BR-36, OQ-06, OQ-07; screenshots 25, 26, 34, 35, 38, 39; DEV-04, QA-14, BA-08.
- **Confidence:** Stage list and order Observed; transition rules **GUESS**; field specs per below.

### Proposed spec — CAPA/NCMR (all records carry the step-1 fields: ID, type, short title, event description, severity, clause, reviewer name, delivery details/need-by date, disposition for NCMR)
Common to every step (Observed): "Your name" recorded on each step (BR-11); each advance writes a `STAGE_CHANGED` audit event with actor and from/to (BR-08, openapi generic stage advance); every free-text save carries `controlledDataAttestation=true` and passes the BR-44 gate.

| Step | Proposed fields | Validation to advance | Basis / confidence |
|---|---|---|---|
| 2 Containment | Containment actions (free text, required); affected quantity / lot (free text, optional) | Containment actions non-empty | "segregate lot, 100% CMM on remaining stock" and "3 of 40" in the NCMR-2026-0087 drawer (34) — Inferred; field split **GUESS** |
| 3 Investigation | Root cause candidates (list of free-text items, ≥ 1); confirmed root cause (free text) | ≥ 1 root cause and a confirmed root cause | Drawer "Root cause candidates" (34) — Inferred; "confirmed" field **GUESS** (AI hypotheses deferred, so human-entered) |
| 4 Draft Ready | Corrective actions (list: action text, owner name, due date); proposed disposition (NCMR only: Use as is, Rework, Repair, Scrap, Return to supplier); `dueDate` (see Developer review note below: proposed to move to step 1, which needs a new create-form field or a default of open date + N days, **GUESS**); citations (clause refs) | ≥ 1 action; NCMR: disposition set; if Use as is or Repair, independent named approver set (BR-10) | Drawer "Actions", "disposition proposed", "Citations" (34); disposition enum §6 — Observed; per-action owner/due **GUESS** |
| 5 QM Review | Reviewer decision (Approve / Return to Investigation); decision comment; reviewer name | Approve → Closed allowed; Return requires a comment | Stage name Observed (35); decision options **GUESS** |
| 6 Closed | Closed date (system), closed by (reviewer name); read-only afterwards except audited corrections | Only from QM Review with Approve | Stage Observed; rules **GUESS** |

**Developer review note (DP-02 + DP-20):** with `dueDate` set only at step 4, records in Containment and Investigation could never be overdue. Recommended: set `dueDate` at **step 1** (create). Alternative: keep it at step 4 and state in the BRD that steps 1–3 are never overdue. Confidence: **GUESS**. **Developer review note:** setting `dueDate` at step 1 adds a **new field**: the observed create forms (screenshots 25, 26) have no due date. Options: (a) add a required or optional `dueDate` field to the create form; (b) default `dueDate` to the open date + N days, with N configurable (BR-47 config). The choice between (a) and (b) and the value of N are **GUESS**, for Vishwas to decide.

Effectiveness check (dashboard tile, DP-17) is **not** specified here: no entity observed.

### Proposed spec — Supplier Qualification
| Step | Proposed fields | Validation to advance | Basis / confidence |
|---|---|---|---|
| 3 Risk | Risk classification (Critical / Standard, matching the supply-chain criticality enum); risk rationale (free text) | Classification set | Audit label "Risk classification" (39); Critical/Standard enum §6 — Inferred; rationale **GUESS**. Human-entered (BR-36 v1.2) |
| 4 Evaluation | Evaluation method (free text, e.g. survey/audit); evaluation result (Acceptable / Not acceptable); notes | Result set; Not acceptable cannot continue to Approval | Audit label "Evaluation" (39) — stage Observed; all fields **GUESS** |
| 6 Active on ASL | Read-only summary: approved scope, approver, approval date, re-evaluation date + days remaining; status Approved | Reached only via "Approve & add to ASL" (BR-35) | ASL tab columns (13), step 5 fields (39) — Observed; that step 6 is read-only is Inferred |

## DP-03 — Controlled-data gate remainder (O-04)
- **Question:** Do you sign off the CFR-range reading, and how are normalisation, evasion, field scope and exempt fields handled?
- **Recommended:** (1) Sign off the v1.4.1 range reading as written in BR-44. (2) Normalise before matching: Unicode NFKC, case-fold, collapse whitespace, treat `.`/`-`/`_` between letters as separators (so `I.T.A.R` and `I T A R` hit). (3) Out of scope: base64, deliberate misspellings, other languages — covered by the attestation, not the matcher. (4) Screen every free-text field (titles, descriptions, notes, scope, location); exempt system IDs, enum values, dates, and person-name fields. (5) Writes without free text still require attestation only if the endpoint accepts any free-text field (openapi). (6) 422 message: "This text appears to contain controlled data (marker: <id>). Remove it and try again." with the input kept in the form, client-side only.
- **Developer review note:** `.`, `-` and `_` between letters are treated as separators, so `15 C.F.R. 734` matches the 15 CFR 730–774 range. A hyphen between digits (as in `120-130`) is unaffected. Once DP-03 is approved, add these as cases to `test_marker_patterns.py`: `15 C.F.R. 734` (hit), and, as **GUESS** (not specified by Developer), `I.T.A.R` (hit), `C-U-I` (hit), `22 CFR 120-130` (range kept, hit).
- **Alternatives:** (a) literal-only markers, no normalisation (simplest, weakest); (b) screen names too (false-positive risk, e.g. a surname "Ear").
- **Rationale:** Whole-word case-insensitive is already decided; light normalisation closes cheap evasion without exotic false positives.
- **Evidence:** BR-44, BR-04; ADR-0005; overview O-04 and §4; DEV-13, DEV-27, QA-03, QA-04, QA-20.
- **Confidence:** (1) Inferred (BA reading of Vishwas's decision); (2)–(6) **GUESS**.

## DP-04 — Field limits
- **Question:** What are the length and character limits per field?
- **Recommended:** Person names (reviewer, approver, preparer) 1–100 chars, trimmed, letters/space/`.,'-`; titles 1–200; user IDs (Equipment ID, Document number, PO number) 1–64, `[A-Za-z0-9._/-]`; revision 1–16; free text ≤ 32 KB (A-06). PO-check fields per §13.2 with the same classes.
- **Alternatives:** (a) only the 32 KB cap on all strings; (b) tighter names (≤ 64).
- **Rationale:** Gives testable bounds; values are conventional, not observed.
- **Evidence:** BR-11, §13.2; overview A-06; QA-16, DEV-04.
- **Confidence:** **GUESS** (only the 32 KB cap is documented).

## DP-06 — QMS maturity bands
- **Question:** What are the bands besides Defined, how is the mean rounded, and what with < 8 answers?
- **Recommended:** Mean rounded to 1 decimal (half-up); bands by floor: 1.0–1.9 Initial, 2.0–2.9 Developing, 3.0–3.9 Defined, 4.0–4.9 Managed, 5.0 Optimising; no score until 8/8 answered (progress shown).
- **Alternatives:** (a) round to nearest band; (b) score partial answers over answered dimensions.
- **Rationale:** 3.0 → Defined and "Managed" as next band are observed; a 1–5 ladder fits the 1–5 ratings.
- **Evidence:** BR-28, BR-41, OQ-09; screenshots 54, 56, 57; QA-08, DEV-11.
- **Confidence:** Defined/Managed Observed; 1-dp display Observed ("3.0 / 5"); other band names and cut-offs **GUESS**.

## DP-07 — Training recurrence and Not started
- **Question:** What is the recurrence interval and when is an assignment "Not started"?
- **Recommended:** Recurrence is a per-course setting in months (default none = one-off); on completion the next due = completion date + interval. Not started = no completion recorded and a start-by date (assignment created + N days) in the future; once past, it becomes Overdue.
- **Alternatives:** (a) one global recurrence (e.g. 12 months); (b) no recurrence in the pilot.
- **Rationale:** "7d to start" on the R. Chen row implies a start-by date; re-certification courses imply recurrence.
- **Evidence:** §4.12, BR-40; screenshot 50; DEV-22, QA-24.
- **Confidence:** start-by concept Inferred; intervals and defaults **GUESS**.

## DP-08 — Segregation of duties
- **Question:** Who counts as "independent" and as "author", is it a hard block, and how are names compared?
- **Recommended:** Author = the reviewer name on the record's create event. Independent = a name different from the author (and, for FAI, from the preparer). Compare after trim, collapse inner whitespace, case-fold; initials are **not** expanded ("J. Park" ≠ "Jordan Park"). Hard block (409/422) on the server; the UI disables the action with a message.
- **Alternatives:** (a) warning only; (b) require a saved Approval Role person (but Approval Roles are not a permission system, BR-19).
- **Rationale:** Observed gates already hard-block (Sign as Evaluator disabled, Approve disabled); names are self-asserted (ADR-0008), so only a deterministic text comparison is possible.
- **Evidence:** BR-10, BR-20, BR-33, OQ-03; screenshots 41, 39, 44; DEV-15, QA-07, QA-25.
- **Confidence:** hard block Inferred; comparison rules **GUESS**.

## DP-09 — FAI after sign-off
- **Question:** Can a signed FAI be edited or un-signed, and can a FAIL row lose its NCR?
- **Recommended:** After the preparer signs, Form 1/3 are locked; the preparer may un-sign (audited) only before the evaluator signs, which unlocks editing. After both sign, no edits; corrections need a new FAI (Delta). A committed FAIL row cannot have its NCR cleared (same rule as add-row).
- **Alternatives:** (a) edits allowed, clearing signatures automatically; (b) no un-sign at all.
- **Rationale:** Keeps the AS9102 signature meaningful and reuses the observed add-row precondition.
- **Evidence:** BR-33, BR-34; screenshot 41; QA-25.
- **Confidence:** Inferred (signing was not exercised).

## DP-10 — Supplier master data
- **Question:** How are suppliers created and edited, are on-time % and SCAR counts entered or derived, and how are SQ, Supplier and SCAR linked?
- **Recommended:** A Supplier record (name, commodity, criticality, standards, cert renewal date, on-time %) with create/edit; on-time % entered manually (no PO/receipt data in scope); open SCAR count derived from SCAR records linked by `supplierId`; SQ links to a Supplier by `supplierId` (created at SQ step 1 if new). Flags derived: open SCAR/CAPA linked → flag; next step text chosen by band.
- **Alternatives:** (a) all fields entered (no derivation); (b) supplier exists only via SQ.
- **Rationale:** Observed scorecard shows these fields but no data source; derive only what the build already stores.
- **Evidence:** §4.7, §4.8, BR-16; screenshots 12, 48, 49; DEV-12, BA-12.
- **Confidence:** **GUESS** (fields Observed; sourcing not observed).

## DP-11 — Keyed record edits (Document)
- **Question:** Can Document number/revision change, can a revision be re-released, and what is "the same document"?
- **Recommended:** Same document = same Document number (case-insensitive). Number and revision are immutable after create; a new revision is a new record. Releasing a revision ≤ the current released one (or the same one again) is rejected (409). Concurrent releases: conditional write, second gets 409.
- **Alternatives:** (a) allow edits to Draft records only; (b) allow re-release of older revisions with a reason.
- **Rationale:** Matches the key `DOC#<docNo>#REV#<rev>` and the observed auto-supersede of "earlier released revision of the same document".
- **Evidence:** BR-37, OQ-17; screenshots 44, 46; overview §5; DEV-14, QA-13.
- **Developer review note:** revisions are compared **numerically** when both values are numbers and **alphabetically** when both are letters; a mix of number and letter (e.g. `3` vs `B`) is rejected (HTTP 422 — **GUESS**, code not specified). This is the recommendation for revision ordering.
- **Confidence:** Inferred (ordering rule per Developer review note).

## DP-12 — Dates and time
- **Question:** Which timezone defines "today", are thresholds inclusive, what is due-today, and the +N months end-of-month rule?
- **Recommended:** Workspace timezone America/New_York (**decided by Vishwas 2026-10-13**; originally proposed America/Chicago, A-07 US users); day count = calendar days between today and the date in that zone; thresholds inclusive (≤ 30 is in the 30-day bucket); due today (0d) = Due soon, Overdue from day −1; +N months clamps to the last day of the month (Jan 31 + 1 → Feb 28/29).
- **Alternatives:** (a) UTC dates (matches the observed "Completed 2026-10-13" on Oct 12 CT, OQ-16); (b) due today = Overdue.
- **Rationale:** UTC caused an off-by-one date for US users in the demo; inclusive buckets match "≤90d" labels.
- **Evidence:** BR-18, BR-24, BR-25, BR-39, OQ-16; screenshots 43, 51; overview A-07; DEV-21, QA-23.
- **Confidence:** inclusive buckets Inferred; TZ choice and due-today **GUESS**; EOM clamp **GUESS**.

## DP-13 — Review queue, filters, tie-break
- **Question:** What age direction/basis does the review queue use, how do filters combine, and how are equal supplier scores ordered?
- **Recommended:** Severity (Critical > Major > Minor), then oldest `openedAt` first; filters combine with AND; empty state "No records match these filters" with Clear filters; equal supplier scores ordered by name A–Z.
- **Alternatives:** (a) age by soonest due date; (b) tie-break by criticality.
- **Developer review note:** the queue order needs the GSI1 severity rank to sort Critical first (Critical=1; Major=2 and Minor=3 are **GUESS**, not specified).
- **Rationale:** GSI1 is keyed `severityRank#openedAt`; observed queue (9d left before 12d left) is consistent with either basis.
- **Evidence:** BR-14, US-10, US-11, US-18; screenshots 09, 12; overview §5; QA-10, QA-11.
- **Confidence:** Inferred; empty-state text **GUESS**.

## DP-14 — Trend definitions
- **Question:** What are week boundaries, what counts as "opened", and where is the Pareto cut?
- **Recommended:** ISO weeks (Monday start) in the workspace TZ, last 12 complete weeks plus the current one; opened = record create date, closed = date it entered Closed; Pareto shows clauses in descending count and marks those making up the first 80% cumulative.
- **Alternatives:** (a) rolling 7-day windows; (b) top-N clauses instead of 80%.
- **Rationale:** The observed caption "80% of findings come from …" implies an 80% cumulative cut.
- **Evidence:** US-12, §4.5; screenshot 09; QA-09.
- **Confidence:** 80% cut Inferred; week rules **GUESS**.

## DP-16 — Supplier band cut-offs and schema
- **Question:** What are the band cut-offs and the config schema for weights and bands?
- **Recommended:** Bands At risk < 60, Watch 60–79, Approved ≥ 80 (PLACEHOLDER). SSM `supplier-risk/weights` JSON: `{"weights":{"openScars":n,"onTimePct":n,"criticality":n,"certFreshness":n},"bands":[{"name":"At risk","min":0},{"name":"Watch","min":60},{"name":"Approved","min":80}],"placeholder":true}`; weights sum to 1; bands sorted by `min`.
- **Developer review note:** the weights-sum-to-1 check allows a tolerance of **±0.001**.
- **Alternatives:** (a) At risk < 50 / Watch < 70; (b) four bands.
- **Rationale:** Consistent with all observed points (48 At risk, 62 Watch, 84 Approved); 74 (Precision Heat) is unobserved and would be Watch.
- **Evidence:** BR-16, BR-47, OQ-01; screenshots 12, 48, 49; overview §3, O-04; QA-01.
- **Confidence:** band names Observed; cut-offs and schema **GUESS**.

## DP-17 — Dashboard tile sources
- **Question:** What feeds "FAI sign-off pending" and "Effectiveness checks due"?
- **Recommended:** FAI sign-off pending = FAI records not removed where preparer or evaluator has not signed. Effectiveness checks due = shown as 0 with "Not tracked in this build" until an effectiveness-check entity is decided.
- **Alternatives:** (a) hide the Effectiveness tile; (b) count CAPAs in Closed with a follow-up date (needs a new field).
- **Rationale:** FAI signature state exists; no effectiveness entity was observed, so counting one would be invention.
- **Evidence:** §4.4; screenshot 08; BA-16.
- **Confidence:** FAI tile Inferred; Effectiveness handling **GUESS**.

## DP-19 — SQ date validation
- **Question:** May the re-evaluation date be before the approval date, or the approval date be in the future?
- **Recommended:** Re-evaluation/expiry date must be after the approval date (422 otherwise); approval date must be ≤ today (workspace TZ).
- **Alternatives:** (a) warnings only; (b) allow future approval dates (scheduled approvals).
- **Rationale:** Both cases make the ASL entry inconsistent; dates are entered manually with no observed checks.
- **Evidence:** BR-35; screenshot 39; QA-24.
- **Confidence:** **GUESS** (no validation observed).

## DP-20 — CAPA/NCMR overdue rule (OQ-25)
- **Question:** Should past-due open CAPA/NCMR be flagged and counted like BR-42 items?
- **Recommended:** A CAPA/NCMR not in Closed with `dueDate` before today (DP-12) is Overdue: Overdue badge in Records and the review queue, counted in the dashboard Needs attention list and its "items need attention" total, and an overdue split on the Awaiting review tile. No Due soon state for CAPA/NCMR (the "days left" display already covers it). Query via the existing GSI2 `dueAt`.
- **Alternatives:** (a) display-only (red "overdue" in place of "Nd left"), not counted; (b) also add a CAPA/NCMR Due soon window (BR-47 config).
- **Rationale:** Matches how training, calibration and supplier items are treated (BR-42) and uses the index that already exists.
- **Evidence:** OQ-25, BR-14, BR-42; screenshots 08, 09, 34, 35; overview §5 (GSI2); Architect finding #29 (DEV-29).
- **Developer review note:** depends on `dueDate` being set at step 1 (see DP-02 note); otherwise Containment and Investigation records are never overdue. **GUESS**. Setting it at step 1 needs a new field (create form has no due date): (a) a `dueDate` field on the create form or (b) default open date + N days, N configurable; choice and N are **GUESS** (see DP-02).
- **Confidence:** Inferred (no CAPA/NCMR overdue display observed; rule extends BR-42). Changes the BR-42 seed count only if seeded records are past due.

---

## Open items for Vishwas (2026-10-13)
**Status: DECIDED by Vishwas 2026-10-13 (relayed by Chief of Staff): OI-1 (b), OI-2 (a), OI-3 (b); OI-4 confirmed, gate in first-deploy §5a (36a674b). Folded into BRD v1.6.** These were the items left open after BRD v1.5 (§13.7 note): the two parts of DP-05 the decision did not cover, OQ-08, and the placeholder tuning owner. Evidence: BRD §4.2, US-04, §13.4, §4.10, OQ-08; screenshot [02](screenshots/02-compare.png); architecture-overview §5.2 (seed); [first-deploy runbook](../runbooks/first-deploy.md) §5.

### OI-1 — /compare table content (DP-05 leftover, US-04) — DECIDED: (b)
**Observed** ([02](screenshots/02-compare.png), BRD §4.2): heading "How Sentinel QA compares", an "Honest disclosure" banner (claims reflect vendors' public pages "as of 2026"), a "Plays with your existing QMS" note, and a matrix of **10 dimensions** (clause-level citation, AS9100D depth, AI-hypothesis flagging, agent-first architecture, traceability across modules, human-in-the-loop, trial access, deployment model, primary industry focus, reliability transparency) × Sentinel QA, Greenlight Guru, MasterControl, Qualityze, OpenRegulatory, QT9 QMS, with Yes / Partial / No / Not verified or short text. A footnote explains the QT9 and Mitti entries. *Evidence gap:* the BRD (US-04 seed check, §4.2) says 9 criteria × 7 products; screenshot 02 shows 10 rows and 6 product columns (no Mitti column visible, it may be cut off to the right). The count should be re-checked before any verbatim copy.

**Build fact:** several Sentinel QA "Yes" cells describe capabilities that are **deferred** in this build (AI-hypothesis flagging, agent-first drafting, reliability transparency: BRD §12 #1, BR-29/30/43). Copied verbatim, they would overstate the build.

| Option | What it is | Trade-offs | Scope / tests |
|---|---|---|---|
| **(a) Verbatim static copy** | Reproduce the observed matrix and footnotes as static content | Fastest route to the observed page; but restates third-party claims we can't re-verify, and the AI rows say "Yes" for deferred features | Static page only; one snapshot test against the table; content needs a re-check of the 9×7 vs 10×6 count and an owner for keeping vendor claims current |
| **(b) Reduced Sentinel-only feature table (recommended)** | Keep the observed dimension names, show only the Sentinel QA column, with deferred AI rows labelled "Not in this build"; drop competitor columns | No third-party claims to maintain; truthful about the build. Loses the competitive framing | Static page; test checks the dimension list and that deferred rows show "Not in this build"; US-04 seed check (9×7) is retired |
| (c) Drop the table | Remove /compare (or the matrix) from the build | Least work and no claims risk; leaves a gap in the evaluator journey (§3 journey 1, P6) | Remove US-04 and nav link; no tests |

**Recommendation:** (b). Confidence: Inferred (from the observed page and the AI deferral). The "Not in this build" wording is a **GUESS**.

### OI-2 — Seed/sample fixture publication (DP-05 leftover, §13.4) — DECIDED: (a)
**Observed / decided:** sample data is allowed in every env, labelled (BR-31, v1.4); the seed set `seed/sample-v<n>.json` is loaded by a one-off seed command through the normal write path, `isSample=true`, soft-delete only (architecture-overview §5.2). Seed checks (US-04, US-08, US-28, US-31) hold only against that set (§13.4).

| Option | What it is | Trade-offs | Scope / tests |
|---|---|---|---|
| **(a) Ship internally only (recommended)** | Seed file lives in the repo and is loaded by the seed command into dev, stage and (labelled) prod; not offered as a download | Matches the existing design; no extra public surface | No new scope; seed checks run against seeded envs as today |
| (b) Also publish as a downloadable static file | Same file, plus a public download link | Lets prospects inspect sample data; adds a public artefact to keep in sync and a new page/link (new UI, not observed) | Small new scope (static asset + link); add a test that the download matches the seed version |
| (c) Don't ship fixtures | No seed set in any env | Removes the labelled-sample feature Vishwas allowed (BR-31) | Seed checks (US-04/08/28/31) become untestable and are retired; empty-state screens only |

**Recommendation:** (a). Confidence: Inferred (follows from BR-31 and §5.2; nothing observed suggests a public download).

### OI-3 — OQ-08 FAI Form 2 (never observed) — DECIDED: (b), all fields GUESS (BRD BR-48, US-42; openapi c6bf9e2); fields to verify pre-go-live
**Observed:** Form 1 and Form 3 only; "Form 2 was not observed" (BRD §4.10, OQ-08).

| Option | What it is | Trade-offs | Scope / tests |
|---|---|---|---|
| **(a) Leave out of the MVP (recommended)** | No Form 2 in the build; keep OQ-08 open | Nothing invented; an AS9102 package is incomplete without Form 2 | No new scope; add an AC that the FAI record shows only Form 1 and Form 3 |
| (b) Build from the Form 1/3 pattern | Form 2 as a grid like Form 3, with fields **GUESS** (from AS9102 general knowledge, not observed: materials/special processes/functional tests with spec, supplier, cert ref) | Closer to a full AS9102 package; every field and rule would be a **GUESS** | New entity, API routes (contract change), grid UI, gate on free text, tests: roughly a Form 3-sized slice |
| (c) Defer until observed | Capture Form 2 from the live site (needs sign-in or an AI-free path) before deciding | Grounded spec later; delays the decision | No scope now |

**Recommendation:** (a). Confidence: Observed (absence); the option (b) field list is **GUESS**.

### OI-4 — Placeholder tuning is a pre-go-live item — DECIDED (confirmed)
**Confirmed:** the PLACEHOLDER values ship in config and must be tuned before prod go-live:
- supplier risk weights (SSM `supplier-risk/weights`, BR-47);
- DP-16 band cut-offs (At risk < 60, Watch 60–79, Approved ≥ 80; same parameter);
- due-soon thresholds (SSM `due-soon-days`, BR-18, BR-25, training);
- CAPA/NCMR default due days, PLACEHOLDER 30 (SSM `capa-ncmr/default-due-days`, DP-20).

| Role | Owner |
|---|---|
| Values | Vishwas |
| Records them in the BRD and updates the SSM parameter spec | BA |
| Sets the parameters in prod | InfraDeploy |

**Trigger:** before the prod deploy approval (Vishwas is the required prod reviewer, first-deploy §5). Proposed gate in the [first-deploy runbook](../runbooks/first-deploy.md): "Prod: confirm no SSM parameter is still labelled PLACEHOLDER" — that runbook is InfraDeploy's; the gate was added as first-deploy §5a (36a674b).

---

## Remaining OQs for Vishwas (2026-10-13)
**Status: DECIDED by Vishwas 2026-10-13 (via Chief of Staff, ~14:45 CT); folded into BRD v1.7 §13.8.** Chosen: OQ-10 (a); OQ-14 (b) warning only, rule approved (no longer GUESS); OQ-15 (b) manual Assign training; OQ-18 (a); OQ-21 (a); OQ-22 (b) Industry filter hidden; OQ-23 (a), button placement GUESS. OQ-14, 15 and 22 differ from the BA recommendation. The OQs still open after BRD v1.6.2 were: Each one has the BRD §11 evidence, options and a BA recommendation. Anything not grounded in the BRD or site evidence is marked **GUESS**.

### OQ-10 — Do records created in modules show up in Records? — DECIDED (a)
**Evidence:** Records shows only the 6 sample records; whether user-created records appear was not observed ([35](screenshots/35-records-status-board.png)). Sample records are allowed in every env, labelled (BR-31, BR-45). Records tabs: CAPA/NCMR/SCAR, FAI, Supplier Qualification, Calibration, Document Control (§4.5).
| Option | Trade-offs |
|---|---|
| **(a) Records lists every record, sample and user-created, with the sample label on sample items (recommended)** | One cross-module view, which matches the observed tabs and "Your records" on the dashboard (§4.4). Needs list queries per type, which the existing indexes support (GSI1, overview §5) |
| (b) Records shows sample records only; user records live in their own modules | Matches exactly what was seen; the Records page becomes a demo-only page and the "Awaiting your review" queue (BR-14) would never show real work |
| (c) Records shows user-created records only; samples hidden there | Clean for prod users; drops the observed sample board |

**Recommendation:** (a). Confidence: Inferred (the tabs and the review queue only make sense with real records).

### OQ-14 — Should a PO be blocked when the supplier isn't on the ASL? — DECIDED (b), rule approved
**Evidence:** SQ approval adds the supplier to the ASL ([39](screenshots/39-sq-wizard-step5-approval-gated.png)); the PO "ASL gate" is badged **ROADMAP – not live** (§4.9); no timeline.
| Option | Trade-offs |
|---|---|
| **(a) Out of the build, stays roadmap (recommended)** | Matches the observed site; no new rule. Purchase Controls stays manual entry (BR-21) |
| (b) Advisory warning on the PO check when the supplier has no active ASL entry | Small, useful; needs a PO → Supplier link (DP-10 `supplierId`), which PO checks don't carry today (§13.2). New behaviour, **GUESS** |
| (c) Hard block | Not observed anywhere; biggest scope and risk |

**Recommendation:** (a). Confidence: Observed (roadmap badge).

### OQ-15 — Should new CAPAs/NCMRs/PO findings create training assignments automatically? — DECIDED (b)
**Evidence:** sample rows say "Auto-assigned · CAPA-2026-0031 / NCMR-2026-0082 / PO clause-check finding" and "3 auto-generated from CAPAs or PO findings", but "CAPA-driven training assignment" is badged **ROADMAP** ([50](screenshots/50-training-matrix-baseline-rivera-row.png), §4.12).
| Option | Trade-offs |
|---|---|
| **(a) No automation; the source link is kept as a field and shown on seeded/manual rows (recommended)** | Matches the ROADMAP badge; the "Auto-assigned · <record>" text stays possible from sample data (BR-27) |
| (b) Manual "Assign training" action on a CAPA/NCMR that creates a linked assignment | Gives traceability without automation rules; new UI, **GUESS** |
| (c) Automatic assignment on record events | The roadmap feature; needs rules (which course, which role) that were never observed |

**Recommendation:** (a). Confidence: Observed (ROADMAP badge); how a training assignment is created without automation (manual entry) is not observed — **GUESS**.

### OQ-18 — What escalation thresholds and rules does Agent reliability use, and can users edit them? — DECIDED (a)
**Evidence:** "Drafts below 0.75 confidence (should escalate)"; escalated tasks in the CSV include 0.76–0.85 ([58](screenshots/58-reliability-export-csv.png), CSV); rule editing not observed. The whole Agent reliability module is **deferred** with AI (BR-29, BR-30, BR-43, §12 #1).
| Option | Trade-offs |
|---|---|
| **(a) Close as deferred with AI (recommended)** | No agent tasks exist in this build, so there is nothing to escalate; reopen with AI |
| (b) Record the observed 0.75 threshold as a config default for the future module | Keeps the observation; no build effect now |
| (c) Specify editable rules now | Nothing observed to base them on; all **GUESS** |

**Recommendation:** (a), recording 0.75 as the observed value in the deferred BR-43. Confidence: Observed.

### OQ-21 — Is the print view a controlled record, and is it in the build? — DECIDED (a)
**Evidence:** CAPA/NCMR create form has a Print link (`/capa/<id>/print`, §4.6); the FAI record has "Print FAI" ([41](screenshots/41-fai-record-created-form3.png)); neither output was opened.
| Option | Trade-offs |
|---|---|
| **(a) Browser print of the record page with header (ID, revision/status, printed date, printed by) and a footer "Uncontrolled when printed" (recommended)** | Small; stays consistent with "references only, no files" (ADR-0007). Header/footer content is **GUESS** |
| (b) Print views omitted from the build | Least work; drops two observed buttons |
| (c) Generated PDF stored as the controlled record | Contradicts the no-file-storage rule (ADR-0007); not observed |

**Recommendation:** (a). Confidence: buttons Observed; print content **GUESS**.

### OQ-22 — Does the build support industries other than Aerospace? — DECIDED (b)
**Evidence:** FAQ says API Spec Q1/Q2 and medical-device standards are in early access ([33](screenshots/33-home-faq-expanded.png)); the workspace and Records Industry filter show only Aerospace ([35](screenshots/35-records-status-board.png)); assumption A-04 single workspace.
| Option | Trade-offs |
|---|---|
| **(a) Aerospace only; keep the Industry filter with the single value (recommended)** | Matches what is live; no new standards content |
| (b) Aerospace only and hide the Industry filter | Simpler UI; differs from the observed page |
| (c) Add oil & gas / medical | Content and clause sets not observed; large scope, **GUESS** |

**Recommendation:** (a). Confidence: Observed.

### OQ-23 — How is a SCAR created? — DECIDED (a)
**Evidence:** NCMR-2026-0087 proposes "scrap + SCAR" and "Issue SCAR (AS9100D §8.7.2) with 30-day corrective action" ([34](screenshots/34-records-ncmr-2026-0087-detail.png)); no SCAR create entry point was observed; SCAR is a quality-record type with `SCAR-` IDs (BR-12, §6); the data model has `sourceRecordId` (overview §5, OQ-23).
| Option | Trade-offs |
|---|---|
| **(a) "Issue SCAR" action on an NCMR (and CAPA), creating a SCAR with `sourceRecordId` and the supplier linked (DP-10) (recommended)** | Matches the observed sample flow and the existing data field; new button, placement is **GUESS** |
| (b) A standalone "Start a new SCAR" form like NCMR/CAPA | Simple and consistent with §4.6; loses the NCMR link unless entered by hand |
| (c) No SCAR creation; SCARs are sample-only | Least work; Supply Chain SCAR counts (DP-10) stay at zero for real data |

**Recommendation:** (a). Confidence: Inferred (from the sample action text and `sourceRecordId`).
