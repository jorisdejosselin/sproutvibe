import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ServerSetupPage from '../ServerSetupPage'

// Keep the auto-detect effect from firing a real request. api/client.js is
// pulled in transitively and calls axios.create(), so that needs stubbing too.
vi.mock('axios', () => {
  const instance = {
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  }
  return {
    default: {
      create: vi.fn(() => instance),
      get: vi.fn().mockRejectedValue(new Error('Network Error')),
    },
  }
})

describe('ServerSetupPage — issue #32 guidance', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('warns before connecting when an http server is typed into the https app shell', async () => {
    // Simulate the Capacitor WebView origin, which is where #32 was reported.
    const original = window.location
    delete window.location
    window.location = { ...original, origin: 'https://localhost', protocol: 'https:' }

    render(<ServerSetupPage onConnected={() => {}} />)
    await userEvent.type(
      screen.getByPlaceholderText(/sprout.yourdomain.com/i),
      'http://192.168.100.67:5055',
    )

    // The user is told why before they hit a dead end.
    expect(await screen.findByText(/cannot reach an http:\/\/ server/i)).toBeInTheDocument()

    window.location = original
  })

  it('stays quiet for an https server url', async () => {
    const original = window.location
    delete window.location
    window.location = { ...original, origin: 'https://localhost', protocol: 'https:' }

    render(<ServerSetupPage onConnected={() => {}} />)
    await userEvent.type(
      screen.getByPlaceholderText(/sprout.yourdomain.com/i),
      'https://sprout.example.com',
    )
    expect(screen.queryByText(/cannot reach an http:\/\/ server/i)).not.toBeInTheDocument()

    window.location = original
  })
})
