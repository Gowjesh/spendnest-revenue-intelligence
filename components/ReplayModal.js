'use client';

import { X, RotateCcw } from 'lucide-react';

export default function ReplayModal({
  show,
  onClose,
  step1Done,
  step2Done,
  step3Done,
  step4Done,
  replayLog,
  onImportInitial,
  onReplayRandom,
  onM07Override,
  onImportUpdate,
  onReset
}) {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '700px',
        maxWidth: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
      }}>
        {/* Modal Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', margin: 0 }}>
              Replay Engine &amp; Data Contract Tests
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Interactive test suite validating idempotency, duplicate prevention, and override persistence.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Steps */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Step 1 */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: step1Done ? '1px solid #10b981' : '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>Step 1: Load Initial Batch (01_initial.json)</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loads initial delivery of 44 records (30 calls, 14 meetings).</div>
            </div>
            <button id="btn-step-1" onClick={onImportInitial} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              Run Step 1
            </button>
          </div>

          {/* Step 2 */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: step2Done ? '1px solid #10b981' : '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>Step 2: Replay Same Batch (Random Shuffled Order)</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Demonstrates record count stays 44 (0 duplicates created).</div>
            </div>
            <button id="btn-step-2" onClick={onReplayRandom} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', background: '#3b82f6', color: '#fff', border: 'none' }}>
              Test Replay
            </button>
          </div>

          {/* Step 3 */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: step3Done ? '1px solid #10b981' : '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>Step 3: Apply Manual Override on M07 (Willowfield)</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manually classifies M07 under "Customer Support &amp; Defect Escalation".</div>
            </div>
            <button id="btn-step-3" onClick={onM07Override} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', background: '#a855f7', color: '#fff', border: 'none' }}>
              Apply Override
            </button>
          </div>

          {/* Step 4 */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: step4Done ? '1px solid #10b981' : '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>Step 4: Ingest Late Transcript Update (02_update.json)</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>M07 updates to Rev 2 (27 turns). M07 override remains preserved.</div>
            </div>
            <button id="btn-step-4" onClick={onImportUpdate} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', background: '#10b981', color: '#fff', border: 'none' }}>
              Ingest Update
            </button>
          </div>

          {/* Log Output */}
          {replayLog && (
            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#a7f3d0', fontFamily: 'monospace' }}>
              &gt; {replayLog}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onReset}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', fontSize: '12px', background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)', cursor: 'pointer' }}
          >
            <RotateCcw size={13} /> Reset Slate
          </button>
          <button onClick={onClose} className="btn-primary" style={{ padding: '7px 16px', fontSize: '13px' }}>
            Close Tests
          </button>
        </div>
      </div>
    </div>
  );
}
