# Business Requirements Document — Sentinel QA

| Item | Value |
|---|---|
| Product | Sentinel QA — "AI Quality Manager" for AS9100D aerospace suppliers |
| Source | https://sentinel-qa.lovable.app/ (public, unauthenticated exploration) |
| Version / date | 1.0 — 2026-10-12 |
| Basis | Observed behavior only (as-built BRD). No features are invented; roadmap items are marked **[ROADMAP – not live]**. |
| Evidence | [screenshots/](screenshots/README.md) |

---

## 1. Product overview

Sentinel QA helps small and mid-size AS9100D aerospace suppliers run their quality management system. An AI agent drafts quality records: CAPA, NCMR, SCAR, FAI (AS9102), supplier risk narratives, and PO clause checks. A human quality leader stays the **reviewer of record** and makes the final decision. Hero message: *"The AI Quality Manager built for AS9100 aerospace suppliers."* Standards it names: AS9100D, AS9102, AS9145 (the validation page also lists AS13100 and NADCAP).

Positioning, from the home page and /compare: clause-level citations, flagging of AI hypotheses, an agent-first approach, cross-module traceability and human-in-the-loop review. Commercial model: a single 60–90-day Pilot ("Email us about a pilot").

### 1.1 Scope
**In scope (this BRD):** the marketing site (/, /compare, /pricing, /validation, /privacy, /terms, /security), the public tools (/demo, /try-your-document) and the demo workspace (/app/aerospace and its modules). That covers the dashboard, Records, NCMR, Corrective Actions, Supply Chain, Supplier Qualification, Purchase Controls, FAI, Calibration, Training, Document Control, Approval Roles, QMS Champion, Ask the agent and Agent reliability, plus the cross-cutting governance rules.

**Out of scope:** authentication (/auth: Continue with Google, Sign in, Create an account), user accounts and multi-tenancy, billing, and server-side persistence for signed-in users. Also out of scope is any AI output content: it was deliberately not triggered (see §10).

## 2. Personas
| ID | Persona | Goals | Observed touchpoints |
|---|---|---|---|
| P1 | Quality Manager / quality leader (reviewer of record) | Approve AI drafts, keep audit-ready records, close CAPA/NCMR | Dashboard, Records "Awaiting your review", CAPA/NCMR, Approval Roles, QMS Champion |
| P2 | Quality engineer / inspector | Log nonconformances, run FAI, maintain calibration | NCMR, FAI, Calibration |
| P3 | Supplier quality / buyer | Qualify suppliers, monitor risk, check PO flow-downs | Supply Chain, Supplier Qualification, Purchase Controls (persona "R. Chen Buyer" in Training) |
| P4 | Engineering Lead / Production Supervisor (independent approvers) | Approve FAI / PO / dispositions under segregation of duties | Approval Roles defaults |
| P5 | Training / document coordinator | Keep role competency and controlled documents current | Training, Document Control |
| P6 | Prospect / evaluator (owner or QM at a supplier) | Judge fit before a pilot | Home, Compare, Pricing, Validation, /demo, /try-your-document |
| P7 | Platform/ops owner of the AI agent | Monitor agent quality and alerts | Agent reliability |

## 3. Main user journeys
1. **Evaluate:** Home → Compare / Validation → Try your document or Try the agent → Pricing → "Email us about a pilot".
2. **Daily triage:** /app → dashboard "N items need attention" → open an overdue item (calibration, training, supplier re-evaluation) in its module.
3. **Raise an NCMR:** NCMR → Start a new NCMR → enter name → short title, describe event → tick controlled-data checkbox → Create record & continue → (steps 2–6 through Containment, Investigation, Draft Ready, QM Review, Closed) → choose disposition → independent approver for Use as is / Repair.
4. **Draft a CAPA:** Corrective Actions → paste text + confirm → Start my CAPA (or Start a new CAPA form) → 6 steps → QM Review → Closed.
5. **Qualify a supplier:** Supplier Qualification → New → Request → Docs & certs → Risk → Evaluation → Approval → Active on ASL; re-evaluation date tracked.
6. **Check a PO:** Purchase Controls → paste PO + confirm → Check clauses → review Missing/Weak/Present findings with suggested wording.
7. **FAI:** FAI → paste and Build my FAI record, or New → AS9102 Form 1 → Create FAI.
8. **Calibration upkeep:** Calibration → Register an instrument → set last date → +6/+12/+24 months → Save; status is derived from the due date.
9. **Training / documents / roles:** maintain the matrix (Mark complete), the document register, and approver roles.
10. **Maturity check:** QMS Champion → rate 8 dimensions → score, heatmap, 90-day plan.
11. **Agent oversight:** Agent reliability → KPIs, alert rules, task log, Export CSV.

## 4. Feature list by module

