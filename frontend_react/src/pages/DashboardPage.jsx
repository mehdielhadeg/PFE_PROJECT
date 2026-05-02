import { useEffect, useMemo, useState } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Alert } from '@mui/material'
import { FileText, ThumbsUp, Users, X, TrendingUp, AlertCircle } from 'lucide-react'

import Header from '../components/Header'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

ChartJS.register(ArcElement, Tooltip)

/* ─── Inject styles once ─── */
const STYLE_ID = 'dashboard-styles'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

    .db-root { font-family: 'DM Sans', sans-serif; }

    .db-kpi {
      background: var(--color-background-primary);
      border: 1px solid var(--color-border-tertiary);
      border-radius: 14px;
      padding: 20px 22px;
      position: relative;
      overflow: hidden;
      transition: box-shadow .2s, transform .2s;
    }
    .db-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,.07); }
    .db-kpi::before {
      content: '';
      position: absolute;
      inset: 0;
      opacity: .045;
      pointer-events: none;
    }
    .db-kpi.green::before  { background: radial-gradient(circle at top right, #1D9E75 0%, transparent 70%); }
    .db-kpi.blue::before   { background: radial-gradient(circle at top right, #4A6CF7 0%, transparent 70%); }
    .db-kpi.teal::before   { background: radial-gradient(circle at top right, #0E9F8E 0%, transparent 70%); }

    .db-pill {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
      padding: 3px 10px; border-radius: 99px;
    }

    .db-table tr { transition: background .15s; }
    .db-table tbody tr:hover { background: var(--color-background-secondary, rgba(0,0,0,.025)); }

    .db-details-btn {
      font-family: 'DM Mono', monospace;
      font-size: 10px; font-weight: 500; letter-spacing: .04em;
      padding: 5px 12px;
      border: 1px solid var(--color-border-secondary);
      border-radius: 8px;
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: background .15s, border-color .15s, color .15s;
    }
    .db-details-btn:hover {
      background: var(--color-background-secondary, rgba(0,0,0,.04));
      border-color: var(--color-text-tertiary);
      color: var(--color-text-primary);
    }

    .db-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.48);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000; padding: 16px;
      animation: db-fade-in .18s ease;
    }
    .db-modal {
      width: min(740px, 92vw);
      background: var(--color-background-primary);
      border: 1px solid var(--color-border-tertiary);
      border-radius: 18px;
      padding: 28px;
      animation: db-slide-up .22s cubic-bezier(.22,.86,.44,1);
    }
    @keyframes db-fade-in  { from { opacity: 0 } to { opacity: 1 } }
    @keyframes db-slide-up { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }

    .db-section-label {
      font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
      color: var(--color-text-tertiary); margin-bottom: 10px;
    }

    .db-divider { height: 1px; background: var(--color-border-tertiary); margin: 2px 0; }
  `
  document.head.appendChild(s)
}

/* ─── KPI Card ─── */
function KpiCard({ icon, colorClass, accentColor, label, value, sub }) {
  return (
    <div className={`db-kpi ${colorClass}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
        }}>{label}</span>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: accentColor + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
      </div>
      <div style={{
        fontSize: 36, fontWeight: 300, lineHeight: 1,
        color: 'var(--color-text-primary)',
        fontVariantNumeric: 'tabular-nums',
        marginBottom: 8,
      }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{sub}</div>
    </div>
  )
}

/* ─── Legend dot ─── */
function LegendItem({ color, label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 6, height: 20, borderRadius: 3,
        background: color, flexShrink: 0,
      }} />
      <div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{count}</div>
      </div>
    </div>
  )
}

