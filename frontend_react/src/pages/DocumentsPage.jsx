import { useEffect, useState } from 'react'
import { Alert } from '@mui/material'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import Header from '../components/Header'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { fileToBase64 } from '../utils/base64'

/* ── inject styles once ── */
const STYLE_ID = 'docs-page-styles'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

    .dp-root { font-family: 'DM Sans', sans-serif; }

    /* ── card shell ── */
    .dp-card {
      background: var(--color-background-primary);
      border: 1px solid var(--color-border-tertiary);
      border-radius: 14px;
      overflow: hidden;
    }

    /* ── card header ── */
    .dp-card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--color-border-tertiary);
    }
    .dp-card-title {
      font-size: 17px; font-weight: 600;
      color: var(--color-text-primary);
      margin: 0;
    }

    /* ── upload button ── */
    .dp-upload-btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'DM Sans', sans-serif;
  font-size: 14px; font-weight: 500;
  padding: 10px 18px;
  border: none;
  border-radius: 9px;
  background: linear-gradient(135deg, #6366F1, #818CF8); /* ← same as create btn */
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(99,102,241,.25);
  transition: opacity .15s;
}

.dp-upload-btn:hover {
  opacity: .88;
}

    /* ── table ── */
    .dp-table {
      width: 100%; border-collapse: collapse;
      font-size: 14.5px;
    }
    .dp-table thead tr {
      border-bottom: 1px solid var(--color-border-tertiary);
    }
    .dp-table th {
      padding: 12px 18px;
      font-size: 11px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase;
      color: var(--color-text-tertiary);
      text-align: left;
      white-space: nowrap;
    }
    .dp-table tbody tr {
      border-bottom: 1px solid var(--color-border-tertiary);
      transition: background .14s;
    }
    .dp-table tbody tr:last-child { border-bottom: none; }
    .dp-table tbody tr:hover { background: rgba(0,0,0,0.025); }
    .dp-table td {
      padding: 14px 18px;
      color: var(--color-text-primary);
      vertical-align: middle;
    }

    /* ── doc name cell ── */
    .dp-doc-name {
      display: flex; align-items: center; gap: 12px;
      font-weight: 500; color: var(--color-text-primary);
      max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .dp-doc-icon {
      width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
      background: #F1F5F9;
      display: flex; align-items: center; justify-content: center;
    }

    /* ── meta cells ── */
    .dp-meta {
      color: var(--color-text-secondary); font-size: 14px;
    }
    .dp-date {
      font-family: 'DM Mono', monospace;
      font-size: 12px; color: var(--color-text-tertiary);
    }

    /* ── action buttons ── */
    .dp-open-btn {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px; font-weight: 500;
      padding: 7px 14px;
      border: 1px solid var(--color-border-secondary);
      border-radius: 8px;
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: background .15s, border-color .15s, color .15s;
      white-space: nowrap;
    }
    .dp-open-btn:hover {
      background: var(--color-background-secondary, rgba(0,0,0,.04));
      color: var(--color-text-primary);
      border-color: var(--color-text-tertiary);
    }

    .dp-del-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 34px; height: 34px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
      color: var(--color-text-tertiary);
      transition: background .15s, border-color .15s, color .15s;
    }
    .dp-del-btn:hover {
      background: #FEF2F2;
      border-color: #FECACA;
      color: #DC2626;
    }

    /* ── empty / loading states ── */
    .dp-empty {
      padding: 56px 24px;
      text-align: center;
      color: var(--color-text-tertiary);
      font-size: 15px;
    }
    .dp-empty-icon {
      margin: 0 auto 14px;
      width: 44px; height: 44px; border-radius: 12px;
      background: var(--color-background-secondary, #F1F5F9);
      display: flex; align-items: center; justify-content: center;
    }

    /* ── skeleton rows ── */
    .dp-skel {
      height: 16px; border-radius: 4px;
      background: linear-gradient(90deg, var(--color-border-tertiary) 25%, rgba(0,0,0,.04) 50%, var(--color-border-tertiary) 75%);
      background-size: 200% 100%;
      animation: dp-shimmer 1.4s infinite;
    }
    @keyframes dp-shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }

    /* ── modal overlay ── */
    .dp-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.45);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000; padding: 16px;
      animation: dp-fade-in .18s ease;
    }
    .dp-modal {
      width: min(460px, 92vw);
      background: var(--color-background-primary);
      border: 1px solid var(--color-border-tertiary);
      border-radius: 18px;
      padding: 32px;
      animation: dp-slide-up .22s cubic-bezier(.22,.86,.44,1);
    }
    @keyframes dp-fade-in  { from { opacity: 0 } to { opacity: 1 } }
    @keyframes dp-slide-up { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }

    .dp-modal-title {
      font-size: 19px; font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 10px;
    }
    .dp-modal-body {
      font-size: 15px; color: var(--color-text-secondary);
      line-height: 1.6; margin: 0 0 28px;
    }
    .dp-modal-filename {
      font-family: 'DM Mono', monospace;
      font-size: 13px;
      background: var(--color-background-secondary, rgba(0,0,0,.04));
      border: 1px solid var(--color-border-tertiary);
      border-radius: 6px;
      padding: 3px 10px;
      color: var(--color-text-primary);
    }
    .dp-modal-actions {
      display: flex; gap: 12px; justify-content: flex-end;
    }
    .dp-modal-cancel {
      font-family: 'DM Sans', sans-serif;
      font-size: 14px; font-weight: 500;
      padding: 10px 20px;
      border: 1px solid var(--color-border-secondary);
      border-radius: 9px;
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: background .15s;
    }
    .dp-modal-cancel:hover { background: rgba(0,0,0,.04); }
    .dp-modal-confirm {
      font-family: 'DM Sans', sans-serif;
      font-size: 14px; font-weight: 500;
      padding: 10px 20px;
      border: none; border-radius: 9px;
      background: #DC2626;
      color: #fff;
      cursor: pointer;
      transition: background .15s, transform .15s;
    }
    .dp-modal-confirm:hover { background: #B91C1C; transform: translateY(-1px); }
  `
  document.head.appendChild(s)
}

/* ── inline SVG icons ── */
const IconFile = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)
const IconExternalLink = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)
const IconTrash = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)
const IconWarn = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconDocs = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
)

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function SkeletonRow({ cols }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border-tertiary)' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '16px 18px' }}>
          <div className="dp-skel" style={{ width: i === 0 ? '60%' : '40%' }} />
        </td>
      ))}
    </tr>
  )
}

export default function DocumentsPage() {
  const { token, role } = useAuth()
  const [documents, setDocuments] = useState([])
  const [error, setError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmDoc, setConfirmDoc] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.listDocuments(token)
      setDocuments(data.documents || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openDoc = async (doc) => {
    try {
      const openUrl = doc.open || (await api.signedUrl(token, doc.name, 120)).url
      if (openUrl) window.open(openUrl, '_blank', 'noopener,noreferrer')
    } catch (err) { setError(err.message) }
  }

  const removeDoc = async (name) => {
    try {
      await api.deleteDocument(token, name)
      await load()
    } catch (err) { setError(err.message) }
  }

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setError('')

    for (const file of files) {
      try {
        setUploadStatus(`Traitement de ${file.name}...`)
        const content_b64 = await fileToBase64(file)
        const data = await api.uploadDocument(token, file.name, content_b64)

        if (data.status === 'Duplicate') {
          setUploadStatus(`Doublon : ${file.name} (ignoré)`)
        } else {
          setUploadStatus(`Indexé : ${file.name}`)
        }
      } catch (err) {
        setError(err.message)
      }
    }

    await load()
    setTimeout(() => setUploadStatus(''), 1500)
  }

  const isAdmin = role === 'admin'
  const colCount = isAdmin ? 5 : 2

  return (
    <Header title="Documents" subtitle="Bibliothèque de documents indexés.">
      <div className="dp-root" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <div className="dp-card">
          <div className="dp-card-header">
            <span className="dp-card-title">Bibliothèque</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isAdmin ? (
                <label className="dp-upload-btn">
                  <UploadFileRoundedIcon sx={{ fontSize: 20 }} />
                  Importer un fichier
                  <input hidden type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={onUpload} />
                </label>
              ) : null}
            </div>
          </div>
          
          {isAdmin && uploadStatus ? (
            <div style={{ padding: '10px 24px 0 24px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              {uploadStatus}
            </div>
          ) : null}

          <div style={{ overflowX: 'auto' }}>
            <table className="dp-table">
              <thead>
                <tr>
                  <th>Nom du document</th>
                  {isAdmin && <th>Ajouté par</th>}
                  {isAdmin && <th>Date d'ajout</th>}
                  <th>Ouvrir</th>
                  {isAdmin && <th style={{ width: 60 }}></th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={colCount}>
                      <div className="dp-empty">
                        <div className="dp-empty-icon"><IconDocs /></div>
                        Aucun document trouvé.
                      </div>
                    </td>
                  </tr>
                ) : documents.map((doc) => (
                  <tr key={doc.name}>
                    <td>
                      <div className="dp-doc-name">
                        <div className="dp-doc-icon"><IconFile /></div>
                        {doc.name}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="dp-meta">{doc.uploaded_by || '—'}</td>
                    )}
                    {isAdmin && (
                      <td className="dp-date">{formatDate(doc.upload_date)}</td>
                    )}
                    <td>
                      <button className="dp-open-btn" onClick={() => openDoc(doc)}>
                        Ouvrir <IconExternalLink />
                      </button>
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          className="dp-del-btn"
                          title="Supprimer le document"
                          onClick={() => setConfirmDoc(doc)}
                        >
                          <IconTrash />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── delete confirm modal ── */}
      {confirmDoc && (
        <div className="dp-modal-overlay" onClick={() => setConfirmDoc(null)}>
          <div className="dp-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: '#FEF2F2', border: '1px solid #FECACA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconWarn />
              </div>
              <div>
                <div className="dp-modal-title">Supprimer le document</div>
                <div className="dp-modal-body">
                  Cette action est irréversible. Le document{' '}
                  <span className="dp-modal-filename">{confirmDoc.name}</span>{' '}
                  sera définitivement supprimé ainsi que ses entrées d'index.
                </div>
              </div>
            </div>
            <div className="dp-modal-actions">
              <button className="dp-modal-cancel" onClick={() => setConfirmDoc(null)}>
                Annuler
              </button>
              <button
                className="dp-modal-confirm"
                onClick={async () => {
                  const name = confirmDoc.name
                  setConfirmDoc(null)
                  await removeDoc(name)
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </Header>
  )
}