### 4.1 Cross-cutting / workspace chrome
- Sidebar groups: **Today** (Records, badge 6); **Nonconformance** (NCMR, Corrective Actions); **Supplier** (Supply Chain badge 6, Supplier Qualification, Purchase Controls badge 5); **Inspection** (First Article Inspection, Calibration); **Compliance** (Training badge 3, Document Control, Approval Roles, QMS Champion "Assess"); **Assistant** (Ask the agent, Agent reliability); a "How outputs are governed" link.
- Header: DEMO badge, Search with ⌘K palette, Marketing site link. Page subtitle "Aerospace · AS9100D".
- A floating "Ask about <module>" assistant on each module. First-party analytics notice with an OK button. A "Demo utilities" button.
- Governance: clause citations with "Why this citation:", hypothesis prefixing, a controlled-data gate, an audit timeline, and segregation of duties (see §7).

### 4.2 Marketing site
- **Home (/)** ([01](screenshots/01-home.png)): nav Capabilities, How it works, ROI, Compare, Pricing, Try your document, FAQ, Sign in, Open workspace (/app), Try the agent (/demo). Stats: AI hypotheses "Flagged", CAPA draft "~90s", reviewer of record "You". Sample card NC-2026-0087 (Ti bracket, AeroForge, 3 of 40 OOT, Major, Clause 8.7). Capabilities: CAPA drafting §10.2, NC triage §8.7, Risk & supplier assist §8.1.1, Standards update impact §4.4/§7.2. A "Where AS9100 shops fail audits most" section by clause. Footer: Privacy, Terms, Security, AI validation summary. Disclaimer: "draft assistance, not regulatory judgment."
- **Compare** ([02](screenshots/02-compare.png)): rows are clause-level citation, AS9100D depth, AI-hypothesis flagging, agent-first, cross-module traceability, human-in-loop, trial access, deployment, industry focus. Values are Yes / Partial / No / Not verified.
- **Pricing** ([03](screenshots/03-pricing.png)): a single Pilot card, "60–90 days, contact us".
- **Validation** ([06](screenshots/06-validation.png)): uncertainty hedging; clause-citation discipline; standards coverage (AS9102, AS9145, AS13100, NADCAP); output audit trail; known limitations.
- **Privacy / Terms / Security** ([22](screenshots/22-privacy.png), [23](screenshots/23-terms.png), [24](screenshots/24-security.png)): static content.

### 4.3 Public AI tools
- **/demo – live agent** ([05](screenshots/05-demo-agent.png)): Back to site, Session history (0). Prompt cards: Triage an aerospace NC, Draft an AS9100D CAPA, AS9100D update impact, Score an aerospace supplier. A chat log with an ITAR/EAR warning.
- **/try-your-document** ([04](screenshots/04-try-your-document.png)): document types Purchase order/quality agreement, First article inspection, Corrective action/nonconformance. Textarea, controlled-data checkbox, Check clauses (disabled until the box is ticked and text is entered), Try a sample. Output by type: PO clause review, an editable AS9102 record, or CAPA step 1.

### 4.4 Workspace dashboard (/app → /app/aerospace) ([08](screenshots/08-workspace-dashboard.png))
- Headline "8 items need attention".
- Tiles: Awaiting review (CAPA/NCMR) 0; FAI sign-off pending 0; Supplier re-evaluation 2 (0 overdue, 1 in 0–30d, 1 in 31–60d, 0 in 61–90d); Calibration 5 instruments (2 active, 2 due soon, 1 overdue); Effectiveness checks due 0; Training 3 (2 expired, 1 due soon).
- Needs attention list (8 items, tagged Overdue / Due soon), e.g. J. Park counterfeit part awareness expired 14d; CAL-2026-001 Mitutoyo caliper overdue 12d; Alloy Precision Machining re-evaluation in 18d.
- "Threatens delivery (14 days)", currently empty: "No open CAPA or NCMR has a need-by date in the next 14 days."
- "Your records" (empty, with an Open Records link). Module cards: Records, Supply Chain, Ask the agent.

### 4.5 Records (/dashboard-preview?module=records) ([09](screenshots/09-records.png))
- Banner "ILLUSTRATIVE — SAMPLE RECORDS". Tabs: CAPA/NCMR/SCAR, FAI, Supplier Qualification, Calibration, Document Control.
- Stage counts (Open/Investigation/QM Review/Closed): CAPA 1/1/0/0; NCMR 0/1/1/0; SCAR 1/0/0/1.
- Filters: Type (All/CAPA/NCMR/SCAR); Industry (Aerospace); Severity (All/Critical/Major/Minor); Status (All/New/Containment/Investigation/Draft Ready/QM Review/Closed); Standard (All/AS9100D). 6 records.
- "Awaiting your review", sorted by severity then age: Critical NCMR-2026-0087 Ti bracket hole Ø §8.7, 9d left; Major SCAR-2026-0044 FAI flatness fail §8.4, 12d left.
- A status board with show/hide.
- Trends: opened vs closed over 12 weeks, severity mix 2/2/2, by standard, and a Pareto by clause ("80% of findings come from §8.4, §8.1.4, §8.5.1, §8.5.4").

