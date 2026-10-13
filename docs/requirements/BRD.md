# Business Requirements Document — Sentinel QA

| Item | Value |
|---|---|
| Product | Sentinel QA — "AI Quality Manager" for AS9100D aerospace suppliers |
| Source | https://sentinel-qa.lovable.app/ (public, unauthenticated exploration) |
| Version / date | 1.4.2 — 2026-10-13 (v1.1 + scope decisions from architecture, §12; review responses and build clarifications, §13; Vishwas decisions of 2026-10-13, §13.5; BR-44 CFR range interpretation v1.4.1; CAPA/NCMR overdue rule raised as OQ-25/DP-20 v1.4.2; observed findings unchanged; changelog §14) |
| Basis | Observed behavior only (as-built BRD). No features are invented; roadmap items are marked **[ROADMAP – not live]**. |
| Evidence | [screenshots/](screenshots/README.md) |
| Architecture | [architecture-overview.md](../architecture/architecture-overview.md) v0.4, [ADRs](../architecture/adr/) |

---

## 1. Product overview

Sentinel QA helps small and mid-size AS9100D aerospace suppliers run their quality management system. An AI agent drafts quality records: CAPA, NCMR, SCAR, FAI (AS9102), supplier risk narratives, and PO clause checks. A human quality leader stays the **reviewer of record** and makes the final decision. Hero message: *"The AI Quality Manager built for AS9100 aerospace suppliers."* Standards it names: AS9100D, AS9102, AS9145 (the validation page also lists AS13100 and NADCAP).

Positioning, from the home page and /compare: clause-level citations, flagging of AI hypotheses, an agent-first approach, cross-module traceability and human-in-the-loop review. Commercial model: a single 60–90-day Pilot ("Email us about a pilot").

### 1.1 Scope
**In scope (this BRD):** the marketing site (/, /compare, /pricing, /validation, /privacy, /terms, /security), the public tools (/demo, /try-your-document) and the demo workspace (/app/aerospace and its modules). That covers the dashboard, Records, NCMR, Corrective Actions, Supply Chain, Supplier Qualification, Purchase Controls, FAI, Calibration, Training, Document Control, Approval Roles, QMS Champion, Ask the agent and Agent reliability, plus the cross-cutting governance rules.

> **v1.2 build scope:** this document still records observed behavior. For the build, AI generate/draft flows are out of scope and items tagged **[Deferred v1.2 …]** are not built; items tagged **[Changed v1.2]** carry a build rule that differs from the observed demo. See §12.

