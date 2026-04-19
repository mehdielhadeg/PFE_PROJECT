import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'

import Header from '../components/Header'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function UsersPage() {
  const { token, role, username: currentUsername } = useAuth()
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  const [createForm, setCreateForm] = useState({ username: '', password: '', role: 'employee' })
  const [editMap, setEditMap] = useState({})
  const [confirmUser, setConfirmUser] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.listUsers(token)
      setUsers(data || [])
      const nextEdit = {}
      for (const u of data || []) {
        nextEdit[u.id] = { username: u.username, role: u.role, password: '' }
      }
      setEditMap(nextEdit)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (role !== 'admin') return
    load()
  }, [role])

  if (role !== 'admin') {
    return (
      <Header title="Users" subtitle="Admin only">
        <Alert severity="warning">Access denied.</Alert>
      </Header>
    )
  }

  const createUser = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await api.createUser(token, createForm)
      setCreateForm({ username: '', password: '', role: 'employee' })
      setSuccess('User created.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const updateUser = async (id) => {
    setError('')
    setSuccess('')
    try {
      const payload = { ...editMap[id] }
      if (!payload.password) delete payload.password
      await api.updateUser(token, id, payload)
      setSuccess('User updated.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteUser = async (id) => {
    setError('')
    setSuccess('')
    try {
      await api.deleteUser(token, id)
      setSuccess('User deleted.')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Header title="Users">
      <Stack spacing={2}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Create user</Typography>
          <Box component="form" onSubmit={createUser} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 180px auto' }, gap: 1 }}>
            <TextField label="Username" value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} required />
            <TextField label="Password" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required />
            <TextField select label="Role" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
              <MenuItem value="employee">employee</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </TextField>
            <Button type="submit" variant="contained">Create</Button>
          </Box>
        </Paper>

        {error ? <Alert severity="error">{error}</Alert> : null}
        {success ? <Alert severity="success">{success}</Alert> : null}

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Manage users</Typography>
          {loading ? <Typography sx={{ opacity: 0.75 }}>Loading...</Typography> : null}

          {!loading ? (
            <Table>
              <TableHead>
                <TableRow>
                  {/* <TableCell>ID</TableCell> */}
                  <TableCell>Username</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>New Password (optional)</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    {/* <TableCell>{u.id}</TableCell> */}
                    <TableCell>
                      <TextField
                        size="small"
                        value={editMap[u.id]?.username || ''}
                        onChange={(e) => setEditMap((prev) => ({ ...prev, [u.id]: { ...prev[u.id], username: e.target.value } }))}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={editMap[u.id]?.role || 'employee'}
                        onChange={(e) => setEditMap((prev) => ({ ...prev, [u.id]: { ...prev[u.id], role: e.target.value } }))}
                      >
                        <MenuItem value="employee">employee</MenuItem>
                        <MenuItem value="admin">admin</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="password"
                        placeholder="Leave empty to keep"
                        value={editMap[u.id]?.password || ''}
                        onChange={(e) => setEditMap((prev) => ({ ...prev, [u.id]: { ...prev[u.id], password: e.target.value } }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <IconButton color="primary" onClick={() => updateUser(u.id)}>
                          <SaveOutlinedIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => setConfirmUser(u)}
                          disabled={u.username === currentUsername}
                          title={u.username === currentUsername ? 'You cannot delete yourself' : 'Delete user'}
                        >
                          <DeleteOutlineRoundedIcon />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Paper>
      </Stack>

      <Dialog open={Boolean(confirmUser)} onClose={() => setConfirmUser(null)}>
        <DialogTitle>Delete user</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the user
            {confirmUser?.username ? ` \"${confirmUser.username}\"` : ''} and remove their conversation history.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUser(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!confirmUser?.id) return
              const id = confirmUser.id
              setConfirmUser(null)
              await deleteUser(id)
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Header>
  )
}