### 4.6 NCMR and Corrective Actions (CAPA)
- NCMR list ([10](screenshots/10-ncmr.png)): empty state "No NCMR records yet"; Start a new NCMR → /app/aerospace/capa/new?type=NCMR.
- CAPA list ([11](screenshots/11-capa.png)): a paste box (Start my CAPA, Try a sample); empty state "No corrective actions yet"; Start a new CAPA.
- Create form ([25](screenshots/25-new-ncmr-form.png), [26](screenshots/26-new-capa-form.png)):
  - "Your name" (placeholder e.g. Dana Ruiz) + Save; the name is recorded on each step.
  - "Step 1 of 6". Auto ID NCMR-DEMO-xxxx / CAPA-DEMO-xxxx. Print link (/capa/<id>/print). Back to workspace.
  - Stage track: New → Containment → Investigation → Draft Ready → QM Review → Closed. NCMR-only disposition selector.
  - Two sample-scenario buttons. Short title; Describe the event; controlled-data checkbox; "Delivery details (optional)".
  - "Create record & continue →" stays disabled until the box is ticked. The timeline starts with "Created · Reviewer · stage: new" and a timestamp.

### 4.7 Supply Chain (/supply-chain) ([12](screenshots/12-supply-chain.png))
- **Live:** supplier risk scorecard, ranked worst-first. The score blends SCARs, on-time %, criticality and cert freshness. Standard filter: All, AMS 2750, AS6174, AS9100D, AS9102, NADCAP, NAS 410.
- Rows: 48 AeroFast Distribution (Fasteners, Critical, 82%, 0 SCARs); 62 AeroForge (Ti machining, Critical, 88%, 2); 74 Precision Heat Ltd (NADCAP heat treat, Critical, 96%, 0); 84 AeroWire (Cables/wire harness, Standard, 97%, 0).
- Detail (AeroForge "Watch · 62"): cert renews in 42d; AI risk narrative; flags an open SCAR on TB-4471 and an FAI flatness fail 18d ago; next step "escalate to ASL review".
- **[ROADMAP – not live]** Incoming inspection triage; sub-tier flow-down monitor; cert expiry watch (90/60/30-day alerts); geopolitical risk map.

### 4.8 Supplier Qualification ([13](screenshots/13-supplier-qualification.png), [28](screenshots/28-new-supplier-qualification-wizard.png))
- Tabs: Active on ASL / All qualifications. Columns: Record, Supplier, Stage, Approved scope, Re-evaluation, Created.
- Data:
  - SQ-2025-014 Alloy Precision Machining Ltd: Approved / Active on ASL, "Machined titanium detail parts, AS9100D §8.4", re-evaluation 2026-10-30 (18d).
  - SQ-2025-021 Northline Heat Treat: Approved, "Vacuum heat treatment", 2026-12-03 (53d).
  - SQ-2025-027 Cascade Surface Finishing: Approved, "Chem-film per MIL-DTL-5541 Type I", 2027-07-09.
  - SQ-2026-003 Helix Fastener Supply: Evaluation.
  - SQ-2026-006 Veridian Composites: Documentation & cert review.
- New wizard, 6 steps: Request, Docs & certs, Risk, Evaluation, Approval, Active on ASL. Fields: Supplier name (e.g. AeroForge Precision Ltd), Scope requested. Back / Continue (Continue disabled: "Enter the supplier name to continue."). Audit trail.

### 4.9 Purchase Controls (/purchase-controls) ([14](screenshots/14-purchase-controls.png))
- **Live:** PO clause check against AS9100D §8.4.3. A paste box with Check clauses / Try a sample.
- Sample PO-2026-4471: AeroForge, TB-4471, 500 ea, "Rev C (not stated on PO)". Summary: 5 missing, 1 weak, 1 present.
- Findings filter: Status (Missing/Weak/Present); Clause (AS9100D §8.4.3 / AS9102).
  - Missing: design revision level, sub-tier flow-down, right of access, FAI.
  - Present: Certificate of Conformity.
  - Digital Product Definition status: not captured.
- Each finding has suggested wording and a "Why this citation" note.
- **[ROADMAP – not live]** ASL gate (block PO if the supplier is not on the ASL); supplier change notice triage; receiving document match; counterfeit-part screen.

### 4.10 First Article Inspection ([15](screenshots/15-fai.png), [29](screenshots/29-new-fai-form1.png))
- A paste box "Build my FAI record" (disabled until confirmed). Empty state "No FAI records yet. Start with a new Form 1".
- AS9102 Form 1 — Part identification: Part Number*, Part Name*, Part Revision (optional), FAI Report Number ("Generated automatically if blank"), Part Type, FAI Type, Reason for FAI (default initial FAI), Manufacturing Routing Number, Create FAI.

### 4.11 Calibration ([16](screenshots/16-calibration.png), [27](screenshots/27-new-calibration-instrument-form.png))
- Tabs: All / Due soon / Overdue. KPIs: active 4; due ≤30d 1; ≤60d 1; ≤90d 2; overdue 1. Columns: Record, Instrument, Type, Status, Certificate, Next due.
- Register an instrument (fields in §6). Next-due shortcuts +6/+12/+24 months. Save to the register.

### 4.12 Training (/training) ([17](screenshots/17-training.png))
- **Live:** role-to-training matrix (§7.2). KPIs: current 2, due soon 1, overdue 2, not started 1. Standard filter. Columns: Role·Person, Course, Standard, Due, Status, Action (Mark complete).
- Assignments can be sourced from CAPA, NCMR or PO-check findings (see the sample rows).
- **[ROADMAP – not live]** CAPA-driven assignment (automation); procedure-change re-training; competency evaluation; audit-ready report.

