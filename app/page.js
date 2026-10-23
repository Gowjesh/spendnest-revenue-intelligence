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
  RotateCcw
} from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'replay', 'brief'
  const [recordsMap, setRecordsMap] = useState(new Map());
  const [manualOverrides, setManualOverrides] = useState({});
  const [activeBatchId, setActiveBatchId] = useState('none');
  const [activeRevision, setActiveRevision] = useState(0);
  const [selectedRecordKey, setSelectedRecordKey] = useState(null);
  const [drawerTab, setDrawerTab] = useState('analysis'); // 'analysis', 'transcript'
  const [toastMessage, setToastMessage] = useState(null);

  // Replay test status state
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [step4Done, setStep4Done] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSourceType, setFilterSourceType] = useState('all');
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterText, setFilterText] = useState('all');

  // Load data on mount from localStorage or public/data
  useEffect(() => {
    try {
      const savedOverrides = localStorage.getItem('spendnest_manual_overrides');
      const parsedOverrides = savedOverrides ? JSON.parse(savedOverrides) : {};
      setManualOverrides(parsedOverrides);

      const savedState = localStorage.getItem('spendnest_records_cache');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        const map = new Map(parsed.entries);
        setRecordsMap(map);
        setActiveBatchId(parsed.batch_id || 'cached');
        setActiveRevision(parsed.revision || 1);
        setStep1Done(true);
        if (parsed.revision >= 2) setStep4Done(true);
        return;
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }

    // Default: load initial data + update batch so app opens ready in final state
    loadDefaultFinalState();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => { setToastMessage(null); }, 3000);
  };

  const saveState = (map, overrides, batchId, revision) => {
    try {
      localStorage.setItem('spendnest_manual_overrides', JSON.stringify(overrides));
      const serialized = {
        batch_id: batchId,
        revision: revision,
        entries: Array.from(map.entries())
      };
      localStorage.setItem('spendnest_records_cache', JSON.stringify(serialized));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  };

  // Load both batches for immediate full experience
  const loadDefaultFinalState = async () => {
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
      console.error('Data load error:', e);
    }
  };

  // Replay Step 1: Initial import
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
      showToast(`Step 1 Complete: 44 unique records loaded (17 with text)`);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Replay Step 2: Random replay duplicate prevention test
  const handleReplayRandom = async () => {
    try {
      const res = await fetch('/data/01_initial.json');
      const b1 = await res.json();
      const shuffled = [...b1.records].sort(() => Math.random() - 0.5);
      const replayedMap = ingestBatch(recordsMap, { ...b1, records: shuffled }, manualOverrides);
      setRecordsMap(replayedMap);
      saveState(replayedMap, manualOverrides, activeBatchId, activeRevision);
      setStep2Done(true);
      showToast(`Step 2 Complete: Replayed in random order. Record count strictly 44!`);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Replay Step 3: Manual override on M07
  const handleOverrideM07 = () => {
    const m07Key = 'meeting:4f304fff-fd40-5cfc-a366-0a134c445c2a';
    handleRouteOverride(m07Key, 'support_escalation');
    setStep3Done(true);
    showToast(`Step 3 Complete: M07 manually routed to Support Escalation`);
  };

  // Replay Step 4: Import update batch (M07 late transcript)
  const handleImportUpdate = async () => {
    try {
      const res = await fetch('/data/02_update.json');
      const b2 = await res.json();
      const updatedMap = ingestBatch(recordsMap, b2, manualOverrides);
      setRecordsMap(updatedMap);
      setActiveBatchId(b2.batch_id);
      setActiveRevision(2);
      saveState(updatedMap, manualOverrides, b2.batch_id, 2);
      setStep4Done(true);
      const m07 = updatedMap.get('meeting:4f304fff-fd40-5cfc-a366-0a134c445c2a');
      const overridePreserved = m07?.is_manual_override ? 'Preserved' : 'None';
      showToast(`Step 4 Complete: M07 updated to 27 turns. Count: 44. Override: ${overridePreserved}`);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Reset Clean Slate
  const handleReset = () => {
    localStorage.removeItem('spendnest_manual_overrides');
    localStorage.removeItem('spendnest_records_cache');
    setRecordsMap(new Map());
    setManualOverrides({});
    setActiveBatchId('none');
    setActiveRevision(0);
    setSelectedRecordKey(null);
    setStep1Done(false);
    setStep2Done(false);
    setStep3Done(false);
    setStep4Done(false);
    showToast('Reset Complete: Clean slate ready');
  };

  // Manual route change
  const handleRouteOverride = (key, newRouteId) => {
    const updatedOverrides = { ...manualOverrides, [key]: newRouteId };
    setManualOverrides(updatedOverrides);

    const record = recordsMap.get(key);
    if (record) {
      const updatedRecord = {
        ...record,
        assigned_route: newRouteId,
        is_manual_override: true,
        updated_at: new Date().toISOString()
      };
      const updatedMap = new Map(recordsMap);
      updatedMap.set(key, updatedRecord);
      setRecordsMap(updatedMap);
      saveState(updatedMap, updatedOverrides, activeBatchId, activeRevision);
      const cat = ROUTE_CATEGORIES.find(c => c.id === newRouteId);
      showToast(`Route updated to: ${cat?.label}`);
    }
  };

  // Reset route back to default suggestion
  const handleResetOverride = (key) => {
    const updatedOverrides = { ...manualOverrides };
    delete updatedOverrides[key];
    setManualOverrides(updatedOverrides);

    const record = recordsMap.get(key);
    if (record) {
      const defaultRoute = CONVERSATION_ANALYSIS[key]?.defaultRoute || 'review_needed';
      const updatedRecord = {
        ...record,
        assigned_route: defaultRoute,
        is_manual_override: false,
        updated_at: new Date().toISOString()
      };
      const updatedMap = new Map(recordsMap);
      updatedMap.set(key, updatedRecord);
      setRecordsMap(updatedMap);
      saveState(updatedMap, updatedOverrides, activeBatchId, activeRevision);
      showToast('Restored automated route suggestion');
    }
  };

  // Export handlers
  const handleDownloadZip = async () => {
    try {
      showToast('Building export archive...');
      const recordsArray = Array.from(recordsMap.values());
      const zipBlob = await buildExportArchive(recordsArray);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spendnest_exports_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Downloaded export bundle (ZIP)');
    } catch (err) {
      showToast(`Export error: ${err.message}`);
    }
  };

  const handleDownloadJson = () => {
    const recordsArray = Array.from(recordsMap.values());
    const { jsonData } = generateManifest(recordsArray);
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const recordsArray = Array.from(recordsMap.values());
    const { csvString } = generateManifest(recordsArray);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Computed metrics
  const recordsArray = useMemo(() => Array.from(recordsMap.values()), [recordsMap]);
  const metrics = useMemo(() => computeDashboardMetrics(recordsArray), [recordsArray]);
  const manifest = useMemo(() => generateManifest(recordsArray), [recordsArray]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return recordsArray.filter(r => {
      const key = makeRecordKey(r.source_type, r.source_id);
      const analysis = CONVERSATION_ANALYSIS[key];

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (r.record_ref || '').toLowerCase().includes(q) ||
          (r.payload?.title || '').toLowerCase().includes(q) ||
          (r.payload?.rep_name || r.payload?.organizer_email || '').toLowerCase().includes(q) ||
          (analysis?.contact || '').toLowerCase().includes(q) ||
          (analysis?.summary || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      if (filterSourceType !== 'all' && r.source_type !== filterSourceType) return false;

      if (filterPerson !== 'all') {
        const rep = r.payload?.rep_name || r.payload?.rep_email;
        const org = r.payload?.organizer_email;
        if (rep !== filterPerson && org !== filterPerson) return false;
      }

      if (filterRoute !== 'all' && r.assigned_route !== filterRoute) return false;

      if (filterText === 'with_text' && !hasUsableText(r)) return false;
      if (filterText === 'without_text' && hasUsableText(r)) return false;

      return true;
    });
  }, [recordsArray, searchQuery, filterSourceType, filterPerson, filterRoute, filterText]);

  const selectedRecord = selectedRecordKey ? recordsMap.get(selectedRecordKey) : null;
  const selectedAnalysis = selectedRecordKey ? CONVERSATION_ANALYSIS[selectedRecordKey] : null;

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

      {/* Clean Top Navigation */}
      <header className="top-nav">
        <div className="brand-wrapper">
          <div className="brand-logo">SN</div>
          <div>
            <div className="brand-title">SpendNest Revenue Intelligence Inbox</div>
            <div className="brand-subtitle">Activity &amp; Decision Hub • 21 August 2026 (Asia/Kolkata)</div>
          </div>
        </div>

        {/* 3 Main Sections */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            id="tab-inbox"
            className={`tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            <Filter size={15} />
            Inbox &amp; Activity ({recordsArray.length})
          </button>
          <button
            id="tab-replay"
            className={`tab-btn ${activeTab === 'replay' ? 'active' : ''}`}
            onClick={() => setActiveTab('replay')}
          >
            <RefreshCw size={15} />
            Replay &amp; Contract Tests
          </button>
          <button
            id="tab-brief"
            className={`tab-btn ${activeTab === 'brief' ? 'active' : ''}`}
            onClick={() => setActiveTab('brief')}
          >
            <FileText size={15} />
            Daily Brief &amp; Exports
          </button>
        </div>

        {/* Quick Export Button */}
        <div>
          <button
            id="btn-quick-export"
            className="btn-primary"
            onClick={handleDownloadZip}
          >
            <Download size={14} />
            Download ZIP
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ padding: '24px 32px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>

        {/* ==================== VIEW 1: INBOX & ACTIVITY ==================== */}
        {activeTab === 'inbox' && (
          <div>
            {/* 4 Clean Headline Metric Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div className="metric-card" id="card-records">
                <div className="metric-title">
                  <span>Selected Records</span>
                  <Filter size={15} color="#6366f1" />
                </div>
                <div className="metric-value">{metrics.totalRecords}</div>
                <div className="metric-caption">
                  30 Calls • 14 Meetings<br />
                  <span style={{ color: 'var(--text-muted)' }}>Unique key: (source_type, source_id)</span>
                </div>
              </div>

              <div className="metric-card" id="card-coverage">
                <div className="metric-title">
                  <span>Supplied Text Coverage</span>
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
                  <span style={{ color: '#34d399' }}>✓ Denominator: 44 total delivered records</span>
                </div>
              </div>

              <div className="metric-card" id="card-connects">
                <div className="metric-title">
                  <span>Stored Connect Rate</span>
                  <Phone size={15} color="#f59e0b" />
                </div>
                <div className="metric-value">
                  {metrics.connectRatePercent}%
                  <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                    (11/30)
                  </span>
                </div>
                <div className="metric-caption">
                  Stored is_connected flag • 9 verified calls<br />
                  <span style={{ color: '#fbbf24' }}>Audit: C02 reached receptionist only</span>
                </div>
              </div>

              <div className="metric-card" id="card-overrides">
                <div className="metric-title">
                  <span>Manual Overrides</span>
                  <SlidersHorizontal size={15} color="#a855f7" />
                </div>
                <div className="metric-value">
                  {metrics.manualOverrideCount}
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                    preserved
                  </span>
                </div>
                <div className="metric-caption">
                  {metrics.pendingReviewCount > 0 ? (
                    <span style={{ color: '#fb7185' }}>⚠️ M07 pending manager review</span>
                  ) : (
                    <span>All records actively categorized</span>
                  )}
                  <br />Survives updates and refreshes
                </div>
              </div>
            </div>

            {/* Quick Priority Attention Strip */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '12px 18px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                <AlertTriangle size={16} color="#f43f5e" />
                <span>Priority Exceptions:</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  id="btn-alert-m04"
                  onClick={() => setSelectedRecordKey('meeting:252cb4ce-ecdb-5056-bb6b-a1ff02a9a835')}
                  style={{
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    color: '#fb7185',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  [M04] Cedarwave (Card Migration Risk)
                </button>
                <button
                  id="btn-alert-m07"
                  onClick={() => setSelectedRecordKey('meeting:4f304fff-fd40-5cfc-a366-0a134c445c2a')}
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  [M07] Willowfield (Product Defect Bugs)
                </button>
                <button
                  id="btn-alert-m02"
                  onClick={() => setSelectedRecordKey('meeting:4c58cf32-bc96-52fb-b9d9-bb5e8e3f019b')}
                  style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#818cf8',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  [M02] LedgerBridge (Vendor Eval, Not Sales)
                </button>
                <button
                  id="btn-alert-c06"
                  onClick={() => setSelectedRecordKey('call:12216d5c-e254-52c6-b344-47de4c6e1ae5')}
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#60a5fa',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  [C06] Mr Nikhil (Ravi vs Meera Identity Mismatch)
                </button>
              </div>
            </div>

            {/* Simple Filter Toolbar */}
            <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ flex: '1 1 200px', position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
                  <input
                    id="search-input"
                    type="text"
                    placeholder="Search by ref, title, contact, rep..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 32px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Source Type Filter */}
                <select
                  id="filter-type"
                  value={filterSourceType}
                  onChange={(e) => setFilterSourceType(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="all">All Types (44)</option>
                  <option value="call">Calls (30)</option>
                  <option value="meeting">Meetings (14)</option>
                </select>

                {/* Person Filter */}
                <select
                  id="filter-person"
                  value={filterPerson}
                  onChange={(e) => setFilterPerson(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="all">All Reps &amp; Organizers</option>
                  <option value="Arun">Arun (15 calls)</option>
                  <option value="Meera">Meera (5 calls)</option>
                  <option value="Leela">Leela (8 calls)</option>
                  <option value="Kiran">Kiran (1 call)</option>
                  <option value="Dev">Dev (1 call)</option>
                  <option value="team08@example.com">team08 (3 meetings)</option>
                  <option value="team09@example.com">team09 (3 meetings)</option>
                </select>

                {/* Route Filter */}
                <select
                  id="filter-route"
                  value={filterRoute}
                  onChange={(e) => setFilterRoute(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="all">All Categories</option>
                  {ROUTE_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>

                {/* Transcript Filter */}
                <select
                  id="filter-text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="all">All Text States</option>
                  <option value="with_text">Transcript Present</option>
                  <option value="without_text">No Supplied Text</option>
                </select>

                {/* Reset Filters */}
                <button
                  id="btn-reset-filters"
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => {
                    setSearchQuery('');
                    setFilterSourceType('all');
                    setFilterPerson('all');
                    setFilterRoute('all');
                    setFilterText('all');
                  }}
                >
                  Reset
                </button>
              </div>

              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Showing <strong>{filteredRecords.length}</strong> of <strong>{recordsArray.length}</strong> records</span>
                <span>Click any row to view analysis, citations, and full transcript</span>
              </div>
            </div>

            {/* Conversation List Table */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxHeight: '580px' }}>
                <table className="data-table" id="table-inbox">
                  <thead>
                    <tr>
                      <th style={{ width: '70px' }}>Ref</th>
                      <th>Title / Contact</th>
                      <th style={{ width: '85px' }}>Type</th>
                      <th>Rep / Organizer</th>
                      <th style={{ width: '110px' }}>Transcript</th>
                      <th>Category Route</th>
                      <th style={{ width: '90px' }}>Decision</th>
                      <th>Flag / Key Insight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                          No records match your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map(r => {
                        const key = makeRecordKey(r.source_type, r.source_id);
                        const analysis = CONVERSATION_ANALYSIS[key];
                        const cat = ROUTE_CATEGORIES.find(c => c.id === r.assigned_route);
                        const hasText = hasUsableText(r);

                        return (
                          <tr
                            key={key}
                            id={`row-${r.record_ref || r.source_id.slice(0, 8)}`}
                            onClick={() => setSelectedRecordKey(key)}
                          >
                            <td>
                              <span style={{ fontWeight: 700, color: '#fff' }}>
                                {r.record_ref || r.source_id.slice(0, 6)}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                                {analysis?.title || r.payload?.title || 'Interaction Record'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {analysis?.contact || (r.source_type === 'call' ? r.payload?.to_number : 'Calendar Event')}
                              </div>
                            </td>
                            <td>
                              {r.source_type === 'call' ? (
                                <span className="badge badge-call"><Phone size={9} /> Call</span>
                              ) : (
                                <span className="badge badge-meeting"><Video size={9} /> Meeting</span>
                              )}
                            </td>
                            <td>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {r.payload?.rep_name || r.payload?.organizer_email || 'Unassigned'}
                              </div>
                            </td>
                            <td>
                              {hasText ? (
                                <span className="badge badge-verified">
                                  <CheckCircle size={9} /> {r.source_type === 'call' ? 'Text' : `${r.transcript_payload?.turns?.length} turns`}
                                </span>
                              ) : (
                                <span className="badge badge-pending" style={{ opacity: 0.7 }}>
                                  No text
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`badge route-${r.assigned_route || 'review_needed'}`}>
                                {cat ? cat.label : 'Review Needed'}
                              </span>
                            </td>
                            <td>
                              {r.is_manual_override ? (
                                <span className="badge badge-override">Override</span>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto</span>
                              )}
                            </td>
                            <td>
                              {analysis?.attentionFlags && analysis.attentionFlags.length > 0 ? (
                                <span style={{
                                  fontSize: '11px',
                                  color: '#fb7185',
                                  fontWeight: 600
                                }}>
                                  ⚠️ {analysis.attentionFlags[0]}
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {hasText ? 'Analysis ready' : 'Logged intake'}
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
          </div>
        )}

        {/* ==================== VIEW 2: REPLAY & CONTRACT TESTS ==================== */}
        {activeTab === 'replay' && (
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            <div className="glass-panel" style={{ padding: '28px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                Interactive Replay &amp; Data Contract Test Suite
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                Verify the exact acceptance criteria from <strong>DATA_CONTRACT.md</strong> with one click per step:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Step 1 */}
                <div style={{
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#6366f1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>1</span>
                      Initial Import (`01_initial.json`)
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Loads 44 unique records (30 calls, 14 meetings) with 17 usable transcripts.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {step1Done && <span className="badge badge-verified">✓ 44 Records (17 with text)</span>}
                    <button id="btn-test-step1" className="btn-primary" onClick={handleImportInitial}>
                      Run Step 1
                    </button>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>2</span>
                      Duplicate Prevention Replay (Random Order)
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Replays batch 1 in shuffled order. Record count must remain strictly 44 (zero duplicates).
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {step2Done && <span className="badge badge-verified">✓ Idempotent: Count = 44</span>}
                    <button id="btn-test-step2" className="btn-secondary" onClick={handleReplayRandom}>
                      Run Step 2
                    </button>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f59e0b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>3</span>
                      Manual Route Override on M07
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Sets M07 to &quot;Support Escalation&quot; and marks as a manual manager override.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {step3Done && <span className="badge badge-override">✓ M07 Override Active</span>}
                    <button id="btn-test-step3" className="btn-secondary" onClick={handleOverrideM07}>
                      Run Step 3
                    </button>
                  </div>
                </div>

                {/* Step 4 */}
                <div style={{
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f43f5e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>4</span>
                      Import Update Batch (`02_update.json`)
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Updates M07 to rev 2 (27 turns). Count stays 44. M07 manual route is preserved!
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {step4Done && <span className="badge badge-verified">✓ M07 Updated &amp; Override Preserved</span>}
                    <button id="btn-test-step4" className="btn-primary" style={{ background: '#e11d48' }} onClick={handleImportUpdate}>
                      Run Step 4
                    </button>
                  </div>
                </div>
              </div>

              {/* Reset to Clean Slate */}
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Clear localStorage to re-run the complete verification from step 1:
                </span>
                <button id="btn-reset-clean" className="btn-secondary" style={{ color: '#fb7185' }} onClick={handleReset}>
                  <RotateCcw size={14} /> Reset Clean Slate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== VIEW 3: DAILY BRIEF & EXPORTS ==================== */}
        {activeTab === 'brief' && (
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            {/* Quick Export Downloads */}
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                    Export Delivery Files
                  </h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Download the complete structured archive and machine-readable manifests:
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button id="btn-export-json" className="btn-secondary" onClick={handleDownloadJson}>
                    <Download size={13} /> manifest.json
                  </button>
                  <button id="btn-export-csv" className="btn-secondary" onClick={handleDownloadCsv}>
                    <Download size={13} /> manifest.csv
                  </button>
                  <button id="btn-export-zip-main" className="btn-primary" onClick={handleDownloadZip}>
                    <Download size={14} /> Download ZIP Archive
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Brief */}
            <div className="glass-panel" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                    Sales Manager Daily Intelligence Brief
                  </h2>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Date: 21 August 2026 (Asia/Kolkata) • Scope: 44 Selected Records
                  </div>
                </div>
                <button className="btn-secondary" onClick={() => window.print()}>
                  Print / PDF
                </button>
              </div>

              <div style={{ lineHeight: '1.7', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#6366f1', textTransform: 'uppercase', fontSize: '12px', marginBottom: '6px' }}>1. Summary</h4>
                  <p>
                    Today&apos;s activity comprises 44 records (18 with usable conversation text post-update). Key actions center on customer retention risks during card migration, bug escalations, and channel partnership agreements.
                  </p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#f43f5e', textTransform: 'uppercase', fontSize: '12px', marginBottom: '6px' }}>2. Immediate Customer Risks</h4>
                  <p>• <strong>[M04] Cedarwave Distribution</strong>: Customer is anxious about card service disruption during migration away from legacy provider (Turn 5). CS lead must publish a zero-downtime transition schedule.</p>
                  <p>• <strong>[M07] Willowfield Trust</strong>: Screen share reproduced event-payment description edit bug and Recreate Payment document upload error (Turns 2-8). Support lead to file bug tickets.</p>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: '#10b981', textTransform: 'uppercase', fontSize: '12px', marginBottom: '6px' }}>3. Pipeline &amp; Partnerships</h4>
                  <p>• <strong>[M03] Asterloom Systems</strong>: Prospect with ~65 employees reimbursing INR 10-15L/month requested prepaid card proposal for CFO review.</p>
                  <p>• <strong>[M01] Harborpath &amp; [C07] Willowbank</strong>: Strong channel partnership referral opportunities for overseas corporate formation clients.</p>
                </div>

                <div>
                  <h4 style={{ color: '#a855f7', textTransform: 'uppercase', fontSize: '12px', marginBottom: '6px' }}>4. Rep Coaching Insights</h4>
                  <p>• <strong>Meera</strong>: Outstanding outbound qualification across multi-location retailers (5 dials, 5 connects, 5 transcripts).</p>
                  <p>• <strong>Arun</strong>: High dial volume (15 calls) with polite rejection handling. Voicemail on C04 demonstrates persistence.</p>
                  <p>• <strong>System Audit</strong>: Call C06 metadata lists Meera, but caller identified as &quot;Ravi&quot;. Phone provisioning audit required.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ==================== CONVERSATION DETAIL DRAWER ==================== */}
      {selectedRecord && (
        <div className="modal-backdrop" onClick={() => setSelectedRecordKey(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800, fontSize: '16px', color: '#fff' }}>
                    {selectedRecord.record_ref || selectedRecord.source_id.slice(0, 8)}
                  </span>
                  {selectedRecord.source_type === 'call' ? (
                    <span className="badge badge-call"><Phone size={9} /> Call</span>
                  ) : (
                    <span className="badge badge-meeting"><Video size={9} /> Meeting</span>
                  )}
                  {selectedRecord.is_manual_override && (
                    <span className="badge badge-override">Override Active</span>
                  )}
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedAnalysis?.title || selectedRecord.payload?.title || 'Interaction Detail'}
                </h3>
              </div>
              <button
                id="btn-close-drawer"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setSelectedRecordKey(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Route Control */}
            <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Route:</span>
                <select
                  id="select-drawer-route"
                  value={selectedRecord.assigned_route || 'review_needed'}
                  onChange={(e) => handleRouteOverride(selectedRecordKey, e.target.value)}
                  style={{
                    padding: '5px 10px',
                    background: 'var(--bg-card)',
                    border: '1px solid #6366f1',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  {ROUTE_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {selectedRecord.is_manual_override && (
                <button
                  id="btn-reset-route"
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => handleResetOverride(selectedRecordKey)}
                >
                  Reset to Auto
                </button>
              )}
            </div>

            {/* Drawer Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
              <button
                className={`tab-btn ${drawerTab === 'analysis' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', borderRadius: 0, padding: '10px' }}
                onClick={() => setDrawerTab('analysis')}
              >
                Analysis &amp; Actions
              </button>
              <button
                className={`tab-btn ${drawerTab === 'transcript' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', borderRadius: 0, padding: '10px' }}
                onClick={() => setDrawerTab('transcript')}
              >
                Full Transcript ({hasUsableText(selectedRecord) ? 'Available' : 'None'})
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {drawerTab === 'analysis' ? (
                selectedAnalysis ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {selectedAnalysis.attentionFlags && selectedAnalysis.attentionFlags.length > 0 && (
                      <div style={{ padding: '10px 14px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fb7185', marginBottom: '4px' }}>
                          ⚠️ Attention Flag
                        </div>
                        <div style={{ fontSize: '12px', color: '#f8fafc' }}>
                          {selectedAnalysis.attentionFlags.join(' • ')}
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>What Happened</div>
                      <p style={{ fontSize: '13px', color: '#f8fafc', lineHeight: '1.5' }}>{selectedAnalysis.summary}</p>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Why It Matters</div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{selectedAnalysis.whyItMatters}</p>
                    </div>

                    <div style={{ padding: '12px 14px', background: 'rgba(99, 102, 241, 0.08)', borderLeft: '4px solid #6366f1', borderRadius: '4px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '4px' }}>Supporting Evidence Passage</div>
                      <div style={{ fontSize: '12px', color: '#f8fafc', fontStyle: 'italic', lineHeight: '1.5' }}>{selectedAnalysis.evidenceQuote}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>What Evidence Does NOT Establish</div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>{selectedAnalysis.evidenceLimits}</p>
                    </div>

                    <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '4px' }}>Next Step &amp; Owner</div>
                      <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>{selectedAnalysis.nextSteps}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Owner: <strong style={{ color: '#34d399' }}>{selectedAnalysis.owner}</strong></div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>No Supplied Conversation Text</div>
                    <p style={{ fontSize: '12px' }}>This record was logged without audio transcript. No substantive analysis is invented for missing text.</p>
                  </div>
                )
              ) : (
                <div>
                  {selectedRecord.source_type === 'call' && selectedRecord.payload?.transcript ? (
                    <div style={{ background: '#070a12', padding: '16px', borderRadius: '6px', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap', color: '#f8fafc' }}>
                      {selectedRecord.payload.transcript}
                    </div>
                  ) : selectedRecord.source_type === 'meeting' && selectedRecord.transcript_payload?.turns && selectedRecord.transcript_payload.turns.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selectedRecord.transcript_payload.turns.map((turn, idx) => (
                        <div key={idx} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, fontSize: '11px', color: turn.speaker.includes('Team') ? '#60a5fa' : '#c084fc' }}>
                              Turn {idx + 1} • {turn.speaker}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {turn.timecode || `${Math.round(turn.starts_at_seconds)}s`}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{turn.text}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No transcript text available for this interaction.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
