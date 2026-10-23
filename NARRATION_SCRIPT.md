# Three-Minute Spoken Narration Script

**Duration**: ~3:00 minutes  
**Format**: One continuous screen recording with spoken narration  
**Recorded Video File**: `sales_manager_workflow_demo_1792727462975.webp` (in artifacts directory)

---

### [0:00 - 0:45] Section 1: Introduction & Useful Manager Workflow

**On Screen**: Open `http://localhost:3000` showing the Dashboard overview.

**Spoken Narration**:
> *"Hello! Today I'm demonstrating the Revenue Intelligence Inbox built for SpendNest sales managers to understand daily activity, prioritize critical accounts, and inspect conversation evidence for August 21st, 2026.*
>
> *Starting on the dashboard, we see 44 total selected records: 30 phone calls and 14 calendar meetings. Notice our headline metrics clearly define their denominators: our usable transcript coverage is 40.9%—that's 18 out of 44 records with genuine text.
>
> *More importantly, our upstream connect rate shows 36.7%—that's 11 of 30 calls flagged by the dialer. But when we audit the actual transcripts, only 9 calls represent substantive two-way conversations. For example, call C02 was marked connected, but the rep only reached a receptionist who transferred to voicemail.
>
> *Looking at our Priority Attention Queue, let's click into record M04, Cedarwave Distribution. The manager immediately sees why this matters: Cedarwave is an existing customer anxious about card downtime during their programme migration, and they hit an administrative bug reassigning users across departments. In the drawer, we cite exact turns 2 and 30, define clear boundaries of what the evidence doesn't establish, and assign an immediate action item to the CS lead."*

---

### [0:45 - 1:45] Section 2: Difficult Routing Decision & Inbox Exploration

**On Screen**: Navigate to the **Inbox** tab. Filter by person (Meera) or search for C06. Open record M02 (LedgerBridge) or C06.

**Spoken Narration**:
> *"Now let's switch to the Inbox view, which lists all 44 interactions with multi-dimensional filters by rep, organizer, source type, and routing category.
>
> *Here is one of our most difficult routing decisions: Meeting M02, titled 'LedgerBridge / SpendNest discussion'. On the surface, a sales manager or automated tool might see a company name and assume this is a sales deal in our pipeline. But when we open M02 and read turns 2 and 3, we discover something crucial: SpendNest is the buyer, evaluating LedgerBridge as a third-party electronic invoicing supplier!
>
> *If we had lazily routed M02 into our sales pipeline, we would inflate pipeline value and mislead executive forecasting. So our routing engine classifies M02 under 'Vendor / Inbound Evaluation'.
>
> *Next, let's look at call C06 with Mr. Nikhil. Metadata lists the rep as Meera, but line 1 of the transcript begins: 'Good evening... Ravi here.' Our product detects and flags this identity mismatch directly in the inbox, preventing incorrect rep coaching and alerting the manager to audit phone provisioning.
>
> *To test manual corrections, let's change C06's route to 'Review Needed'. Notice how the 'Manual Override Active' badge appears immediately, and the decision is saved to local storage."*

---

### [1:45 - 2:45] Section 3: Replay Studio & The Duplicate / Update Test

**On Screen**: Switch to the **Replay Studio** tab. Execute Step 1, Step 2, Step 3, and Step 4.

**Spoken Narration**:
> *"Next, let's verify our data contract compliance in the Replay Studio.
>
> *First, we click 'Reset Clean Slate', then 'Import Initial Batch'. Delivery initial-001 loads 44 unique records with 17 usable transcripts.
>
> *Now for the duplicate test: we click 'Test Random Replay'. This re-imports the exact same batch with the records shuffled into a random order. As you can see in the live execution log, our map keys records strictly on the pair (source_type, source_id). The count remains exactly 44—zero duplicate records are created.
>
> *Next, in Step 3, we apply a manual route override to record M07, setting it to 'Customer Support & Defect Escalation'.
>
> *Now in Step 4, we import 02_update.json. This is our announced late-transcript delivery for M07. Watch what happens: M07's payload updates to revision 2, its transcript upgrades from 0 turns to 27 full dialogue turns, the total record count remains strictly 44, and our manual routing override is 100% preserved! Even if we refresh the browser, the state survives completely intact."*

---

### [2:45 - 3:00] Section 4: Export Center & Wrap-Up

**On Screen**: Click into the **Exports** tab. Show the directory structure and click 'Download Full ZIP Bundle'.

**Spoken Narration**:
> *"Finally, in the Exports tab, the manager can generate a complete, organized archive. With one click on 'Download Full ZIP Bundle', the system bundles a machine-readable manifest.json, manifest.csv, the daily manager brief, and structured markdown files organized into routing folders like pipeline deals, partnerships, and customer success.
>
> *Everything is reproducible, evidence-grounded, and contract-compliant. Thank you for watching!"*