### 4.13 Document Control ([18](screenshots/18-document-control.png), [30](screenshots/30-new-document-form.png))
- Tabs: All / Under review / Released. KPIs: Released, Under review, Draft, Superseded (all 0). Empty register. Add a document form (fields in §6).

### 4.14 Approval Roles ([19](screenshots/19-approval-roles.png))
- "A convenience only, not a login or permission system."
- Quick-add buttons: + Quality Manager, + Engineering Lead, + Production Supervisor. Add a role (Role name), Remove role, Add a person.
- Default approver per record type (see BR-20).

### 4.15 QMS Champion (/qms-champion) ([20](screenshots/20-qms-champion.png))
- **Live:** maturity self-assessment, 8 dimensions rated 1–5 ("0/8 answered", ~3 min). Dimensions: Leadership §5; Risk §6.1/§8.1.1; CAPA effectiveness §10.2; Nonconformity §8.7; Supplier §8.4; Training §7.2; Documents §7.5; Monitoring §9/§10.
- Outputs: score, gap heatmap, 90-day plan.
- **[ROADMAP – not live]** Mock audit; management review pack; internal audit planner; readiness score; KPI tracker.

### 4.16 Ask the agent
- Workspace entry point to the agent (same capability as /demo), plus a per-module floating "Ask about <module>".

### 4.17 Agent reliability (/reliability) ([21](screenshots/21-reliability.png))
- "Live · last 24h", Export CSV.
- KPIs: 240 tasks; 88.3% success; 3.3% failures; 2.1% timeouts; 3.0s average latency; 61% human acceptance (27 rejected).
- Alert banner: 1 firing (timeout).
- Alert rules table (see BR-30).
- Task log: filters for status (Success/Failure/Timeout/Escalated) and module. Columns: When, Task, Module, Status, Latency, Conf., Decision, Reviewer. Example: "Detect expired certifications", Training, Escalated, 0.48 conf (below threshold, routed to human), Modified by M. Okafor.

## 5. Screen inventory
| # | Screen | Route | Screenshot |
|---|---|---|---|
| S01 | Home | / | [01-home](screenshots/01-home.png) |
| S02 | Compare | /compare | [02-compare](screenshots/02-compare.png) |
| S03 | Pricing | /pricing | [03-pricing](screenshots/03-pricing.png) |
| S04 | Try your document | /try-your-document | [04](screenshots/04-try-your-document.png) |
| S05 | Live agent demo | /demo | [05](screenshots/05-demo-agent.png) |
| S06 | AI validation summary | /validation | [06](screenshots/06-validation.png) |
| S07 | Sign in (out of scope) | /auth | [07](screenshots/07-auth-signin.png) |
| S08 | Workspace dashboard | /app/aerospace | [08](screenshots/08-workspace-dashboard.png) |
| S09 | Records | /dashboard-preview?module=records | [09](screenshots/09-records.png) |
| S10 | NCMR list | /app/aerospace/ncmr | [10](screenshots/10-ncmr.png) |
| S11 | Corrective Actions | /app/aerospace/capa | [11](screenshots/11-capa.png) |
| S12 | Supply Chain | /supply-chain | [12](screenshots/12-supply-chain.png) |
| S13 | Supplier Qualification | /app/aerospace/supplier-qualification | [13](screenshots/13-supplier-qualification.png) |
| S14 | Purchase Controls | /purchase-controls | [14](screenshots/14-purchase-controls.png) |
| S15 | FAI list | /app/aerospace/fai | [15](screenshots/15-fai.png) |
| S16 | Calibration | /app/aerospace/calibration | [16](screenshots/16-calibration.png) |
| S17 | Training | /training | [17](screenshots/17-training.png) |
| S18 | Document Control | /app/aerospace/documents | [18](screenshots/18-document-control.png) |
| S19 | Approval Roles | /app/aerospace/approval-roles | [19](screenshots/19-approval-roles.png) |
| S20 | QMS Champion | /qms-champion | [20](screenshots/20-qms-champion.png) |
| S21 | Agent reliability | /reliability | [21](screenshots/21-reliability.png) |
| S22–24 | Privacy / Terms / Security | /privacy, /terms, /security | [22](screenshots/22-privacy.png), [23](screenshots/23-terms.png), [24](screenshots/24-security.png) |
| S25 | New NCMR (step 1) | /app/aerospace/capa/new?type=NCMR | [25](screenshots/25-new-ncmr-form.png) |
| S26 | New CAPA (step 1) | /app/aerospace/capa/new | [26](screenshots/26-new-capa-form.png) |
| S27 | Register instrument | Calibration → Register | [27](screenshots/27-new-calibration-instrument-form.png) |
| S28 | New supplier qualification | Supplier Qualification → New | [28](screenshots/28-new-supplier-qualification-wizard.png) |
| S29 | AS9102 Form 1 | FAI → New | [29](screenshots/29-new-fai-form1.png) |
| S30 | Add a document | Document Control → Add | [30](screenshots/30-new-document-form.png) |
| — | Not captured | CAPA print view, record detail pages, ⌘K palette, Demo utilities, Ask the agent workspace page | — |

