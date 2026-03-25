import { describe, it, expect, beforeEach } from 'vitest'
import { getServerUrl, setServerUrl, clearServerUrl } from '../client'

describe('server URL helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty string when no server URL is stored', () => {
    expect(getServerUrl()).toBe('')
  })

  it('stores and retrieves a server URL', () => {
    setServerUrl('http://myserver.com')
    expect(getServerUrl()).toBe('http://myserver.com')
  })

  it('strips trailing slash when storing', () => {
    setServerUrl('http://myserver.com/')
    expect(getServerUrl()).toBe('http://myserver.com')
  })

  it('clearServerUrl removes the stored URL', () => {
    setServerUrl('http://myserver.com')
    clearServerUrl()
    expect(getServerUrl()).toBe('')
  })
})
