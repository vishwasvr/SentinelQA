# BA Responses to Review Findings (BRD v1.3, statuses updated v1.4 / v1.4.1 / v1.4.2 / v1.4.3 / v1.5)

| Item | Value |
|---|---|
| Author | Business Analyst |
| Date | 2026-10-13 |
| BRD | [BRD.md](../requirements/BRD.md) v1.4.1, §13 (clarifications), §13.3 (decisions pending DP-xx) |
| Sources | developer-review.md (be0a8d5; IDs DEV-n = finding #n), qa-review.md (QA-n), ba-review.md (BA-n), infra-review.md (m-n), architect-review.md (F-n) |

Note: developer-review states "BA 11"; the BA-owned items are DEV-04, 05 (Architect with BA for semantics), 10, 11, 12, 13 (BA rules), 14, 15, 21, 22 = 10. No eleventh BA item was found.

| Finding | Status | Reason / BRD change |
|---|---|---|
| DEV-04 | Resolved (v1.5, BRD §13.7) | PO-check manual-entry fields specified from the observed structure only (§13.2). CAPA/NCMR steps 2–6 and SQ steps 3/4/6 marked blocked (§13.2a, DP-02); field types/lengths DP-04 |
| DEV-05 | Resolved | Soft delete for Remove role/person, Training Undo, Form 3 row removal (§13.1), per Architect's every-environment delete deny |
| DEV-10 | Resolved (v1.5, BRD §13.7) | BR-12 build criterion and US-13/17/26 ACs no longer assert `DEMO`; format itself is DP-01 |
| DEV-11 | Partly resolved (v1.5: DP-05/06 decided; /compare content and fixture publication still open) | Build criteria separated from seed checks (US-04/08/28/31, §13.4). /compare content, fixtures → DP-05 (Simulate second reviewer removed v1.4.3, see DEV-11 (DP-05 part) row); QMS bands → DP-06 |
| DEV-12 | Resolved (v1.5, BRD §13.7) | Supplier master create/edit and input sources are new product behavior → DP-10 |
| DEV-13 | Resolved (v1.5, BRD §13.7) | 400/422 behavior added as ACs on US-02 (from BR-44). Matching rule decided v1.4 (whole-word, case-insensitive). *v1.4.1:* CFR markers are ranges (see DEV-27 / BR-44); sign-off pending DP-03. Normalisation, field scope, attestation on non-text writes, message → DP-03. SSM caching is Architect's (QA-31) |
| DEV-14 | Resolved (v1.5, BRD §13.7) | Corrections = new events and Undo semantics stated (§13.1, BR-40). Document key edits/supersede edge cases → DP-11 |
| DEV-15 | Resolved (v1.5, BRD §13.7) | SoD semantics, hard vs warning, name comparison → DP-08 |
| DEV-21 | Resolved (v1.5, BRD §13.7) | Timezone, boundaries, end-of-month rule are new rules → DP-12 |
| DEV-22 | Resolved (v1.5, BRD §13.7) | Recurrence and Not-started rule not observable → DP-07 |
| DEV-27 | Resolved (v1.5, BRD §13.7) | *v1.4.1:* BA interpretation of Vishwas's 2026-10-13 decision recorded in BR-44: CFR markers are ranges — any citation whose part number is within 22 CFR parts 120–130 or 15 CFR parts 730–774 is a hit, including subsections and Part/§ forms (e.g. `22 CFR 121.1`, `22 CFR Part 126`, `15 CFR § 774.1`); case-insensitive. Implementation may store ranges as structured data (`title`, `partFrom`, `partTo`). Sign-off pending under DP-03. Pattern-format / SSM JSON storage remains Architect's |
| BA-08 | Resolved (v1.5, BRD §13.7) | Transition rules → DP-02 |
| BA-16 | Resolved (v1.5, BRD §13.7) | Tile data sources (no effectiveness-check entity observed) → DP-17 |
| QA-01 | Resolved (v1.4) | PLACEHOLDER defaults in config (BR-47); tuned values remain DP-16 (partial) |
| QA-03 | Resolved (v1.4); range semantics Partly (v1.4.1) | Whole-word, case-insensitive; markers incl. ITAR, EAR, CUI, 22 CFR 120-130, 15 CFR 730-774 (BR-44). *v1.4.1:* CFR markers are ranges (any part in 120–130 / 730–774, incl. subsections and Part/§ forms; case-insensitive; BA interpretation, sign-off pending DP-03) |
| QA-04 | Resolved (v1.5, BRD §13.7) | 400/422 Given/When/Then added to US-02; message and input retention → DP-03 |
| QA-06 | Resolved | US-08 restated as a formula (BR-42); "8" moved to a seed check |
| QA-07 | Resolved (v1.5, BRD §13.7) | DP-08 |
| QA-08 | Resolved (v1.5, BRD §13.7) | DP-06 |
| QA-09 | Resolved (v1.5, BRD §13.7) | DP-14 |
| QA-10 | Resolved (v1.5, BRD §13.7) | DP-13 |
| QA-11 | Resolved (v1.5, BRD §13.7) | Not inferable from the two observed rows (different severities) → DP-13 |
| QA-12 | Resolved (v1.4) | Client-side ⌘K over loaded lists, no server endpoint (US-41); DP-15 resolved |
| QA-13 | Resolved (v1.5, BRD §13.7) | DP-11 |
| QA-14 | Resolved (v1.5, BRD §13.7) | DP-02 |
| QA-15 | Resolved (v1.5, BRD §13.7) | DP-01 |
| QA-16 | Resolved (v1.5, BRD §13.7) | DP-04 |
| QA-18 | Resolved | §1.1 persistence wording fixed; BR-31/32 moved before BR-33 |
| QA-20 | Resolved (v1.5, BRD §13.7) | Matching rule decided v1.4 (whole-word, case-insensitive, BR-44); *v1.4.1:* CFR range hit semantics in BR-44 (sign-off pending DP-03); normalisation/evasion cases → DP-03 |
| QA-23 | Resolved (v1.5, BRD §13.7) | DP-12 |
| QA-24 | Resolved (v1.5, BRD §13.7) | Undo is audited and status re-derived from the due date (BR-40, observed in screenshot 52). SQ date validation → DP-19 |
| QA-25 | Resolved (v1.5, BRD §13.7) | BR-34 conflict resolved: add-row precondition vs advisory banner. SoD name variants → DP-08; edit/un-sign after sign-off → DP-09 |
| QA-27 | Resolved (v1.4.3) | DP-18 decided by Vishwas: /demo and /try-your-document stay static pages (US-05, US-07) |
| m-9 (infra) | Resolved | Resets are an operator action via InfraDeploy's script, dev/stage only, not an app feature (§13.1) |
| F-09 (architect) | Resolved (v1.2.3) | BR-08 aligned with BR-46/C-1 in v1.2.3 |
| BA-10 | Resolved (v1.4) | US-41 in scope: client-side search over loaded lists |
| BA-15 | Partly resolved (v1.4) | Seed/sample policy: labeled sample data allowed in all envs (BR-31/45); ID format → DP-01 |
| DEV-29 (BA part) | Resolved (v1.5, BRD §13.7) | CAPA/NCMR overdue rule not observed in screenshots 08/09/10/11/25/26/34/35; raised as OQ-25 / DP-20. Index side fixed by Architect (GSI2 `dueAt` = `dueDate`) |
| DEV-11 (DP-05 part) | Resolved (v1.4.3) | Vishwas: "Simulate second reviewer" removed from the build; BR-33, §4.10, US-35, OQ-03 marked removed per DP-05. /compare content and fixture publication not covered |

Rejected: none.
