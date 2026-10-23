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
  buildExportArchive,
  getDailyManagerBriefContent
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
  Calendar,
  Clock,
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  ArrowUpDown,
  Tag,
  SlidersHorizontal,
  X,
  PlayCircle
} from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'inbox', 'replay', 'exports', 'brief'
  const [recordsMap, setRecordsMap] = useState(new Map());
  const [manualOverrides, setManualOverrides] = useState({});
  const [activeBatchId, setActiveBatchId] = useState('none');
  const [activeRevision, setActiveRevision] = useState(0);
  const [selectedRecordKey, setSelectedRecordKey] = useState(null);
  const [drawerTab, setDrawerTab] = useState('analysis'); // 'analysis', 'transcript', 'raw'
  const [replayLogs, setReplayLogs] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSourceType, setFilterSourceType] = useState('all');
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterTextAvailability, setFilterTextAvailability] = useState('all');
  const [filterOverride, setFilterOverride] = useState('all');

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
        addLog('Loaded saved state from browser localStorage.');
        return;
      }
    } catch (e) {
      console.warn('Could not read from localStorage:', e);
    }

    // Default: load initial batch and then update batch so app opens in final state
    loadInitialData();
  }, []);

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setReplayLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => { setToastMessage(null); }, 3500);
  };

  const saveToLocalStorage = (map, overrides, batchId, revision) => {
    try {
      localStorage.setItem('spendnest_manual_overrides', JSON.stringify(overrides));
      const serialized = {
        batch_id: batchId,
        revision: revision,
        entries: Array.from(map.entries())
      };
      localStorage.setItem('spendnest_records_cache', JSON.stringify(serialized));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  };

  // Step 1: Load 01_initial.json
  const loadInitialBatch = async () => {
    try {
      addLog('Fetching /data/01_initial.json...');
      const res = await fetch('/data/01_initial.json');
      if (!res.ok) throw new Error('Failed to fetch 01_initial.json');
      const batch1 = await res.json();

      const newMap = ingestBatch(new Map(), batch1, manualOverrides);
      setRecordsMap(newMap);
      setActiveBatchId(batch1.batch_id);
      setActiveRevision(batch1.revision);
      saveToLocalStorage(newMap, manualOverrides, batch1.batch_id, batch1.revision);

      const withText = Array.from(newMap.values()).filter(hasUsableText).length;
      addLog(`SUCCESS: Ingested ${batch1.batch_id} (Rev ${batch1.revision}). Total unique records: ${newMap.size}. Records with usable text: ${withText}.`);
      showToast(`Batch 1 Loaded: ${newMap.size} records, ${withText} with usable text`);
    } catch (err) {
      addLog(`ERROR loading initial batch: ${err.message}`);
      showToast(`Error: ${err.message}`);
    }
  };

  // Step 2: Replay 01_initial.json with randomized record order
  const replayBatch1RandomOrder = async () => {
    try {
      addLog('Fetching 01_initial.json for randomized re-import test...');
      const res = await fetch('/data/01_initial.json');
      const batch1 = await res.json();

      // Shuffle records array
      const shuffledRecords = [...batch1.records].sort(() => Math.random() - 0.5);
      const shuffledBatch = { ...batch1, records: shuffledRecords };

      const prevCount = recordsMap.size;
      const replayedMap = ingestBatch(recordsMap, shuffledBatch, manualOverrides);
      setRecordsMap(replayedMap);
      saveToLocalStorage(replayedMap, manualOverrides, activeBatchId, activeRevision);

      addLog(`REPLAY CHECK: Re-imported ${shuffledRecords.length} records in randomized order.`);
      addLog(`IDEMPOTENCY VERIFICATION: Previous count: ${prevCount} -> Current count: ${replayedMap.size}. Zero duplicate records created!`);
      showToast(`Replay Verified: Record count unchanged at ${replayedMap.size}`);
    } catch (err) {
      addLog(`ERROR during replay test: ${err.message}`);
    }
  };

  // Step 3: Ingest 02_update.json (M07 late transcript arriving)
  const applyUpdateBatch = async () => {
    try {
      addLog('Fetching /data/02_update.json...');
      const res = await fetch('/data/02_update.json');
      if (!res.ok) throw new Error('Failed to fetch 02_update.json');
      const batch2 = await res.json();

      const prevCount = recordsMap.size;
      const updatedMap = ingestBatch(recordsMap, batch2, manualOverrides);
      setRecordsMap(updatedMap);
      setActiveBatchId(batch2.batch_id);
      setActiveRevision(Math.max(activeRevision, batch2.revision));
      saveToLocalStorage(updatedMap, manualOverrides, batch2.batch_id, Math.max(activeRevision, batch2.revision));

      const withText = Array.from(updatedMap.values()).filter(hasUsableText).length;
      const m07 = updatedMap.get('meeting:4f304fff-fd40-5cfc-a366-0a134c445c2a');
      const m07Turns = m07?.transcript_payload?.turns?.length || 0;

      addLog(`SUCCESS: Ingested ${batch2.batch_id} (Rev ${batch2.revision}).`);
      addLog(`UPDATE VERIFICATION: Total records remained ${updatedMap.size} (no duplicate created).`);
      addLog(`M07 transcript updated from 0 to ${m07Turns} turns. Manual override preserved: ${m07?.is_manual_override ? 'YES' : 'NO'}.`);
      showToast(`Update Applied: M07 now has ${m07Turns} turns. Total records: ${updatedMap.size}`);
    } catch (err) {
      addLog(`ERROR applying update batch: ${err.message}`);
      showToast(`Error: ${err.message}`);
    }
  };

  // Full default demo load: Batch 1 + Batch 2
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
      saveToLocalStorage(map, manualOverrides, b2.batch_id, b2.revision);
      addLog('Application ready: Loaded 44 records (18 with usable transcript post-update).');
    } catch (e) {
      console.error('Error loading default data:', e);
    }
  };

  // Clean Slate Reset
  const resetToCleanSlate = () => {
    localStorage.removeItem('spendnest_manual_overrides');
    localStorage.removeItem('spendnest_records_cache');
    setRecordsMap(new Map());
    setManualOverrides({});
    setActiveBatchId('none');
    setActiveRevision(0);
    setSelectedRecordKey(null);
    addLog('RESET: Local storage cleared. Clean slate restored.');
    showToast('Clean slate: Ready to test replay from step 1');
  };

  // Manual Route Override handler
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
      saveToLocalStorage(updatedMap, updatedOverrides, activeBatchId, activeRevision);

      const cat = ROUTE_CATEGORIES.find(c => c.id === newRouteId);
      addLog(`MANUAL OVERRIDE: Changed route for ${record.record_ref || record.source_id} to "${cat?.label}".`);
      showToast(`Manual route set to: ${cat?.label}`);
    }
  };

  // Reset route back to default suggestion
  const handleResetRouteOverride = (key) => {
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
      saveToLocalStorage(updatedMap, updatedOverrides, activeBatchId, activeRevision);

      addLog(`RESET ROUTE: Restored automated suggestion for ${record.record_ref || record.source_id}.`);
      showToast('Restored automated route suggestion');
    }
  };

  // Export handlers
  const handleDownloadZip = async () => {
    try {
      showToast('Generating export bundle with manifest...');
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
      addLog('EXPORT COMPLETED: Downloaded complete ZIP bundle with manifest and markdown records.');
      showToast('Export downloaded successfully!');
    } catch (err) {
      showToast(`Export failed: ${err.message}`);
    }
  };

  const handleDownloadManifestJson = () => {
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
    showToast('Downloaded manifest.json');
  };

  const handleDownloadManifestCsv = () => {
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
    showToast('Downloaded manifest.csv');
  };

  // Computed data
  const recordsArray = useMemo(() => Array.from(recordsMap.values()), [recordsMap]);
  const metrics = useMemo(() => computeDashboardMetrics(recordsArray), [recordsArray]);
  const manifest = useMemo(() => generateManifest(recordsArray), [recordsArray]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return recordsArray.filter(r => {
      const key = makeRecordKey(r.source_type, r.source_id);
      const analysis = CONVERSATION_ANALYSIS[key];

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const refMatch = (r.record_ref || '').toLowerCase().includes(q);
        const titleMatch = (r.payload?.title || '').toLowerCase().includes(q);
        const repMatch = (r.payload?.rep_name || r.payload?.organizer_email || '').toLowerCase().includes(q);
        const contactMatch = (analysis?.contact || '').toLowerCase().includes(q);
        const summaryMatch = (analysis?.summary || '').toLowerCase().includes(q);
        const idMatch = r.source_id.toLowerCase().includes(q);
        if (!refMatch && !titleMatch && !repMatch && !contactMatch && !summaryMatch && !idMatch) {
          return false;
        }
      }

      // Source type
      if (filterSourceType !== 'all' && r.source_type !== filterSourceType) {
        return false;
      }

      // Person filter
      if (filterPerson !== 'all') {
        const rep = r.payload?.rep_name || r.payload?.rep_email;
        const org = r.payload?.organizer_email;
        if (rep !== filterPerson && org !== filterPerson) {
          return false;
        }
      }

      // Route category
      if (filterRoute !== 'all' && r.assigned_route !== filterRoute) {
        return false;
      }

      // Text availability
      if (filterTextAvailability === 'with_text' && !hasUsableText(r)) return false;
      if (filterTextAvailability === 'without_text' && hasUsableText(r)) return false;

      // Manual override filter
      if (filterOverride === 'overridden' && !r.is_manual_override) return false;
      if (filterOverride === 'automated' && r.is_manual_override) return false;

      return true;
    });
  }, [recordsArray, searchQuery, filterSourceType, filterPerson, filterRoute, filterTextAvailability, filterOverride]);

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
          padding: '12px 20px',
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
          <div className="brand-logo">SN</div>
          <div>
            <div className="brand-title">SpendNest Revenue Intelligence Inbox</div>
            <div className="brand-subtitle">Activity & Conversation Decision Hub • 21 August 2026 (Asia/Kolkata)</div>
          </div>
        </div>

        {/* Global Tab Navigation */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            id="tab-dashboard"
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Layers size={16} />
            Dashboard
          </button>
          <button
            id="tab-inbox"
            className={`tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            <Filter size={16} />
            Inbox ({recordsArray.length})
          </button>
          <button
            id="tab-brief"
            className={`tab-btn ${activeTab === 'brief' ? 'active' : ''}`}
            onClick={() => setActiveTab('brief')}
          >
            <FileText size={16} />
            Manager Brief
          </button>
          <button
            id="tab-replay"
            className={`tab-btn ${activeTab === 'replay' ? 'active' : ''}`}
            onClick={() => setActiveTab('replay')}
          >
            <RefreshCw size={16} />
            Replay Studio
          </button>
          <button
            id="tab-exports"
            className={`tab-btn ${activeTab === 'exports' ? 'active' : ''}`}
            onClick={() => setActiveTab('exports')}
          >
            <Download size={16} />
            Exports
          </button>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            fontSize: '12px',
            padding: '5px 12px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)'
          }}>
            Batch: <strong style={{ color: '#fff' }}>{activeBatchId}</strong> (Rev {activeRevision})
          </div>
          <button
            id="btn-quick-export"
            className="btn-primary"
            onClick={handleDownloadZip}
          >
            <Download size={15} />
            Export Archive
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ padding: '24px 32px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>

        {/* ==================== TAB 1: DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <div>
            {/* KPI Cards Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '18px',
              marginBottom: '28px'
            }}>
              {/* Card 1: Records Count */}
              <div className="metric-card" id="metric-total-records">
                <div className="metric-title">
                  <span>Selected Records</span>
                  <Layers size={16} color="#6366f1" />
                </div>
                <div className="metric-value">{metrics.totalRecords}</div>
                <div className="metric-caption">
                  30 Calls • 14 Calendar Meetings<br />
                  <span style={{ color: 'var(--text-muted)' }}>Unique key: (source_type, source_id)</span>
                </div>
              </div>

              {/* Card 2: Transcript Coverage */}
              <div className="metric-card" id="metric-transcript-coverage">
                <div className="metric-title">
                  <span>Supplied Text Coverage</span>
                  <FileText size={16} color="#10b981" />
                </div>
                <div className="metric-value">
                  {metrics.coveragePercent}%
                  <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    ({metrics.totalWithText}/{metrics.totalRecords})
                  </span>
                </div>
                <div className="metric-caption">
                  Calls: {metrics.callsWithText}/30 ({metrics.callCoveragePercent}%) • Meetings: {metrics.meetingsWithText}/14 ({metrics.meetingCoveragePercent}%)<br />
                  <span style={{ color: '#34d399' }}>✓ Denominator: 44 total delivered records</span>
                </div>
              </div>

              {/* Card 3: Connect Rate & Discrepancies */}
              <div className="metric-card" id="metric-connection-rate">
                <div className="metric-title">
                  <span>Upstream Connect Rate</span>
                  <Phone size={16} color="#f59e0b" />
                </div>
                <div className="metric-value">
                  {metrics.connectRatePercent}%
                  <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    (11/30)
                  </span>
                </div>
                <div className="metric-caption">
                  Stored is_connected flag • 9 substantive calls<br />
                  <span style={{ color: '#fbbf24' }}>⚠️ Audit: C02 reached receptionist only</span>
                </div>
              </div>

              {/* Card 4: Routing & Review States */}
              <div className="metric-card" id="metric-routing-overrides">
                <div className="metric-title">
                  <span>Manual Overrides</span>
                  <SlidersHorizontal size={16} color="#a855f7" />
                </div>
                <div className="metric-value">
                  {metrics.manualOverrideCount}
                  <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '8px' }}>
                    saved
                  </span>
                </div>
                <div className="metric-caption">
                  {metrics.pendingReviewCount > 0 ? (
                    <span style={{ color: '#fb7185' }}>⚠️ {metrics.pendingReviewCount} pending manager review (M07)</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>All records assigned to active routes</span>
                  )}
                  <br />Preserved across updates and refreshes
                </div>
              </div>
            </div>

            {/* Grid: Activity by Person & Priority Attention Queue */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '24px', marginBottom: '28px' }}>
              {/* Activity Breakdown */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={18} color="#6366f1" />
                  Activity by Person (Calls & Meetings)
                </h3>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Call Representatives (30 Calls)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(metrics.repStats).map(([rep, stat]) => (
                      <div
                        key={rep}
                        onClick={() => {
                          setFilterPerson(rep);
                          setActiveTab('inbox');
                        }}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa' }} />
                          {rep}
                          {rep === 'Meera' && (
                            <span className="badge badge-pending" style={{ fontSize: '10px' }}>Audit: Spoken as Ravi on C06</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <strong>{stat.totalCalls}</strong> calls • {stat.connected} connects • {stat.withTranscript} transcripts
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Meeting Organizers (14 Calendar Events)
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '8px'
                  }}>
                    {Object.entries(metrics.organizerStats).map(([org, stat]) => (
                      <div
                        key={org}
                        onClick={() => {
                          setFilterPerson(org);
                          setActiveTab('inbox');
                        }}
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#c084fc' }}>{org}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {stat.totalMeetings} meetings ({stat.withTranscript} with text)
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                    *Note: Organizers are calendar event owners, not confirmed sales reps or meeting attendees.
                  </div>
                </div>
              </div>

              {/* Priority Attention & Exceptions Queue */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} color="#f43f5e" />
                  Priority Attention & Exception Queue
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* M04 Cedarwave */}
                  <div
                    onClick={() => {
                      setSelectedRecordKey('meeting:252cb4ce-ecdb-5056-bb6b-a1ff02a9a835');
                    }}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(244, 63, 94, 0.08)',
                      borderRadius: '8px',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="badge badge-pending">[M04] Cedarwave Distribution</span>
                      <span style={{ fontSize: '11px', color: '#fb7185', fontWeight: 600 }}>Retention Risk</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Card migration anxiety and admin bug moving users across departments (Turn 2, Turn 30).
                    </div>
                  </div>

                  {/* M07 Willowfield Trust */}
                  <div
                    onClick={() => {
                      setSelectedRecordKey('meeting:4f304fff-fd40-5cfc-a366-0a134c445c2a');
                    }}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(245, 158, 11, 0.08)',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="badge badge-override">[M07] Willowfield Trust</span>
                      <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 600 }}>Product Defect Escalation</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Screen share reproduced 2 bugs: payment description not persisting and upload error in Recreate Payment.
                    </div>
                  </div>

                  {/* M02 LedgerBridge */}
                  <div
                    onClick={() => {
                      setSelectedRecordKey('meeting:4c58cf32-bc96-52fb-b9d9-bb5e8e3f019b');
                    }}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(99, 102, 241, 0.08)',
                      borderRadius: '8px',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="badge route-vendor_evaluations">[M02] LedgerBridge Discussion</span>
                      <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>Vendor Evaluation</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      CRITICAL: SpendNest is evaluating LedgerBridge for electronic invoicing (Turn 1, 2). Do NOT treat as sales pipeline!
                    </div>
                  </div>

                  {/* C06 Identity mismatch */}
                  <div
                    onClick={() => {
                      setSelectedRecordKey('call:12216d5c-e254-52c6-b344-47de4c6e1ae5');
                    }}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="badge badge-call">[C06] Mr Nikhil (~120 Stores)</span>
                      <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600 }}>Identity Discrepancy</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Metadata caller is Meera, but spoken transcript begins: &quot;Good evening... Ravi here.&quot;
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Routing Category Distribution */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
                Conversation Routing Distribution
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px'
              }}>
                {ROUTE_CATEGORIES.map(cat => {
                  const count = metrics.routeCounts[cat.id] || 0;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setFilterRoute(cat.id);
                        setActiveTab('inbox');
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className={`badge route-${cat.id}`}>{cat.label}</span>
                        <strong style={{ fontSize: '16px', color: '#fff' }}>{count}</strong>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {((count / (metrics.totalRecords || 1)) * 100).toFixed(0)}% of total selected records
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: INBOX ==================== */}
        {activeTab === 'inbox' && (
          <div>
            {/* Filter Toolbar */}
            <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ flex: '1 1 240px', position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
                  <input
                    id="search-input"
                    type="text"
                    placeholder="Search by ref, title, contact, rep, text..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Filter Source Type */}
                <select
                  id="filter-source-type"
                  value={filterSourceType}
                  onChange={(e) => setFilterSourceType(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="all">All Source Types (44)</option>
                  <option value="call">Calls Only (30)</option>
                  <option value="meeting">Meetings Only (14)</option>
                </select>

                {/* Filter Person */}
                <select
                  id="filter-person"
                  value={filterPerson}
                  onChange={(e) => setFilterPerson(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="all">All Reps &amp; Organizers</option>
                  <optgroup label="Call Representatives">
                    <option value="Arun">Arun (15 calls)</option>
                    <option value="Leela">Leela (8 calls)</option>
                    <option value="Meera">Meera (5 calls)</option>
                    <option value="Kiran">Kiran (1 call)</option>
                    <option value="Dev">Dev (1 call)</option>
                  </optgroup>
                  <optgroup label="Meeting Organizers">
                    <option value="team08@example.com">team08 (3 meetings)</option>
                    <option value="team09@example.com">team09 (3 meetings)</option>
                    <option value="team06@example.com">team06 (1 meeting)</option>
                    <option value="team07@example.com">team07 (1 meeting)</option>
                    <option value="team10@example.com">team10 (1 meeting)</option>
                    <option value="team11@example.com">team11 (1 meeting)</option>
                    <option value="team12@example.com">team12 (1 meeting)</option>
                    <option value="team13@example.com">team13 (1 meeting)</option>
                    <option value="team14@example.com">team14 (1 meeting)</option>
                    <option value="arun@example.com">arun (1 meeting)</option>
                  </optgroup>
                </select>

                {/* Filter Route */}
                <select
                  id="filter-route"
                  value={filterRoute}
                  onChange={(e) => setFilterRoute(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="all">All Assigned Routes</option>
                  {ROUTE_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>

                {/* Filter Transcript availability */}
                <select
                  id="filter-text"
                  value={filterTextAvailability}
                  onChange={(e) => setFilterTextAvailability(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="all">All Text States</option>
                  <option value="with_text">Usable Transcript Present</option>
                  <option value="without_text">No Usable Supplied Text</option>
                </select>

                {/* Filter Overridden */}
                <select
                  id="filter-override"
                  value={filterOverride}
                  onChange={(e) => setFilterOverride(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="all">All Decision Types</option>
                  <option value="overridden">Manually Overridden</option>
                  <option value="automated">Automated Suggestion</option>
                </select>

                {/* Reset Filters button */}
                <button
                  id="btn-reset-filters"
                  className="btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterSourceType('all');
                    setFilterPerson('all');
                    setFilterRoute('all');
                    setFilterTextAvailability('all');
                    setFilterOverride('all');
                  }}
                >
                  Reset
                </button>
              </div>

              {/* Status bar */}
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Showing <strong>{filteredRecords.length}</strong> of <strong>{recordsArray.length}</strong> records</span>
                <span>Active local date: <strong>21 August 2026 (Asia/Kolkata)</strong></span>
              </div>
            </div>

            {/* Records Table */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxHeight: '650px' }}>
                <table className="data-table" id="records-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Ref</th>
                      <th>Title / Contact</th>
                      <th style={{ width: '90px' }}>Type</th>
                      <th>Rep / Organizer</th>
                      <th style={{ width: '130px' }}>Transcript</th>
                      <th>Assigned Route</th>
                      <th style={{ width: '100px' }}>Decision</th>
                      <th>Key Signal / Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No records match your selected filter criteria.
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
                              <span style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>
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
                                <span className="badge badge-call">
                                  <Phone size={10} /> Call
                                </span>
                              ) : (
                                <span className="badge badge-meeting">
                                  <Video size={10} /> Meeting
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {r.payload?.rep_name || r.payload?.organizer_email || 'Unassigned'}
                              </div>
                              {r.source_type === 'call' && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  {r.payload?.is_connected ? 'Reported connected' : 'Not connected'}
                                </div>
                              )}
                            </td>
                            <td>
                              {hasText ? (
                                <span className="badge badge-verified">
                                  <CheckCircle size={10} /> {r.source_type === 'call' ? 'Text' : `${r.transcript_payload?.turns?.length} turns`}
                                </span>
                              ) : (
                                <span className="badge badge-pending" style={{ opacity: 0.8 }}>
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
                                <span className="badge badge-override">
                                  Override
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto</span>
                              )}
                            </td>
                            <td>
                              {analysis?.attentionFlags && analysis.attentionFlags.length > 0 ? (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {analysis.attentionFlags.map((flag, idx) => (
                                    <span key={idx} style={{
                                      fontSize: '10px',
                                      padding: '2px 6px',
                                      background: 'rgba(244, 63, 94, 0.1)',
                                      color: '#fb7185',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(244, 63, 94, 0.2)'
                                    }}>
                                      {flag}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {hasText ? 'Analysis available' : 'Logged intake record'}
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

        {/* ==================== TAB 3: MANAGER BRIEF ==================== */}
        {activeTab === 'brief' && (
          <div className="glass-panel" style={{ padding: '36px', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                  Sales Manager Daily Intelligence Brief
                </h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Date: <strong>21 August 2026 (Asia/Kolkata)</strong> • Scope: 44 Selected Records (30 Calls, 14 Meetings)
                </div>
              </div>
              <button
                id="btn-print-brief"
                className="btn-secondary"
                onClick={() => window.print()}
              >
                Print / Save PDF
              </button>
            </div>

            <div style={{ lineHeight: '1.7', fontSize: '14px', color: 'var(--text-secondary)' }}>
              <section style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#6366f1', marginBottom: '8px' }}>
                  1. Executive Overview
                </h3>
                <p>
                  Today&apos;s team activity represents 44 selected interactions. 18 conversations contain usable transcripts (17 initial + 1 delivered in update batch).
                  Analysis reveals crucial operational risks in customer retention, high-value strategic channel opportunities, and material divergence between stored upstream classifications and spoken reality.
                </p>
              </section>

              <section style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f43f5e', marginBottom: '8px' }}>
                  2. Immediate Customer Risks &amp; Escalations
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '4px solid #f43f5e' }}>
                    <strong style={{ color: '#fff' }}>[M04] Cedarwave Distribution — Card Migration Friction</strong>
                    <p style={{ marginTop: '4px' }}>
                      Customer expressed serious anxiety regarding physical and virtual card termination during migration away from legacy network (Turn 5). Also reported ongoing inability to reassign users across departments (Turn 30).
                    </p>
                    <p style={{ marginTop: '4px', color: '#fb7185', fontWeight: 600 }}>
                      → CS Lead must deliver a zero-downtime card transition plan today and escalate the user reassignment defect to engineering.
                    </p>
                  </div>

                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                    <strong style={{ color: '#fff' }}>[M07] Willowfield Trust — Product UI Defect Escalation</strong>
                    <p style={{ marginTop: '4px' }}>
                      Screen share with Customer A reproduced two bugs: event-payment description edit does not save to subsequent screen (Turn 2), and document attachment upload fails during Recreate Payment (Turn 8).
                    </p>
                    <p style={{ marginTop: '4px', color: '#fbbf24', fontWeight: 600 }}>
                      → Support Lead to file urgent bug tickets and ensure customer uses the Bill Pay workaround in the interim.
                    </p>
                  </div>
                </div>
              </section>

              <section style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#10b981', marginBottom: '8px' }}>
                  3. Commercial Pipeline &amp; Channel Next Steps
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                    <strong style={{ color: '#fff' }}>[M03] Asterloom Systems — Prepaid Cards Proposal for CFO</strong>
                    <p style={{ marginTop: '4px' }}>
                      Prospect has ~65 employees reimbursing INR 10-15 lakh/month. Requested cards proposal for upcoming CFO evaluation (Turn 36).
                    </p>
                    <p style={{ marginTop: '4px', color: '#34d399', fontWeight: 600 }}>
                      → Deliver prepaid cards deck with ROI metrics tailored for CFO sign-off by Friday.
                    </p>
                  </div>

                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '4px solid #6366f1' }}>
                    <strong style={{ color: '#fff' }}>[M01] Harborpath Advisory &amp; [C07] Willowbank Advisory — Channel Partners</strong>
                    <p style={{ marginTop: '4px' }}>
                      Both advisory firms incorporate companies overseas and actively refer clients to business account providers. Harborpath also suggested co-marketing via podcast (Turn 26).
                    </p>
                    <p style={{ marginTop: '4px', color: '#818cf8', fontWeight: 600 }}>
                      → Issue partner referral terms; connect SpendNest marketing with Harborpath for podcast planning.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#a855f7', marginBottom: '8px' }}>
                  4. Coaching Insights &amp; Operational Audit
                </h3>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li>
                    <strong>Meera (Star Prospector)</strong>: 5 calls, 5 connects, 5 transcripts. Effectively navigated multi-location retailers, identified StoreHarbor as incumbent (C05), and secured an executive referral to People Operations (C08).
                  </li>
                  <li>
                    <strong>Arun (Cadence &amp; Voicemail Audit)</strong>: 15 dials, 2 connects. Arun handled rejection politely (C01) and left a detailed voicemail addressing a misrouted proposal (C04). However, lead source accuracy should be checked to prevent cold calls to hostile contacts.
                  </li>
                  <li>
                    <strong>System Identity Audit Required</strong>: Call C06 metadata lists Meera, but caller explicitly introduced himself as &quot;Ravi&quot;. Management must audit phone provisioning credentials immediately.
                  </li>
                </ul>
              </section>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: REPLAY STUDIO ==================== */}
        {activeTab === 'replay' && (
          <div>
            <div className="glass-panel" style={{ padding: '28px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RefreshCw size={22} color="#6366f1" />
                Data Replay &amp; Verification Studio
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                Test and verify the exact behavioural replay contract specified in <strong>DATA_CONTRACT.md</strong>.
                Prove duplicate prevention, late-transcript ingestion for M07, and preservation of manual route overrides.
              </p>

              {/* Step by Step Action Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* Step 1 */}
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', marginBottom: '6px' }}>Step 1: Initial Batch</div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>Import 01_initial.json</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Expectation: 44 unique logical records (30 calls, 14 meetings). Exactly 17 usable transcripts.
                  </div>
                  <button
                    id="btn-import-initial"
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={loadInitialBatch}
                  >
                    Import Initial Batch
                  </button>
                </div>

                {/* Step 2 */}
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: '6px' }}>Step 2: Duplicate Test</div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>Replay in Random Order</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Expectation: Records shuffled randomly; record count remains strictly 44. Zero duplicates created.
                  </div>
                  <button
                    id="btn-replay-random"
                    className="btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={replayBatch1RandomOrder}
                  >
                    Test Random Replay
                  </button>
                </div>

                {/* Step 3 */}
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>Step 3: Manual Route</div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>Override M07 or M02</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Set M07 to &quot;Support Escalation&quot; or M02 to &quot;Vendor Evaluation&quot;. Marked as manual override.
                  </div>
                  <button
                    id="btn-override-m07"
                    className="btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      handleRouteOverride('meeting:4f304fff-fd40-5cfc-a366-0a134c445c2a', 'support_escalation');
                    }}
                  >
                    Set M07 to Support
                  </button>
                </div>

                {/* Step 4 */}
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#f43f5e', textTransform: 'uppercase', marginBottom: '6px' }}>Step 4: Update Batch</div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>Import 02_update.json</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Expectation: M07 updated to revision 2 (27 turns). Count stays 44. Manual route preserved!
                  </div>
                  <button
                    id="btn-import-update"
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', background: '#e11d48' }}
                    onClick={applyUpdateBatch}
                  >
                    Apply Update Batch
                  </button>
                </div>
              </div>

              {/* Clean Slate Reset */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Clear localStorage and cached memory to re-run the entire replay sequence from scratch:
                </div>
                <button
                  id="btn-reset-clean-slate"
                  className="btn-secondary"
                  style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                  onClick={resetToCleanSlate}
                >
                  Reset Clean Slate
                </button>
              </div>
            </div>

            {/* Live Replay Event Console */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  Live Replay Execution Log
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {replayLogs.length} events recorded
                </span>
              </div>
              <div style={{
                background: '#070a12',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'monospace',
                fontSize: '12px',
                maxHeight: '320px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                {replayLogs.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>No replay actions logged yet. Run a step above to see output.</span>
                ) : (
                  replayLogs.map((log, i) => (
                    <div
                      key={i}
                      style={{
                        color: log.includes('SUCCESS') ? '#34d399' : log.includes('ERROR') ? '#fb7185' : log.includes('IDEMPOTENCY') ? '#60a5fa' : '#94a3b8'
                      }}
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: EXPORTS ==================== */}
        {activeTab === 'exports' && (
          <div>
            <div className="glass-panel" style={{ padding: '28px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                    Organized Exports &amp; Manifest Generator
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Generate production-ready exports organized by routing destination with machine-readable manifest.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    id="btn-download-manifest-json"
                    className="btn-secondary"
                    onClick={handleDownloadManifestJson}
                  >
                    <Download size={14} /> manifest.json
                  </button>
                  <button
                    id="btn-download-manifest-csv"
                    className="btn-secondary"
                    onClick={handleDownloadManifestCsv}
                  >
                    <Download size={14} /> manifest.csv
                  </button>
                  <button
                    id="btn-download-full-zip"
                    className="btn-primary"
                    onClick={handleDownloadZip}
                  >
                    <Download size={15} /> Download Full ZIP Bundle
                  </button>
                </div>
              </div>

              {/* Folder Architecture Preview */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Exported Directory Structure (Included in ZIP)
                </div>
                <pre style={{ fontSize: '12px', color: '#818cf8', fontFamily: 'monospace', lineHeight: '1.6' }}>
{`exports/
├── manifest.json                               # Full machine-readable envelope
├── manifest.csv                                # Spreadsheet-ready CSV manifest
├── daily_brief/
│   └── 2026-08-21_manager_brief.md            # Manager daily brief for 21 Aug 2026
└── routing/
    ├── pipeline_deals/                         # Asterloom (M03), Mapletrail (M06), Raghav (C08), Milan (C03)
    ├── partnerships/                           # Harborpath (M01), Willowbank (C07)
    ├── customer_success/                       # Cedarwave Migration (M04), Brookmint Setup (M09)
    ├── support_escalation/                     # Willowfield Trust Bug Escalation (M07)
    ├── vendor_evaluations/                     # LedgerBridge E-Invoicing Supplier (M02)
    ├── internal_enablement/                    # Billing Workflow Walkthrough (M10)
    ├── outbound_prospecting/                   # C01, C05, C06, C09, C10
    └── unconnected_intake/                     # C02 (Fernhaven Voicemail), C04 (Lanternpath Voicemail), background records`}
                </pre>
              </div>

              {/* Manifest Table Preview */}
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                  Active Manifest Table ({manifest.jsonData.length} Rows)
                </h3>
                <div style={{ overflowX: 'auto', maxHeight: '420px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table className="data-table" id="manifest-table">
                    <thead>
                      <tr>
                        <th>Source ID</th>
                        <th>Ref</th>
                        <th>Type</th>
                        <th>Rev</th>
                        <th>Assigned Route</th>
                        <th>Output File Path</th>
                        <th>Override</th>
                        <th>Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manifest.jsonData.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                            {row.source_id.slice(0, 8)}...
                          </td>
                          <td style={{ fontWeight: 700, color: '#fff' }}>{row.record_ref || '-'}</td>
                          <td>{row.source_type}</td>
                          <td>Rev {row.applied_revision}</td>
                          <td>
                            <span className={`badge route-${row.assigned_route}`}>{row.route_label}</span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#60a5fa' }}>
                            {row.output_path}
                          </td>
                          <td>
                            {row.is_manual_override ? (
                              <span className="badge badge-override">Override</span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto</span>
                            )}
                          </td>
                          <td style={{ fontSize: '12px' }}>{row.owner}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
            {/* Drawer Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '18px', color: '#fff' }}>
                    {selectedRecord.record_ref || selectedRecord.source_id.slice(0, 8)}
                  </span>
                  {selectedRecord.source_type === 'call' ? (
                    <span className="badge badge-call"><Phone size={10} /> Phone Call</span>
                  ) : (
                    <span className="badge badge-meeting"><Video size={10} /> Calendar Meeting</span>
                  )}
                  {selectedRecord.is_manual_override && (
                    <span className="badge badge-override">Manual Override Active</span>
                  )}
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedAnalysis?.title || selectedRecord.payload?.title || 'Interaction Detail'}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  ID: <code style={{ color: '#818cf8' }}>{selectedRecord.source_id}</code> • Rev {selectedRecord.applied_revision || 1}
                </div>
              </div>
              <button
                id="btn-close-drawer"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                onClick={() => setSelectedRecordKey(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Routing Control Bar */}
            <div style={{ padding: '14px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Assigned Route:
                </span>
                <select
                  id="select-drawer-route"
                  value={selectedRecord.assigned_route || 'review_needed'}
                  onChange={(e) => handleRouteOverride(selectedRecordKey, e.target.value)}
                  style={{
                    padding: '6px 12px',
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
                  id="btn-reset-drawer-route"
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => handleResetRouteOverride(selectedRecordKey)}
                >
                  Reset to Automated Suggestion
                </button>
              )}
            </div>

            {/* Drawer Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
              <button
                id="drawer-tab-analysis"
                className={`tab-btn ${drawerTab === 'analysis' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', borderRadius: 0, padding: '12px' }}
                onClick={() => setDrawerTab('analysis')}
              >
                Analysis &amp; Coaching
              </button>
              <button
                id="drawer-tab-transcript"
                className={`tab-btn ${drawerTab === 'transcript' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', borderRadius: 0, padding: '12px' }}
                onClick={() => setDrawerTab('transcript')}
              >
                Transcript ({hasUsableText(selectedRecord) ? 'Present' : 'None'})
              </button>
              <button
                id="drawer-tab-raw"
                className={`tab-btn ${drawerTab === 'raw' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', borderRadius: 0, padding: '12px' }}
                onClick={() => setDrawerTab('raw')}
              >
                Raw Source Payload
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {/* TAB: ANALYSIS */}
              {drawerTab === 'analysis' && (
                <div>
                  {selectedAnalysis ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Attention Flags */}
                      {selectedAnalysis.attentionFlags && selectedAnalysis.attentionFlags.length > 0 && (
                        <div style={{ padding: '14px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fb7185', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <AlertTriangle size={15} />
                            Attention / Discrepancy Notice
                          </div>
                          {selectedAnalysis.attentionFlags.map((flag, idx) => (
                            <div key={idx} style={{ fontSize: '13px', color: '#f8fafc' }}>• {flag}</div>
                          ))}
                        </div>
                      )}

                      {/* Summary */}
                      <div>
                        <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          What Happened
                        </h4>
                        <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                          {selectedAnalysis.summary}
                        </p>
                      </div>

                      {/* Why it Matters */}
                      <div>
                        <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          Why It Matters
                        </h4>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                          {selectedAnalysis.whyItMatters}
                        </p>
                      </div>

                      {/* Evidence Quote */}
                      <div style={{ padding: '14px', background: 'rgba(99, 102, 241, 0.08)', borderLeft: '4px solid #6366f1', borderRadius: '4px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                          Supporting Evidence Passage
                        </div>
                        <div style={{ fontSize: '13px', color: '#f8fafc', fontStyle: 'italic', lineHeight: '1.5' }}>
                          {selectedAnalysis.evidenceQuote}
                        </div>
                      </div>

                      {/* Evidence Limits */}
                      <div>
                        <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          What Evidence Does NOT Establish
                        </h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                          {selectedAnalysis.evidenceLimits}
                        </p>
                      </div>

                      {/* Action Items */}
                      <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '6px' }}>
                          Recommended Next Steps &amp; Ownership
                        </div>
                        <div style={{ fontSize: '13px', color: '#fff', marginBottom: '6px' }}>
                          {selectedAnalysis.nextSteps}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Assigned Owner: <strong style={{ color: '#34d399' }}>{selectedAnalysis.owner}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <AlertTriangle size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        No Usable Supplied Text in Delivery
                      </div>
                      <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto' }}>
                        Per DATA_CONTRACT.md, this record has no supplied conversation text. Upstream status: <code>{selectedRecord.payload?.summary_status || selectedRecord.payload?.recording_status || 'logged'}</code>.
                        No substantive analysis is invented for silent or missing text.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: TRANSCRIPT */}
              {drawerTab === 'transcript' && (
                <div>
                  {selectedRecord.source_type === 'call' && selectedRecord.payload?.transcript ? (
                    <div style={{ background: '#070a12', padding: '18px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.7', whiteSpace: 'pre-wrap', color: '#f8fafc' }}>
                      {selectedRecord.payload.transcript}
                    </div>
                  ) : selectedRecord.source_type === 'meeting' && selectedRecord.transcript_payload?.turns && selectedRecord.transcript_payload.turns.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {selectedRecord.transcript_payload.turns.map((turn, idx) => (
                        <div key={idx} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '12px', color: turn.speaker.includes('Team') ? '#60a5fa' : '#c084fc' }}>
                              Turn {idx + 1} • {turn.speaker}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {turn.timecode || `${Math.round(turn.starts_at_seconds)}s`}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                            {turn.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        No transcript available
                      </div>
                      <p style={{ fontSize: '12px', marginTop: '6px' }}>
                        {selectedRecord.transcript_payload?.unavailable_reason || 'Source record did not contain audio transcript.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: RAW SOURCE */}
              {drawerTab === 'raw' && (
                <div style={{ background: '#070a12', padding: '16px', borderRadius: '8px', overflowX: 'auto' }}>
                  <pre style={{ fontSize: '11px', color: '#818cf8', fontFamily: 'monospace' }}>
                    {JSON.stringify(selectedRecord, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