## 6. Data entities and key fields
| Entity | Key fields (observed) | Enumerations |
|---|---|---|
| Quality record (CAPA / NCMR / SCAR) | ID (CAPA-DEMO-xxxx, NCMR-DEMO-xxxx; samples like NCMR-2026-0087, SCAR-2026-0044), type, short title, event description, severity, stage, standard/clause, days left (due), reviewer name, delivery details (optional; need-by date implied by the "Threatens delivery" panel), disposition (NCMR only), timeline | Type: CAPA, NCMR, SCAR. Severity: Critical, Major, Minor. Stage: New, Containment, Investigation, Draft Ready, QM Review, Closed. Disposition: Use as is, Rework, Repair, Scrap, Return to supplier |
| Audit timeline event | Timestamp, actor/reviewer, event (created, stage change, AI draft acceptance, reviewer decision), stage; signed-in: activity_log row with actor + snapshot | — |
| Supplier (risk scorecard) | Score (0–100), name, commodity, criticality, on-time %, open SCAR count, cert renewal (days), standards, AI narrative, flags, next step | Criticality: Critical, Standard. Band e.g. "Watch". Standard: AMS 2750, AS6174, AS9100D, AS9102, NADCAP, NAS 410 |
| Supplier qualification | Record (SQ-YYYY-NNN), supplier name, scope requested / approved scope, stage, re-evaluation date (+ days), created | Stage: Request, Docs & certs (shown as "Documentation & cert review"), Risk, Evaluation, Approval, Active on ASL (plus status "Approved") |
| PO clause check | PO number, supplier, part, qty, revision, findings[] (requirement, status, clause, suggested wording, why-citation), summary counts | Status: Missing, Weak, Present (plus "not captured"). Clause: AS9100D §8.4.3, AS9102 |
| FAI (AS9102 Form 1) | Part Number*, Part Name*, Part Revision, FAI Report Number (auto if blank), Part Type, FAI Type, Reason for FAI, Manufacturing Routing Number | Part Type: Detail, Sub-Assembly, Assembly, COTS, Software. FAI Type: Full, Partial, Delta |
| Calibration instrument | Record (CAL-YYYY-NNN), equipment name, equipment ID/asset no., type, certificate reference*, last calibration date, next due date, calibrated by, NIST traceability statement*, status (computed) | Type: Caliper, Micrometer, Gauge, Height gauge, CMM, Torque wrench, Surface plate, Test equipment, Other. Status: Active, Due soon, Overdue |
| Training assignment | Role, person, course, source record (CAPA/NCMR/PO finding), standard/clause or SOP, due offset, status | Status: Current, Due soon, Overdue (expired), Not started |
| Controlled document | Name, document ID/number, revision, type, location (link/description), effective date, next review date, status | Type: Work Instruction, Procedure, Drawing, Quality Manual section, Form, Specification, Other. Status: Draft, Under review, Released (KPI also counts Superseded) |
| Approval role | Role name, people[], default for record types | Record types: Supplier Qualification, CAPA, NCMR, Document, FAI, Purchase Order |
| Maturity assessment | 8 dimension ratings (1–5), score, heatmap, 90-day plan | Dimensions listed in §4.15 |
| Agent task | When, task, module, status, latency, confidence, decision, reviewer | Status: Success, Failure, Timeout, Escalated. Decision e.g. Modified / accepted / rejected |
| Alert rule | Name, current value, threshold, window, channel, enabled, state | Channel: PagerDuty, Slack, Email. Window: 1h, 24h, 7d |

