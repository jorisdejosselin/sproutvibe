import { describe, it, expect } from 'vitest'
import {
  classifyConnectionError,
  preflightServerUrl,
  parseServerUrl,
  buildDiagnosticReport,
} from '../diagnostics'

// The Capacitor WebView serves the app from https://localhost — this is the
// environment issue #32 was reported from.
const nativeEnv = {
  origin: 'https://localhost',
  protocol: 'https:',
  native: true,
  platform: 'android',
  userAgent: 'test',
  online: true,
}
// A self-hosted instance opened in a browser over plain http.
const browserEnv = { ...nativeEnv, origin: 'http://192.168.100.67:5055', protocol: 'http:', native: false, platform: 'web' }

const networkError = Object.assign(new Error('Network Error'), { code: undefined, response: undefined })

describe('parseServerUrl', () => {
  it('rejects input without a scheme', () => {
    expect(parseServerUrl('192.168.1.10:5055')).toBeNull()
  })
  it('parses a normal http url', () => {
    expect(parseServerUrl('http://192.168.1.10:5055')?.host).toBe('192.168.1.10:5055')
  })
})

describe('preflight — the #32 case', () => {
  it('flags an http server as unreachable from the https app shell', () => {
    const r = preflightServerUrl('http://192.168.100.67:5055', nativeEnv)
    expect(r?.code).toBe('MIXED_CONTENT')
    expect(r?.severity).toBe('error')
  })

  it('does not flag the same url in a plain http browser, where it works', () => {
    expect(preflightServerUrl('http://192.168.100.67:5055', browserEnv)).toBeNull()
  })

  it('does not flag an https server from the app shell', () => {
    expect(preflightServerUrl('https://sprout.example.com', nativeEnv)).toBeNull()
  })

  it('flags input with no scheme', () => {
    expect(preflightServerUrl('192.168.1.10:5055', nativeEnv)?.code).toBe('INVALID_URL')
  })
})

describe('classifyConnectionError', () => {
  it('reports mixed content rather than a generic network failure', () => {
    // This is the regression that matters: the reporter saw only "Network Error".
    const r = classifyConnectionError(networkError, 'http://192.168.100.67:5055', nativeEnv)
    expect(r.code).toBe('MIXED_CONTENT')
    expect(r.title).not.toMatch(/network error/i)
  })

  it('falls back to a plain unreachable message when schemes match', () => {
    expect(classifyConnectionError(networkError, 'http://192.168.100.67:5055', browserEnv).code).toBe('NO_RESPONSE')
  })

  it('calls out certificate trust for https failures', () => {
    const r = classifyConnectionError(networkError, 'https://sprout.example.com', nativeEnv)
    expect(r.code).toBe('NO_RESPONSE_HTTPS')
    expect(r.detail).toMatch(/certificate/i)
  })

  it('detects timeouts', () => {
    const err = Object.assign(new Error('timeout of 6000ms exceeded'), { code: 'ECONNABORTED' })
    expect(classifyConnectionError(err, 'http://h:1', browserEnv).code).toBe('TIMEOUT')
  })

  it('treats an http response as a server problem, not a network one', () => {
    const err = Object.assign(new Error('Request failed'), { response: { status: 404 } })
    const r = classifyConnectionError(err, 'http://h:1', browserEnv)
    expect(r.code).toBe('HTTP_STATUS')
    expect(r.detail).toMatch(/no Sprout API/i)
  })
})

describe('buildDiagnosticReport', () => {
  it('records the scheme mismatch that explains the failure', () => {
    const text = buildDiagnosticReport({ url: 'http://192.168.100.67:5055', err: networkError, env: nativeEnv })
    expect(text).toMatch(/scheme match\s+: no/)
    expect(text).toMatch(/MIXED_CONTENT/)
    expect(text).toMatch(/platform\s+: android/)
  })

  it('never leaks the auth token', () => {
    localStorage.setItem('token', 'super-secret-jwt')
    const text = buildDiagnosticReport({ url: 'http://h:1', err: networkError, env: nativeEnv })
    expect(text).not.toMatch(/super-secret-jwt/)
    localStorage.clear()
  })
})