**Out of scope:** authentication (/auth: Continue with Google, Sign in, Create an account), user accounts and multi-tenancy, billing, and the observed demo's signed-in persistence (migration/export of the hosted product's accounts). *v1.3 clarification:* server-side persistence itself **is in build scope** (BR-45, §12 #2); only the login-gated behavior of the observed product is out of scope. Also out of scope is any AI output content: at the user's request, AI generate flows (Try the agent prompts, Check clauses, Try a sample, Start my CAPA, Build my FAI record, "Ask about …", "Continue drafting in the agent", "Ask the agent to draft a full gap-closure plan") were deliberately not run in either pass (see §10). AI-labelled content quoted in this BRD is pre-seeded sample/demo content or locally computed summaries that appeared without triggering generation.

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
- Header: DEMO badge, Search with ⌘K palette, Marketing site link. Page subtitle "Aerospace · AS9100D". The workspace header reads "Aerospace workspace — AS9100D · AS9102 · AS9145 · AS13100 · NADCAP special processes", with a workspace switcher pill "Workspace: Aerospace AS9100D" and the hint "Scoped to Aerospace · AS9100D. Use the sidebar or ⌘K to jump between modules." [37](screenshots/37-workspace-demo-utilities-menu.png)
- **⌘K command palette** [36](screenshots/36-cmdk-command-palette.png): search box "Search records, modules, docs…" (Esc/× to close). A "Modules" group lists Workspace (Module launcher — live status at a glance), Records (CAPA / NCMR / SCAR queue), Supply Chain (Supplier risk scorecards), Purchase Controls (PO clause check), Training (Role → training matrix), QMS Champion (QMS maturity self-assessment); the list scrolls, so further entries exist but were not captured.
- **Demo utilities** menu (floating "…" button, bottom right) [37](screenshots/37-workspace-demo-utilities-menu.png): **Send feedback** and **Reset demo**. Neither was executed.
- A floating "Ask about <module>" assistant on each module. First-party analytics notice with an OK button. A "Demo utilities" button.
- Governance: clause citations with "Why this citation:", hypothesis prefixing, a controlled-data gate, an audit timeline, and segregation of duties (see §7).

### 4.2 Marketing site
- **Home (/)** ([01](screenshots/01-home.png)): nav Capabilities, How it works, ROI, Compare, Pricing, Try your document, FAQ, Sign in, Open workspace (/app), Try the agent (/demo). Stats: AI hypotheses "Flagged", CAPA draft "~90s", reviewer of record "You". Sample card NC-2026-0087 (Ti bracket, AeroForge, 3 of 40 OOT, Major, Clause 8.7). Capabilities: CAPA drafting §10.2, NC triage §8.7, Risk & supplier assist §8.1.1, Standards update impact §4.4/§7.2. A "Where AS9100 shops fail audits most" section by clause. Footer: Privacy, Terms, Security, AI validation summary. Disclaimer: "draft assistance, not regulatory judgment."
- **Home sections (second pass):**
  - *Reliability before speed* ("How we keep this safe") [31](screenshots/31-home-roi-calculator-default.png): Hedging by default (any root cause or fact not in the input is prefixed "AI hypothesis — confirm"); Clause citations with sourcing ("Why this citation" note); Output audit trail (demo drafts retained in a local workspace with prompt, output, timestamp and referenced clauses; link to the AI validation summary).
  - *ROI / Time savings* "What could ~90-second drafting do for your team?" [31](screenshots/31-home-roi-calculator-default.png): presets Small team / Established team; inputs Records / month (default 20; "CAPAs, NCMRs, SCARs — anything your team drafts") and Manual draft time (min) (default 90). Output "Your estimate": 29.5 hours/month returned, 354 h/yr annualized, 44.3 days/yr at 8h/day. Footnote: "Estimate only. Reviewer time is not deducted — a qualified quality leader still reviews and approves every draft." (The defaults are consistent with records × (manual min − 1.5 min) / 60 = 20 × 88.5 / 60 = 29.5 h; ×12 = 354 h; ÷8 = 44.3 days.)
  - *Clause cards* [32](screenshots/32-home-how-it-works.png): Clause 7.1.5.2 Measurement traceability — "Live today" (calibration records missing a NIST-traceable statement, or instruments used past due date); Clause 8.4 External provider control — "Next" (appears four times in the top 10 findings). Note: "Supplier controls: live in demo (PO clause check, supplier scorecards); certificate watch and incoming inspection triage on roadmap."
  - *How it works* "From event to audit-ready record" [32](screenshots/32-home-how-it-works.png): a three-step loop "designed to fit inside your existing SOP": 01 Describe the event (paste the nonconformity, audit finding, supplier issue or standard update in plain language); 02 Agent drafts the record (structured output referencing clauses in your selected standards and QMS process areas); 03 Your quality leader makes the call (reviewer of record edits, approves and releases; every output marked draft assistance).
  - *Weekly digest* [33](screenshots/33-home-faq-expanded.png): mock email/Slack summary ("Sent every Monday · quiet weeks stay quiet", e.g. 3 CAPAs need review, Precision Polymers cert expires in 30 days, 2 training records expired, AS9100D §7.2 revision impact draft ready), labelled "Illustrative" and "Mock preview — the notification pipeline is on the roadmap." **[ROADMAP – not live]**
  - *FAQ* "What quality leaders ask first" [33](screenshots/33-home-faq-expanded.png): "Does Sentinel QA replace our Quality Manager?" → No; it drafts, the qualified reviewer of record approves and takes regulatory responsibility. "Which standards is the agent trained on?" → AS9100D in early access for aerospace and expanding alongside AS9102, AS9145 and NADCAP; API Spec Q1/Q2 with API 6A and NACE MR0175 / ISO 15156 (petroleum / oil & gas) also in early access; medical device coverage (ISO 13485, ISO 14971, EU MDR, FDA 21 CFR 820, IEC 62304) is lighter; clause numbers cited in every draft. "Is our data used to train models?" → answer begins "This is a public demo agent — do not paste ITAR / EAR-controlled data, drawings, or supplier NDAs…" (rest cut off).
- **Compare** ([02](screenshots/02-compare.png)): rows are clause-level citation, AS9100D depth, AI-hypothesis flagging, agent-first, cross-module traceability, human-in-loop, trial access, deployment, industry focus. Values are Yes / Partial / No / Not verified.
- **Pricing** ([03](screenshots/03-pricing.png)): a single Pilot card, "60–90 days, contact us".
- **Validation** ([06](screenshots/06-validation.png), [47](screenshots/47-validation-how-outputs-governed.png)), title "How Sentinel QA's own outputs are governed" (linked from the sidebar "How outputs are governed" and record "see how this is governed" badges). Disclaimer: "maintained by the Sentinel QA team and is not an independent certification … not a completed formal validation of your specific intended use." Sections: 1 Uncertainty hedging (root cause, failure mechanism, part number, quantity, date or supplier facts not in the input are prefixed "AI hypothesis — confirm:"; multiple plausible causes are ranked as investigation candidates; insufficient input → a targeted clarifying question before drafting); 2 Clause-citation discipline (every claim carries a clause reference plus a one-sentence "Why this citation:"; the agent is instructed not to fabricate clause numbers and writes "clause reference to confirm" if unsure); 3 Aerospace standards coverage (AS9102, AS9145 APQP/PPAP, AS13100, NADCAP); 4 Output audit trail (demo interactions retained in the browser; in the authenticated register every create/update on a Risk, CAPA, NCMR or Audit writes an immutable activity_log row with actor and snapshot); known limitations (below the fold).
- **Privacy / Terms / Security** ([22](screenshots/22-privacy.png), [23](screenshots/23-terms.png), [24](screenshots/24-security.png)): static content.

### 4.3 Public AI tools
- **/demo – live agent** ([05](screenshots/05-demo-agent.png)): Back to site, Session history (0). Prompt cards: Triage an aerospace NC, Draft an AS9100D CAPA, AS9100D update impact, Score an aerospace supplier. A chat log with an ITAR/EAR warning.
- **/try-your-document** ([04](screenshots/04-try-your-document.png)): document types Purchase order/quality agreement, First article inspection, Corrective action/nonconformance. Textarea, controlled-data checkbox, Check clauses (disabled until the box is ticked and text is entered), Try a sample. Output by type: PO clause review, an editable AS9102 record, or CAPA step 1.

### 4.4 Workspace dashboard (/app → /app/aerospace) ([08](screenshots/08-workspace-dashboard.png))
- Headline "8 items need attention".
- Tiles: Awaiting review (CAPA/NCMR) 0; FAI sign-off pending 0; Supplier re-evaluation 2 (0 overdue, 1 in 0–30d, 1 in 31–60d, 0 in 61–90d); Calibration 5 instruments (2 active, 2 due soon, 1 overdue); Effectiveness checks due 0; Training 3 (2 expired, 1 due soon).
- Needs attention list (8 items, tagged Overdue / Due soon) [37](screenshots/37-workspace-demo-utilities-menu.png): J. Park — Counterfeit part awareness (training expired 14 days ago, Overdue); Instrument CAL-2026-001 Mitutoyo digital caliper 0–150 mm (overdue by 12 days, Overdue); L. Brandt — AMS 2750 pyrometry basics (expired 3 days ago, Overdue); M. Alvarez — FOD awareness SOP-AS-002 (due in 12 days, Due soon); Supplier Alloy Precision Machining Ltd. (re-evaluation due in 18 days, Due soon); Instrument CAL-2026-002 Zeiss CONTURA CMM (due in 25 days, Due soon); Supplier Northline Heat Treat (re-evaluation due in 53 days, Due soon); Instrument CAL-2026-003 Torque wrench 5–50 Nm (due in 64 days, Due soon). The 8 = 3 training + 3 calibration + 2 supplier items.
- Section label "Audit readiness — Aggregated from Records, FAI, Supplier Qualification, effectiveness checks, Calibration and Training."
- "Threatens delivery (14 days)", currently empty: "No open CAPA or NCMR has a need-by date in the next 14 days."
- "Your records" (empty, with an Open Records link). Module cards: Records, Supply Chain, Ask the agent.

### 4.5 Records (/dashboard-preview?module=records) ([09](screenshots/09-records.png))
- Banner "ILLUSTRATIVE — SAMPLE RECORDS". Tabs: CAPA/NCMR/SCAR, FAI, Supplier Qualification, Calibration, Document Control.
- Stage counts (Open/Investigation/QM Review/Closed): CAPA 1/1/0/0; NCMR 0/1/1/0; SCAR 1/0/0/1.
- Filters: Type (All/CAPA/NCMR/SCAR); Industry (Aerospace); Severity (All/Critical/Major/Minor); Status (All/New/Containment/Investigation/Draft Ready/QM Review/Closed); Standard (All/AS9100D). 6 records.
- "Awaiting your review", sorted by severity then age: Critical NCMR-2026-0087 Ti bracket hole Ø §8.7, 9d left; Major SCAR-2026-0044 FAI flatness fail §8.4, 12d left.
- Header text: "AI-drafted CAPAs, NCMRs, and SCARs surfaced at the human checkpoint for AS9100D aerospace quality teams." Notice: "Records you create stay in your browser; pasted text is sent to an AI provider and not retained — click around freely. Hover any acronym for a plain-language definition. Press ⌘K to jump anywhere." [35](screenshots/35-records-status-board.png)
- **Status board** "Triage-to-resolution across CAPA, NCMR, and SCAR" (Hide toggle), one column per stage with a count [35](screenshots/35-records-status-board.png): New — CAPA-2026-0026 Minor "Missed FOD sweep — final assembly bay 3" §8.5.4; Containment — CAPA-2026-0031 Critical "Counterfeit-part risk — fastener sub-tier" §8.1.4; Investigation — NCMR-2026-0082 Major "Heat-treat furnace excursion — NADCAP…" §8.5.1; Draft Ready — SCAR-2026-0044 Major "FAI flatness fail — AI housing, AeroForge" §8.4; QM Review — NCMR-2026-0087 Critical "Ti bracket P/N TB-4471 — hole Ø out of…" §8.7; Closed — SCAR-2026-0041 Minor "NDT re-cert lapsed — bracket supplier" §8.4.
- **Record detail drawer** (NCMR-2026-0087) [34](screenshots/34-records-ncmr-2026-0087-detail.png): badges Critical, NCMR; title "Ti bracket P/N TB-4471 — hole Ø out of tolerance"; meta "Aerospace · AS9100D §8.7 · opened 6d ago · supplier: AeroForge"; badge "AI-assisted draft — see how this is governed". Summary: 3 of 40 titanium brackets from AeroForge outside Ø6.35 ±0.02 mm on a primary-structure critical hole; disposition proposed: scrap + SCAR. Root cause candidates, each tagged AI HYPOTHESIS: boring-bar wear on OP-40 crossed limit without in-process check; CMM datum shift from misaligned fixture. Actions: segregate lot, 100% CMM on remaining stock; issue SCAR (AS9100D §8.7.2) with 30-day corrective action; re-qualify OP-40 tool-life curve, add SPC on Ø. Citations: AS9100D §8.7 (Why this citation: control of nonconforming outputs — mandates disposition and containment); AS9102 (any change to the machining process re-triggers FAI on the affected characteristic). Button "Continue drafting in the agent →" (not run). Note: the home-page sample card shows this case as Major, the Records sample as Critical.
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
- Detail (AeroFast Distribution "At risk · 48") [48](screenshots/48-supply-chain-aerofast-detail.png): Fasteners · Aerospace; 82% on-time, 0 open SCARs, cert in 30d. "AI draft — risk narrative": "Critical-path supplier. Score 48 reflects 82% on-time delivery, and cert renewal in 30 days." plus "AI hypothesis — confirm root causes on any open SCARs before de-risking the score." Flags: Counterfeit-risk CAPA open; Sub-tier not on ASL. Suggested next step: "Escalate to Approved Supplier List review; add to next quality council agenda."
- Detail (AeroWire Cables "Approved · 84") [49](screenshots/49-supply-chain-aerowire-detail.png): Wire harness · Aerospace; 97% on-time, 0 open SCARs, cert in 180d; narrative "Score 84 reflects 97% on-time delivery, and cert renewal in 180 days."; no flags; next step "Maintain current oversight cadence; no action needed."; link "Try the agent →".
- Observed score bands: At risk (48), Watch (62), Approved (84). Precision Heat (74) band not captured.
- **[ROADMAP – not live]** Incoming inspection triage (auto-route lots to skip-lot, reduced or 100% inspection); sub-tier flow-down monitor (track AS9100 §8.1.4 requirements cascading to sub-tier distributors); certificate expiry watch (ISO / NADCAP / AS9100 certs, alerts 90/60/30 days out); geopolitical & logistics risk map.

### 4.8 Supplier Qualification ([13](screenshots/13-supplier-qualification.png), [28](screenshots/28-new-supplier-qualification-wizard.png))
- Tabs: Active on ASL / All qualifications. Columns: Record, Supplier, Stage, Approved scope, Re-evaluation, Created.
- Data:
  - SQ-2025-014 Alloy Precision Machining Ltd: Approved / Active on ASL, "Machined titanium detail parts, AS9100D §8.4", re-evaluation 2026-10-30 (18d).
  - SQ-2025-021 Northline Heat Treat: Approved, "Vacuum heat treatment", 2026-12-03 (53d).
  - SQ-2025-027 Cascade Surface Finishing: Approved, "Chem-film per MIL-DTL-5541 Type I", 2027-07-09.
  - SQ-2026-003 Helix Fastener Supply: Evaluation.
  - SQ-2026-006 Veridian Composites: Documentation & cert review.
- New wizard, 6 steps: Request, Docs & certs, Risk, Evaluation, Approval, Active on ASL. Fields: Supplier name (e.g. AeroForge Precision Ltd), Scope requested. Back / Continue (Continue disabled: "Enter the supplier name to continue."). Audit trail.
- Opening an existing record resumes the wizard at its stage (route `/app/aerospace/supplier-qualification/new?id=SQ-2026-006`) with "← Back to supplier qualification". Banner: "AI-assisted draft · Aerospace · approver: you. Every risk rating is a hypothesis until you confirm it." plus a "How this is governed" link. A "Your name" bar ("Recorded as the person on every step, AI acceptance and approval in the timeline. Saved in this browser only.") [38](screenshots/38-sq-wizard-step2-docs-certs.png)
- **Step 2 of 6 — Documentation & cert review** [38](screenshots/38-sq-wizard-step2-docs-certs.png): one free-text area "Documentation & certification review" (sample: "Awaiting AS9100D certificate and quality manual."); Back / Continue.
- **Steps 3 (Risk) and 4 (Evaluation)** were advanced through but their contents were not captured; the audit trail records the advances.
- **Step 5 of 6 — Approval decision** [39](screenshots/39-sq-wizard-step5-approval-gated.png): Approver (named individual — required) dropdown "Select an approver…" with hint "No saved roles yet — type a custom name, or set up Approval Roles"; Approval scope (what this supplier is approved to provide), placeholder "CNC machining of aluminium and titanium detail parts. Excludes special processes."; Approval date; Re-evaluation / expiry date (both date pickers, entered manually). Rule text: "A named approver is required before this supplier can go active on the ASL." With no approver, "Approve & add to ASL →" is disabled and "Name an approver to continue." is shown. Step 6 (Active on ASL) was not reached.
- Audit trail example [39](screenshots/39-sq-wizard-step5-approval-gated.png): 9/6/2026 7:22:00 PM · demo data · illustrative demo record · "New supplier request"; 10/12/2026 7:51:07 PM · Reviewer · Advanced Docs & certs → Risk · "Risk classification"; 7:51:15 PM · Advanced Risk → Evaluation · "Evaluation"; 7:51:16 PM · Advanced Evaluation → Approval · "Approval decision".

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
- AS9102 Form 1 — Part identification (/app/aerospace/fai/new): "Text references only. Do not attempt to attach drawings or reports — this platform stores references, never the files themselves." Part Number*, Part Name*, Part Revision (optional), FAI Report Number ("Generated automatically if blank"), Part Type (default Detail), FAI Type (default Full), Reason for FAI ("Optional — defaults to initial first article inspection"), Manufacturing Routing Number, Create FAI.
- **Validation on submit** [40](screenshots/40-fai-form1-validation-errors.png): empty required fields are outlined red with "Part Number is required." / "Part Name is required."; a summary line "Fill in the highlighted fields to continue: Part Number, Part Name."; a toast "Please fill in: Part Number, Part Name." Create FAI stays clickable (validation runs on click).
- **FAI record page** (/app/aerospace/fai/<uuid>) [41](screenshots/41-fai-record-created-form3.png): header "TEST-PN-001 — TEST bracket", "AS9102 Form 1 · text references only, no files are stored here". Fields: Part number, Part name, Revision (N/A when blank), FAI report number (auto: FAIR-2026-1576064A), FAI type (Full), Status (Draft).
  - *Approval actions*: "AS9102 Rev C requires the evaluator to be a different person than the preparer." Buttons Sign as Preparer, Sign as Evaluator (disabled, "Preparer must sign first."), Print FAI; status "Preparer: not signed · Evaluator: not signed"; "Acting as Reviewer 1 (you)" with "Simulate second reviewer". Signing was not exercised.
  - *Form 3 — Characteristic accountability*: Excel-style grid (Tab/Shift+Tab across cells, arrows move between cells, Enter moves down; Tab or Enter from the last cell of the bottom row commits it and opens a new one; empty Reference Location, Result and Equipment cells auto-fill "N/A"). Columns: Char. No., Ref. Location, Designator (dropdown, default None), Requirement, Result, Equipment, Pass/Fail (default PASS), NCR / Disposition, Checks. "+ Add characteristic" (hint "Fill Char. no., Requirement (and NCR if Fail) to add a row"). Completeness banner: "No completeness issues detected. Advisory only — entry and sign-off are not blocked."
  - Form 2 was not observed.

### 4.11 Calibration ([16](screenshots/16-calibration.png), [27](screenshots/27-new-calibration-instrument-form.png))
- Tabs: All / Due soon / Overdue. KPIs: active 4; due ≤30d 1; ≤60d 1; ≤90d 2; overdue 1. Columns: Record, Instrument, Type, Status, Certificate, Next due.
- Register an instrument (fields in §6). Next-due shortcuts +6/+12/+24 months. Save to the register. Form note: "Saved entries are active immediately — status is calculated from the next-due date. This platform stores certificate references, never files." and "Saved in this browser for the demo."
- **+24 months** [42](screenshots/42-calibration-new-instrument-plus24mo.png): last calibration 01/15/2026 → next due 01/15/2028 (the +24 chip shows selected).
- **Register after save** (/app/aerospace/calibration?view=all, "Calibration & Equipment Register") [43](screenshots/43-calibration-register-after-save.png): new row CAL-DEMO-MV5YVOKD "TEST caliper", type "—" (none chosen), Active, certificate CERT-TEST-001, next due 2028-01-15 (ID auto-generated because Equipment ID was blank). KPIs: Active instruments 5; Due within 30 days 1; Due within 60 days 1; Due within 90 days 2; Overdue 1. Rows: CAL-2026-001 Mitutoyo digital caliper 0–150 mm (Caliper, Overdue, CERT-2025-8841, 2026-09-30 · overdue); CAL-2026-002 Zeiss CONTURA CMM · CMM-02 (Due soon, CERT-2026-0113, 2026-11-05 · 25d); CAL-2026-003 Torque wrench 5–50 Nm · TW-0071 (Due soon, CERT-2025-9902, 2026-12-14 · 64d); CAL-2026-004 Granite surface plate 600 × 900 mm (Active, CERT-2026-0044, 2027-05-15); CAL-2026-005 Micrometer 25–50 mm · MIC-0233 (Active, CERT-2026-0090, 2027-03-09). "Active instruments" counts all non-overdue instruments (4 → 5 after the save); the 30/60/90 buckets are cumulative (the ≤90 count of 2 includes the 25d item).

### 4.12 Training (/training) ([17](screenshots/17-training.png))
- **Live:** role-to-training matrix (§7.2). KPIs: current 2, due soon 1, overdue 2, not started 1. Standard filter. Columns: Role·Person, Course, Standard, Due, Status, Action (Mark complete).
- Assignments can be sourced from CAPA, NCMR or PO-check findings (see the sample rows). Subtitle: "6 assignments shown · 3 auto-generated from CAPAs or PO findings · Clear filters"; standard filter Aerospace; "Try the agent →".
- **Baseline rows** [50](screenshots/50-training-matrix-baseline-rivera-row.png), [51](screenshots/51-training-mark-complete-alvarez.png): J. Park, Incoming Inspector — Counterfeit part awareness (Auto-assigned · CAPA-2026-0031), AS9100D §8.1.4, 14d overdue, Overdue; L. Brandt, Heat-Treat Operator — AMS 2750 pyrometry basics (Auto-assigned · NCMR-2026-0082), AMS 2750, 3d overdue, Overdue; R. Chen, Buyer — Purchase controls & flow-down (Auto-assigned · PO clause-check finding), AS9100D §8.4.3, 7d to start, Not started; M. Alvarez, Production Operator — FOD awareness — SOP-AS-002, AS9100D §8.5.4, 12d, Due soon; **D. Rivera, NDT Technician — Level II PT re-certification, AS9100D §8.4 / NAS 410, 90d, Current**; J. Park, Incoming Inspector — AS9102 First Article Inspection, AS9102, 340d, Current.
- **Mark complete** [51](screenshots/51-training-mark-complete-alvarez.png), [52](screenshots/52-training-mark-complete-brandt.png): the Due cell becomes "Completed 2026-10-13", status becomes Current, the action becomes "Undo", and KPIs update (Alvarez: Current 2→3, Due soon 1→0; Brandt: Current 2→3, Overdue 2→1). No dialog for evidence, verifier or date was shown. In 52 Alvarez is back to Due soon (12d) while Brandt is complete. Mark complete on the D. Rivera row itself was not captured (Rivera stays Current, 90d, with Mark complete available).
- **[ROADMAP – not live]** CAPA-driven assignment (automation); procedure-change re-training; competency evaluation; audit-ready report.

### 4.13 Document Control ([18](screenshots/18-document-control.png), [30](screenshots/30-new-document-form.png))
- Tabs: All / Under review / Released. KPIs: Released, Under review, Draft, Superseded (all 0). Empty register. Add a document form (fields in §6).
- Add form header: "We store a reference to where this document lives — never the file itself. Paste a link or describe where your team keeps it. No upload, nothing stored." Placeholder for location: "Paste a link (SharePoint, Drive, your PLM) or describe where your team keeps it — e.g. 'Quality share drive › Work Instructions › WI-QA-014'."
- **Release needs an approver** [44](screenshots/44-document-new-released-approver-required.png): with Status = Released and "Approved for release by" empty ("Select an approver…"), Save to the register is disabled with "Name an approver to release." and "Pick who approved this release before saving." Helper text: "Releasing a document needs a named approver. Any earlier released revision of the same document is marked superseded automatically." The approver picker offers saved roles or "Custom name…" (free-text, e.g. "D. Okafor, Quality Manager"); "No saved roles yet — type a custom name, or set up Approval Roles."
- With a custom approver entered ("TEST Approver, QM"), Save is enabled [45](screenshots/45-document-new-released-approver-entered.png) (in this capture location and effective date were blank).
- **After save** [46](screenshots/46-document-saved-edit-view.png): the record reopens at /app/aerospace/documents/new?id=DOC-DEMO-MV5YVSZE as "Edit a controlled document" (WI-TEST-001, Rev A, Work Instruction, "Test share drive > WI", effective 10/12/2026, Released, approver "Test Approver"). The register list after save was not captured.

### 4.14 Approval Roles ([19](screenshots/19-approval-roles.png))
- "A convenience only, not a login or permission system."
- Quick-add buttons: + Quality Manager, + Engineering Lead, + Production Supervisor. Add a role (Role name), Remove role, Add a person.
- Default approver per record type (see BR-20).

### 4.15 QMS Champion (/qms-champion) ([20](screenshots/20-qms-champion.png))
- **Live:** maturity self-assessment, 8 dimensions rated 1–5 ("0/8 answered", ~3 min). Dimensions: Leadership §5; Risk §6.1/§8.1.1; CAPA effectiveness §10.2; Nonconformity §8.7; Supplier §8.4; Training §7.2; Documents §7.5; Monitoring §9/§10.
- Outputs: score, gap heatmap, 90-day plan.
- Header "QMS maturity self-assessment — Rate each dimension 1–5. 8/8 answered · takes about 3 minutes", progress bar, "Saved for this session", AS9100D badge and Reset [53](screenshots/53-qms-champion-ratings-all-3.png). Each dimension card shows the clause, a question, buttons 1–5, the current rating badge (n/5), and an anchor quote for the chosen level, e.g. Leadership "How visibly does top management own the QMS?" 3 = "Reviewed annually"; Risk 2 = "Risk file exists, rarely updated", 3 = "Updated at design changes"; CAPA 3 = "Closed on time, weak effectiveness", 4 = "Effectiveness verified statistically", 5 = "Repeat-issue rate < 5%, trended"; Nonconformity 3 = "Consistent disposition"; Supplier 2 = "ASL exists, not enforced", 3 = "ASL enforced at PO"; Training 3 = "Matrix + tracking"; Documents 3 = "Controlled release workflow", 4 = "Change control with impact"; Monitoring 3 = "Reviewed at management review" [55](screenshots/55-qms-champion-ratings-mixed.png).
- **AI-drafted maturity summary** (badge "Draft assistance — a QM reviews before action"; it appeared once all 8 were rated, without running any generate action): Overall n / 5 with a band, "Top 3 gaps to close" (dimension, clause, n/5, suggested next step), a dimension heatmap, a "90-day priority" box, and "Ask the agent to draft a full gap-closure plan →" (not run). Observed results:

  | Ratings (Lead, Risk, CAPA, NC, Supplier, Training, Docs, Monitoring) | Overall | Top 3 gaps | 90-day priority | Evidence |
  |---|---|---|---|---|
  | 3,3,3,3,3,3,3,3 | 3.0 / 5 · Defined | Leadership 3; Risk 3; CAPA effectiveness 3 | Leadership & Risk: "moving both from level 3 to level 5 would lift the overall band to Managed" | [54](screenshots/54-qms-champion-summary-all-3.png) |
  | 3,2,4,3,2,3,4,3 | 3.0 / 5 · Defined | Risk 2; Supplier controls 2; Leadership 3 | Risk & Supplier: "moving both from level 2 to level 4 would lift the overall band to Managed" | [56](screenshots/56-qms-champion-summary-mixed.png) |
  | 1,3,5,3,3,3,3,3 | 3.0 / 5 · Defined | Leadership 1; Risk 3; Nonconformity 3 | Leadership & Risk: "moving both from level 1 to level 3 would lift the overall band to Managed" | [57](screenshots/57-qms-champion-summary-leadership-1.png) |

  Suggested next steps seen: Leadership — "Stand up a monthly quality council with documented actions…"; Risk — "Link every open CAPA back to a hazard in the risk file. Assign an owner to keep the file live…"; CAPA — "Introduce statistical effectiveness verification (n=3 lots or 90 days trending)…"; Supplier — "Enforce ASL at PO issue and add sub-tier disclosure to your standard PO clauses (AS9100D §8.1.4)"; Nonconformity — "Add trending across sites/product families…".
- **[ROADMAP – not live]** Mock audit; management review pack; internal audit planner; readiness score; KPI tracker.

### 4.16 Ask the agent
- Workspace entry point to the agent (same capability as /demo), plus a per-module floating "Ask about <module>".

### 4.17 Agent reliability (/reliability) ([21](screenshots/21-reliability.png))
- "Live · last 24h", Export CSV.
- KPIs: 240 tasks; 88.3% success; 3.3% failures; 2.1% timeouts; 3.0s average latency; 61% human acceptance (27 rejected).
- Alert banner: 1 firing (timeout).
- Alert rules table (see BR-30).
- Task log ("240 of 240", search "Search task, ID, error…"): filters for status (Success/Failure/Timeout/Escalated) and module. Columns: When, Task, Module, Status, Latency, Conf., Decision, Reviewer. Example: "Detect expired certifications" T-255S, Training, Escalated, 0.48 conf ("Confidence below threshold — routed to human reviewer"), Modified by M. Okafor [58](screenshots/58-reliability-export-csv.png).
- Alert rule descriptions: Failure rate spike "Any agent task failing (5xx, tool error, schema mismatch)"; Timeout budget "Tasks exceeding 30s ceiling"; Latency SLO "Average end-to-end latency"; Low-confidence drift "Drafts below 0.75 confidence (should escalate)"; Reviewer rejection rate "Human reviewers rejecting agent drafts". Summary "4 enabled · 1 breached".
- **Export CSV** ([58-reliability-task-log-export.csv](screenshots/58-reliability-task-log-export.csv)): 240 rows (the full task log), columns `id, ts, module, task, status, latency_ms, confidence, decision, reviewer, tokens, error_code`. `ts` is ISO-8601 UTC; rows span 2026-10-11T21:02Z to 2026-10-13T00:56Z (Oct 11 4:02 PM – Oct 12 7:56 PM CT, about 28 h, although the page says "last 24h"). Two fields, `tokens` and `error_code`, are not shown in the UI. Content reconciles with the KPIs: status success 212 / escalated 15 / failure 8 / timeout 5 (88.3% / 3.3% / 2.1%); mean latency 3034 ms (= Latency SLO current); 21 of 240 (8.75%) below 0.75 confidence (= Low-confidence drift 8.8%); decisions accepted 138 / modified 62 / rejected 27 / n/a 13 (138 of 227 decided = 61% acceptance; 27/240 = 11.3% rejection). Error codes: TIMEOUT_30S (5, latency 30.9–32.5 s), TOOL_ERROR 2, MODEL_5XX 2, SCHEMA_MISMATCH 2, RATE_LIMIT 2. Modules: QMS Champion 64, Purchase Controls 49, Supply Chain 48, Training 42, Records 37. Reviewer "—" on 45 rows. 16 task types (e.g. Draft CAPA root-cause, Classify NCMR severity, Suggest SCAR response, Link related deviations, Score supplier risk, Flag cert expiry, Summarize audit findings, PO clause check (AS9100 / AS9100D), Detect missing FAI clause, Match role → training, Suggest refresher plan, Detect expired certifications, Maturity gap analysis, Cite clause reference, Draft 90-day plan). Escalated rows have confidences 0.40–0.85 (12 of 15 below 0.75), so escalation is not purely confidence-based.

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
| S31 | Home — Reliability / ROI calculator | / (#roi) | [31](screenshots/31-home-roi-calculator-default.png) |
| S32 | Home — clause cards / How it works | / (#how-it-works) | [32](screenshots/32-home-how-it-works.png) |
| S33 | Home — weekly digest mock / FAQ | / (#faq) | [33](screenshots/33-home-faq-expanded.png) |
| S34 | Record detail drawer (NCMR-2026-0087) | /dashboard-preview?module=records | [34](screenshots/34-records-ncmr-2026-0087-detail.png) |
| S35 | Records status board | /dashboard-preview?module=records | [35](screenshots/35-records-status-board.png) |
| S36 | ⌘K command palette | any workspace page | [36](screenshots/36-cmdk-command-palette.png) |
| S37 | Demo utilities menu (on dashboard) | /app/aerospace | [37](screenshots/37-workspace-demo-utilities-menu.png) |
| S38 | SQ wizard step 2 — Docs & certs | /app/aerospace/supplier-qualification/new?id=SQ-2026-006 | [38](screenshots/38-sq-wizard-step2-docs-certs.png) |
| S39 | SQ wizard step 5 — Approval decision | same | [39](screenshots/39-sq-wizard-step5-approval-gated.png) |
| S40 | FAI Form 1 validation errors | /app/aerospace/fai/new | [40](screenshots/40-fai-form1-validation-errors.png) |
| S41 | FAI record (Form 1 summary, sign-off, Form 3) | /app/aerospace/fai/<uuid> | [41](screenshots/41-fai-record-created-form3.png) |
| S42 | Register instrument (+24 months) | /app/aerospace/calibration/new | [42](screenshots/42-calibration-new-instrument-plus24mo.png) |
| S43 | Calibration register after save | /app/aerospace/calibration?view=all | [43](screenshots/43-calibration-register-after-save.png) |
| S44–45 | Add document — Released needs approver / approver entered | /app/aerospace/documents/new | [44](screenshots/44-document-new-released-approver-required.png), [45](screenshots/45-document-new-released-approver-entered.png) |
| S46 | Edit a controlled document (after save) | /app/aerospace/documents/new?id=DOC-DEMO-… | [46](screenshots/46-document-saved-edit-view.png) |
| S47 | How outputs are governed | /validation | [47](screenshots/47-validation-how-outputs-governed.png) |
| S48–49 | Supplier detail (AeroFast, AeroWire) | /supply-chain | [48](screenshots/48-supply-chain-aerofast-detail.png), [49](screenshots/49-supply-chain-aerowire-detail.png) |
| S50–52 | Training matrix baseline / Mark complete | /training | [50](screenshots/50-training-matrix-baseline-rivera-row.png), [51](screenshots/51-training-mark-complete-alvarez.png), [52](screenshots/52-training-mark-complete-brandt.png) |
| S53–57 | QMS Champion ratings and maturity summary | /qms-champion | [53](screenshots/53-qms-champion-ratings-all-3.png)–[57](screenshots/57-qms-champion-summary-leadership-1.png) |
| S58 | Agent reliability at export + CSV | /reliability | [58 png](screenshots/58-reliability-export-csv.png), [58 csv](screenshots/58-reliability-task-log-export.csv) |
| — | Not captured | CAPA/NCMR print view and steps 2–6, SQ steps 3/4/6, FAI Form 2, FAI print, Document register after save, Ask the agent workspace page, Reset demo result | — |

## 6. Data entities and key fields
| Entity | Key fields (observed) | Enumerations |
|---|---|---|
| Quality record (CAPA / NCMR / SCAR) | ID (CAPA-DEMO-xxxx, NCMR-DEMO-xxxx; samples like NCMR-2026-0087, SCAR-2026-0044), type, short title, event description, severity, stage, standard/clause, days left (due), reviewer name, delivery details (optional; need-by date implied by the "Threatens delivery" panel), disposition (NCMR only), timeline | Type: CAPA, NCMR, SCAR. Severity: Critical, Major, Minor. Stage: New, Containment, Investigation, Draft Ready, QM Review, Closed. Disposition: Use as is, Rework, Repair, Scrap, Return to supplier |
| Audit timeline event | Timestamp, actor/reviewer, event (created, stage change, AI draft acceptance, reviewer decision), stage; signed-in: activity_log row with actor + snapshot | — |
| Supplier (risk scorecard) | Score (0–100), name, commodity, criticality, on-time %, open SCAR count, cert renewal (days), standards, AI narrative, flags, next step | Criticality: Critical, Standard. Band: At risk (48), Watch (62), Approved (84). Standard: AMS 2750, AS6174, AS9100D, AS9102, NADCAP, NAS 410 |
| Supplier qualification | Record (SQ-YYYY-NNN), supplier name, scope requested / approved scope, stage, documentation & certification review notes, approver (named individual, required), approval date, re-evaluation / expiry date, re-evaluation days, created, reviewer name, audit trail | Stage: Request, Docs & certs (shown as "Documentation & cert review"), Risk, Evaluation, Approval, Active on ASL (plus status "Approved") |
| PO clause check | PO number, supplier, part, qty, revision, findings[] (requirement, status, clause, suggested wording, why-citation), summary counts | Status: Missing, Weak, Present (plus "not captured"). Clause: AS9100D §8.4.3, AS9102 |
| FAI (AS9102 Form 1) | id (UUID in URL), Part Number*, Part Name*, Part Revision (N/A if blank), FAI Report Number (auto, e.g. FAIR-2026-1576064A), Part Type, FAI Type, Reason for FAI, Manufacturing Routing Number, status, preparer signature, evaluator signature | Part Type: Detail, Sub-Assembly, Assembly, COTS, Software. FAI Type: Full, Partial, Delta. Status observed: Draft |
| FAI characteristic (AS9102 Form 3) | Char. No., Ref. Location, Designator, Requirement, Result, Equipment, Pass/Fail, NCR / Disposition, Checks | Designator default None; Pass/Fail: PASS (default) / FAIL |
| Calibration instrument | Record (CAL-YYYY-NNN; user-created CAL-DEMO-xxxxxxxx), equipment name, equipment ID/asset no., type, certificate reference*, last calibration date, next due date, calibrated by, NIST traceability statement*, status (computed) | Type: Caliper, Micrometer, Gauge, Height gauge, CMM, Torque wrench, Surface plate, Test equipment, Other. Status: Active, Due soon, Overdue |
| Training assignment | Role, person, course, source record ("Auto-assigned · <record>"), standard/clause or SOP, due offset, completion date ("Completed YYYY-MM-DD"), status | Status: Current, Due soon, Overdue (expired), Not started |
| Controlled document | Record id (DOC-DEMO-xxxxxxxx), name, document ID/number, revision, type, location (link/description), effective date, next review date (optional), status, approved for release by (required when Released; saved role or custom name) | Type: Work Instruction, Procedure, Drawing, Quality Manual section, Form, Specification, Other. Status: Draft, Under review, Released (KPI also counts Superseded) |
| Approval role | Role name, people[], default for record types | Record types: Supplier Qualification, CAPA, NCMR, Document, FAI, Purchase Order |
| Maturity assessment | 8 dimension ratings (1–5) with level anchor text, answered count, overall score (n.n / 5), band, top 3 gaps (with suggested next step), heatmap, 90-day priority; saved for the session | Bands observed: Defined (3.0); Managed named as the next band |
| Agent task | id (T-xxxx), ts (UTC), module, task, status, latency_ms, confidence, decision, reviewer, tokens, error_code (CSV export) | Status: success, failure, timeout, escalated. Decision: accepted, modified, rejected, n/a. Error code: TIMEOUT_30S, TOOL_ERROR, MODEL_5XX, SCHEMA_MISMATCH, RATE_LIMIT |
| Record detail (sample) | ID, severity, type, title, industry, clause, age, supplier, summary, root-cause candidates (AI hypothesis), actions, citations (clause + why) | — |
| Alert rule | Name, current value, threshold, window, channel, enabled, state | Channel: PagerDuty, Slack, Email. Window: 1h, 24h, 7d |

## 7. Business rules and validations
- **BR-01** Every AI claim carries a clause reference and a "Why this citation:" note. **[Deferred v1.2: AI out of scope]**
- **BR-02** AI content that is not grounded in user input is prefixed "AI hypothesis — confirm:". **[Deferred v1.2: AI out of scope]**
- **BR-03** Where the AI is uncertain about the applicable clause, the output says "clause reference to confirm". **[Deferred v1.2: AI out of scope]**
- **BR-04** Every paste-and-generate action shows "Do not paste ITAR, EAR, CUI or customer-confidential data" and a required checkbox "I confirm this text contains no controlled data". This covers Try your document, /demo, Start my CAPA, Check clauses, Build my FAI record and the CAPA/NCMR create form. **[Changed v1.2]** *Build rule:* the attestation is enforced server-side on every free-text save, not only paste-and-generate actions (BR-44, ADR-0005).
- **BR-05** The action button stays disabled until the checkbox is ticked (and, where applicable, text is present). The CAPA/NCMR create form shows "Tick the controlled-data confirmation to continue." **[Changed v1.2]** *Build rule:* the checkbox remains, and a server-side controlled-data keyword hit additionally blocks the save (BR-44).
- **BR-06** Pasted text is sent to the server and the AI provider for processing and is not retained. Demo records are stored in the browser only. **[Changed v1.2]** *Build rule:* no text is sent to an AI provider (AI out of scope); records are persisted server-side, not in the browser (BR-45, D-03).
- **BR-07** No files are stored. Certificates and documents are recorded as references or links only (e.g. "Where this document lives", calibration certificate reference).
- **BR-08** Every record has an audit timeline: creation, stage changes, AI draft acceptances, reviewer decisions. When signed in, each event writes an immutable activity_log row with the actor and a snapshot. **[Changed v1.2]** *Build rule:* the app writes the audit log append-only, independent of sign-in; corrections are new events, and single-event updates/deletes are denied in every environment. Prod is strictly append-only; dev/stage admins may do full table resets per decision C-1 (BR-46, D-05, ADR-0006). AI draft acceptance events are reserved but not emitted (AI deferred).
- **BR-09** The human quality leader is the reviewer of record. AI outputs are drafts only.
- **BR-10** Segregation of duties: the "Use as is" and "Repair" NCMR dispositions need an independent named approver.
- **BR-11** CAPA/NCMR need a reviewer name ("Your name" + Save). The name is recorded on each step.
- **BR-12** CAPA/NCMR IDs are generated automatically (CAPA-DEMO-xxxx / NCMR-DEMO-xxxx in demo mode). *Build criterion (v1.3):* the ID is system-generated, unique within the workspace, starts with the record-type prefix (`CAPA-`, `NCMR-`, `SCAR-`) and is immutable after create. The production format (year scope, sequential vs random suffix, whether `DEMO` appears) is **pending decision DP-01** (§13.3); ACs must not assert the `DEMO` literal.
- **BR-13** The CAPA/NCMR workflow has 6 steps through the stages New → Containment → Investigation → Draft Ready → QM Review → Closed. The Disposition field appears only for NCMR.
- **BR-14** The "Awaiting your review" list sorts by severity (Critical > Major > Minor), then by age.
- **BR-15** "Threatens delivery" lists open CAPA/NCMR with a need-by date within the next 14 days.
- **BR-16** The supplier risk score blends open SCARs, on-time %, criticality and certificate freshness. Suppliers are ranked worst (lowest score) first. **[Changed v1.2]** *Build rule:* score is deterministic from configurable weights; weights and band cut-offs are configurable, values TBD from Vishwas (BR-47, D-07).
- **BR-17** The Supplier Qualification wizard cannot continue until the supplier name is entered ("Enter the supplier name to continue.").
- **BR-18** The supplier re-evaluation date is tracked and bucketed as overdue / 0–30d / 31–60d / 61–90d on the dashboard. **[Changed v1.2]** *Build rule:* bucket windows are configurable, values TBD from Vishwas (BR-47).
- **BR-19** Approval Roles are a convenience only, not an access-control mechanism.
- **BR-20** Default approvers: Supplier Qualification, CAPA, NCMR and Document → Quality Manager; FAI → Engineering Lead; Purchase Order → Production Supervisor. The default is skipped if it would break segregation of duties.
- **BR-21** The PO clause check evaluates the PO against AS9100D §8.4.3 (and AS9102 for FAI). Each requirement is classified Missing / Weak / Present (or not captured) and comes with suggested wording. **[Deferred v1.2: AI out of scope]** PO check records are entered manually in the build; findings are not AI-generated (overview §2). Manual-entry fields are limited to the observed structure, §13.2.
- **BR-22** FAI Form 1 requires Part Number and Part Name. On Create FAI with them empty, each shows "<Field> is required.", plus "Fill in the highlighted fields to continue: Part Number, Part Name." and a toast "Please fill in: Part Number, Part Name." ([40](screenshots/40-fai-form1-validation-errors.png)). The FAI Report Number is generated automatically if left blank (FAIR-YYYY-xxxxxxxx). Reason for FAI defaults to initial FAI. A new FAI starts in status Draft.
- **BR-23** Calibration "Save to the register" is disabled until an equipment name is entered ("Enter an equipment name."). Certificate reference and NIST traceability statement are required.
- **BR-24** The +6/+12/+24-month next-due buttons stay disabled until a last calibration date is set. When used, they set next due = last date + N months.
- **BR-25** Calibration status is computed from the next-due date: Overdue if past; Due soon inside a window (observed ≤30d, ≤60d and ≤90d buckets, with a 64-day item shown as Due soon); otherwise Active. **[Changed v1.2]** *Build rule:* due-soon windows are configurable, values TBD from Vishwas (BR-47).
- **BR-26** Document Control "Save" is disabled until a document name is entered ("Enter a document name.").
- **BR-27** Training assignments can trace back to a source record (CAPA, NCMR, PO-check finding). Items past their due date show as overdue/expired. Mark complete updates the status.
- **BR-28** The QMS Champion assessment takes a 1–5 rating on each of the 8 dimensions (progress "x/8 answered"). Results were observed only at 8/8; behavior with fewer answers was not captured.
- **BR-29** Agent tasks below the confidence threshold are escalated (routed to a human reviewer), e.g. a confidence of 0.48. **[Deferred v1.2: AI out of scope]** (Agent reliability module deferred, overview §2/§6.)
- **BR-30** An alert rule fires when its metric breaches the threshold over its window. Observed rules: **[Deferred v1.2: AI out of scope]** (Agent reliability alarms deferred, overview §6.)

  | Rule | Current / threshold | Window | Channel | State |
  |---|---|---|---|---|
  | Failure rate spike | 3.3% / 5% | 1h | PagerDuty | Enabled |
  | Timeout budget | 2.1% / 2% | 1h | Slack | Enabled, BREACH (firing) |
  | Latency SLO | 3034 ms / 4000 ms | 24h | Slack | Enabled |
  | Low-confidence drift | 8.8% / 15% | 24h | Email | Enabled |
  | Reviewer rejection rate | 11.3% / 10% | 7d | Email | Disabled (so not firing despite the breach) |

- **BR-31** Records sample data is labelled "ILLUSTRATIVE — SAMPLE RECORDS". *Build rule (v1.4, Vishwas 2026-10-13):* sample/demo data is **allowed in all environments, including prod**. Every sample record is synthetic and carries the "ILLUSTRATIVE — SAMPLE RECORDS" label (and the DEMO badge where observed) so it can never be mistaken for a customer record. See BR-45 for the per-environment data rule.
- **BR-32** Disabled-in-demo actions: none observed beyond the validation gates. AI generate actions were not exercised (user request); Reset demo was not executed.
- **BR-33** FAI sign-off follows AS9102 Rev C segregation: the evaluator must be a different person than the preparer; Sign as Evaluator is disabled until the preparer signs ("Preparer must sign first."). The demo simulates a second person with "Simulate second reviewer" ([41](screenshots/41-fai-record-created-form3.png)).
- **BR-34** FAI Form 3 completeness checks are advisory only; entry and sign-off are not blocked. Empty Reference Location, Result and Equipment cells auto-fill "N/A". A row needs Char. no. and Requirement (and NCR if Fail). *Clarification (v1.3):* the last sentence is the **add-row precondition** observed in the hint "Fill Char. no., Requirement (and NCR if Fail) to add a row" — a row missing these is not committed. The **completeness banner** is a separate advisory check over committed rows and never blocks entry or sign-off. Whether a committed FAIL row can later have its NCR cleared is pending DP-09.
- **BR-35** A supplier cannot go active on the ASL without a named approver: "Approve & add to ASL" is disabled with "Name an approver to continue." ([39](screenshots/39-sq-wizard-step5-approval-gated.png)). Approval date and re-evaluation/expiry date are entered manually at step 5.
- **BR-36** Every SQ step advance is written to the audit trail with timestamp, actor ("Reviewer" when no name is saved) and "Advanced <from> → <to>". Every risk rating is a hypothesis until confirmed. **[Partially deferred v1.2: AI out of scope]** The audit-trail rule stays; AI risk hypotheses are deferred, so ratings are human-entered.
- **BR-37** Releasing a document requires a named approver ("Name an approver to release." / "Pick who approved this release before saving."); saving a Released revision automatically marks any earlier released revision of the same document as Superseded ([44](screenshots/44-document-new-released-approver-required.png)).
- **BR-38** Approver pickers (SQ, Document) list saved Approval Roles or accept a custom free-text name.
- **BR-39** Calibration ID is auto-generated (CAL-DEMO-xxxxxxxx) when Equipment ID is blank; new entries are active immediately. Register KPIs: "Active instruments" = all non-overdue instruments; due-within-30/60/90 buckets are cumulative; Due soon status covers at least 25d and 64d, Active at 147d+ ([43](screenshots/43-calibration-register-after-save.png)).
- **BR-40** Mark complete sets the training row to Current with "Completed <date>", replaces the action with Undo and updates the KPIs. No evidence or verifier is captured ([51](screenshots/51-training-mark-complete-alvarez.png)). *Build rule (v1.3):* Mark complete and Undo are each written as a new audit event (BR-08/BR-46); Undo clears the completion on the assignment (no hard delete, §13.1) and the status is re-derived from the due date as if never completed (in [52](screenshots/52-training-mark-complete-brandt.png) the undone Alvarez row returned to Due soon 12d). Recurrence interval and the "Not started" rule are pending DP-07.
- **BR-41** QMS Champion overall score equals the mean of the 8 ratings in all three observed cases (3.0 → band Defined). Top 3 gaps are the lowest-rated dimensions, with ties resolved in dimension order; the 90-day priority targets the two lowest ([54](screenshots/54-qms-champion-summary-all-3.png), [56](screenshots/56-qms-champion-summary-mixed.png), [57](screenshots/57-qms-champion-summary-leadership-1.png)). Ratings persist for the session; Reset clears them.
- **BR-42** The dashboard "items need attention" count is the number of Needs attention items: overdue/expired or due-soon training, calibration and supplier re-evaluations (8 = 3 + 3 + 2).
- **BR-43** Low-confidence drift counts drafts below 0.75 confidence; a timeout is a task exceeding 30 s (TIMEOUT_30S). **[Deferred v1.2: AI out of scope]**
- **BR-44** **[New v1.2; amended v1.4.1]** Controlled-data gate on all free-text saves: every endpoint that persists free text requires `controlledDataAttestation=true` (missing → rejected, HTTP 400), and a hit on the configurable controlled-data keyword/marker list **blocks the save** (HTTP 422). Neither the text nor the matched substring is logged; only the marker id. The attestation is recorded on the audit event (`controlledDataAttested`). *Matching rule (v1.4, Vishwas 2026-10-13):* **whole-word, case-insensitive** matching (`CUI` does not match "circuit", `EAR` does not match "year"). *Marker list (v1.4):* must include `ITAR`, `EAR`, `CUI`, `22 CFR 120-130` and `15 CFR 730-774`, plus the existing configured markers (`EAR99`, `ECCN`, `NOFORN`, `Distribution Statement`, `export controlled`). The list lives in config (SSM, overview §3). *CFR range markers (v1.4.1 — BA interpretation of Vishwas's 2026-10-13 decision; sign-off pending under DP-03):* the CFR markers are **ranges**, not literals. Any citation whose part number falls within **22 CFR parts 120–130** or **15 CFR parts 730–774** is a hit, including subsections and the "Part" or "§" forms (e.g. `22 CFR 121.1`, `22 CFR Part 126`, `15 CFR § 774.1`). Matching is **case-insensitive**. The implementation may store the ranges as structured data (`title`, `partFrom`, `partTo`), per Developer finding #27. Still pending DP-03: sign-off on this CFR range interpretation, normalisation/evasion cases, screened fields vs exempt IDs/names, attestation on writes without free text, the 422 user message and input retention, and whether the marker id is shown. Source: D-14, [ADR-0005](../architecture/adr/0005-controlled-data-gate-enforcement.md), overview §4.
- **BR-45** **[New v1.2]** Persistence is server-side. In prod, records and audit events are retained for at least 7 years. Dev/stage hold synthetic data only and carry no retention obligation; real customer records must never be loaded there. *v1.4 (reconciled with BR-31):* prod holds customer records and **may also show labeled synthetic sample records** (BR-31). The dev/stage synthetic-only rule is unchanged. Source: D-03 as amended by O-08, [ADR-0003](../architecture/adr/0003-datastore.md), [ADR-0013](../architecture/adr/0013-environment-profiles.md), overview §8.
- **BR-46** **[New v1.2, amended v1.2.2]** The audit log is append-only as application behavior: the app only ever adds events (conditional put) and corrections are new events. Single-event updates and deletes are denied in every environment (IAM explicit deny). Prod is strictly append-only. In dev/stage only, admins may perform full table resets (synthetic data only, BR-45). No WORM/Object Lock archive. Source: D-05, [ADR-0006](../architecture/adr/0006-immutable-audit-log.md); decision C-1 (Vishwas, 2026-10-13).
- **BR-47** **[New v1.2]** Supplier risk weights and score bands (BR-16) and due-soon thresholds (BR-18, BR-25, training) are configurable (SSM parameters), not hard-coded. *v1.4 (Vishwas 2026-10-13):* the build ships with clearly labeled **PLACEHOLDER** default risk weights and due-soon thresholds; the default values live in config (SSM parameters `supplier-risk/weights` and `due-soon-days`, architecture-overview §3 and IaC `20-data.yaml`), each labeled PLACEHOLDER, and are not stated in this BRD. Vishwas will tune the values later (DP-16, overview O-04). Source: D-07, overview §1/§3.
## 8. User stories and acceptance criteria

### 8.1 Governance (cross-cutting)
- **US-01** As a quality leader, I want every AI claim cited to a clause so I can verify it. **[Deferred v1.2: AI out of scope]**
  - *Given* an AI-generated output, *When* it is displayed, *Then* each claim shows a clause reference and a "Why this citation:" note (BR-01).
  - *Given* content not present in my input, *Then* it is prefixed "AI hypothesis — confirm:" (BR-02).
- **US-02** As a user, I must confirm that my pasted text has no controlled data before it is processed. **[Changed v1.2]** Build: applies to every free-text save; a controlled-data keyword hit blocks the save even when the box is ticked (BR-44).
  - *Given* any paste-and-generate box, *When* the checkbox is unticked, *Then* the action button is disabled and the ITAR/EAR/CUI warning is visible.
  - *When* I tick it (and enter text), *Then* the button is enabled (BR-04/05).
  - *Build (BR-44):* *Given* any free-text save request without `controlledDataAttestation=true`, *Then* it is rejected with HTTP 400 and nothing is persisted. *Given* the attestation and text containing a configured marker, *Then* it is rejected with HTTP 422, no record or audit event is written, and neither the text nor the matched substring is logged. The user-facing 422 message and whether the form keeps the input are pending DP-03.
- **US-03** As an auditor, I want an audit timeline on every record. **[Changed v1.2]** Build: events are append-only (BR-46); AI draft acceptance events are reserved, not emitted.
  - *Given* a record is created, *Then* the timeline shows "Created · <reviewer> · stage: new" with a timestamp.
  - *When* the stage changes or an AI draft is accepted, *Then* a new event is appended (BR-08).

### 8.2 Marketing and public tools
- **US-04** As a prospect, I want to compare Sentinel QA with competitors.
  - *Given* /compare, *Then* I see a comparison table with values Yes / Partial / No / Not verified. *Seed check:* the observed page shows 9 criteria × 7 products; the cell content is not in this BRD, so the table content is pending DP-05.
- **US-05** As a prospect, I want to try my own document. **[Deferred v1.2: AI out of scope]** (/try-your-document hidden or static, overview A-10.)
  - *Given* /try-your-document, *When* I pick a doc type, paste text and tick the confirmation, *Then* Check clauses is enabled.
  - *When* the box is unticked or the text is empty, *Then* the button is disabled.
- **US-06** As a prospect, I want to start a pilot. *Given* /pricing, *Then* a single Pilot card (60–90 days) offers "Email us about a pilot".
- **US-07** As a prospect, I want to chat with the agent. *Given* /demo, *Then* I see 4 prompt cards, Session history (0) and the ITAR/EAR warning. **[Deferred v1.2: AI out of scope]** (/demo hidden or static, overview A-10.)

### 8.3 Dashboard
- **US-08** As a QM, I want one place showing what needs attention.
  - *Given* /app/aerospace, *Then* the headline count equals the number of items in the Needs attention list, and each item is tagged Overdue or Due soon. *Build criterion:* count = number of training, calibration and supplier re-evaluation items whose derived status is Overdue or Due soon (BR-42). *Seed check (demo fixture, §13.4):* with the BRD sample data the count is 8 (3 + 3 + 2).
- **US-09** As a QM, I want to know which CAPA/NCMR threaten delivery. *Given* no open record has a need-by date within 14 days, *Then* the empty-state text is shown.

### 8.4 Records
- **US-10** As a QM, I want to filter records. *When* I pick Type, Severity, Status or Standard, *Then* the list shows only matching records.
- **US-11** As a QM, I want my review queue prioritised. *Given* records awaiting review, *Then* they are sorted by severity and then age, with clause and days left (BR-14).
- **US-12** As a QM, I want trends. *Then* I see opened vs closed (12 weeks), severity mix, a by-standard view and a clause Pareto.

### 8.5 NCMR / CAPA
- **US-13** As an inspector, I want to start an NCMR.
  - *Given* the NCMR list, *When* I click Start a new NCMR, *Then* /app/aerospace/capa/new?type=NCMR opens at "Step 1 of 6", with an auto ID that starts with `NCMR-` (BR-12) and a Disposition selector.
- **US-14** As a reviewer, I want my name recorded. *When* I enter "Your name" and Save, *Then* that name is attributed on each step and in the timeline.
- **US-15** As a user, I cannot create a record without the controlled-data confirmation. *Given* the box is unticked, *Then* "Create record & continue →" is disabled and shows "Tick the controlled-data confirmation to continue." **[Changed v1.2]** Build: in addition, a controlled-data keyword hit blocks the save (BR-44).
- **US-16** As a QM, I need independent approval for risky dispositions. *Given* the NCMR disposition is Use as is or Repair, *Then* an independent named approver is required (BR-10).
- **US-17** As a quality engineer, I want to draft a CAPA from pasted text. **[Partially deferred v1.2: AI out of scope]** "Start my CAPA" paste-to-draft is deferred; Start a new CAPA form stays in scope.
  - *Given* Corrective Actions, *When* I paste text and confirm, *Then* Start my CAPA is enabled.
  - *Else* I can Start a new CAPA (auto ID starting `CAPA-`, BR-12).

### 8.6 Supply Chain
- **US-18** As supplier quality, I want suppliers ranked by risk. *Then* the list is ordered by ascending score and can be filtered by standard.
- **US-19** As supplier quality, I want a risk narrative. *When* I open a supplier, *Then* I see the score band, cert renewal days, flags (SCARs, FAI failures) and a recommended next step. **[Partially deferred v1.2: AI out of scope]** The AI risk narrative is deferred; the deterministic score, band, cert days, flags and next step remain (BR-47).

### 8.7 Supplier Qualification
- **US-20** As supplier quality, I want to see the ASL. *Given* the Active on ASL tab, *Then* approved suppliers are listed with scope and re-evaluation date (+ days remaining).
- **US-21** As supplier quality, I want to start a qualification.
  - *Given* the New wizard at step Request, *When* the supplier name is empty, *Then* Continue is disabled with "Enter the supplier name to continue."
  - *When* it is filled, *Then* I can continue to Docs & certs.
- **US-38** As a QM, I want supplier approval to be explicit. *Given* step 5 Approval decision, *When* no named approver is selected, *Then* "Approve & add to ASL" is disabled with "Name an approver to continue."; each step advance is logged in the audit trail.

### 8.8 Purchase Controls
- **US-22** As a buyer, I want a PO checked against §8.4.3. **[Deferred v1.2: AI out of scope]** "Check clauses" AI check deferred; PO check findings are entered manually (overview §2).
  - *Given* pasted PO text and the confirmation, *When* I click Check clauses, *Then* I get summary counts (missing/weak/present) and findings with clause, suggested wording and why-citation.
  - Findings can be filtered by status and clause.

### 8.9 FAI
- **US-23** As an inspector, I want to create AS9102 Form 1.
  - *Given* Form 1, *When* I click Create FAI with Part Number or Part Name empty, *Then* the FAI is not created, each empty field shows "<Field> is required.", and a summary line and toast list the missing fields.
  - *When* the FAI Report Number is blank, *Then* it is generated automatically.
- **US-34** As an inspector, I want the FAI record created from Form 1. *When* Create FAI succeeds, *Then* the record page shows the Form 1 summary (auto report number, status Draft), approval actions and an empty Form 3 grid.
- **US-35** As a QM, I want preparer/evaluator segregation on FAI. *Given* the preparer has not signed, *Then* Sign as Evaluator is disabled with "Preparer must sign first.", and the evaluator must be a different person.
- **US-36** As an inspector, I want to key in Form 3 characteristics quickly. *Then* the grid supports Tab/Enter keyboard entry, auto-fills N/A, and shows advisory completeness issues without blocking sign-off.
- **US-24** As an inspector, I want to build an FAI from pasted text. *Then* Build my FAI record is disabled until the confirmation is ticked. **[Deferred v1.2: AI out of scope]**

### 8.10 Calibration
- **US-25** As a metrology owner, I want overdue gauges surfaced. *Then* KPIs and the All / Due soon / Overdue tabs reflect the status computed from the next-due date.
- **US-26** As a metrology owner, I want to register an instrument.
  - *Given* the form, *When* the equipment name is empty, *Then* Save is disabled with "Enter an equipment name."
  - *When* the last date is set, *Then* the +6/+12/+24 buttons fill in the next due date.
  - Certificate reference and NIST statement are required.
  - *When* I set last date 01/15/2026 and click +24 months, *Then* next due becomes 01/15/2028; *When* I save, *Then* the register shows a new Active row with an auto-generated unique ID (format pending DP-01) and the KPIs update.

### 8.11 Training
- **US-27** As a training coordinator, I want a role-to-training matrix. *Then* each row shows role·person, course, source record, standard, due and status, with a Mark complete action.
- **US-28** *When* I click Mark complete, *Then* the row shows "Completed <date>", status Current, the action becomes Undo, and the KPIs update; *When* I click Undo, *Then* the row returns to the status derived from its due date and both actions appear in the audit trail (BR-40). *Seed check:* observed for M. Alvarez and L. Brandt.

### 8.12 Document Control
- **US-29** As a document controller, I want to register a controlled document. *When* the name is empty, *Then* Save is disabled with "Enter a document name." Location is a link or description (no upload).
- **US-37** As a QM, I want released documents to have a named approver. *Given* Status = Released and no approver, *Then* Save is disabled with "Name an approver to release."; *When* I choose a role or type a custom name, *Then* Save is enabled and earlier released revisions are superseded automatically.

### 8.13 Approval Roles
- **US-30** As a QM, I want default approvers per record type.
  - *When* I quick-add roles and people, *Then* the defaults map as in BR-20.
  - *Given* a default would make the author also the approver, *Then* the default is skipped.

### 8.14 QMS Champion
- **US-31** As a QM, I want a maturity self-assessment. *When* I rate all 8 dimensions 1–5, *Then* I get an overall score with band, top 3 gaps with next steps, a heatmap and a 90-day priority, marked draft assistance. *Build criterion:* overall = mean of the 8 ratings; top 3 gaps = lowest ratings, ties in dimension order (BR-41). *Seed check:* all 3s → 3.0 / 5 Defined. Band thresholds other than Defined and the mean's rounding are pending DP-06. **[Partially deferred v1.2: AI out of scope]** Deterministic score, gaps and heatmap stay (BR-41); "Ask the agent to draft a full gap-closure plan" is deferred.

### 8.15 Agent reliability
- **US-32** As an ops owner, I want agent KPIs and alerts. *Then* I see 24h KPIs, firing alerts with their channel, a rules table and a filterable task log; Export CSV downloads the log. **[Deferred v1.2: AI out of scope]**
- **US-39** As an ops owner, I want to export the task log. *When* I click Export CSV, *Then* I get one row per logged task with id, UTC timestamp, module, task, status, latency_ms, confidence, decision, reviewer, tokens and error_code. **[Deferred v1.2: AI out of scope]**
- **US-40** As a QM, I want to open a sample record. *When* I click a record in Records, *Then* a drawer shows summary, AI-hypothesis root causes, actions and citations with "Why this citation". **[Partially deferred v1.2: AI out of scope]** Drawer stays; "Continue drafting in the agent" is deferred.
- **US-41** As any user, I want to jump anywhere. *When* I press ⌘K, *Then* a palette lets me search records, modules and docs. **In scope (v1.4, Vishwas 2026-10-13).** *Build criterion:* for the pilot, ⌘K search runs **client-side** over the lists already loaded in the browser (records, modules, docs); there is no server search endpoint. Results are limited to loaded data.
- **US-33** *Given* task confidence is below the threshold, *Then* the task is Escalated to a human and the reviewer's decision is logged. **[Deferred v1.2: AI out of scope]**

## 9. Non-functional and compliance notes (observed)
- **Data protection:** ITAR/EAR/CUI warning plus a mandatory confirmation. Pasted text is not retained. Demo data lives in browser storage only. No file storage.
- **Auditability:** append-only timeline; immutable activity_log with actor and snapshot when signed in; printable CAPA/NCMR view.
- **AI governance:** citations, hypothesis flagging, uncertainty hedging, a published validation summary with known limitations, a human reviewer of record, and confidence-based escalation.
- **Observability:** reliability dashboard with SLO-style alerts (PagerDuty, Slack, Email); average latency of about 3 s.
- **Privacy:** first-party analytics only, "no advertising trackers"; consent notice with an OK button.
- **Positioning disclaimer:** "draft assistance, not regulatory judgment"; not a substitute for a certification body.
- **UX:** responsive web app; ⌘K search; demo mode clearly badged (DEMO, ILLUSTRATIVE).

## 10. Coverage notes
- **Pass 1 (screenshots 01–30):** all public marketing pages, the public tool entry screens, the workspace dashboard and every sidebar module's landing page, and step 1 of the create forms (NCMR, CAPA, calibration, supplier qualification, FAI Form 1, document).
- **Pass 2 (screenshots 31–58 + 1 CSV), non-AI workspace flows:** home Reliability / ROI / clause cards / How it works / digest / FAQ; Records detail drawer and status board; ⌘K palette; Demo utilities menu; SQ wizard steps 2 and 5 (approval gate); FAI Form 1 validation, a created FAI record with sign-off and Form 3; calibration +24 months and the register after save; document release approver gate and saved edit view; "How outputs are governed"; supplier details for AeroFast and AeroWire; training baseline (incl. D. Rivera) and Mark complete; QMS Champion ratings and three maturity summaries; reliability Export CSV. The second pass produced 34 captures; 5 duplicates/near-duplicates were removed, leaving 28 screenshots + the CSV.
- **Totals:** 58 screenshots + 1 CSV. OQs: 6 answered, 13 partially answered, 5 still open (§11).
- **Deliberately not run (user request):** all AI generate flows — /demo prompts, Check clauses, Try a sample, Start my CAPA, Build my FAI record, "Ask about <module>", "Continue drafting in the agent", "Ask the agent to draft a full gap-closure plan", "Try the agent". AI-labelled content in this BRD is sample data or a locally computed summary.
- **Not reached / not captured:** the sign-in-gated workspace; CAPA/NCMR steps 2–6 and print view; SQ steps 3, 4 (contents) and 6; FAI Form 2, signing, and Print FAI; the Document Control register after save; the effect of Reset demo; Mark complete on the D. Rivera row; Precision Heat detail; session history; the full ⌘K list (it scrolls).
## 11. Open questions
Status legend: **Answered** · **Partially answered** · **Still open** (with reason: AI-gated, login-gated, or not observable) · v1.2: **Closed** / **Resolved — configurable** / **Deferred** (scope decisions, §12). Observed answers are unchanged.

| OQ | Status | Answer / what is still missing | Evidence |
|---|---|---|---|
| OQ-01 Supplier risk score weighting and bands | **Resolved v1.2 — configurable, values pending** | Bands observed: At risk (48), Watch (62), Approved (84). Narratives cite on-time % and cert renewal days; flags cite open CAPAs and sub-tier ASL status. Weights and band cut-offs are not shown (not observable). **v1.2:** Weights and band cut-offs are configurable (D-07, BR-47); values pending from Vishwas (overview O-04). | [48](screenshots/48-supply-chain-aerofast-detail.png), [49](screenshots/49-supply-chain-aerowire-detail.png), [12](screenshots/12-supply-chain.png) |
| OQ-02 "Due soon" thresholds | **Resolved v1.2 — configurable, values pending** | Calibration: Due soon at 25d and 64d, Active at 147d+; register buckets are cumulative (≤90d = 2), consistent with a 90-day window. Supplier re-eval: Due soon at 18d and 53d. Training: Due soon at 12d, Current at 90d and 340d. Exact thresholds per module are not stated. **v1.2:** Due-soon thresholds are configurable per module (D-07, BR-47); values pending from Vishwas (overview O-04). | [43](screenshots/43-calibration-register-after-save.png), [37](screenshots/37-workspace-demo-utilities-menu.png), [50](screenshots/50-training-matrix-baseline-rivera-row.png) |
| OQ-03 Segregation of duties | Partially answered | Additional SoD/approval points: FAI evaluator must differ from preparer (AS9102 Rev C), evaluator cannot sign before preparer; supplier needs a named approver before ASL; released documents need a named approver. Enforcement is by named individuals only (demo offers "Simulate second reviewer"; Approval Roles is not a permission system). Which roles count as independent and QM Review closure rules remain unobserved. | [41](screenshots/41-fai-record-created-form3.png), [39](screenshots/39-sq-wizard-step5-approval-gated.png), [44](screenshots/44-document-new-released-approver-required.png) |
| OQ-04 Persistence model | **Closed v1.2** | Demo: "Saved in this browser for the demo", "Your name … Saved in this browser only", QMS ratings "Saved for this session", "Records you create stay in your browser". Signed-in: authenticated register writes immutable activity_log rows. Migration, export and retention are still open (login-gated). **v1.2:** Server-side persistence; 7-year retention in prod only; dev/stage synthetic only (D-03 amended by O-08, ADR-0003, ADR-0013, BR-45). | [42](screenshots/42-calibration-new-instrument-plus24mo.png), [35](screenshots/35-records-status-board.png), [47](screenshots/47-validation-how-outputs-governed.png) |
| OQ-05 AI provider / model / region | **Deferred v1.2 (AI out of scope)** | Only "pasted text is sent to an AI provider and not retained" is stated; no provider, terms or region shown. **v1.2:** No AI provider in this build (D-01, ADR-0004 Deferred); reopen with AI. | [35](screenshots/35-records-status-board.png) |
| OQ-06 CAPA/NCMR steps 2–6 | Partially answered | The sample NCMR-2026-0087 drawer shows the drafted content structure (summary with proposed disposition, AI-hypothesis root causes, actions, citations), and the status board shows one sample per stage. The step 2–6 screens and when drafting occurs were not captured (AI-gated). | [34](screenshots/34-records-ncmr-2026-0087-detail.png), [35](screenshots/35-records-status-board.png) |
| OQ-07 Supplier Qualification steps 2–6 | Partially answered | Step 2: free-text documentation & certification review. Step 5: required named approver (saved role or custom name), approval scope, approval date and re-evaluation/expiry date entered manually; "Approve & add to ASL" gated on approver. Steps advance with audit-trail entries. Steps 3/4 contents and step 6 were not captured. | [38](screenshots/38-sq-wizard-step2-docs-certs.png), [39](screenshots/39-sq-wizard-step5-approval-gated.png) |
| OQ-08 FAI Forms 2 and 3 | Partially answered | Form 3 (Characteristic accountability) is live on the FAI record page as an Excel-style grid with advisory completeness checks. Form 2 was not observed. | [41](screenshots/41-fai-record-created-form3.png) |
| OQ-09 QMS Champion score / 90-day plan | Partially answered | Overall score equals the mean of the 8 ratings in all three observed sets (3.0 → "Defined"; "Managed" is the next band). Top 3 gaps = lowest ratings (ties in dimension order); 90-day priority targets the two lowest. Other band thresholds and the full gap-closure plan (via the agent) are still open (AI-gated). | [54](screenshots/54-qms-champion-summary-all-3.png), [56](screenshots/56-qms-champion-summary-mixed.png), [57](screenshots/57-qms-champion-summary-leadership-1.png) |
| OQ-10 Records sample vs user-created records | Partially answered v1.4 | Records still shows only the 6 sample records; whether user-created module records appear there was not observed. **v1.4:** labeled sample records are allowed in all environments, including prod (BR-31, BR-45); whether user-created records appear in Records is still open. | [35](screenshots/35-records-status-board.png) |
| OQ-11 Dashboard "items need attention" | Answered | 8 = the 8 Needs attention items: 3 training (2 expired, 1 due soon), 3 calibration (1 overdue, 2 due soon), 2 supplier re-evaluations due soon. These match the tiles (Supplier 2, Training 3, the 3 non-Active of 5 instruments). | [37](screenshots/37-workspace-demo-utilities-menu.png) |
| OQ-12 FAI Form 1 errors | Answered | "Part Number is required." / "Part Name is required." under red-outlined fields, "Fill in the highlighted fields to continue: Part Number, Part Name." and a toast "Please fill in: Part Number, Part Name." | [40](screenshots/40-fai-form1-validation-errors.png) |
| OQ-13 Controlled-data confirmation in audit trail | **Closed v1.2 (resolved by architecture-overview §4 / ADR-0005)** | The audit trails seen (SQ) show stage advances only; no paste flow was run (AI-gated). **v1.2:** Resolved: the build logs the attestation; the build records `controlledDataAttested` on audit events for non-AI free-text saves (ADR-0005, overview §4; overview O-07 lists OQ-13 as "we log attestation"). | [39](screenshots/39-sq-wizard-step5-approval-gated.png) |
| OQ-14 ASL gate integration / roadmap timeline | Still open — not observable | SQ approval adds the supplier to the ASL, but the PO ASL gate is still roadmap and no timeline is published. | [39](screenshots/39-sq-wizard-step5-approval-gated.png) |
| OQ-15 Training auto-assignment live vs seeded | Partially answered | Rows carry "Auto-assigned · CAPA-2026-0031 / NCMR-2026-0082 / PO clause-check finding", and the matrix says "3 auto-generated from CAPAs or PO findings", while "CAPA-driven training assignment" is still badged ROADMAP. Whether new records generate assignments was not observable. | [50](screenshots/50-training-matrix-baseline-rivera-row.png) |
| OQ-16 What Mark complete records | Answered | A completion date ("Completed 2026-10-13"), status Current, an Undo action and KPI updates. No evidence reference or verifier is requested. (The date appears to be the UTC date; the capture was taken on the evening of Oct 12 CT.) | [51](screenshots/51-training-mark-complete-alvarez.png), [52](screenshots/52-training-mark-complete-brandt.png) |
| OQ-17 Document lifecycle | Partially answered | Releasing needs a named approver, and "any earlier released revision of the same document is marked superseded automatically". Next review date is optional; reminders and revision linking were not observed. | [44](screenshots/44-document-new-released-approver-required.png), [46](screenshots/46-document-saved-edit-view.png) |
| OQ-18 Escalation threshold / editable rules | Partially answered | Low-confidence threshold is 0.75 ("Drafts below 0.75 confidence (should escalate)"); 8.75% of exported tasks are below it. Escalated tasks in the CSV include confidences 0.76–0.85, so escalation is not solely confidence-based. Rule editing was not observed. | [58](screenshots/58-reliability-export-csv.png), [CSV](screenshots/58-reliability-task-log-export.csv) |
| OQ-19 Export CSV contents / range | Answered | All 240 logged tasks, 11 columns (id, ts UTC, module, task, status, latency_ms, confidence, decision, reviewer, tokens, error_code), spanning about 28 h (2026-10-11 21:02Z → 2026-10-13 00:56Z) despite the "last 24h" label. Figures reconcile with the page KPIs (§4.17). | [CSV](screenshots/58-reliability-task-log-export.csv), [58](screenshots/58-reliability-export-csv.png) |
| OQ-20 Demo utilities / ⌘K | Answered | Demo utilities: Send feedback, Reset demo (effect not executed). ⌘K: "Search records, modules, docs…" with a Modules list (Workspace, Records, Supply Chain, Purchase Controls, Training, QMS Champion, more on scroll). | [37](screenshots/37-workspace-demo-utilities-menu.png), [36](screenshots/36-cmdk-command-palette.png) |
| OQ-21 Print view as controlled record | Still open — not observable | A "Print FAI" button exists on the FAI record; neither the CAPA nor the FAI print output was opened. | [41](screenshots/41-fai-record-created-form3.png) |
| OQ-22 Industry filter beyond Aerospace | Partially answered | The FAQ says API Spec Q1/Q2 (oil & gas) and medical-device standards are in early access, but the workspace and the Records Industry filter still show only Aerospace. | [33](screenshots/33-home-faq-expanded.png), [35](screenshots/35-records-status-board.png) |
| OQ-23 SCAR creation path | Partially answered | Sample NCMR-2026-0087 proposes "scrap + SCAR" and an action "Issue SCAR (AS9100D §8.7.2) with 30-day corrective action", which suggests SCARs originate from NCMRs. No SCAR create entry point was observed. | [34](screenshots/34-records-ncmr-2026-0087-detail.png) |
| OQ-24 How it works / ROI / FAQ | Answered | How it works: a 3-step loop (describe → agent drafts → quality leader decides). ROI: records/month × manual minutes vs ~90 s; defaults 20 × 90 → 29.5 h/month, 354 h/yr, 44.3 days/yr; reviewer time not deducted. FAQ: does not replace the QM; standards coverage; public demo, do not paste ITAR/EAR data. See §4.2. | [31](screenshots/31-home-roi-calculator-default.png), [32](screenshots/32-home-how-it-works.png), [33](screenshots/33-home-faq-expanded.png) |
| OQ-25 Overdue rule for CAPA/NCMR dueDate | Still open — not observed (v1.4.2) | Overdue rule for CAPA/NCMR dueDate: not observed; should past-due CAPA/NCMR be flagged and counted like BR-42 items? Observed: the dashboard Needs attention list, its Overdue/Due soon badges and the "8 items need attention" count (BR-42) cover only training, calibration and supplier re-evaluations; the Awaiting review tile shows "0 CAPA / NCMR" with no overdue split; "Threatens delivery (14 days)" uses the need-by date, not the due date (BR-15) and was empty. Records shows only "9d left"/"12d left" in Awaiting your review (BR-14); no Overdue badge, red date, overdue count or due/overdue filter (filters: Type, Industry, Severity, Status, Standard). The NCMR and CAPA modules were empty and the step-1 forms show no due-date field. Architect finding #29 (DEV-29): `dueDate` is now indexed in GSI2 `dueAt`, but no rule uses it. Pending DP-20. | [08](screenshots/08-workspace-dashboard.png), [09](screenshots/09-records.png), [35](screenshots/35-records-status-board.png), [34](screenshots/34-records-ncmr-2026-0087-detail.png), [10](screenshots/10-ncmr.png), [11](screenshots/11-capa.png), [25](screenshots/25-new-ncmr-form.png), [26](screenshots/26-new-capa-form.png) |

## 12. v1.2 scope decisions
Decided during architecture (2026-10-13). Sources: [architecture-overview.md](../architecture/architecture-overview.md) §2, §4, §6, §8, §12 and the cited ADRs. Observed findings in §1–§11 are unchanged; build rules are tagged inline.

| # | Decision | Source | BRD effect |
|---|---|---|---|
| 1 | All AI generate/draft flows are **out of scope** for this build. An AI seam is reserved: `/api/ai/*` route (not routed), `src/ai/` `DraftProvider` interface with no implementation, `draft`/`aiAssisted:false` record fields and reserved audit event types `AI_DRAFT_ACCEPTED/MODIFIED/REJECTED`. /demo and /try-your-document are hidden or static | D-01, D-04, [ADR-0004](../architecture/adr/0004-ai-provider.md), overview §2, §6, A-10 | Deferred: BR-01, BR-02, BR-03, BR-21, BR-29, BR-30, BR-43; US-01, US-05, US-07, US-22, US-24, US-32, US-33, US-39. Partially deferred: BR-36; US-17, US-19, US-31, US-40. OQ-05 deferred; OQ-13 closed (attestation logged, BR-44) |
| 2 | Persistence is **server-side**. 7-year retention applies to **prod only**; dev/stage use synthetic data only | D-03 (amended by O-08), [ADR-0003](../architecture/adr/0003-datastore.md), [ADR-0013](../architecture/adr/0013-environment-profiles.md), overview §8 | New BR-45; changed BR-06; OQ-04 closed |
| 3 | A controlled-data keyword hit **blocks the save on all free-text saves**, in addition to the confirmation checkbox (attestation enforced server-side) | D-14, [ADR-0005](../architecture/adr/0005-controlled-data-gate-enforcement.md), overview §4 | New BR-44; changed BR-04, BR-05, US-02, US-15 |
| 4 | Supplier risk weights/bands and due-soon thresholds are **configurable**; values TBD from Vishwas | D-07, overview §1, §3, O-04 | New BR-47; changed BR-16, BR-18, BR-25; OQ-01/OQ-02 resolved as configurable |
| 5 | The audit log is **append-only** (no update/delete; no WORM archive) | D-05, [ADR-0006](../architecture/adr/0006-immutable-audit-log.md) | New BR-46; changed BR-08, US-03 |

Still open OQs: OQ-03, 06, 07, 08, 09, 10, 14, 15, 17, 18, 21, 22, 23 (consistent with overview O-07). Answered OQs (11, 12, 16, 19, 20, 24) are unchanged.

## 13. v1.3 review responses and build clarifications
Responses to the BA-owned findings in [developer-review.md](../reviews/developer-review.md) (be0a8d5), [ba-review.md](../reviews/ba-review.md), [qa-review.md](../reviews/qa-review.md), [infra-review.md](../reviews/infra-review.md) and [architect-review.md](../reviews/architect-review.md). Mapping per finding: [ba-responses.md](../reviews/ba-responses.md). Nothing here adds observed behavior; unresolved items are listed in §13.3.

### 13.1 Removal, undo and resets (decided by architecture)
- Domain-record deletes are denied in **every** environment (architecture, confirmed by Architect 2026-10-13; `30-api.yaml`). Every remove or undo in the app is therefore a **soft delete / reversal**: the item is marked removed or reverted and a new audit event is appended (BR-08, BR-46). This applies to Approval Roles "Remove role" and "remove person" (§4.14), Training Undo (BR-40) and removing a Form 3 row (US-36). Removed items are excluded from lists, counts and pickers.
- Corrections to any record are new audit events; prior events are never changed (BR-46).
- Full dev/stage table resets (BR-46, C-1) are an **operator action via the InfraDeploy reset script**, not an app feature and not available in prod.

### 13.2 Manual PO-check entry (BR-21, US-22) — observed fields only
Fields are limited to what the observed PO check shows (§4.9, §6). Types, lengths and required flags beyond this are **not** specified (DP-04).
- **PO header:** PO number, supplier, part, quantity, revision (observed as free text, e.g. "Rev C (not stated on PO)").
- **Findings grid, one row per requirement:** requirement; clause (AS9100D §8.4.3 or AS9102); status (Missing / Weak / Present / Not captured); suggested wording; "Why this citation" note.
- **Summary counts** are derived from the rows (count per status), not entered.
- Filters: status and clause (US-22).
- Free-text fields (requirement, suggested wording, why-citation, revision) are subject to the controlled-data gate (BR-44).

### 13.2a Not specified — blocked on Vishwas
- **CAPA/NCMR steps 2–6** field specs (Containment, Investigation, Draft Ready, QM Review, Closed) and **SQ steps 3 (Risk), 4 (Evaluation) and 6 (Active on ASL)** were not observed (OQ-06, OQ-07). No fields are specified here. **Blocked on DP-02.** Until decided, the build covers step 1 (§4.6), SQ steps 1, 2 and 5 (§4.8) and a generic stage advance that writes the audit event (BR-36).

### 13.3 Decisions pending (Vishwas)
| # | Decision | Findings |
|---|---|---|
| DP-01 | Record ID/number format per entity: prefix, year scope, sequential vs random suffix, `DEMO` literal; uniqueness of user-entered IDs (Equipment ID, Document number) | DEV-10, QA-15, BA-15 |
| DP-02 | Field specs for CAPA/NCMR steps 2–6 and SQ steps 3/4/6; stage transition rules (backward moves, skipping, who closes, disposition before Closed, SQ re-evaluation cycle) | DEV-04, QA-14, BA-08 |
| DP-03 | **Partially resolved v1.4 / v1.4.1** (matching = whole-word, case-insensitive; marker list incl. ITAR, EAR, CUI, 22 CFR 120-130, 15 CFR 730-774; BR-44). *v1.4.1:* CFR markers interpreted as ranges (any citation with part number in 22 CFR 120–130 or 15 CFR 730–774 is a hit, incl. subsections and Part/§ forms; case-insensitive; BA interpretation of Vishwas 2026-10-13; **sign-off pending**). Implementation may store ranges as structured data (`title`, `partFrom`, `partTo`) per DEV #27. Still pending: DP-03 sign-off on CFR range interpretation, normalisation/evasion cases, screened fields vs exempt IDs/names, attestation on writes without free text, 422 user message and input retention, whether the marker id is shown | DEV-13, DEV-27, QA-03, QA-04, QA-20 |
| DP-04 | Field-level limits (lengths, allowed characters) incl. reviewer name and PO-check fields | QA-16, DEV-04 |
| DP-05 | /compare table content and the "Simulate second reviewer" control in the build (keep or remove); published seed fixtures (v1.4: sample data allowed in all envs, BR-31) | DEV-11 |
| DP-06 | QMS maturity bands other than Defined, rounding of the mean, results with < 8 answers | QA-08, DEV-11 |
| DP-07 | Training recurrence interval, "Not started" / start-by rule | DEV-22, QA-24 |
| DP-08 | Segregation of duties: definition of "independent" approver and "author"; hard block vs warning; name comparison (case/whitespace/initials) | DEV-15, QA-07, QA-25 |
| DP-09 | FAI edits after sign-off, un-sign, FAIL row NCR clearing | QA-25 |
| DP-10 | Supplier master data: create/edit story; on-time % and open SCAR count entered or derived; SQ ↔ Supplier ↔ SCAR linking; deterministic flags and next step | DEV-12, BA-12 |
| DP-11 | Edit semantics for keyed records: changing Document number/revision, re-release of same or older revision, "same document" for supersede | DEV-14, QA-13 |
| DP-12 | Date/time: workspace timezone for "today" and day counts, inclusive/exclusive threshold boundaries, due-today status, +N months end-of-month rule | DEV-21, QA-23 |
| DP-13 | Review-queue age direction and basis (openedAt vs due date); filter combination (AND?) and empty state; supplier score tie-break | QA-10, QA-11 |
| DP-14 | Trend definitions: week boundaries, "opened", Pareto cut | QA-09 |
| DP-15 | **Resolved v1.4:** client-side over loaded lists, no server endpoint (US-41) | QA-12 |
| DP-16 | **Partially resolved v1.4:** PLACEHOLDER defaults in config (BR-47). Still pending: tuned values from Vishwas, band cut-offs and schema | QA-01 |
| DP-17 | Data source for dashboard tiles "FAI sign-off pending" and "Effectiveness checks due" (no effectiveness-check entity observed) | BA-16 |
| DP-18 | /demo and /try-your-document: hidden or static (O-06) | QA-27 |
| DP-19 | SQ date validation: re-evaluation before approval date, future approval date | QA-24 |
| DP-20 | Overdue rule for CAPA/NCMR dueDate: not observed; should past-due CAPA/NCMR be flagged and counted like BR-42 items? (OQ-25; `dueDate` indexed in GSI2 `dueAt` per Architect finding #29) | DEV-29 |

### 13.4 Build criteria vs demo-seed checks
ACs in §8 are build criteria unless marked *Seed check*. A seed check holds only against the BRD sample data (§4) loaded as a labeled synthetic fixture (v1.4: allowed in any environment, including prod, per BR-31/BR-45); it is not a build requirement. Seed checks in v1.3: US-04 (9 × 7), US-08 (8), US-28 (Alvarez/Brandt), US-31 (3.0 Defined), US-26 (01/15/2026 + 24 months = 01/15/2028 is a rule example and holds without seed). Fixture publication is pending DP-05.

### 13.5 v1.4 decisions (Vishwas, 2026-10-13)
| # | Decision | BRD change | Closes |
|---|---|---|---|
| 1 | Sample/demo data allowed in all environments, including prod (labeled) | BR-31, BR-45, OQ-10, §13.4 | BA-15 (seed part) |
| 2 | ⌘K search is client-side over loaded lists for the pilot; no server search endpoint | US-41 in scope | DP-15, QA-12, BA-10 |
| 3 | PLACEHOLDER default risk weights and due-soon thresholds in config, tuned later | BR-47 | QA-01; DP-16 partial |
| 4 | Keyword gate: whole-word, case-insensitive; markers incl. EAR, 22 CFR 120-130, 15 CFR 730-774. *v1.4.1 BA interpretation (sign-off pending DP-03):* CFR markers are ranges (part numbers within 22 CFR 120–130 / 15 CFR 730–774), incl. subsections and Part/§ forms; case-insensitive; may store as structured (`title`, `partFrom`, `partTo`) per DEV #27 | BR-44 | QA-03, BA-04; DP-03 partial; DEV-27 (BA part) |

## 14. Changelog
| Version | Date | Summary |
|---|---|---|
| 1.0 | 2026-10-12 | Initial as-built BRD from the first exploration pass (screenshots 01–30). |
| 1.1 | 2026-10-12 | Second pass of non-AI workspace flows (screenshots 31–58, reliability CSV); OQ statuses updated. |
| 1.2 | 2026-10-13 | Architecture scope decisions (§12): AI generate/draft flows deferred with `/api/ai/*` seam; server-side persistence with prod-only 7-year retention; controlled-data keyword hit blocks all free-text saves (BR-44); configurable risk weights/bands and due-soon thresholds (BR-47); append-only audit log (BR-46); OQ-04 closed, OQ-05/OQ-13 deferred, OQ-01/OQ-02 resolved as configurable. Observed findings unchanged. |
| 1.2.1 | 2026-10-13 | OQ-13 changed from Deferred to Closed: the build logs `controlledDataAttested` on audit events for all free-text saves (architecture-overview §4, ADR-0005, BR-44). |
| 1.2.2 | 2026-10-13 | BR-46 amended per decision C-1: append-only covers app behavior; single-event updates/deletes denied everywhere; prod strictly append-only; dev/stage admins may do full table resets. OQ-13 citation corrected to architecture-overview §4 / ADR-0005. |
| 1.2.3 | 2026-10-13 | BR-08 build rule aligned with BR-46/C-1 (dev/stage full table resets; prod strictly append-only). |
| 1.3 | 2026-10-13 | Responses to BA-owned review findings (§13, ba-responses.md): soft delete for all removals/undo and reset via InfraDeploy script (§13.1); manual PO-check fields from observed structure (§13.2); CAPA/NCMR steps 2–6 and SQ steps 3/4/6 marked blocked; ID ACs no longer assert `DEMO`; build criteria separated from seed checks (US-04/08/28/31); BR-44 400/422 ACs on US-02; BR-34 add-row vs advisory clarified; BR-40 Undo audited; §1.1 persistence wording fixed; BR-31/32 renumbered in order; decisions pending DP-01..DP-19 (§13.3). |
| 1.4 | 2026-10-13 | Vishwas decisions (§13.5): sample/demo data allowed in all envs incl. prod, labeled (BR-31, BR-45 reconciled, OQ-10, §13.4); US-41 in scope with client-side ⌘K search, DP-15 resolved; BR-47 PLACEHOLDER defaults in config, DP-16 partially resolved; BR-44 whole-word case-insensitive matching and marker list incl. EAR, 22 CFR 120-130, 15 CFR 730-774, DP-03 partially resolved. QA-01, QA-03, QA-12 resolved. |
| 1.4.1 | 2026-10-13 | BR-44 CFR markers clarified as ranges (BA interpretation of Vishwas's 2026-10-13 decision; sign-off pending under DP-03): any citation whose part number is within 22 CFR parts 120–130 or 15 CFR parts 730–774 is a hit, including subsections and Part/§ forms (e.g. `22 CFR 121.1`, `22 CFR Part 126`, `15 CFR § 774.1`); matching case-insensitive. Implementation may store ranges as structured data (`title`, `partFrom`, `partTo`) per Developer finding #27. DP-03 note updated; ba-responses DEV-27 row added. |
| 1.4.2 | 2026-10-13 | CAPA/NCMR overdue behaviour checked against screenshots 08, 09, 10, 11, 25, 26, 34, 35: not observed (the BR-42 count and Overdue/Due soon badges cover training, calibration and supplier re-evaluations only). Added OQ-25 and DP-20 (overdue rule for CAPA/NCMR `dueDate`; references Architect finding #29, GSI2 `dueAt`). BR-42 unchanged. ba-responses DEV-29 row added. |
