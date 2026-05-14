import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatUptime = (seconds) => {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
};

export default function App() {
  const [health, setHealth]       = useState(null);
  const [metrics, setMetrics]     = useState(null);
  const [deploys, setDeploys]     = useState([]);
  const [lastPoll, setLastPoll]   = useState(null);
  const [healthErr, setHealthErr] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/health`);
      setHealth(res.data);
      setHealthErr(false);
    } catch {
      setHealthErr(true);
      setHealth(null);
    }
    setLastPoll(new Date());
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/metrics`);
      setMetrics(res.data);
    } catch {
      setMetrics(null);
    }
  }, []);

  const fetchDeploys = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/deployments`);
      setDeploys(res.data);
    } catch {
      setDeploys([]);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchMetrics();
    fetchDeploys();

    const healthTimer  = setInterval(fetchHealth,  5000);
    const metricsTimer = setInterval(fetchMetrics, 10000);
    const deployTimer  = setInterval(fetchDeploys, 15000);

    return () => {
      clearInterval(healthTimer);
      clearInterval(metricsTimer);
      clearInterval(deployTimer);
    };
  }, [fetchHealth, fetchMetrics, fetchDeploys]);

  const isOk = health?.status === 'ok';

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoDot(isOk && !healthErr)} />
            <span style={styles.logoText}>SYS<span style={styles.logoAccent}>HEALTH</span></span>
          </div>
          <div style={styles.pollInfo}>
            {lastPoll && <span style={styles.pollTime}>last poll {formatTime(lastPoll)}</span>}
            <span style={styles.pollBadge(isOk && !healthErr)}>
              {healthErr ? '● OFFLINE' : isOk ? '● LIVE' : '● CHECKING'}
            </span>
          </div>
        </div>
      </header>

      <main style={styles.main}>

        {/* ── CARD 1: Health ── */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardLabel}>System health</span>
            <span style={styles.cardTag(isOk && !healthErr)}>
              {healthErr ? 'ERROR' : isOk ? 'HEALTHY' : 'PENDING'}
            </span>
          </div>

          <div style={styles.bigStatus(isOk && !healthErr)}>
            {healthErr ? '✕ Unreachable' : isOk ? '✓ All systems go' : '… Connecting'}
          </div>

          <div style={styles.grid2}>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>DB connection</div>
              <div style={styles.statValue(health?.db === 'connected')}>
                {health?.db ?? '—'}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>API status</div>
              <div style={styles.statValue(!healthErr)}>
                {healthErr ? 'unreachable' : 'reachable'}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Last checked</div>
              <div style={styles.statValueNeutral}>
                {formatTime(health?.timestamp)}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Poll interval</div>
              <div style={styles.statValueNeutral}>5 s</div>
            </div>
          </div>
        </section>

        {/* ── CARD 2: Metrics ── */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardLabel}>Runtime metrics</span>
            <span style={styles.cardTagNeutral}>LIVE</span>
          </div>

          <div style={styles.grid2}>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Uptime</div>
              <div style={styles.statValueNeutral}>
                {metrics ? formatUptime(metrics.uptime) : '—'}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Heap used</div>
              <div style={styles.statValueNeutral}>
                {metrics ? formatBytes(metrics.memory?.heapUsed) : '—'}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>Heap total</div>
              <div style={styles.statValueNeutral}>
                {metrics ? formatBytes(metrics.memory?.heapTotal) : '—'}
              </div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statLabel}>RSS memory</div>
              <div style={styles.statValueNeutral}>
                {metrics ? formatBytes(metrics.memory?.rss) : '—'}
              </div>
            </div>
          </div>

          {metrics && (
            <div style={styles.memBar}>
              <div style={styles.memBarLabel}>
                <span>Heap usage</span>
                <span>
                  {Math.round((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100)}%
                </span>
              </div>
              <div style={styles.memBarTrack}>
                <div style={styles.memBarFill(
                  Math.round((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100)
                )} />
              </div>
            </div>
          )}
        </section>

        {/* ── CARD 3: Deployments ── */}
        <section style={{ ...styles.card, ...styles.cardFull }}>
          <div style={styles.cardHeader}>
            <span style={styles.cardLabel}>Deployment history</span>
            <span style={styles.cardTagNeutral}>{deploys.length} records</span>
          </div>

          {deploys.length === 0 ? (
            <div style={styles.empty}>
              No deployments recorded yet.
              <br />
              <span style={styles.emptyHint}>
                They will appear here once the pipeline runs a deployment.
              </span>
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Version</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Deployed at</th>
                </tr>
              </thead>
              <tbody>
                {deploys.map((d, i) => (
                  <tr key={d.id} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                    <td style={styles.td}>#{d.id}</td>
                    <td style={styles.td}>{d.version}</td>
                    <td style={styles.td}>
                      <span style={styles.statusPill(d.status === 'success')}>
                        {d.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {new Date(d.deployed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

      </main>

      <footer style={styles.footer}>
        System Health Dashboard · DevOps Assessment · Kaar Tech → KTern.AI
      </footer>
    </div>
  );
}

/* ─────────────────────────── styles ─────────────────────────── */
const C = {
  bg:       '#0a0e17',
  surface:  '#111827',
  border:   '#1e2a3a',
  text:     '#e2e8f0',
  muted:    '#64748b',
  green:    '#22c55e',
  greenDim: '#15803d',
  red:      '#ef4444',
  accent:   '#38bdf8',
  font:     `'JetBrains Mono', 'Fira Code', 'Courier New', monospace`,
};

const styles = {
  page: {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: C.font,
    fontSize: 13,
  },
  header: {
    borderBottom: `1px solid ${C.border}`,
    padding: '0 24px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoDot: (ok) => ({
    width: 8, height: 8,
    borderRadius: '50%',
    background: ok ? C.green : C.red,
    boxShadow: ok ? `0 0 6px ${C.green}` : `0 0 6px ${C.red}`,
    animation: 'pulse 2s infinite',
  }),
  logoText: { fontSize: 15, fontWeight: 700, letterSpacing: 3, color: C.text },
  logoAccent: { color: C.accent },
  pollInfo: { display: 'flex', alignItems: 'center', gap: 12 },
  pollTime: { color: C.muted, fontSize: 11 },
  pollBadge: (ok) => ({
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    color: ok ? C.green : C.red,
  }),
  main: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '28px 24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 20,
  },
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: 20,
  },
  cardFull: { gridColumn: '1 / -1' },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: `1px solid ${C.border}`,
  },
  cardLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: 'uppercase' },
  cardTag: (ok) => ({
    fontSize: 10, fontWeight: 700, letterSpacing: 1,
    padding: '2px 8px', borderRadius: 4,
    background: ok ? '#052e16' : '#450a0a',
    color: ok ? C.green : C.red,
    border: `1px solid ${ok ? C.greenDim : '#7f1d1d'}`,
  }),
  cardTagNeutral: {
    fontSize: 10, fontWeight: 700, letterSpacing: 1,
    padding: '2px 8px', borderRadius: 4,
    background: '#0c1a2e', color: C.accent,
    border: `1px solid #1e3a5f`,
  },
  bigStatus: (ok) => ({
    fontSize: 22, fontWeight: 700,
    color: ok ? C.green : C.red,
    marginBottom: 20,
    letterSpacing: 1,
  }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  statBox: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: '10px 12px',
  },
  statLabel: { fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  statValue: (ok) => ({ fontSize: 13, fontWeight: 700, color: ok ? C.green : C.red }),
  statValueNeutral: { fontSize: 13, fontWeight: 700, color: C.text },
  memBar: { marginTop: 16 },
  memBarLabel: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 10, color: C.muted, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  memBarTrack: { height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' },
  memBarFill: (pct) => ({
    height: '100%', borderRadius: 3,
    width: `${pct}%`,
    background: pct > 80 ? C.red : pct > 60 ? '#f59e0b' : C.accent,
    transition: 'width 0.6s ease',
  }),
  empty: {
    textAlign: 'center', color: C.muted,
    padding: '32px 0', lineHeight: 2,
  },
  emptyHint: { fontSize: 11, color: '#334155' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', fontSize: 10, fontWeight: 700,
    color: C.muted, letterSpacing: 2,
    padding: '8px 12px', textTransform: 'uppercase',
    borderBottom: `1px solid ${C.border}`,
  },
  td: { padding: '10px 12px', fontSize: 12, color: C.text, verticalAlign: 'middle' },
  trEven: { background: 'transparent' },
  trOdd:  { background: '#0d1520' },
  statusPill: (ok) => ({
    fontSize: 10, fontWeight: 700, letterSpacing: 1,
    padding: '2px 8px', borderRadius: 4,
    background: ok ? '#052e16' : '#450a0a',
    color: ok ? C.green : C.red,
    border: `1px solid ${ok ? C.greenDim : '#7f1d1d'}`,
  }),
  footer: {
    textAlign: 'center',
    padding: '20px 0',
    fontSize: 10,
    color: '#1e3a5f',
    letterSpacing: 2,
    textTransform: 'uppercase',
    borderTop: `1px solid ${C.border}`,
  },
};