import { useEffect, useMemo, useState } from 'react'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
} from 'chart.js'
import { Alert } from '@mui/material'
import { FileText, ThumbsUp, Users } from 'lucide-react'

import Header from '../components/Header'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

ChartJS.register(ArcElement, Tooltip)

function KpiCard({ icon, iconBg, label, value, sub }) {
  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{label}</span>
      </div>
      <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1 }}>{value}</span>
      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

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
    labels: ['Positif', 'Négatif', 'Neutre'],
    datasets: [{
      data: feedback?.counts
        ? [feedback.counts.thumbs_up || 0, feedback.counts.thumbs_down || 0, feedback.counts.no_feedback || 0]
        : [0, 0, 0],
      backgroundColor: ['#1D9E75', '#E24B4A', '#888780'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  }), [feedback])

  const donutOptions = {
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } },
    },
  }

  const card = {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '16px 20px',
  }

  const sectionTitle = {
    fontSize: 15, fontWeight: 500,
    color: 'var(--color-text-primary)', marginBottom: 16,
  }

  if (role !== 'admin') {
    return (
      <Header title="Dashboard" subtitle="Admin only">
        <Alert severity="warning">Access denied.</Alert>
      </Header>
    )
  }

  return (
    <Header
      title="Dashboard"
      subtitle="Vue d'ensemble de la performance et de l'adoption."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
          <KpiCard
            iconBg="#EAF3DE"
            icon={<ThumbsUp size={15} color="#3B6D11" />}
            label="Taux de satisfaction"
            value={feedback ? `${feedback.satisfaction_rate}%` : '—'}
            sub="Basé sur les votes collectés"
          />
          <KpiCard
            iconBg="#EEF1FF"
            icon={<Users size={15} color="#3F4F9A" />}
            label="Nombre d'utilisateurs"
            value={counts ? counts.users_total : '—'}
            sub="Utilisateurs actifs"
          />
          <KpiCard
            iconBg="#E7F4EF"
            icon={<FileText size={15} color="#1C6E4A" />}
            label="Nombre de documents"
            value={counts ? counts.documents_total : '—'}
            sub="Documents indexés"
          />
        </div>

        {/* Donut */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ ...sectionTitle, width: '100%' }}>Répartition des feedbacks</div>
          <div style={{ position: 'relative', width: 180, height: 180 }}>
            <Doughnut data={donutData} options={donutOptions} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total
              </span>
              <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {(feedback?.counts?.thumbs_up || 0) + (feedback?.counts?.thumbs_down || 0)}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
            {[
              { label: 'Positif', color: '#1D9E75', key: 'thumbs_up' },
              { label: 'Négatif', color: '#E24B4A', key: 'thumbs_down' },
              { label: 'Neutre',  color: '#888780', key: 'no_feedback' },
            ].map(({ label, color, key }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                {label} ({feedback?.counts?.[key] ?? 0})
              </div>
            ))}
          </div>
        </div>

        {/* Negative feedback table */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={sectionTitle}>Alertes qualité</span>
            <span style={{
              fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 99,
              background: '#FCEBEB', color: '#791F1F',
            }}>
              Réponses notées négatives
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {['Question', 'Extrait de réponse', 'Date', ''].map((h, i) => (
                  <th key={i} style={{
                    textAlign: i === 3 ? 'right' : 'left',
                    fontWeight: 500, fontSize: 12,
                    color: 'var(--color-text-secondary)',
                    padding: '8px 12px',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    width: ['30%', '40%', '15%', '15%'][i],
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(feedback?.latest_negatives?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 24, fontSize: 13 }}>
                    Aucun feedback négatif pour l'instant.
                  </td>
                </tr>
              ) : (feedback?.latest_negatives ?? []).map((row) => {
                const excerpt = row.answer_excerpt || ''
                const clipped = excerpt.length > 80 ? `${excerpt.slice(0, 80)}...` : excerpt
                return (
                  <tr key={row.message_id} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.question || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {clipped || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-tertiary)' }}>
                      {row.created_at ? new Date(row.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedAlert(row)}
                        style={{
                        fontSize: 11, padding: '4px 10px',
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 'var(--border-radius-md)',
                        background: 'transparent',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                      }}>
                        Détails
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {selectedAlert ? (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: 16,
          }}>
            <div style={{
              width: 'min(780px, 92vw)',
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 'var(--border-radius-lg)',
              padding: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>Détails du feedback</div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    border: '0.5px solid var(--color-border-secondary)',
                    borderRadius: 'var(--border-radius-md)',
                    background: 'transparent',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Fermer
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Question</div>
                  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                    {selectedAlert.question || '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>Réponse</div>
                  <div style={{ fontSize: 14, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                    {selectedAlert.answer || selectedAlert.answer_excerpt || '-'}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                  {selectedAlert.created_at ? new Date(selectedAlert.created_at).toLocaleString('fr-FR') : ''}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Header>
  )
}