## 7. Business rules and validations
- **BR-01** Every AI claim carries a clause reference and a "Why this citation:" note.
- **BR-02** AI content that is not grounded in user input is prefixed "AI hypothesis — confirm:".
- **BR-03** Where the AI is uncertain about the applicable clause, the output says "clause reference to confirm".
- **BR-04** Every paste-and-generate action shows "Do not paste ITAR, EAR, CUI or customer-confidential data" and a required checkbox "I confirm this text contains no controlled data". This covers Try your document, /demo, Start my CAPA, Check clauses, Build my FAI record and the CAPA/NCMR create form.
- **BR-05** The action button stays disabled until the checkbox is ticked (and, where applicable, text is present). The CAPA/NCMR create form shows "Tick the controlled-data confirmation to continue."
- **BR-06** Pasted text is sent to the server and the AI provider for processing and is not retained. Demo records are stored in the browser only.
- **BR-07** No files are stored. Certificates and documents are recorded as references or links only (e.g. "Where this document lives", calibration certificate reference).
- **BR-08** Every record has an audit timeline: creation, stage changes, AI draft acceptances, reviewer decisions. When signed in, each event writes an immutable activity_log row with the actor and a snapshot.
- **BR-09** The human quality leader is the reviewer of record. AI outputs are drafts only.
- **BR-10** Segregation of duties: the "Use as is" and "Repair" NCMR dispositions need an independent named approver.
- **BR-11** CAPA/NCMR need a reviewer name ("Your name" + Save). The name is recorded on each step.
- **BR-12** CAPA/NCMR IDs are generated automatically (CAPA-DEMO-xxxx / NCMR-DEMO-xxxx in demo mode).
- **BR-13** The CAPA/NCMR workflow has 6 steps through the stages New → Containment → Investigation → Draft Ready → QM Review → Closed. The Disposition field appears only for NCMR.
- **BR-14** The "Awaiting your review" list sorts by severity (Critical > Major > Minor), then by age.
- **BR-15** "Threatens delivery" lists open CAPA/NCMR with a need-by date within the next 14 days.
- **BR-16** The supplier risk score blends open SCARs, on-time %, criticality and certificate freshness. Suppliers are ranked worst (lowest score) first.
- **BR-17** The Supplier Qualification wizard cannot continue until the supplier name is entered ("Enter the supplier name to continue.").
- **BR-18** The supplier re-evaluation date is tracked and bucketed as overdue / 0–30d / 31–60d / 61–90d on the dashboard.
- **BR-19** Approval Roles are a convenience only, not an access-control mechanism.
- **BR-20** Default approvers: Supplier Qualification, CAPA, NCMR and Document → Quality Manager; FAI → Engineering Lead; Purchase Order → Production Supervisor. The default is skipped if it would break segregation of duties.
- **BR-21** The PO clause check evaluates the PO against AS9100D §8.4.3 (and AS9102 for FAI). Each requirement is classified Missing / Weak / Present (or not captured) and comes with suggested wording.
- **BR-22** FAI Form 1 requires Part Number and Part Name. The FAI Report Number is generated automatically if left blank. Reason for FAI defaults to initial FAI.
- **BR-23** Calibration "Save to the register" is disabled until an equipment name is entered ("Enter an equipment name."). Certificate reference and NIST traceability statement are required.
- **BR-24** The +6/+12/+24-month next-due buttons stay disabled until a last calibration date is set. When used, they set next due = last date + N months.
- **BR-25** Calibration status is computed from the next-due date: Overdue if past; Due soon inside a window (observed ≤30d, ≤60d and ≤90d buckets, with a 64-day item shown as Due soon); otherwise Active.
- **BR-26** Document Control "Save" is disabled until a document name is entered ("Enter a document name.").
- **BR-27** Training assignments can trace back to a source record (CAPA, NCMR, PO-check finding). Items past their due date show as overdue/expired. Mark complete updates the status.
- **BR-28** The QMS Champion assessment needs a 1–5 rating on each of the 8 dimensions (progress "x/8 answered") before results are produced (assumed; see OQ).
- **BR-29** Agent tasks below the confidence threshold are escalated (routed to a human reviewer), e.g. a confidence of 0.48.
- **BR-30** An alert rule fires when its metric breaches the threshold over its window. Observed rules:

  | Rule | Current / threshold | Window | Channel | State |
  |---|---|---|---|---|
  | Failure rate spike | 3.3% / 5% | 1h | PagerDuty | Enabled |
  | Timeout budget | 2.1% / 2% | 1h | Slack | Enabled, BREACH (firing) |
  | Latency SLO | 3034 ms / 4000 ms | 24h | Slack | Enabled |
  | Low-confidence drift | 8.8% / 15% | 24h | Email | Enabled |
  | Reviewer rejection rate | 11.3% / 10% | 7d | Email | Disabled (so not firing despite the breach) |

- **BR-31** Records sample data is labelled "ILLUSTRATIVE — SAMPLE RECORDS".
- **BR-32** Disabled-in-demo actions: none observed beyond the validation gates. Destructive or AI actions were not exercised.

## 8. User stories and acceptance criteria

### 8.1 Governance (cross-cutting)
- **US-01** As a quality leader, I want every AI claim cited to a clause so I can verify it.
  - *Given* an AI-generated output, *When* it is displayed, *Then* each claim shows a clause reference and a "Why this citation:" note (BR-01).
  - *Given* content not present in my input, *Then* it is prefixed "AI hypothesis — confirm:" (BR-02).
- **US-02** As a user, I must confirm that my pasted text has no controlled data before it is processed.
  - *Given* any paste-and-generate box, *When* the checkbox is unticked, *Then* the action button is disabled and the ITAR/EAR/CUI warning is visible.
  - *When* I tick it (and enter text), *Then* the button is enabled (BR-04/05).
- **US-03** As an auditor, I want an audit timeline on every record.
  - *Given* a record is created, *Then* the timeline shows "Created · <reviewer> · stage: new" with a timestamp.
  - *When* the stage changes or an AI draft is accepted, *Then* a new event is appended (BR-08).

### 8.2 Marketing and public tools
- **US-04** As a prospect, I want to compare Sentinel QA with competitors.
  - *Given* /compare, *Then* I see the 9 criteria × 7 products, with values Yes / Partial / No / Not verified.
- **US-05** As a prospect, I want to try my own document.
  - *Given* /try-your-document, *When* I pick a doc type, paste text and tick the confirmation, *Then* Check clauses is enabled.
  - *When* the box is unticked or the text is empty, *Then* the button is disabled.
