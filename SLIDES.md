# Revenue Intelligence Inbox — 5 Slide Presentation

---

## Slide 1: Manager Problem & Key Analytical Findings

### The Problem
A sales manager receives 44 unstructured calls and calendar records across multiple disconnected systems. Upstream metadata is inconsistent, transcripts arrive asynchronously, and stored classifications often disagree with reality.

### Finding 1: Stored Classification Contradiction
- **Evidence**:
  - **Call C02** (`4b870624-8aad-5315-a60e-0db95981cf99`): Stored as `is_connected: true` and `is_conversation: true`, but Arun spoke only to receptionist Kavya who transferred him to Leela's voicemail (*"It looks as though she isn't in the office today... I'll put you through to the mailbox now"*).
  - **Call C04** (`bcdcbf56-d338-5c78-9a97-42c2fc1c9931`): Stored as `is_connected: false` and `is_conversation: false`, yet Arun left a 40-second substantive voicemail clarifying a previously misdirected proposal (*"Arun from the sales team here... My understanding is that our information first went to the wrong email address"*).
- **Product Impact**: The dashboard explicitly separates upstream connection rates from verified conversation coverage.

### Finding 2: Caller Identity Divergence
- **Evidence**:
  - **Call C06** (`12216d5c-e254-52c6-b344-47de4c6e1ae5`): Metadata rep_name is `"Meera"`, but the caller introduces himself in line 1 as: *"Good evening, Mr Nikhil... Ravi here. I'll say at the start that this is a cold call."*
- **Product Impact**: The UI displays both the detected speaker and the provisioned account, triggering a phone provisioning audit flag.

### Finding 3: Non-Sales Interactions Mixed with Pipeline
- **Evidence**:
  - **Meeting M02**: Internal strategy team is evaluating LedgerBridge as an e-invoicing supplier (*Turn 2: "Supplier A... Are you more interested in electronic invoicing or payment rails?" Turn 3: "Electronic invoicing is the bigger opportunity"*).
  - **Meeting M10**: Internal employee billing walkthrough (*Turn 2: "We can wait for the trainer to return" Turn 4: "demo account"*).
  - **Meeting M07**: Customer bug reproduction session (*Turns 2–8*).
- **Product Impact**: Strict separation of pipeline opportunities from vendor evaluations, customer bug reports, and internal enablement.

---

## Slide 2: Interface Choices & Deliberate Omissions

### What We Built
- **KPIs with Defined Denominators**: Explicit breakdown (`17/44` initial -> `18/44` post-update text coverage; `11/30` stored connects vs `9` verified conversations).
- **Priority Exception Queue**: Instant visibility into customer retention risks ([M04] Cedarwave card migration anxiety) and defect escalations ([M07] Willowfield UI bugs).
- **Activity by Person**: Distinguishes call representatives from calendar meeting organizers (organizers are not assumed to be reps or attendees).
- **Drilldown Detail Drawer**: Evidence quotes, limitations, action items, verbatim turns, and raw source JSON in one click.
- **Replay Studio**: One-click verification panel allowing reviewers to validate idempotency, duplicate prevention, and override persistence.

### Deliberately Rejected Decision: Speculative Account Merging & Deal Size ARR
- **Alternative Considered**: Automatically clustering records by fuzzy company name matching (e.g. Cedarwave M04 with M13) and guessing deal ARR from loose conversational statements (e.g. Asterloom M03 mention of *"INR 10-15 lakh monthly spend"*).
- **Why Rejected**: Per data contracts, there is no authoritative CRM deal table, no verified company-ID join, and conversational mentions represent employee personal spending, not software contract value.
- **Trade-off Accepted**: We present transparent conversation signals and explicit uncertainty boundaries rather than inventing artificial pipeline figures that generate false managerial confidence.

---

## Slide 3: Routing Architecture & Difficult Routing Decisions

