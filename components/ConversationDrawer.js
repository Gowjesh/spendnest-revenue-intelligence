'use client';

import { X } from 'lucide-react';
import { ROUTE_CATEGORIES } from '../lib/analysisData';
import { hasUsableText } from '../lib/dataEngine';

export default function ConversationDrawer({
  selectedRecord,
  selectedAnalysis,
  selectedRecordKey,
  drawerTab,
  setDrawerTab,
  onClose,
  onOverrideRoute
}) {
  if (!selectedRecord) return null;

  const hasText = hasUsableText(selectedRecord);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '580px',
      maxWidth: '100%',
      height: '100vh',
      background: '#0f172a',
      borderLeft: '1px solid var(--border-color)',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
      zIndex: 900,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Drawer Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: '12px', padding: '2px 8px', borderRadius: '4px' }}>
              {selectedRecord.record_ref || selectedRecord.source_id.slice(0, 6)}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {selectedRecord.source_type.toUpperCase()} • Revision {selectedRecord.applied_revision}
            </span>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
            {selectedRecord.payload?.title || selectedAnalysis?.title || 'Conversation Detail'}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Drawer Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 24px' }}>
        <button
          onClick={() => setDrawerTab('analysis')}
          style={{
            padding: '12px 16px',
            background: 'transparent',
            border: 'none',
            borderBottom: drawerTab === 'analysis' ? '2px solid #6366f1' : '2px solid transparent',
            color: drawerTab === 'analysis' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          Analysis &amp; Routing
        </button>
        <button
          onClick={() => setDrawerTab('transcript')}
          style={{
            padding: '12px 16px',
            background: 'transparent',
            border: 'none',
            borderBottom: drawerTab === 'transcript' ? '2px solid #6366f1' : '2px solid transparent',
            color: drawerTab === 'transcript' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          Full Transcript ({hasText ? 'Available' : 'None'})
        </button>
      </div>

      {/* Drawer Body */}
      <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
        {drawerTab === 'analysis' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Routing Dropdown */}
            <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#818cf8' }}>
                  Assign Routing Destination:
                </label>
                {selectedRecord.is_manual_override && (
                  <span style={{ fontSize: '11px', background: '#a855f7', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    Manual Override Active
                  </span>
                )}
              </div>
              <select
                id="drawer-route-select"
                className="filter-select"
                style={{ width: '100%' }}
                value={selectedRecord.assigned_route}
                onChange={(e) => onOverrideRoute(selectedRecordKey, e.target.value)}
              >
                {ROUTE_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Summary */}
            <div>
              <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                Summary of Conversation
              </h4>
              <div className="action-box">
                {selectedAnalysis?.summary || (hasText ? 'Transcript delivered; awaiting manager manual review.' : 'No audio transcript or dialogue turns delivered in source record.')}
              </div>
            </div>

            {/* Evidence Quote */}
            {selectedAnalysis?.evidenceQuote && (
              <div>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#10b981', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  Verbatim Transcript Evidence
                </h4>
                <div className="quote-box">
                  {selectedAnalysis.evidenceQuote}
                </div>
              </div>
            )}

            {/* Why It Matters */}
            {selectedAnalysis?.whyItMatters && (
              <div>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#f59e0b', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  Manager Insight &amp; Critical Distinction
                </h4>
                <div className="insight-box">
                  {selectedAnalysis.whyItMatters}
                </div>
              </div>
            )}

            {/* Action Items */}
            {selectedAnalysis?.nextSteps && (
              <div>
                <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  Action Item &amp; Owner
                </h4>
                <div className="action-box">
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Next Step:</strong> {selectedAnalysis.nextSteps}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    <strong>Action Owner:</strong> {selectedAnalysis.owner || 'Unassigned'}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Full Transcript Tab */
          <div>
            {selectedRecord.source_type === 'call' ? (
              selectedRecord.payload?.transcript ? (
                <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#e2e8f0', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  {selectedRecord.payload.transcript}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                  No audio transcript available for this call.
                </div>
              )
            ) : (
              selectedRecord.transcript_payload?.turns && selectedRecord.transcript_payload.turns.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedRecord.transcript_payload.turns.map(t => (
                    <div
                      key={t.turn_number}
                      style={{
                        background: t.speaker?.toLowerCase().includes('supplier') || t.speaker?.toLowerCase().includes('customer') ? 'rgba(255,255,255,0.03)' : 'rgba(99, 102, 241, 0.08)',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        borderLeft: t.speaker?.toLowerCase().includes('supplier') || t.speaker?.toLowerCase().includes('customer') ? '2px solid #94a3b8' : '2px solid #6366f1'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Turn {t.turn_number} • {t.speaker || 'Speaker'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6' }}>
                        {t.text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                  No transcript turns available for this calendar meeting.
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