- **US-06** As a prospect, I want to start a pilot. *Given* /pricing, *Then* a single Pilot card (60–90 days) offers "Email us about a pilot".
- **US-07** As a prospect, I want to chat with the agent. *Given* /demo, *Then* I see 4 prompt cards, Session history (0) and the ITAR/EAR warning.

### 8.3 Dashboard
- **US-08** As a QM, I want one place showing what needs attention.
  - *Given* /app/aerospace, *Then* the headline count equals the number of items in the Needs attention list (8), and each item is tagged Overdue or Due soon.
- **US-09** As a QM, I want to know which CAPA/NCMR threaten delivery. *Given* no open record has a need-by date within 14 days, *Then* the empty-state text is shown.

### 8.4 Records
- **US-10** As a QM, I want to filter records. *When* I pick Type, Severity, Status or Standard, *Then* the list shows only matching records.
- **US-11** As a QM, I want my review queue prioritised. *Given* records awaiting review, *Then* they are sorted by severity and then age, with clause and days left (BR-14).
- **US-12** As a QM, I want trends. *Then* I see opened vs closed (12 weeks), severity mix, a by-standard view and a clause Pareto.

### 8.5 NCMR / CAPA
- **US-13** As an inspector, I want to start an NCMR.
  - *Given* the NCMR list, *When* I click Start a new NCMR, *Then* /app/aerospace/capa/new?type=NCMR opens at "Step 1 of 6", with an auto ID NCMR-DEMO-xxxx and a Disposition selector.
- **US-14** As a reviewer, I want my name recorded. *When* I enter "Your name" and Save, *Then* that name is attributed on each step and in the timeline.
- **US-15** As a user, I cannot create a record without the controlled-data confirmation. *Given* the box is unticked, *Then* "Create record & continue →" is disabled and shows "Tick the controlled-data confirmation to continue."
- **US-16** As a QM, I need independent approval for risky dispositions. *Given* the NCMR disposition is Use as is or Repair, *Then* an independent named approver is required (BR-10).
- **US-17** As a quality engineer, I want to draft a CAPA from pasted text.
  - *Given* Corrective Actions, *When* I paste text and confirm, *Then* Start my CAPA is enabled.
  - *Else* I can Start a new CAPA (CAPA-DEMO-xxxx).

### 8.6 Supply Chain
- **US-18** As supplier quality, I want suppliers ranked by risk. *Then* the list is ordered by ascending score and can be filtered by standard.
- **US-19** As supplier quality, I want a risk narrative. *When* I open a supplier, *Then* I see the score band, cert renewal days, flags (SCARs, FAI failures) and a recommended next step.

### 8.7 Supplier Qualification
- **US-20** As supplier quality, I want to see the ASL. *Given* the Active on ASL tab, *Then* approved suppliers are listed with scope and re-evaluation date (+ days remaining).
- **US-21** As supplier quality, I want to start a qualification.
  - *Given* the New wizard at step Request, *When* the supplier name is empty, *Then* Continue is disabled with "Enter the supplier name to continue."
  - *When* it is filled, *Then* I can continue to Docs & certs.

### 8.8 Purchase Controls
- **US-22** As a buyer, I want a PO checked against §8.4.3.
  - *Given* pasted PO text and the confirmation, *When* I click Check clauses, *Then* I get summary counts (missing/weak/present) and findings with clause, suggested wording and why-citation.
  - Findings can be filtered by status and clause.

### 8.9 FAI
- **US-23** As an inspector, I want to create AS9102 Form 1.
  - *Given* Form 1, *When* Part Number or Part Name is empty, *Then* the FAI cannot be created (error text not observed, OQ-12).
  - *When* the FAI Report Number is blank, *Then* it is generated automatically.
- **US-24** As an inspector, I want to build an FAI from pasted text. *Then* Build my FAI record is disabled until the confirmation is ticked.

### 8.10 Calibration
- **US-25** As a metrology owner, I want overdue gauges surfaced. *Then* KPIs and the All / Due soon / Overdue tabs reflect the status computed from the next-due date.
- **US-26** As a metrology owner, I want to register an instrument.
  - *Given* the form, *When* the equipment name is empty, *Then* Save is disabled with "Enter an equipment name."
  - *When* the last date is set, *Then* the +6/+12/+24 buttons fill in the next due date.
  - Certificate reference and NIST statement are required.

### 8.11 Training
- **US-27** As a training coordinator, I want a role-to-training matrix. *Then* each row shows role·person, course, source record, standard, due and status, with a Mark complete action.
- **US-28** *When* I click Mark complete, *Then* the row status becomes Current and the KPIs update (behavior not exercised, OQ-16).

### 8.12 Document Control
- **US-29** As a document controller, I want to register a controlled document. *When* the name is empty, *Then* Save is disabled with "Enter a document name." Location is a link or description (no upload).

### 8.13 Approval Roles
- **US-30** As a QM, I want default approvers per record type.
  - *When* I quick-add roles and people, *Then* the defaults map as in BR-20.
  - *Given* a default would make the author also the approver, *Then* the default is skipped.

### 8.14 QMS Champion
- **US-31** As a QM, I want a maturity self-assessment. *When* I rate all 8 dimensions 1–5, *Then* I get a score, a gap heatmap and a 90-day plan.