### Multi-Destination Taxonomy (9 Operational Categories)
1. **Pipeline Deals & Next Steps**: M03 (Asterloom), M06 (Mapletrail), C08 (Raghav referral), C03 (Milan API follow-up)
2. **Channel & Strategic Partnerships**: M01 (Harborpath Advisory), C07 (Willowbank Advisory)
3. **Customer Success & Migration**: M04 (Cedarwave Migration), M09 (Brookmint Setup)
4. **Customer Support & Defect Escalation**: M07 (Willowfield Bug Reproduction)
5. **Vendor / Inbound Evaluation**: M02 (LedgerBridge E-Invoicing Supplier)
6. **Internal Enablement & Training**: M10 (Billing Training)
7. **Outbound Prospecting & Lead Nurture**: C01, C05, C06, C09, C10
8. **Gatekeeper / Unconnected / Voicemail**: C02 (Fernhaven), C04 (Lanternpath)
9. **Review Needed / Attention Required**: Newly arrived or stale analysis

### Difficult Routing Case 1: M02 LedgerBridge (Buyer vs Seller)
- **The Ambiguity**: Calendar title is *"LedgerBridge Discussion"*. An automated rule might easily classify this as an outbound sales pitch.
- **Transcript Evidence**: Turn 2: *"Supplier A: Then I will cover the market strategy as well as technical integration... Are you more interested in electronic invoicing or payment rails?"* Turn 3: *"Team member B: Electronic invoicing is the bigger opportunity."*
- **Resolution**: Internal team is the buyer evaluating a vendor. Routed to *Vendor / Inbound Evaluation* to prevent corrupting sales pipeline metrics.

### Difficult Routing Case 2: M01 Harborpath (Dual Destination)
- Harborpath advises overseas firms establishing US entities (channel referral partner), but also agrees to record a joint podcast (Turn 26 co-marketing). Routed to Channel Partnerships with a co-marketing marketing action item.

---

## Slide 4: Safe Number Checks & Evidence Auditing

### Audited Numbers & Safe Calculations
- **Selected Record Count**: Exactly 44 distinct logical records across all test deliveries. Primary identity: `(source_type, source_id)`.
- **Transcript Coverage**:
  - *Initial Delivery*: 17/44 (38.6%) — 10 calls, 7 meetings.
  - *Post-Update Delivery*: 18/44 (40.9%) — 10 calls, 8 meetings (M07 updated).
- **Connection Rate Truth**: Stored metadata reports 11/30 (36.7%), but only 9 calls represent substantive two-way conversations. C02 was an administrative receptionist transfer.

### Replay Verification Results
- **Idempotent Re-Import**: Re-importing `01_initial.json` with randomized record order preserves the exact 44 record count.
- **Update Ingestion**: Ingesting `02_update.json` detects revision 2 for M07. Upgrades turns from 0 to 27 without creating a 45th record.
- **Preserved Judgment**: Manual route overrides on M07 or any record remain 100% active and survive source updates and browser refreshes.

---

## Slide 5: Trade-offs, AI Usage & Product Roadmap

### Architectural Decisions
- **Deterministic State Engine**: Next.js client-state engine backed by browser LocalStorage rather than requiring an external database or authentication server. Provides instant, zero-latency replay testing, fully reproducible locally and online.
- **Grounded AI Usage**: Pre-generated, verifiable evidence passages and coaching insights grounded directly in the 18 adapted texts. Zero hallucination of contract terms, deal stages, or customer commitments. When text is absent, records remain in a clean intake state.

### Product Roadmap
1. **Live CRM Sync**: Two-way webhooks to push verified manual routes and coaching notes to Salesforce / HubSpot.
2. **Speaker Voice Biometrics**: Automatically resolve identity discrepancies like C06 (Ravi vs Meera) in real time.
3. **Automated Export Sync**: Sync of Markdown folders to shared Notion / Google Drive directories.

### Submission Artifacts Summary
- **Working App**: Next.js workspace with interactive Replay Studio and Export Center.
- **Exports**: 44 structured Markdown files, `manifest.json`, `manifest.csv`, and Daily Manager Brief.
- **Recording & Documentation**: 3-minute continuous screen demonstration video, complete narration script, and short README.
