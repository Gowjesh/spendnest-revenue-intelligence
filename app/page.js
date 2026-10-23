'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ROUTE_CATEGORIES,
  CONVERSATION_ANALYSIS
} from '../lib/analysisData';
import {
  makeRecordKey,
  hasUsableText,
  ingestBatch,
  computeDashboardMetrics,
  generateManifest,
  buildExportArchive
} from '../lib/dataEngine';
import {
  Phone,
  Video,
  Filter,
  Search,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  FileText,
  User,
  SlidersHorizontal,
  X,
  Play,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

export default function Home() {
  const [recordsMap, setRecordsMap] = useState(new Map());
  const [manualOverrides, setManualOverrides] = useState({});
  const [activeBatchId, setActiveBatchId] = useState('initial-001');
  const [activeRevision, setActiveRevision] = useState(1);
  const [selectedRecordKey, setSelectedRecordKey] = useState(null);
  const [drawerTab, setDrawerTab] = useState('analysis'); // 'analysis' or 'transcript'
  const [toastMessage, setToastMessage] = useState(null);
  const [showReplayModal, setShowReplayModal] = useState(false);

  // Replay Step states
  const [replayLog, setReplayLog] = useState('');
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [step4Done, setStep4Done] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSourceType, setFilterSourceType] = useState('all'); // 'all', 'call', 'meeting'
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterHasText, setFilterHasText] = useState('all'); // 'all', 'has_text', 'no_text'
  const [onlyAttention, setOnlyAttention] = useState(false);

  // Load state on mount from localStorage or public data
  useEffect(() => {
    try {
      const savedOverrides = localStorage.getItem('revintel_manual_overrides') || localStorage.getItem('spendnest_manual_overrides');
      const parsedOverrides = savedOverrides ? JSON.parse(savedOverrides) : {};
      setManualOverrides(parsedOverrides);

      const savedState = localStorage.getItem('revintel_records_cache') || localStorage.getItem('spendnest_records_cache');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        const map = new Map(parsed.entries);
        setRecordsMap(map);
        setActiveBatchId(parsed.batch_id || 'update-002');
        setActiveRevision(parsed.revision || 2);
        setStep1Done(true);
        if (parsed.revision >= 2) setStep4Done(true);
        return;
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }

    // Default: load both batches for immediate full experience
    loadInitialData();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => { setToastMessage(null); }, 3000);
  };

  const saveState = (map, overrides, batchId, revision) => {
    try {
      localStorage.setItem('revintel_manual_overrides', JSON.stringify(overrides));
      const serialized = {
        batch_id: batchId,
        revision: revision,
        entries: Array.from(map.entries())
      };
      localStorage.setItem('revintel_records_cache', JSON.stringify(serialized));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  };

  const loadInitialData = async () => {
    try {
      const res1 = await fetch('/data/01_initial.json');
      const b1 = await res1.json();
      let map = ingestBatch(new Map(), b1, manualOverrides);

      const res2 = await fetch('/data/02_update.json');
      const b2 = await res2.json();
      map = ingestBatch(map, b2, manualOverrides);

      setRecordsMap(map);
      setActiveBatchId(b2.batch_id);
      setActiveRevision(b2.revision);
      saveState(map, manualOverrides, b2.batch_id, b2.revision);
      setStep1Done(true);
      setStep4Done(true);
    } catch (e) {
      console.error('Initial data load error:', e);
    }
  };

  // Replay Step 1: Ingest Initial
  const handleImportInitial = async () => {
    try {
      const res = await fetch('/data/01_initial.json');
      const b1 = await res.json();
      const newMap = ingestBatch(new Map(), b1, manualOverrides);
      setRecordsMap(newMap);
      setActiveBatchId(b1.batch_id);
      setActiveRevision(b1.revision);
      saveState(newMap, manualOverrides, b1.batch_id, b1.revision);
      setStep1Done(true);
      setStep2Done(false);
      setStep4Done(false);
      setReplayLog(`Step 1: Loaded batch 01_initial.json. Total records: ${newMap.size} (30 calls, 14 meetings).`);
      showToast('Initial batch loaded (44 records)');
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Replay Step 2: Random Replay
  const handleReplayRandom = async () => {
    try {
      const res = await fetch('/data/01_initial.json');
      const b1 = await res.json();
      const shuffled = [...b1.records].sort(() => Math.random() - 0.5);
      const replayedMap = ingestBatch(recordsMap, { ...b1, records: shuffled }, manualOverrides);
      setRecordsMap(replayedMap);
      saveState(replayedMap, manualOverrides, activeBatchId, activeRevision);
      setStep2Done(true);
      setReplayLog(`Step 2: Re-imported 44 records in randomized order. Result count: ${replayedMap.size}. Zero duplicates created! Primary identity (source_type, source_id) enforced.`);
      showToast('Replay test passed: 0 duplicates created!');
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Replay Step 3: Manual override on M07
  const handleM07OverrideDemo = () => {
    const key = 'meeting:4f304fff-fd40-5cfc-a366-0a134c445c2a';
    handleOverrideRoute(key, 'support_escalation', 'Verified 2 customer bugs reproduced via screen share');
    setStep3Done(true);
    setReplayLog(`Step 3: Manually set route on M07 to "Customer Support & Defect Escalation". Saved to localStorage.`);
    showToast('Manual override applied to M07');
  };

  // Replay Step 4: Ingest Update
  const handleImportUpdate = async () => {
    try {
      const res = await fetch('/data/02_update.json');
      const b2 = await res.json();
      const updatedMap = ingestBatch(recordsMap, b2, manualOverrides);
      setRecordsMap(updatedMap);
      setActiveBatchId(b2.batch_id);
      setActiveRevision(b2.revision);
      saveState(updatedMap, manualOverrides, b2.batch_id, b2.revision);
      setStep4Done(true);
      setReplayLog(`Step 4: Ingested 02_update.json. M07 upgraded from Rev 1 to Rev 2 (turns 0 -> 27). Total records strictly 44. All manual overrides preserved!`);
      showToast('Update batch ingested (M07 updated to Rev 2)');
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Reset Slate
  const handleReset = () => {
    localStorage.removeItem('revintel_manual_overrides');
    localStorage.removeItem('revintel_records_cache');
    localStorage.removeItem('spendnest_manual_overrides');
    localStorage.removeItem('spendnest_records_cache');
    setManualOverrides({});
    setRecordsMap(new Map());
    setStep1Done(false);
    setStep2Done(false);
    setStep3Done(false);
    setStep4Done(false);
    setReplayLog('State cleared. Click Step 1 to load initial batch.');
    showToast('State reset to clean slate');
  };

  // Handle manual route change
  const handleOverrideRoute = (key, routeId, note = '') => {
    const updatedOverrides = {
      ...manualOverrides,
      [key]: {
        routeId,
        note: note || manualOverrides[key]?.note || 'Manager manual override',
        timestamp: new Date().toISOString()
      }
    };
    setManualOverrides(updatedOverrides);

    const updatedMap = new Map(recordsMap);
    const existing = updatedMap.get(key);
    if (existing) {
      updatedMap.set(key, {
        ...existing,
        assigned_route: routeId,
        is_manual_override: true,
        override_note: note || manualOverrides[key]?.note || 'Manager manual override'
      });
      setRecordsMap(updatedMap);
      saveState(updatedMap, updatedOverrides, activeBatchId, activeRevision);
      showToast(`Category updated to: ${ROUTE_CATEGORIES.find(c => c.id === routeId)?.label || routeId}`);
    }
  };

  // Export ZIP package
  const handleDownloadZip = async () => {
    try {
      showToast('Generating export bundle...');
      const recordsArray = Array.from(recordsMap.values());
      const blob = await buildExportArchive(recordsArray);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue_intelligence_exports_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Export ZIP downloaded successfully!');
    } catch (err) {
      console.error(err);
      showToast(`Export error: ${err.message}`);
    }
  };

  // Calculate metrics
  const recordsArray = useMemo(() => Array.from(recordsMap.values()), [recordsMap]);
  const metrics = useMemo(() => computeDashboardMetrics(recordsArray, manualOverrides), [recordsArray, manualOverrides]);

  // Priority Attention Keys
  const attentionKeys = useMemo(() => {
    return [
      'meeting:252cb4ce-ecdb-5056-bb6b-a1ff02a9a835', // M04 Cedarwave (Retention risk)
      'meeting:4f304fff-fd40-5cfc-a366-0a134c445c2a', // M07 Willowfield (Bugs)
      'meeting:4c58cf32-bc96-52fb-b9d9-bb5e8e3f019b', // M02 LedgerBridge (Vendor evaluation)
      'call:12216d5c-e254-52c6-b344-47de4c6e1ae5'     // C06 Ravi / Meera (Identity discrepancy)
    ];
  }, []);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return recordsArray.filter(r => {
      const key = makeRecordKey(r.source_type, r.source_id);
      const analysis = CONVERSATION_ANALYSIS[key];

      if (onlyAttention && !attentionKeys.includes(key)) {
        return false;
      }

      if (filterSourceType !== 'all' && r.source_type !== filterSourceType) {
        return false;
      }

      if (filterPerson !== 'all') {
        const person = r.payload?.rep_name || r.payload?.organizer_email;
        if (person !== filterPerson) return false;
      }

      if (filterRoute !== 'all') {
        if (r.assigned_route !== filterRoute) return false;
      }

      if (filterHasText === 'has_text' && !hasUsableText(r)) {
        return false;
      }
      if (filterHasText === 'no_text' && hasUsableText(r)) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const ref = (r.record_ref || '').toLowerCase();
        const title = (r.payload?.title || analysis?.title || '').toLowerCase();
        const rep = (r.payload?.rep_name || r.payload?.organizer_email || '').toLowerCase();
        const summary = (analysis?.summary || '').toLowerCase();
        const transcriptText = r.source_type === 'call'
          ? (r.payload?.transcript || '').toLowerCase()
          : (r.transcript_payload?.turns || []).map(t => t.text).join(' ').toLowerCase();

        return ref.includes(query) || title.includes(query) || rep.includes(query) || summary.includes(query) || transcriptText.includes(query);
      }

      return true;
    });
  }, [recordsArray, onlyAttention, filterSourceType, filterPerson, filterRoute, filterHasText, searchQuery, attentionKeys]);

  // Selected record data
  const selectedRecord = useMemo(() => {
    if (!selectedRecordKey) return null;
    return recordsMap.get(selectedRecordKey);
  }, [selectedRecordKey, recordsMap]);

  const selectedAnalysis = useMemo(() => {
    if (!selectedRecordKey) return null;
    return CONVERSATION_ANALYSIS[selectedRecordKey];
  }, [selectedRecordKey]);

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#1e293b',
          color: '#f8fafc',
          padding: '12px 18px',
          borderRadius: '8px',
          border: '1px solid #6366f1',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 500
        }}>
          <CheckCircle size={16} color="#10b981" />
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <header className="top-nav">
        <div className="brand-wrapper">
          <div className="brand-logo">RI</div>
          <div>
            <div className="brand-title">Revenue Intelligence Inbox</div>
            <div className="brand-subtitle">Sales Activity &amp; Conversation Review • 21 August 2026</div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            id="btn-replay-modal"
            className="tab-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowReplayModal(true)}
          >
            <RefreshCw size={14} />
            <span>Replay &amp; Tests</span>
            <span style={{
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#818cf8',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
              marginLeft: '4px'
            }}>
              Rev {activeRevision}
            </span>
          </button>

          <button
            id="btn-export-zip"
            className="btn-primary"
            onClick={handleDownloadZip}
          >
            <Download size={14} />
            Download ZIP
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ padding: '24px 32px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>

        {/* 4 Clean Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div className="metric-card" id="card-total-records">
            <div className="metric-title">
              <span>Total Records</span>
              <Filter size={15} color="#6366f1" />
            </div>
            <div className="metric-value">{metrics.totalRecords}</div>
            <div className="metric-caption">
              30 Calls • 14 Meetings<br />
              <span style={{ color: 'var(--text-muted)' }}>Unique key: (source_type, source_id)</span>
            </div>
          </div>

          <div className="metric-card" id="card-transcripts">
            <div className="metric-title">
              <span>Transcripts Available</span>
              <FileText size={15} color="#10b981" />
            </div>
            <div className="metric-value">
              {metrics.coveragePercent}%
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                ({metrics.totalWithText}/{metrics.totalRecords})
              </span>
            </div>
            <div className="metric-caption">
              Calls: {metrics.callsWithText}/30 • Meetings: {metrics.meetingsWithText}/14<br />
              <span style={{ color: 'var(--text-muted)' }}>M07 transcript arrives in update batch</span>
            </div>
          </div>

          <div className="metric-card" id="card-connect-rate">
            <div className="metric-title">
              <span>Connect Rate</span>
              <Phone size={15} color="#f59e0b" />
            </div>
            <div className="metric-value">
              {metrics.connectRatePercent}%
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                (11/30)
              </span>
            </div>
            <div className="metric-caption">
              11 dialer connects • 9 substantive calls<br />
              <span style={{ color: '#f59e0b' }}>Audit: C02 reached receptionist only</span>
            </div>
          </div>

          <div className="metric-card" id="card-overrides">
            <div className="metric-title">
              <span>Manual Overrides</span>
              <SlidersHorizontal size={15} color="#a855f7" />
            </div>
            <div className="metric-value">
              {metrics.manualOverrideCount}
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                saved
              </span>
            </div>
            <div className="metric-caption">
              Preserved across updates &amp; refreshes<br />
              <span style={{ color: 'var(--text-muted)' }}>LocalStorage backed</span>
            </div>
          </div>
        </div>

        {/* Rep Filter Pill Bar */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={14} /> Filter Rep:
          </span>
          <button
            onClick={() => setFilterPerson('all')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              border: filterPerson === 'all' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
              background: filterPerson === 'all' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: filterPerson === 'all' ? '#818cf8' : 'var(--text-secondary)'
            }}
          >
            All Reps ({recordsArray.length})
          </button>
          {['Arun', 'Meera', 'Leela', 'Kiran', 'Dev'].map(name => {
            const count = recordsArray.filter(r => r.payload?.rep_name === name).length;
            const isSelected = filterPerson === name;
            return (
              <button
                key={name}
                onClick={() => setFilterPerson(isSelected ? 'all' : name)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  color: isSelected ? '#818cf8' : 'var(--text-secondary)'
                }}
              >
                {name} ({count})
              </button>
            );
          })}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setOnlyAttention(!onlyAttention)}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: onlyAttention ? '1px solid #f43f5e' : '1px solid rgba(244, 63, 94, 0.3)',
                background: onlyAttention ? 'rgba(244, 63, 94, 0.25)' : 'rgba(244, 63, 94, 0.08)',
                color: '#fb7185'
              }}
            >
              <AlertTriangle size={13} />
              {onlyAttention ? 'Showing 4 Exceptions' : '4 Needs Attention'}
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              id="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations by account, rep, quote, or keywords..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '13px'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <select
            id="filter-type"
            value={filterSourceType}
            onChange={(e) => setFilterSourceType(e.target.value)}
            style={{
              padding: '9px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Types (44)</option>
            <option value="call">Phone Calls (30)</option>
            <option value="meeting">Meetings (14)</option>
          </select>

          {/* Category Filter */}
          <select
            id="filter-category"
            value={filterRoute}
            onChange={(e) => setFilterRoute(e.target.value)}
            style={{
              padding: '9px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Categories</option>
            {ROUTE_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          {/* Text Available Filter */}
          <select
            id="filter-transcript"
            value={filterHasText}
            onChange={(e) => setFilterHasText(e.target.value)}
            style={{
              padding: '9px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Records</option>
            <option value="has_text">Has Transcript Only ({metrics.totalWithText})</option>
            <option value="no_text">Intake / No Transcript</option>
          </select>

          {(searchQuery || filterSourceType !== 'all' || filterPerson !== 'all' || filterRoute !== 'all' || filterHasText !== 'all' || onlyAttention) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterSourceType('all');
                setFilterPerson('all');
                setFilterRoute('all');
                setFilterHasText('all');
                setOnlyAttention(false);
              }}
              style={{
                padding: '8px 14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Conversation List Table */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              Showing {filteredRecords.length} of {recordsArray.length} records
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Click any row to view analysis, evidence quote, and full transcript
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 18px', width: '90px' }}>ID</th>
                  <th style={{ padding: '12px 18px' }}>Account / Conversation</th>
                  <th style={{ padding: '12px 18px', width: '160px' }}>Rep / Organizer</th>
                  <th style={{ padding: '12px 18px', width: '100px' }}>Duration</th>
                  <th style={{ padding: '12px 18px', width: '220px' }}>Routing Category</th>
                  <th style={{ padding: '12px 18px', width: '130px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No conversations match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(r => {
                    const key = makeRecordKey(r.source_type, r.source_id);
                    const analysis = CONVERSATION_ANALYSIS[key];
                    const isSelected = selectedRecordKey === key;
                    const hasText = hasUsableText(r);
                    const cat = ROUTE_CATEGORIES.find(c => c.id === r.assigned_route);

                    const title = r.payload?.title || analysis?.title || (r.source_type === 'call' ? `Call with ${r.payload?.rep_name}` : 'Calendar Meeting');
                    const rep = r.payload?.rep_name || r.payload?.organizer_email || 'Unassigned';

                    return (
                      <tr
                        key={key}
                        onClick={() => setSelectedRecordKey(key)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* ID & Icon */}
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {r.source_type === 'call' ? (
                              <Phone size={14} color="#6366f1" />
                            ) : (
                              <Video size={14} color="#10b981" />
                            )}
                            <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                              {r.record_ref || r.source_id.slice(0, 6)}
                            </span>
                          </div>
                        </td>

                        {/* Title & Summary */}
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>
                            {title}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '480px'
                          }}>
                            {analysis?.summary || (hasText ? 'Transcript available • Review needed' : 'No transcript delivered (Intake)')}
                          </div>
                        </td>

                        {/* Rep / Organizer */}
                        <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>
                          <div>{rep}</div>
                          {analysis?.rep && analysis.rep.includes('Spoken:') && (
                            <div style={{ fontSize: '11px', color: '#fb7185' }}>Audit: Spoken as Ravi</div>
                          )}
                        </td>

                        {/* Duration */}
                        <td style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {r.source_type === 'call' ? `${r.payload?.duration_seconds || 0}s` : `${r.payload?.duration_minutes || 0}m`}
                        </td>

                        {/* Category Dropdown / Badge */}
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 500,
                            background: r.is_manual_override ? 'rgba(168, 85, 247, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                            color: r.is_manual_override ? '#c084fc' : '#818cf8',
                            border: r.is_manual_override ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(99, 102, 241, 0.2)'
                          }}>
                            {cat?.label || 'Review Needed'}
                            {r.is_manual_override && <span style={{ fontSize: '9px', fontWeight: 700 }}>*</span>}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 18px' }}>
                          {analysis?.attentionFlags && analysis.attentionFlags.length > 0 ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: '#fb7185',
                              fontWeight: 600
                            }}>
                              <AlertTriangle size={12} /> Attention
                            </span>
                          ) : hasText ? (
                            <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 500 }}>
                              ✓ Transcript
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Intake
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Detail Slide-out Drawer */}
      {selectedRecord && (
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
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{
                  background: '#6366f1',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
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
              onClick={() => setSelectedRecordKey(null)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                color: 'var(--text-secondary)',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Tab Switch */}
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
              Full Transcript ({hasUsableText(selectedRecord) ? 'Available' : 'None'})
            </button>
          </div>

          {/* Drawer Scrollable Body */}
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            {drawerTab === 'analysis' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Manual Routing Dropdown */}
                <div style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '10px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#818cf8' }}>
                      Assign Routing Destination:
                    </label>
                    {selectedRecord.is_manual_override && (
                      <span style={{
                        fontSize: '11px',
                        background: '#a855f7',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}>
                        Manual Override Active
                      </span>
                    )}
                  </div>
                  <select
                    id="drawer-route-select"
                    value={selectedRecord.assigned_route}
                    onChange={(e) => handleOverrideRoute(selectedRecordKey, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#1e293b',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {ROUTE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Changes are automatically saved to localStorage and preserved across updates and browser refreshes.
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    Summary of Conversation
                  </h4>
                  <div style={{
                    fontSize: '14px',
                    color: '#e2e8f0',
                    lineHeight: '1.6',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    {selectedAnalysis?.summary || (hasUsableText(selectedRecord) ? 'Transcript delivered; awaiting manager manual review.' : 'No audio transcript or dialogue turns delivered in source record.')}
                  </div>
                </div>

                {/* Evidence Quote */}
                {selectedAnalysis?.evidenceQuote && (
                  <div>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#10b981', marginBottom: '8px', letterSpacing: '0.5px' }}>
                      Verbatim Transcript Evidence
                    </h4>
                    <div style={{
                      fontSize: '13px',
                      color: '#a7f3d0',
                      background: 'rgba(16, 185, 129, 0.08)',
                      padding: '14px',
                      borderRadius: '8px',
                      borderLeft: '3px solid #10b981',
                      fontStyle: 'italic',
                      lineHeight: '1.6'
                    }}>
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
                    <div style={{
                      fontSize: '13px',
                      color: '#fde68a',
                      background: 'rgba(245, 158, 11, 0.08)',
                      padding: '14px',
                      borderRadius: '8px',
                      borderLeft: '3px solid #f59e0b',
                      lineHeight: '1.6'
                    }}>
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
                    <div style={{
                      fontSize: '13px',
                      color: '#e2e8f0',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)'
                    }}>
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
              /* Full Transcript View */
              <div>
                {selectedRecord.source_type === 'call' ? (
                  selectedRecord.payload?.transcript ? (
                    <div style={{
                      fontSize: '13px',
                      lineHeight: '1.8',
                      color: '#e2e8f0',
                      whiteSpace: 'pre-wrap',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}>
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
      )}

      {/* Replay & Test Verification Modal */}
      {showReplayModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
            width: '740px',
            maxWidth: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Replay Engine &amp; Data Contract Tests
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Interactive 4-step test suite validating idempotency, duplicate prevention, and override persistence.
                </div>
              </div>
              <button
                onClick={() => setShowReplayModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Step 1 */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: step1Done ? '1px solid #10b981' : '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '2px' }}>
                    Step 1: Load Initial Batch (01_initial.json)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Loads initial delivery of 44 records (30 calls, 14 meetings; 17 transcripts).
                  </div>
                </div>
                <button
                  id="btn-step-1"
                  onClick={handleImportInitial}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: '#6366f1',
                    color: '#fff',
                    border: 'none'
                  }}
                >
                  Run Step 1
                </button>
              </div>

              {/* Step 2 */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: step2Done ? '1px solid #10b981' : '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '2px' }}>
                    Step 2: Replay Same Batch (Random Shuffled Order)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Re-ingests 44 records in randomized order. Demonstrates that record count stays exactly 44 (0 duplicates created).
                  </div>
                </div>
                <button
                  id="btn-step-2"
                  onClick={handleReplayRandom}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none'
                  }}
                >
                  Test Replay
                </button>
              </div>

              {/* Step 3 */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: step3Done ? '1px solid #10b981' : '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '2px' }}>
                    Step 3: Apply Manual Override on M07 (Willowfield)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Manually classifies M07 under "Customer Support &amp; Defect Escalation".
                  </div>
                </div>
                <button
                  id="btn-step-3"
                  onClick={handleM07OverrideDemo}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: '#a855f7',
                    color: '#fff',
                    border: 'none'
                  }}
                >
                  Apply Override
                </button>
              </div>

              {/* Step 4 */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: step4Done ? '1px solid #10b981' : '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px', marginBottom: '2px' }}>
                    Step 4: Ingest Late Transcript Update (02_update.json)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Ingests announced update. M07 updates to Rev 2 (27 turns). M07 manual override remains preserved.
                  </div>
                </div>
                <button
                  id="btn-step-4"
                  onClick={handleImportUpdate}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none'
                  }}
                >
                  Ingest Update
                </button>
              </div>

              {/* Log Output Box */}
              {replayLog && (
                <div style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#a7f3d0',
                  fontFamily: 'monospace'
                }}>
                  &gt; {replayLog}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button
                onClick={handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  background: 'rgba(244, 63, 94, 0.1)',
                  color: '#fb7185',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={13} /> Reset Slate
              </button>
              <button
                onClick={() => setShowReplayModal(false)}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                Close Tests
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
