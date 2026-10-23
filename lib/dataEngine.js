// lib/dataEngine.js
// Core ingestion, replay, metrics, and export engine implementing DATA_CONTRACT.md

import { ROUTE_CATEGORIES, CONVERSATION_ANALYSIS } from './analysisData';
import JSZip from 'jszip';

export function makeRecordKey(source_type, source_id) {
  return `${source_type}:${source_id}`;
}

export function hasUsableText(record) {
  if (!record) return false;
  if (record.source_type === 'call') {
    return Boolean(record.payload?.transcript && record.payload.transcript.trim());
  }
  if (record.source_type === 'meeting') {
    return Boolean(
      record.transcript_payload?.turns &&
      Array.isArray(record.transcript_payload.turns) &&
      record.transcript_payload.turns.length > 0
    );
  }
  return false;
}

/**
 * Ingests a delivery batch into the current record map.
 * Respects revision ordering: newer revisions replace the full payload.
 * Preserves manual routing overrides even when source is refreshed.
 */
export function ingestBatch(currentMap, batchData, manualOverrides = {}) {
  const newMap = new Map(currentMap);
  const deliveryBatchId = batchData.batch_id || 'unknown_batch';
  const deliveryRevision = batchData.revision || 1;

  for (const record of (batchData.records || [])) {
    const key = makeRecordKey(record.source_type, record.source_id);
    const existing = newMap.get(key);

    const incomingRevision = record.revision || deliveryRevision;

    if (existing) {
      // Rule 2: Store the last applied revision per record.
      // Same or older revisions are ignored.
      if (incomingRevision <= existing.applied_revision) {
        // Ignored; do not overwrite with stale or equal revision
        continue;
      }

      // Newer revision replaces entire source payload & transcript payload
      const hadUsableBefore = hasUsableText(existing);
      const hasUsableNow = hasUsableText(record);

      const manualRoute = manualOverrides[key];
      const assignedRoute = manualRoute || existing.assigned_route || getDefaultRoute(record);

      // Determine analysis freshness
      let freshness = existing.analysis_freshness || 'current';
      if (!hadUsableBefore && hasUsableNow) {
        freshness = 'pending_review'; // Newly arrived transcript
      }

      newMap.set(key, {
        ...record,
        batch_id: deliveryBatchId,
        applied_revision: incomingRevision,
        assigned_route: assignedRoute,
        is_manual_override: Boolean(manualRoute),
        analysis_freshness: freshness,
        has_usable_text: hasUsableNow,
        updated_at: new Date().toISOString()
      });
    } else {
      // First time ingesting this record
      const manualRoute = manualOverrides[key];
      const defaultRoute = getDefaultRoute(record);
      const assignedRoute = manualRoute || defaultRoute;

      newMap.set(key, {
        ...record,
        batch_id: deliveryBatchId,
        applied_revision: incomingRevision,
        assigned_route: assignedRoute,
        is_manual_override: Boolean(manualRoute),
        analysis_freshness: CONVERSATION_ANALYSIS[key]?.freshness || 'current',
        has_usable_text: hasUsableText(record),
        updated_at: new Date().toISOString()
      });
    }
  }

  return newMap;
}

export function getDefaultRoute(record) {
  const key = makeRecordKey(record.source_type, record.source_id);
  if (CONVERSATION_ANALYSIS[key]?.defaultRoute) {
    return CONVERSATION_ANALYSIS[key].defaultRoute;
  }
  if (!hasUsableText(record)) {
    return 'unconnected_intake';
  }
  return 'review_needed';
}

/**
 * Computes exact dashboard metrics from the active records array.
 */