### 8.15 Agent reliability
- **US-32** As an ops owner, I want agent KPIs and alerts. *Then* I see 24h KPIs, firing alerts with their channel, a rules table and a filterable task log; Export CSV downloads the log.
- **US-33** *Given* task confidence is below the threshold, *Then* the task is Escalated to a human and the reviewer's decision is logged.

## 9. Non-functional and compliance notes (observed)
- **Data protection:** ITAR/EAR/CUI warning plus a mandatory confirmation. Pasted text is not retained. Demo data lives in browser storage only. No file storage.
- **Auditability:** append-only timeline; immutable activity_log with actor and snapshot when signed in; printable CAPA/NCMR view.
- **AI governance:** citations, hypothesis flagging, uncertainty hedging, a published validation summary with known limitations, a human reviewer of record, and confidence-based escalation.
- **Observability:** reliability dashboard with SLO-style alerts (PagerDuty, Slack, Email); average latency of about 3 s.
- **Privacy:** first-party analytics only, "no advertising trackers"; consent notice with an OK button.
- **Positioning disclaimer:** "draft assistance, not regulatory judgment"; not a substitute for a certification body.
- **UX:** responsive web app; ⌘K search; demo mode clearly badged (DEMO, ILLUSTRATIVE).

## 10. Coverage notes
- **Covered:** all public marketing pages, the public tool entry screens, the workspace dashboard and every sidebar module's landing page, and step 1 of the create forms (NCMR, CAPA, calibration, supplier qualification, FAI Form 1, document). There are 30 screenshots.
- **Not reached (deliberately or because sign-in is required):**
  - the sign-in-gated workspace;
  - all AI output generation (demo prompts, Check clauses, Try a sample, Start my CAPA, Build my FAI record);
  - CAPA/NCMR steps 2–6 and the print view;
  - SQ wizard steps 2–6;
  - FAI forms beyond Form 1;
  - QMS Champion results;
  - session history;
  - record detail pages (e.g. SQ-2025-014);
  - the ⌘K palette contents and Demo utilities;
  - the details of the home How it works / ROI / FAQ sections;
  - FAI required-field error messages;
  - the D. Rivera training row.
- The sample Purchase Controls findings and Supply Chain data were already shown on the landing page; no generation was triggered.

## 11. Open questions
- **OQ-01** How is the supplier risk score weighted (SCARs vs on-time % vs criticality vs cert freshness)? What are the band thresholds (e.g. "Watch")?
- **OQ-02** What are the exact "Due soon" thresholds for calibration, training and supplier re-evaluation? A calibration item 64 days out shows Due soon, which suggests 90d, but the dashboard buckets use 30/60/90.
- **OQ-03** Segregation-of-duties detail: which roles count as "independent"? Does SoD apply to stages beyond the Use as is / Repair dispositions (e.g. QM Review closure)? How is it enforced without a permission system?
- **OQ-04** Persistence model: browser-only for demo vs server for signed-in users. Migration, export and retention periods?
- **OQ-05** Which AI provider/model is used, under what data-processing terms, and in which region? How is "not retained" verified?
- **OQ-06** What happens in CAPA/NCMR steps 2–6? What content is required per stage, and when does AI drafting occur?
- **OQ-07** What are the content and validations of Supplier Qualification steps 2–6? Who approves, and how is the re-evaluation interval set?
- **OQ-08** Are FAI Forms 2 and 3 (AS9102) supported after Form 1?
- **OQ-09** How is the QMS Champion score calculated, and how is the 90-day plan generated?
- **OQ-10** How does Records (sample data under /dashboard-preview) relate to user-created records in the modules?
- **OQ-11** How is the dashboard "items need attention" count composed (8 items vs tile totals)?
- **OQ-12** What error messages and validation does FAI Form 1 show for missing required fields?
- **OQ-13** Is the controlled-data confirmation logged in the audit trail?
- **OQ-14** Is the ASL gate (blocking POs to non-ASL suppliers) planned to integrate with Supplier Qualification? What is the timeline for each roadmap item?
- **OQ-15** Is training auto-assignment from CAPA/NCMR/PO findings live or only seeded sample data? The sample rows cite source records, but "CAPA-driven assignment" is listed as roadmap.
- **OQ-16** What does Mark complete record (date, evidence reference, verifier)?
- **OQ-17** Document lifecycle: how is Superseded reached, and are revisions linked? Are there review reminders?
- **OQ-18** What is the confidence threshold for escalation, and can it be configured? Are alert rules editable by users?
- **OQ-19** What does Export CSV contain, and what time range does it cover?
- **OQ-20** What are the contents and purpose of "Demo utilities" (e.g. reset sample data)? What can the ⌘K palette do?
- **OQ-21** Does the print view constitute a controlled record, and is it signed or dated?
- **OQ-22** Is the "Industry" filter (Aerospace only) intended to support other industries?
- **OQ-23** Are SCARs created from NCMRs or from the Supply Chain module? There is no SCAR create entry point.
- **OQ-24** What do the How it works / ROI / FAQ sections claim (e.g. the ROI calculation inputs)?
