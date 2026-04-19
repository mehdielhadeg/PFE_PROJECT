import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Button,
} from '@mui/material'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'

import Header from '../components/Header'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

export default function DocumentsPage() {
  const { token, role } = useAuth()
  const [documents, setDocuments] = useState([])
  const [error, setError] = useState('')
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

  useEffect(() => {
    load()
  }, [])

  const openDoc = async (doc) => {
    try {
      const openUrl = doc.open || (await api.signedUrl(token, doc.name, 120)).url
      if (openUrl) window.open(openUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.message)
    }
  }

  const removeDoc = async (name) => {
    try {
      await api.deleteDocument(token, name)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const isAdmin = role === 'admin'

  return (
    <Header title="Documents">
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">Library</Typography>
          <Chip label={isAdmin ? 'Admin access' : 'Employee access'} color={isAdmin ? 'primary' : 'default'} />
        </Stack>

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {loading ? <Typography color="text.secondary">Loading documents...</Typography> : null}
        {!loading && documents.length === 0 ? <Typography color="text.secondary">No documents found.</Typography> : null}

        {!loading && documents.length > 0 ? (
          <Box sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  {isAdmin ? <TableCell>Uploaded By</TableCell> : null}
                  {isAdmin ? <TableCell>Upload Date</TableCell> : null}
                  <TableCell width={150}>Open</TableCell>
                  {isAdmin ? <TableCell width={150}>Delete</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.name} hover>
                    <TableCell>{doc.name}</TableCell>
                    {isAdmin ? <TableCell>{doc.uploaded_by || '-'}</TableCell> : null}
                    {isAdmin ? <TableCell>{formatDate(doc.upload_date)}</TableCell> : null}
                    <TableCell>
                      <Button size="small" variant="outlined" onClick={() => openDoc(doc)} endIcon={<OpenInNewRoundedIcon />}>
                        Open
                      </Button>
                    </TableCell>
                    {isAdmin ? (
                      <TableCell>
                        <Tooltip title="Delete document">
                          <IconButton color="error" onClick={() => setConfirmDoc(doc)}>
                            <DeleteOutlineRoundedIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : null}
      </Paper>

      <Dialog open={Boolean(confirmDoc)} onClose={() => setConfirmDoc(null)}>
        <DialogTitle>Delete document</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the document
            {confirmDoc?.name ? ` \"${confirmDoc.name}\"` : ''} and remove its index entries.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDoc(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!confirmDoc?.name) return
              const name = confirmDoc.name
              setConfirmDoc(null)
              await removeDoc(name)
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Header>
  )
}
