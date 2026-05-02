import { Link, useLocation } from 'react-router-dom'
import {
  Box,
  Button,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'

import { useAuth } from '../context/AuthContext'

export default function Header({ title, subtitle, sidebarExtra, headerActions, children, layout }) {
  const { role, username, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    ...(role === 'admin' ? [{ to: '/dashboard', label: 'Dashboard', icon: <DashboardOutlinedIcon fontSize="small" /> }] : []),
    { to: '/chat', label: 'Chat', icon: <ChatOutlinedIcon fontSize="small" /> },
    { to: '/documents', label: 'Documents', icon: <DescriptionOutlinedIcon fontSize="small" /> },
    ...(role === 'admin' ? [{ to: '/users', label: 'Utilisateurs', icon: <GroupOutlinedIcon fontSize="small" /> }] : []),
  ]

  const rootClass = layout === 'chat' ? 'cg-root cg-root-chat' : 'cg-root'
  const mainClass = layout === 'chat' ? 'cg-main cg-main-chat' : 'cg-main'

  return (
    <Box className={rootClass} sx={{ display: 'flex', height: '100vh' }}>
      
      {/* ─── Sidebar ─── */}
      <Box
        component="aside"
        className="cg-sidebar"
        sx={{
          width: 260,
          px: 2,
          py: 2.5,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid var(--color-border-tertiary)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent)',
        }}
      >
        {/* Top */}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Assistant Intelligent
          </Typography>

          <Typography
            variant="caption"
            sx={{
              fontSize: 12,
              color: 'var(--color-text-tertiary)',
            }}
          >
            {username}
          </Typography>

          <Typography
            variant="caption"
            sx={{
              fontSize: 12,
              display: 'block',
              color: 'var(--color-text-tertiary)',
              mb: 2,
            }}
          >
            {role}
          </Typography>

          <Stack spacing={0.5}>
            {navItems.map((item) => {
              const active = location.pathname === item.to

              return (
                <Button
                  key={item.to}
                  component={Link}
                  to={item.to}
                  startIcon={item.icon}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: 16, // 👈 slightly bigger
                    px: 1.5,
                    py: 0.9,
                    borderRadius: 2,
                    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: active ? '1px solid var(--color-border-secondary)' : '1px solid transparent',

                    '&:hover': {
                      background: 'rgba(255,255,255,0.05)',
                      borderColor: 'var(--color-border-secondary)',
                    },
                  }}
                >
                  {item.label}
                </Button>
              )
            })}
          </Stack>

          {sidebarExtra && (
            <>
              <Divider sx={{ my: 2, opacity: 0.2 }} />
              <Box>{sidebarExtra}</Box>
            </>
          )}
        </Box>

        {/* Bottom */}
        <Box>
          <Divider sx={{ mb: 1.5, opacity: 0.2 }} />
          <Button
            fullWidth
            startIcon={<LogoutIcon />}
            onClick={logout}
            sx={{
              textTransform: 'none',
              fontWeight: 500,
              borderRadius: 2,
              border: '1px solid #E24B4A',   // 👈 always red border
              color: '#E24B4A',              // 👈 always red text

              '&:hover': {
                background: 'rgba(226,75,74,0.08)',
                borderColor: '#E24B4A',
              },
            }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* ─── Main ─── */}
      <Box
        component="main"
        className={mainClass}
        sx={{
          flex: 1,
          px: 3,
          py: 2.5,
          overflow: 'auto',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
              {title}
            </Typography>

            {subtitle && (
              <Typography
                variant="body2"
                sx={{
                  color: 'var(--color-text-tertiary)',
                  mt: 0.5,
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>

          {headerActions && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {headerActions}
            </Box>
          )}
        </Box>

        {/* Content */}
        <Box className="cg-page-body">
          {children}
        </Box>
      </Box>
    </Box>
  )
}