/* ─── Main ─── */
export default function DashboardPage() {
  const { token, role } = useAuth()
  const [feedback, setFeedback] = useState(null)
  const [counts, setCounts] = useState(null)
  const [error, setError] = useState('')
  const [selectedAlert, setSelectedAlert] = useState(null)

  useEffect(() => {
    if (role !== 'admin') return
    const load = async () => {
      try {
        const [fb, cnt] = await Promise.all([
          api.analyticsFeedback(token),
          api.analyticsCounts(token),
        ])
        setFeedback(fb)
        setCounts(cnt)
      } catch (err) {
        setError(err.message || 'Failed to load analytics')
      }
    }
    load()
  }, [role, token])

  const donutData = useMemo(() => ({
    labels: ['Positif', 'Négatif'],
    datasets: [{
      data: feedback?.counts
        ? [feedback.counts.thumbs_up || 0, feedback.counts.thumbs_down || 0]
        : [1, 0],
      backgroundColor: ['#1D9E75', '#E24B4A'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }), [feedback])

  const donutOptions = {
    cutout: '76%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } },
    },
  }

  const cardStyle = {
    background: 'var(--color-background-primary)',
    border: '1px solid var(--color-border-tertiary)',
    borderRadius: 14,
    padding: '22px 24px',
  }

  if (role !== 'admin') {
    return (
      <Header title="Dashboard" subtitle="Admin only">
        <Alert severity="warning">Access denied.</Alert>
      </Header>
    )
  }

  const totalVotes = (feedback?.counts?.thumbs_up || 0) + (feedback?.counts?.thumbs_down || 0)

  return (
    <Header
      title="Dashboard"
      subtitle="Vue d'ensemble de la performance et de l'adoption."
    >
      <div className="db-root" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
          <KpiCard
            colorClass="green"
            accentColor="#1D9E75"
            icon={<TrendingUp size={16} color="#1D9E75" />}
            label="Satisfaction"
            value={feedback ? `${feedback.satisfaction_rate}%` : '—'}
            sub="Basé sur les votes collectés"
          />
          <KpiCard
            colorClass="blue"
            accentColor="#4A6CF7"
            icon={<Users size={16} color="#4A6CF7" />}
            label="Utilisateurs"
            value={counts ? counts.users_total : '—'}
            sub="Utilisateurs actifs"
          />
          <KpiCard
            colorClass="teal"
            accentColor="#0E9F8E"
            icon={<FileText size={16} color="#0E9F8E" />}
            label="Documents"
            value={counts ? counts.documents_total : '—'}
            sub="Documents indexés"
          />
        </div>

        {/* ── Donut ── */}
        <div
  style={{
    ...cardStyle,
    display: 'grid',
    gridTemplateColumns: 'auto auto',
    justifyContent: 'center',   // 👈 centers the whole block
    gap: 150,                    // 👈 controls spacing between them
    alignItems: 'center'
  }}
>
          <div>
            <div className="db-section-label">Répartition des feedbacks</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>
              {totalVotes} votes <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-tertiary)' }}>au total</span>
            </div>
            <div style={{ height: 1, background: 'var(--color-border-tertiary)', margin: '16px 0' }} />
            <div style={{ display: 'flex', gap: 28 }}>
              <LegendItem color="#1D9E75" label="Positif" count={feedback?.counts?.thumbs_up ?? 0} />
              <LegendItem color="#E24B4A" label="Négatif" count={feedback?.counts?.thumbs_down ?? 0} />
            </div>
          </div>
          <div style={{ position: 'relative', width: 148, height: 148, flexShrink: 0 }}>
            <Doughnut data={donutData} options={donutOptions} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Score</span>
              <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                {feedback ? `${feedback.satisfaction_rate}%` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Negative feedback table ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div className="db-section-label">Alertes qualité</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>Réponses mal notées</div>
            </div>
            <span className="db-pill" style={{ background: '#FEF2F2', color: '#991B1B' }}>
              <AlertCircle size={10} />
              Feedback négatif
            </span>
          </div>

          <table className="db-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                {[
                  { label: 'Question',           w: '30%' },
                  { label: 'Extrait de réponse', w: '40%' },
                  { label: 'Date',               w: '15%' },
                  { label: '',                   w: '15%' },
                ].map(({ label, w }, i) => (
                  <th key={i} style={{
                    textAlign: i === 3 ? 'right' : 'left',
                    fontWeight: 600, fontSize: 10,
                    letterSpacing: '.08em', textTransform: 'uppercase',
                    color: 'var(--color-text-tertiary)',
                    padding: '0 12px 12px',
                    width: w,
                  }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(feedback?.latest_negatives?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '32px 0', fontSize: 13 }}>
                    Aucun feedback négatif pour l'instant.
                  </td>
                </tr>
              ) : (feedback?.latest_negatives ?? []).map((row) => {
                const excerpt = row.answer_excerpt || ''
                const clipped = excerpt.length > 80 ? `${excerpt.slice(0, 80)}…` : excerpt
                return (
                  <tr key={row.message_id} style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
                    <td style={{ padding: '12px', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {row.question || '—'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {clipped || '—'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-tertiary)', fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
                      {row.created_at ? new Date(row.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button className="db-details-btn" onClick={() => setSelectedAlert(row)}>
                        Détails →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Modal ── */}
        {selectedAlert && (
          <div className="db-modal-overlay" onClick={() => setSelectedAlert(null)}>
            <div className="db-modal" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <span className="db-pill" style={{ background: '#FEF2F2', color: '#991B1B', marginBottom: 8 }}>
                    <AlertCircle size={10} /> Feedback négatif
                  </span>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>Détails du retour</div>
                  {selectedAlert.created_at && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>
                      {new Date(selectedAlert.created_at).toLocaleString('fr-FR')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  style={{
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--color-border-secondary)', borderRadius: 8,
                    background: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Question */}
                <div style={{
                  background: 'var(--color-background-secondary, rgba(0,0,0,.03))',
                  borderRadius: 10, padding: '14px 16px',
                  borderLeft: '3px solid #4A6CF7',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#4A6CF7', marginBottom: 6 }}>Question</div>
                  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {selectedAlert.question || '—'}
                  </div>
                </div>

                {/* Answer */}
                <div style={{
                  background: 'var(--color-background-secondary, rgba(0,0,0,.03))',
                  borderRadius: 10, padding: '14px 16px',
                  borderLeft: '3px solid #E24B4A',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#E24B4A', marginBottom: 6 }}>Réponse</div>
                  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {selectedAlert.answer || selectedAlert.answer_excerpt || '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Header>
  )
}