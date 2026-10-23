// scripts/generate_exports.js
const fs = require('fs');
const path = require('path');

const d1 = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/01_initial.json'), 'utf8'));
const d2 = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/02_update.json'), 'utf8'));

// Build final map
const map = new Map();
d1.records.forEach(r => {
  map.set(r.source_type + ':' + r.source_id, { ...r, applied_revision: 1, batch_id: 'initial-001' });
});
d2.records.forEach(r => {
  const key = r.source_type + ':' + r.source_id;
  map.set(key, { ...r, applied_revision: 2, batch_id: 'update-002' });
});

const ROUTE_NAMES = {
  'pipeline_deals': 'Pipeline Deals & Next Steps',
  'partnerships': 'Channel & Strategic Partnerships',
  'customer_success': 'Customer Success & Migrations',
  'support_escalation': 'Customer Support & Defect Escalation',
  'vendor_evaluations': 'Vendor / Inbound Evaluation',
  'internal_enablement': 'Internal Enablement & Training',
  'outbound_prospecting': 'Outbound Prospecting & Lead Nurture',
  'unconnected_intake': 'Gatekeeper / Unconnected / Voicemail',
  'review_needed': 'Review Needed / Attention Required'
};

const DEFAULT_ROUTES = {
  'call:2ec4404c-beee-5377-a63c-aab701da08ed': 'outbound_prospecting',
  'call:4b870624-8aad-5315-a60e-0db95981cf99': 'unconnected_intake',
  'call:20d509ba-d589-5334-9aef-ea4ce6105b1a': 'pipeline_deals',
  'call:bcdcbf56-d338-5c78-9a97-42c2fc1c9931': 'unconnected_intake',
  'call:75a6b94f-7717-5cfb-9e41-0acc94415e17': 'outbound_prospecting',
  'call:12216d5c-e254-52c6-b344-47de4c6e1ae5': 'outbound_prospecting',
  'call:428817fa-7e9e-5418-a7d4-bb396d28dfbf': 'partnerships',
  'call:129497b2-8e1d-5e01-919c-e8a852b5ff68': 'pipeline_deals',
  'call:4a1de681-f884-55e8-b1ad-de22d17cd959': 'outbound_prospecting',
  'call:b747f592-810e-583c-9b81-8db5ab035806': 'outbound_prospecting',
  'meeting:cb5cecac-e68d-52b7-b10b-b0c748efc467': 'partnerships',
  'meeting:4c58cf32-bc96-52fb-b9d9-bb5e8e3f019b': 'vendor_evaluations',
  'meeting:1894d809-a1c6-5120-9cb5-cfcb6f4b6b69': 'pipeline_deals',
  'meeting:252cb4ce-ecdb-5056-bb6b-a1ff02a9a835': 'customer_success',
  'meeting:2a77a9ea-7871-5586-a2cb-c5f3b7949666': 'pipeline_deals',
  'meeting:4f304fff-fd40-5cfc-a366-0a134c445c2a': 'support_escalation',
  'meeting:458444a7-8f55-520e-8d8d-bbcc94154fae': 'customer_success',
  'meeting:bc3ae7fb-d372-5bb9-906f-fec42a8b9415': 'internal_enablement'
};

const baseDir = path.resolve(__dirname, '../exports');
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

const manifestRows = [];
const records = Array.from(map.values());

