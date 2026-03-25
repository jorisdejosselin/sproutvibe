import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../useAuth'

vi.mock('../../api/auth', () => ({
  getMe: vi.fn(),
  getKioskStatus: vi.fn().mockResolvedValue({ kiosk_mode: false }),
  createDemoSession: vi.fn(),
}))

import { getMe } from '../../api/auth'

function TestConsumer() {
  const { user, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{user ? `user:${user.name}` : 'no-user'}</div>
}

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows no user when no token is stored', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )
    })
    expect(screen.getByText('no-user')).toBeInTheDocument()
  })

  it('loads user from token when token is present', async () => {
    localStorage.setItem('token', 'fake-token')
    getMe.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@example.com' })

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )
    })
    expect(screen.getByText('user:Alice')).toBeInTheDocument()
  })

  it('clears token when getMe fails', async () => {
    localStorage.setItem('token', 'bad-token')
    getMe.mockRejectedValue(new Error('Unauthorized'))

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )
    })
    expect(localStorage.getItem('token')).toBeNull()
    expect(screen.getByText('no-user')).toBeInTheDocument()
  })
})
