# Revenue Intelligence Inbox

A modern Next.js revenue intelligence workspace designed for sales managers to review calls and meetings, monitor team activity on **21 August 2026 (Asia/Kolkata)**, surface operational exceptions, route conversations with evidence citations, and verify data contracts.

- **GitHub Repository**: [https://github.com/Gowjesh/spendnest-revenue-intelligence](https://github.com/Gowjesh/spendnest-revenue-intelligence)
- **1-Click Deployed Access (Vercel)**: [Deploy on Vercel](https://vercel.com/new/clone?repository-url=https://github.com/Gowjesh/spendnest-revenue-intelligence)

---

## 1. Quickstart & Local Setup

### Prerequisites
- Node.js `v18+` or `v20+` (tested on Node `v22.16.0`)
- npm `v9+` (tested on npm `v11.6.1`)

### Run Locally
```bash
# 1. Install dependencies
npm install

# 2. Run development server
npm run dev

# 3. Open in browser
http://localhost:3000
```

### Production Build
```bash
npm run build
npm run start
```

---

## 2. Replay & Update Verification Steps

The application strictly implements the replay contract from `DATA_CONTRACT.md`. All steps can be run from the **Replay Studio** tab in the UI or via local tests:

1. **Step 1: Initial Import (`01_initial.json`)**:
   - Ingests delivery `initial-001` (revision 1).
   - Verifies exactly **44 unique records** (30 calls, 14 meetings) and **17 usable transcripts**.
2. **Step 2: Idempotent Random Replay**:
   - Re-imports `01_initial.json` with records shuffled in random order.
   - Verifies record count remains strictly **44** with **0 duplicate records**.
3. **Step 3: Manual Route Override**:
   - Set a manual route on record `M07` or `C06` using the route dropdown.
   - The UI applies the route, stores `is_manual_override = true`, and persists to `localStorage`.
4. **Step 4: Update Batch Ingestion (`02_update.json`)**:
   - Ingests delivery `update-002` (revision 2 for M07).
   - M07 turns update from `0` to `27` turns.
   - Total unique record count remains **44** (no 45th record created).
   - **Manual override on M07 survives intact**.
5. **Step 5: Browser Refresh / Persistence Check**:
   - Reload the page. All records, manual overrides, and review flags are restored from `localStorage`.

---

## 3. Metric Definitions & Safe Calculations

All metrics fall on **21 August 2026 (Asia/Kolkata)**:

- **Selected Records**: 44 logical records (30 calls, 14 meetings). Identity key: `(source_type, source_id)`.
- **Usable Transcript Coverage**:
  - *Denominator*: 44 total selected records.
  - *Initial*: `17/44` (38.6%) — 10 calls, 7 meetings.
  - *Post-Update*: `18/44` (40.9%) — 10 calls, 8 meetings (M07 updated).
  - *Call Coverage*: `10/30` (33.3%).
  - *Meeting Coverage*: `7/14` (50.0% initial) -> `8/14` (57.1% post-update).
- **Source-Reported Connect Rate**:
  - *Denominator*: Calls with non-null `is_connected` (30 calls).
  - `11/30` (36.7%) reported connected upstream.
  - *Substantive Conversation Rate*: 9 verified two-way calls. Call `C02` reached only a receptionist, while `C04` contained a substantive voicemail.
- **Activity by Person**:
  - *Call Representatives*: Arun (15 calls, 2 connects), Leela (8 calls, 2 connects), Meera (5 calls, 5 connects), Kiran (1 call, 1 connect), Dev (1 call, 1 connect).
  - *Meeting Organizers*: Calendar owners (team08, team09, etc.). The app clarifies that calendar organizers are not assumed to be sales reps or attendees.

---

## 4. Where Generated Exports are Located

Exports are generated via the **Exports** tab in the UI (as a single downloadable ZIP bundle) and are pre-generated on disk in `exports/`:

```text
exports/
├── manifest.json                       # Machine-readable JSON manifest
├── manifest.csv                        # Spreadsheet-ready CSV manifest
├── daily_brief/
│   └── 2026-08-21_manager_brief.md    # Executive Daily Brief for sales manager
└── routing/
    ├── pipeline_deals/                 # Asterloom (M03), Mapletrail (M06), Raghav (C08), Milan (C03)
    ├── partnerships/                   # Harborpath (M01), Willowbank (C07)
    ├── customer_success/               # Cedarwave (M04), Brookmint Setup (M09)
    ├── support_escalation/             # Willowfield Trust Bug Escalation (M07)
    ├── vendor_evaluations/             # LedgerBridge E-Invoicing Supplier (M02)
    ├── internal_enablement/            # Billing Workflow Walkthrough (M10)
    ├── outbound_prospecting/           # C01, C05, C06, C09, C10
    └── unconnected_intake/             # C02, C04, and background records
```

---

## 5. Three Key Evidence-Backed Findings

1. **Finding 1: Upstream Connection Classifications Contradict Reality**:
   - *Evidence*: Call C02 (`4b870624-8aad-5315-a60e-0db95981cf99`) is marked `is_connected: true` and `is_conversation: true`, but transcript shows Arun spoke only to receptionist Kavya who transferred to voicemail (*"It looks as though she isn't in the office today... I'll put you through to the mailbox now"*). Conversely, Call C04 (`bcdcbf56-d338-5c78-9a97-42c2fc1c9931`) is marked `is_connected: false`, but contains a substantive 40-second voicemail resolving a misdirected proposal.
   - *Product Impact*: Dashboard explicitly distinguishes between upstream stored connect rates and verified conversation coverage.
2. **Finding 2: Caller Metadata Identity Contradicts Spoken Dialogue**:
   - *Evidence*: Call C06 (`12216d5c-e254-52c6-b344-47de4c6e1ae5`) lists `rep_name: "Meera"`, but the caller begins: *"Good evening, Mr Nikhil... Ravi here. I'll say at the start that this is a cold call."*
   - *Product Impact*: The interface displays both the provisioned account and detected speaker name, flagging an identity discrepancy for management phone audit.
3. **Finding 3: Meeting Records Conceal Supplier and Internal Sessions**:
   - *Evidence*: Meeting M02 (`4c58cf32-bc96-52fb-b9d9-bb5e8e3f019b`) "LedgerBridge" is an inbound supplier evaluation where our team is the buyer (*Turn 2: "Supplier A: Are you more interested in electronic invoicing or payment rails?" Turn 3: "Electronic invoicing is the bigger opportunity"*). Meeting M10 is internal training (*Turn 2: "wait for the trainer", Turn 4: "demo account"*). Meeting M07 is a bug reproduction session (*Turns 2–8*).
   - *Product Impact*: Routing taxonomy strictly separates sales pipeline opportunities from vendor evaluations, customer bug escalations, and internal training.

---

## 6. One Deliberately Rejected Decision

- **Rejected Alternative**: Automated fuzzy account linking (e.g., merging Cedarwave M04 with M13) and synthetic pipeline ARR forecasting based on transcript spending figures (e.g., Asterloom M03 mention of *"INR 10-15 lakh monthly spend"*).
- **Why Rejected**: Per data contracts, there is no authoritative CRM deal table, no verified company-ID join, and conversational figures represent employee personal reimbursement volume, not software contract ARR.
- **Trade-off Accepted**: We present grounded conversation signals and explicit uncertainty boundaries rather than inventing artificial pipeline numbers that generate false managerial confidence.

---

## 7. AI Usage, Time Spent & Limitations

- **AI Usage**: AI was used to assist with domain intelligence structuring, transcript citation extraction, and frontend component composition. All analysis is pre-grounded in verifiable source passages; no dynamic external model calls or ungrounded generative hallucinations are executed at runtime.
- **Approximate Time Spent**: ~7.5 hours (Requirements analysis, Next.js architecture, replay engine, data contract compliance, UI development, automated browser testing, and documentation).
- **Known Limitations**:
  - Cross-meeting participant resolution is limited to stated local names.
  - Background calls without transcripts remain in intake status; no speculative summary is fabricated.
