# Screenshots — Sentinel QA (https://sentinel-qa.lovable.app/)
Captured 2026-10-12. 01–30: first pass (1440 px, full page). 31–58: second pass of the non-AI workspace flows (1280×800 viewport captures; AI generate actions deliberately not run). Duplicate/near-duplicate captures from the second pass were removed (5 files) and the rest renumbered. Used as evidence for [../BRD.md](../BRD.md).

| File | Route | Shows |
|---|---|---|
| 01-home.png | / | Marketing home: hero, stats, sample NC-2026-0087, standards, capabilities, audit-failure clauses, footer |
| 02-compare.png | /compare | Competitor matrix (Greenlight Guru, MasterControl, Qualityze, OpenRegulatory, QT9, Mitti) |
| 03-pricing.png | /pricing | Single Pilot card (60–90 days), "Email us about a pilot" |
| 04-try-your-document.png | /try-your-document | Doc-type selector, paste box, controlled-data checkbox, Check clauses / Try a sample |
| 05-demo-agent.png | /demo | Live agent: prompt cards, session history (0), ITAR/EAR warning |
| 06-validation.png | /validation | AI validation summary (5 sections) |
| 07-auth-signin.png | /auth | Sign-in page (out of scope) |
| 08-workspace-dashboard.png | /app/aerospace | Dashboard: "8 items need attention", tiles, needs-attention list, module cards |
| 09-records.png | /dashboard-preview?module=records | Illustrative sample records, filters, awaiting review, trends, Pareto |
| 10-ncmr.png | /app/aerospace/ncmr | NCMR empty state, Start a new NCMR |
| 11-capa.png | /app/aerospace/capa | Corrective Actions paste box and empty state |
| 12-supply-chain.png | /supply-chain | Supplier risk scorecard, roadmap, AeroForge detail |
| 13-supplier-qualification.png | /app/aerospace/supplier-qualification | ASL list (SQ-2025-014 … SQ-2026-006) |
| 14-purchase-controls.png | /purchase-controls | PO clause check, sample PO-2026-4471 findings |
| 15-fai.png | /app/aerospace/fai | FAI paste box and empty state |
| 16-calibration.png | /app/aerospace/calibration | Calibration KPIs and register (CAL-2026-001…005) |
| 17-training.png | /training | Role-to-training matrix, KPIs, assignments |
| 18-document-control.png | /app/aerospace/documents | Document Control empty register |
| 19-approval-roles.png | /app/aerospace/approval-roles | Roles, quick-add, default approvers |
| 20-qms-champion.png | /qms-champion | 8-dimension maturity self-assessment |
| 21-reliability.png | /reliability | Agent reliability KPIs, alert rules, task log |
| 22-privacy.png | /privacy | Privacy policy |
| 23-terms.png | /terms | Terms |
| 24-security.png | /security | Security page |
| 25-new-ncmr-form.png | /app/aerospace/capa/new?type=NCMR | New NCMR step 1 (disposition, fields, disabled create) |
| 26-new-capa-form.png | /app/aerospace/capa/new | New CAPA step 1 |
| 27-new-calibration-instrument-form.png | /app/aerospace/calibration (Register) | Register an instrument form |
| 28-new-supplier-qualification-wizard.png | /app/aerospace/supplier-qualification (New) | 6-step wizard, step 1 Request |
| 29-new-fai-form1.png | /app/aerospace/fai (New) | AS9102 Form 1 — Part identification |
| 30-new-document-form.png | /app/aerospace/documents (Add) | Add a document form |
| 31-home-roi-calculator-default.png | / (#roi) | "Reliability before speed" cards; ROI calculator with presets, defaults 20 records/month × 90 min → 29.5 h/month, 354 h/yr, 44.3 days/yr |
| 32-home-how-it-works.png | / (#how-it-works) | Clause 7.1.5.2 (Live today) / 8.4 (Next) cards; 3-step loop: Describe the event → Agent drafts the record → Your quality leader makes the call |
| 33-home-faq-expanded.png | / (#faq) | Weekly digest mock (roadmap); FAQ answers: replace QM?, standards trained on, data used for training |
| 34-records-ncmr-2026-0087-detail.png | /dashboard-preview?module=records | NCMR-2026-0087 detail drawer: summary, AI-hypothesis root causes, actions, citations, Continue drafting in the agent |
| 35-records-status-board.png | /dashboard-preview?module=records | Records header, stage counts, Awaiting your review, Status board (6 columns × 1 card) |
| 36-cmdk-command-palette.png | /dashboard-preview?module=records (⌘K) | Command palette: search box, Modules list |
| 37-workspace-demo-utilities-menu.png | /app/aerospace | Demo utilities menu open: Send feedback, Reset demo |
| 38-sq-wizard-step2-docs-certs.png | /app/aerospace/supplier-qualification/new?id=SQ-2026-006 | SQ wizard step 2 of 6 "Documentation & cert review", audit trail |
| 39-sq-wizard-step5-approval-gated.png | …/supplier-qualification/new?id=SQ-2026-006 | Step 5 Approval decision: named approver required, Approve & add to ASL disabled, audit trail entries |
| 40-fai-form1-validation-errors.png | /app/aerospace/fai/new | Form 1 submitted empty: field errors + toast "Please fill in: Part Number, Part Name." |
| 41-fai-record-created-form3.png | /app/aerospace/fai/<uuid> | Created FAI TEST-PN-001 (FAIR-2026-1576064A, Draft), preparer/evaluator sign-off, Form 3 grid |
| 42-calibration-new-instrument-plus24mo.png | /app/aerospace/calibration/new | Register form filled; +24 months sets next due 01/15/2028 from 01/15/2026 |
| 43-calibration-register-after-save.png | /app/aerospace/calibration?view=all | Register with new CAL-DEMO-MV5YVOKD TEST caliper (Active, due 2028-01-15) |
| 44-document-new-released-approver-required.png | /app/aerospace/documents/new | Status Released without approver: "Name an approver to release." / "Pick who approved this release before saving." |
| 45-document-new-released-approver-entered.png | /app/aerospace/documents/new | Custom approver name entered; Save enabled |
| 46-document-saved-edit-view.png | /app/aerospace/documents/new?id=DOC-DEMO-MV5YVSZE | Saved document reopened as "Edit a controlled document" |
| 47-validation-how-outputs-governed.png | /validation | "How Sentinel QA's own outputs are governed" (sections 1–4 visible) |
| 48-supply-chain-aerofast-detail.png | /supply-chain | AeroFast Distribution detail (At risk · 48) |
| 49-supply-chain-aerowire-detail.png | /supply-chain | AeroWire Cables detail (Approved · 84) |
| 50-training-matrix-baseline-rivera-row.png | /training | Matrix baseline incl. D. Rivera Level II PT row (Current, 90d) |
| 51-training-mark-complete-alvarez.png | /training | After Mark complete on M. Alvarez: "Completed 2026-10-13", Current, Undo; all 6 rows |
| 52-training-mark-complete-brandt.png | /training | After Mark complete on L. Brandt (Alvarez reverted to Due soon) |
| 53-qms-champion-ratings-all-3.png | /qms-champion | 8/8 answered, all dimensions rated 3, "Saved for this session" |
| 54-qms-champion-summary-all-3.png | /qms-champion | Summary for all-3 ratings: Overall 3.0/5 Defined, top 3 gaps, heatmap, 90-day priority |
| 55-qms-champion-ratings-mixed.png | /qms-champion | Mixed ratings 3/2/4/3/2/3/4/3 |
| 56-qms-champion-summary-mixed.png | /qms-champion | Summary for mixed ratings (gaps: Risk 2, Supplier 2, Leadership 3) |
| 57-qms-champion-summary-leadership-1.png | /qms-champion | Summary for Leadership 1, CAPA 5, others 3 |
| 58-reliability-export-csv.png | /reliability | Reliability page at time of Export CSV (240 of 240 tasks) |
| 58-reliability-task-log-export.csv | /reliability → Export CSV | Exported task log: 240 rows, 11 columns (id, ts, module, task, status, latency_ms, confidence, decision, reviewer, tokens, error_code) |