export function computeDashboardMetrics(recordsArray) {
  const totalRecords = recordsArray.length;
  const calls = recordsArray.filter(r => r.source_type === 'call');
  const meetings = recordsArray.filter(r => r.source_type === 'meeting');

  // Usable transcript coverage
  const callsWithText = calls.filter(hasUsableText).length;
  const meetingsWithText = meetings.filter(hasUsableText).length;
  const totalWithText = callsWithText + meetingsWithText;

  // Stored upstream connection rate
  // Denominator: calls with non-null is_connected
  const callsWithKnownConnect = calls.filter(c => c.payload?.is_connected !== null && c.payload?.is_connected !== undefined);
  const callsConnected = calls.filter(c => c.payload?.is_connected === true).length;
  const connectRatePercent = callsWithKnownConnect.length > 0
    ? ((callsConnected / callsWithKnownConnect.length) * 100).toFixed(1)
    : '0.0';

  // Substantive conversation rate:
  // Calls with substantive two-way exchange (9 verified calls)
  const substantiveCalls = calls.filter(c => c.payload?.is_conversation === true && hasUsableText(c)).length;

  // Rep Activity Breakdown (Calls)
  const repStats = {};
  for (const c of calls) {
    const rep = c.payload?.rep_name || c.payload?.rep_email || 'Unassigned Rep';
    if (!repStats[rep]) {
      repStats[rep] = { totalCalls: 0, connected: 0, withTranscript: 0, repEmail: c.payload?.rep_email };
    }
    repStats[rep].totalCalls += 1;
    if (c.payload?.is_connected === true) repStats[rep].connected += 1;
    if (hasUsableText(c)) repStats[rep].withTranscript += 1;
  }

  // Meeting Organizers Breakdown
  const organizerStats = {};
  for (const m of meetings) {
    const org = m.payload?.organizer_email || 'Unknown Organizer';
    if (!organizerStats[org]) {
      organizerStats[org] = { totalMeetings: 0, withTranscript: 0, recordedCount: 0 };
    }
    organizerStats[org].totalMeetings += 1;
    if (hasUsableText(m)) organizerStats[org].withTranscript += 1;
    if (m.payload?.recording_status === 'recorded') organizerStats[org].recordedCount += 1;
  }

  // Routing counts by category
  const routeCounts = {};
  ROUTE_CATEGORIES.forEach(cat => { routeCounts[cat.id] = 0; });
  let manualOverrideCount = 0;
  let pendingReviewCount = 0;

  for (const r of recordsArray) {
    const route = r.assigned_route || 'review_needed';
    routeCounts[route] = (routeCounts[route] || 0) + 1;
    if (r.is_manual_override) manualOverrideCount += 1;
    if (r.analysis_freshness === 'pending_review') pendingReviewCount += 1;
  }

  return {
    totalRecords,
    callsCount: calls.length,
    meetingsCount: meetings.length,
    totalWithText,
    coveragePercent: totalRecords > 0 ? ((totalWithText / totalRecords) * 100).toFixed(1) : '0.0',
    callsWithText,
    callCoveragePercent: calls.length > 0 ? ((callsWithText / calls.length) * 100).toFixed(1) : '0.0',
    meetingsWithText,
    meetingCoveragePercent: meetings.length > 0 ? ((meetingsWithText / meetings.length) * 100).toFixed(1) : '0.0',
    callsConnected,
    callsWithKnownConnect: callsWithKnownConnect.length,
    connectRatePercent,
    substantiveCalls,
    repStats,
    organizerStats,
    routeCounts,
    manualOverrideCount,
    pendingReviewCount
  };
}

/**
 * Generates the machine-readable manifest (JSON and CSV formats).
 */
