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

// Served over https, but a browser/PWA rather than the Android shell — here
// mixed content really is blocked, because allowMixedContent is Android-only.
const httpsPwaEnv = { ...nativeEnv, native: false, platform: 'web' }

describe('preflight', () => {
  it('does NOT warn on Android — allowMixedContent makes http work there', () => {
    // Regression guard. The Android fix and this file shipped in the same
    // release, so warning here is always a false positive on the very address
    // the user is supposed to type.
    expect(preflightServerUrl('http://192.168.100.67:5055', nativeEnv)).toBeNull()
  })

  it('warns for an https-served browser/PWA, where it is still blocked', () => {
    const r = preflightServerUrl('http://192.168.100.67:5055', httpsPwaEnv)
    expect(r?.code).toBe('MIXED_CONTENT')
    expect(r?.severity).toBe('warning')
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

  it('never mentions a version number', () => {
    // A version written here cannot be right: it ships in the release it names.
    const r = preflightServerUrl('http://192.168.100.67:5055', httpsPwaEnv)
    expect(JSON.stringify(r)).not.toMatch(/v\d+\.\d+\.\d+/)
  })
})

describe('classifyConnectionError', () => {
  it('reports mixed content rather than a generic network failure (browser/PWA)', () => {
    // The reporter saw only "Network Error"; this is what replaced it.
    const r = classifyConnectionError(networkError, 'http://192.168.100.67:5055', httpsPwaEnv)
    expect(r.code).toBe('MIXED_CONTENT')
    expect(r.title).not.toMatch(/network error/i)
  })

  it('on Android, a failed http connection is a plain unreachable, not mixed content', () => {
    const r = classifyConnectionError(networkError, 'http://192.168.100.67:5055', nativeEnv)
    expect(r.code).toBe('NO_RESPONSE')
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
    expect(text).toMatch(/platform\s+: android/)
  })

  it('never leaks the auth token', () => {
    localStorage.setItem('token', 'super-secret-jwt')
    const text = buildDiagnosticReport({ url: 'http://h:1', err: networkError, env: nativeEnv })
    expect(text).not.toMatch(/super-secret-jwt/)
    localStorage.clear()
  })
})