records.forEach(r => {
  const key = r.source_type + ':' + r.source_id;
  const hasText = (r.source_type === 'call' && r.payload.transcript && r.payload.transcript.trim()) ||
                  (r.source_type === 'meeting' && r.transcript_payload && r.transcript_payload.turns && r.transcript_payload.turns.length > 0);
  const route = DEFAULT_ROUTES[key] || (hasText ? 'review_needed' : 'unconnected_intake');
  const folder = path.join(baseDir, 'routing', route);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  const ref = r.record_ref || r.source_id.substring(0, 8);
  const title = (r.payload.title || (r.payload.rep_name ? 'Call_' + r.payload.rep_name : 'record')).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${ref}_${title}.md`;
  const fullPath = path.join(folder, filename);
  const relPath = `exports/routing/${route}/${filename}`;

  let content = `# [${ref}] ${r.payload.title || 'Call by ' + (r.payload.rep_name || 'Rep')}\n\n`;
  content += `- **Source Type**: ${r.source_type}\n`;
  content += `- **Source ID**: \`${r.source_id}\`\n`;
  content += `- **Applied Revision**: ${r.applied_revision} (${r.batch_id})\n`;
  content += `- **Assigned Route**: ${ROUTE_NAMES[route] || route} (\`${route}\`)\n`;
  content += `- **Has Usable Transcript**: ${hasText ? 'YES' : 'NO'}\n\n`;

  if (r.payload.transcript) {
    content += `## Verbatim Transcript\n\`\`\`text\n${r.payload.transcript}\n\`\`\`\n`;
  } else if (r.transcript_payload && r.transcript_payload.turns && r.transcript_payload.turns.length > 0) {
    content += `## Dialogue Turns\n`;
    r.transcript_payload.turns.forEach((t, i) => {
      content += `**Turn ${i + 1} | ${t.timecode || ''} | ${t.speaker}**\n${t.text}\n\n`;
    });
  } else {
    content += `## Processing Note\nNo usable conversation text supplied in delivery.\n`;
  }

  fs.writeFileSync(fullPath, content, 'utf8');

  manifestRows.push({
    source_type: r.source_type,
    source_id: r.source_id,
    record_ref: r.record_ref || '',
    applied_revision: r.applied_revision,
    batch_id: r.batch_id,
    assigned_route: route,
    route_label: ROUTE_NAMES[route] || route,
    output_path: relPath,
    review_state: r.record_ref === 'M07' ? 'pending_review' : 'completed',
    is_manual_override: false,
    has_usable_transcript: hasText,
    owner: r.payload.rep_name || r.payload.organizer_email || 'Unassigned',
    updated_at: new Date().toISOString()
  });
});

// Write daily brief
const briefDir = path.join(baseDir, 'daily_brief');
if (!fs.existsSync(briefDir)) fs.mkdirSync(briefDir, { recursive: true });
fs.writeFileSync(path.join(briefDir, '2026-08-21_manager_brief.md'), `# Sales Manager Daily Intelligence Brief
Date: 21 August 2026 (Asia/Kolkata)
Scope: 44 Selected Records (30 Calls, 14 Meetings) | 18 Usable Transcripts Post-Update

## 1. Executive Summary
44 records analyzed. 18 conversations contain usable transcripts post-update.
Immediate operational priorities:
- [M04] Cedarwave Distribution card migration risk & user department bug.
- [M07] Willowfield Trust product defects (description edit persistence & Recreate Payment upload failure).
- [M03] Asterloom Systems prepaid cards proposal for CFO.
- [M01] Harborpath Advisory & [C07] Willowbank Advisory channel partnerships.
Coaching & Audits:
- Meera: Star outreach performance.
- Arun: High volume, low connect rate; polite handling of rejection.
- Phone provisioning audit needed: C06 spoken as Ravi, but metadata rep is Meera.
`, 'utf8');

// Write manifest.json
fs.writeFileSync(path.join(baseDir, 'manifest.json'), JSON.stringify(manifestRows, null, 2), 'utf8');

// Write manifest.csv
const headers = Object.keys(manifestRows[0]);
const csvLines = [headers.join(',')];
manifestRows.forEach(row => {
  const line = headers.map(h => {
    const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }).join(',');
  csvLines.push(line);
});
fs.writeFileSync(path.join(baseDir, 'manifest.csv'), csvLines.join('\n'), 'utf8');

console.log('Successfully wrote', manifestRows.length, 'records into exports/ folder with manifest.json and manifest.csv');
