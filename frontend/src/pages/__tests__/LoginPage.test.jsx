import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from '../LoginPage'
import { AuthProvider } from '../../hooks/useAuth'

vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(),
  getKioskStatus: vi.fn().mockResolvedValue({ kiosk_mode: false }),
  getRegistrationStatus: vi.fn().mockResolvedValue({ allowed: true, invite_required: false }),
  createDemoSession: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => vi.fn() }
})

import { login, getMe } from '../../api/auth'

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    getMe.mockResolvedValue({ id: 1, name: 'Test', email: 'test@example.com' })
  })

  it('renders the sign-in form', () => {
    renderLoginPage()
    expect(screen.getByText('SproutVibe')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
  })

  it('shows name field only in register mode', async () => {
    renderLoginPage()
    expect(screen.queryByPlaceholderText('Your name')).not.toBeInTheDocument()
    // The signup tab only appears once the server confirms signups are open.
    await userEvent.click(await screen.findByText('Create account'))
    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument()
  })

  it('calls login on form submit', async () => {
    login.mockResolvedValue({ access_token: 'tok' })
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'user@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'pass')
    // Two buttons say "Sign in" (tab + submit); click the submit button
    const submitBtn = document.querySelector('button[type="submit"]')
    await userEvent.click(submitBtn)

    expect(login).toHaveBeenCalledWith('user@example.com', 'pass')
  })

  it('shows error message on login failure', async () => {
    login.mockRejectedValue({ response: { data: { detail: 'Invalid credentials' } } })
    renderLoginPage()

    await userEvent.type(screen.getByPlaceholderText('Email'), 'bad@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'wrong')
    const submitBtn = document.querySelector('button[type="submit"]')
    await userEvent.click(submitBtn)

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })
})

describe('LoginPage — signup gating', () => {
  it('hides the Create account tab when the server has registration closed', async () => {
    const { getRegistrationStatus } = await import('../../api/auth')
    getRegistrationStatus.mockResolvedValueOnce({ allowed: false, invite_required: false })

    render(
      <MemoryRouter>
        <AuthProvider><LoginPage /></AuthProvider>
      </MemoryRouter>,
    )

    // The signup tab is not rendered at all, so it cannot be clicked into.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /create account/i })).toBeNull()
    })
    // Signing in is still possible (submit button, not the tab).
    expect(document.querySelector('button[type="submit"]')).toBeInTheDocument()
  })

  it('asks for an invite code when the server requires one', async () => {
    const { getRegistrationStatus } = await import('../../api/auth')
    getRegistrationStatus.mockResolvedValueOnce({ allowed: true, invite_required: true })

    render(
      <MemoryRouter>
        <AuthProvider><LoginPage /></AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /create account/i }))
    expect(await screen.findByPlaceholderText(/invite code/i)).toBeInTheDocument()
  })
})