export function generateManifest(recordsArray) {
  const manifestData = recordsArray.map(r => {
    const key = makeRecordKey(r.source_type, r.source_id);
    const analysis = CONVERSATION_ANALYSIS[key];
    const cat = ROUTE_CATEGORIES.find(c => c.id === r.assigned_route);
    const folder = cat ? cat.id : 'unassigned';
    const filename = `${r.record_ref || r.source_id.substring(0, 8)}_${(r.payload?.title || analysis?.title || 'record').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    const outputPath = `exports/routing/${folder}/${filename}`;

    return {
      source_type: r.source_type,
      source_id: r.source_id,
      record_ref: r.record_ref || '',
      applied_revision: r.applied_revision || 1,
      batch_id: r.batch_id || 'initial-001',
      assigned_route: r.assigned_route || 'review_needed',
      route_label: cat ? cat.label : 'Review Needed',
      output_path: outputPath,
      review_state: r.analysis_freshness === 'pending_review' ? 'pending_review' : 'completed',
      is_manual_override: Boolean(r.is_manual_override),
      has_usable_transcript: hasUsableText(r),
      summary: analysis?.summary || (hasUsableText(r) ? 'Transcript present; pending manager analysis' : 'No usable supplied text in source delivery'),
      owner: analysis?.owner || r.payload?.rep_name || r.payload?.organizer_email || 'Unassigned',
      updated_at: r.updated_at || new Date().toISOString()
    };
  });

  // CSV generation
  const headers = [
    'source_type',
    'source_id',
    'record_ref',
    'applied_revision',
    'batch_id',
    'assigned_route',
    'route_label',
    'output_path',
    'review_state',
    'is_manual_override',
    'has_usable_transcript',
    'owner',
    'updated_at'
  ];

  const csvRows = [headers.join(',')];
  for (const item of manifestData) {
    const row = headers.map(h => {
      const val = item[h];
      const str = val === null || val === undefined ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(row.join(','));
  }

  return {
    jsonData: manifestData,
    csvString: csvRows.join('\n')
  };
}

/**
 * Builds the complete downloadable ZIP bundle containing the manifest and organized markdown files.
 */
export async function buildExportArchive(recordsArray) {
  const zip = new JSZip();
  const { jsonData, csvString } = generateManifest(recordsArray);

  // Add manifest files
  zip.file('manifest.json', JSON.stringify(jsonData, null, 2));
  zip.file('manifest.csv', csvString);

  // Add Daily Brief
  const dailyBriefContent = getDailyManagerBriefContent();
  zip.file('daily_brief/2026-08-21_manager_brief.md', dailyBriefContent);

  // Add individual record output files organized by route
  for (const item of jsonData) {
    const key = makeRecordKey(item.source_type, item.source_id);
    const analysis = CONVERSATION_ANALYSIS[key];
    const rec = recordsArray.find(r => makeRecordKey(r.source_type, r.source_id) === key);

    let md = `# ${item.record_ref ? `[${item.record_ref}] ` : ''}${analysis?.title || rec?.payload?.title || 'Interaction Record'}\n\n`;
    md += `- **Source Type**: ${item.source_type}\n`;
    md += `- **Source ID**: \`${item.source_id}\`\n`;
    md += `- **Applied Revision**: ${item.applied_revision} (${item.batch_id})\n`;
    md += `- **Assigned Route**: ${item.route_label} (\`${item.assigned_route}\`)\n`;
    md += `- **Manual Override**: ${item.is_manual_override ? 'YES (Manager Override Preserved)' : 'NO (Automated Routing)'}\n`;
    md += `- **Review State**: ${item.review_state}\n`;
    md += `- **Owner**: ${item.owner}\n\n`;

    if (analysis) {
      md += `## Executive Summary\n${analysis.summary}\n\n`;
      md += `## Why It Matters\n${analysis.whyItMatters}\n\n`;
      md += `## Supporting Evidence Passage\n> ${analysis.evidenceQuote}\n\n`;
      md += `## What Evidence Does NOT Establish\n${analysis.evidenceLimits}\n\n`;
      md += `## Recommended Next Steps\n- ${analysis.nextSteps}\n\n`;
      if (analysis.attentionFlags && analysis.attentionFlags.length > 0) {
        md += `## Attention Flags\n`;
        analysis.attentionFlags.forEach(flag => { md += `- ⚠️ ${flag}\n`; });
        md += '\n';
      }
    } else {
      md += `## Processing State\n`;
      md += `No substantive transcript supplied in delivery. Stored upstream status: ${rec?.payload?.summary_status || rec?.payload?.recording_status || 'Logged'}.\n\n`;
    }

    // Include transcript excerpt if present
    if (rec?.payload?.transcript) {
      md += `## Verbatim Transcript\n\`\`\`text\n${rec.payload.transcript}\n\`\`\`\n`;
    } else if (rec?.transcript_payload?.turns && rec.transcript_payload.turns.length > 0) {
      md += `## Dialogue Turns\n`;
      rec.transcript_payload.turns.forEach((turn, idx) => {
        md += `**Turn ${idx + 1} | ${turn.timecode || ''} | ${turn.speaker}**\n${turn.text}\n\n`;
      });
    }

    // Write to relative path inside ZIP
    const cleanPath = item.output_path.replace(/^exports\//, '');
    zip.file(cleanPath, md);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  return content;
}

export function getDailyManagerBriefContent() {
  return `# Sales Manager Daily Intelligence Brief
**Date**: 21 August 2026 (Asia/Kolkata)
**Scope**: 44 Selected Records (30 Calls, 14 Meetings) | 18 Usable Transcripts Post-Update

## 1. Executive Summary
Today's 44 selected interactions reveal critical operational risks in existing customer migrations, high-value strategic channel opportunities, and important discrepancies between upstream automated metadata and actual conversation evidence.

## 2. Immediate Action Priorities
1. **Cedarwave Distribution (M04 - Customer Success Risk)**:
   - High-touch account experiencing severe anxiety over upcoming card programme migration away from legacy network.
   - Merchant acceptance failures and inability to reassign users across departments.
   - **Action**: CS Lead must share a zero-downtime card reissuance schedule today and escalate the department assignment defect to engineering.
2. **Willowfield Trust (M07 - Product Defect Escalation)**:
   - Screen-sharing session revealed 2 reproducible bugs: event-payment description edit failing to persist and document upload rejection on "Recreate Payment" flow.
   - **Action**: QA/Support Lead to file urgent bug tickets and communicate the Bill Pay workaround.
3. **Asterloom Systems (M03 - Commercial Proposal Review)**:
   - Prospect evaluating prepaid corporate cards for ~65 employees to replace INR 10-15L/month in manual personal reimbursements.
   - **Action**: Sales Lead to send executive CFO-ready cards proposal before Monday.
4. **Harborpath Advisory (M01) & Willowbank Advisory (C07)**:
   - Two strong channel partnership opportunities for international companies incorporating US entities needing virtual accounts and FX wallets.
   - **Action**: Send partner enablement packets; connect Harborpath with SpendNest marketing for proposed podcast co-marketing.

## 3. Team Performance & Coaching Insights
- **Meera (5 calls, 5 connects, 5 transcripts)**:
  - Exemplary cold outreach performance. Quickly identifies company size (~120-130 locations), uncovers incumbent tools (StoreHarbor), and secures warm referrals (Raghav -> People Ops).
- **Arun (15 calls, 2 connects, 3 transcripts)**:
  - High dial volume but low connection yield. Arun showed good composure when handling an irritated prospect (C01), but phone cadences need verification of lead sources. Substantive voicemail left on C04 demonstrates good persistence.
- **Caller Identity Audit Required**:
  - Call C06 metadata lists Meera, but caller explicitly introduced himself as "Ravi". Phone system provisioning must be audited immediately to ensure proper rep call attribution.
`;
}
