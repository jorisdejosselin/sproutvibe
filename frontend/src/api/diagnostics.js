/**
 * Network diagnostics for the server-connection flow.
 *
 * Motivation: issue #32 — the Android APK showed a bare "Network Error" when
 * adding a self-hosted server over a VPN, while the same URL worked in the
 * phone's browser. "Network Error" is what axios reports for *every*
 * connection-level failure, so there was nothing to act on and nothing to ask
 * the reporter for. This module turns that single string into a specific
 * cause plus a copyable report.
 *
 * The most important case it detects is mixed content. Capacitor serves the
 * app from https://localhost, so an http:// server URL is an https -> http
 * request, which the Android WebView blocks silently. That is invisible to
 * the user and looks exactly like the server being unreachable — but the
 * browser works, because there the page origin is already http.
 */

/** True when running inside the Capacitor native shell rather than a browser. */
export function isNativeApp() {
  // Capacitor injects this global; checked defensively so this is safe in
  // jsdom and in a plain browser where it is simply absent.
  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined
  return Boolean(cap?.isNativePlatform?.() ?? cap?.isNative)
}

export function getPlatform() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined
  return cap?.getPlatform?.() || 'web'
}

/** Snapshot of where the app itself is running. */
export function getEnvironment() {
  const loc = typeof window !== 'undefined' ? window.location : undefined
  return {
    origin: loc?.origin || 'unknown',
    protocol: loc?.protocol || 'unknown',
    native: isNativeApp(),
    platform: getPlatform(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
  }
}

/** Parse a user-entered server URL. Returns null when it is not usable. */
export function parseServerUrl(raw) {
  if (!raw) return null
  const trimmed = String(raw).trim()
  try {
    // Reject scheme-less input explicitly rather than letting URL() guess.
    if (!/^https?:\/\//i.test(trimmed)) return null
    return new URL(trimmed)
  } catch {
    return null
  }
}

/**
 * Checks a server URL *before* any request is made, so we can explain a
 * failure the request itself would only report as "Network Error".
 * Returns null when nothing is wrong.
 */
export function preflightServerUrl(raw, env = getEnvironment()) {
  const parsed = parseServerUrl(raw)
  if (!parsed) {
    return {
      code: 'INVALID_URL',
      severity: 'error',
      title: 'That does not look like a URL',
      detail: 'Include the scheme and port, for example http://192.168.1.10:5055',
    }
  }

  // https page -> http server is mixed content, which is dropped before it
  // reaches the network and surfaces to JS as an ordinary failure.
  //
  // Not on Android: capacitor.config.ts sets android.allowMixedContent, so
  // https -> http genuinely works there. Warning anyway would be a false
  // positive on the exact address the user should be typing — and since the
  // Android fix and this file shipped in the same release (v1.4.1), there is
  // no Android build where the warning would ever have been correct.
  //
  // Still applies to a browser or installed PWA served over https, and to iOS
  // if that is ever shipped, since allowMixedContent is Android-only.
  const mixedContentBlocked = env.platform !== 'android'
  if (mixedContentBlocked && env.protocol === 'https:' && parsed.protocol === 'http:') {
    return {
      code: 'MIXED_CONTENT',
      severity: 'warning',
      title: 'This page cannot reach an http:// server',
      detail:
        `This page is served from ${env.origin} (https), and an https page is not ` +
        `allowed to call an http address — the request is dropped before it leaves ` +
        `the device, which is why ${parsed.host} may work in a normal browser tab ` +
        `but not here. Open the app from an http:// address instead, or serve the ` +
        `server over https.`,
    }
  }

  return null
}

/**
 * Turn a failed connection attempt into something actionable.
 * `err` is an axios error; `raw` is the server URL that was tried.
 */
export function classifyConnectionError(err, raw, env = getEnvironment()) {
  const parsed = parseServerUrl(raw)
  const host = parsed?.host || 'the server'

  // The server answered — this is not a networking problem.
  if (err?.response) {
    const status = err.response.status
    return {
      code: 'HTTP_STATUS',
      title: `Server responded with ${status}`,
      detail:
        status === 404
          ? `Reached ${host}, but there is no Sprout API at that address. Check the port and any path prefix.`
          : status === 401 || status === 403
            ? `Reached ${host}, but it refused the request. Something in front of the server may require authentication.`
            : `Reached ${host}, but it returned ${status}. Check that the URL points at the Sprout backend.`,
    }
  }

  if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
    return {
      code: 'TIMEOUT',
      title: 'The server did not answer in time',
      detail: `No reply from ${host}. It may be unreachable from this network, or blocked by a firewall.`,
    }
  }

  // No response at all. Before blaming the network, check whether we ever had
  // a chance — a blocked mixed-content request looks identical from here.
  const pre = preflightServerUrl(raw, env)
  if (pre?.code === 'MIXED_CONTENT') return pre

  if (parsed?.protocol === 'https:') {
    return {
      code: 'NO_RESPONSE_HTTPS',
      title: `Could not reach ${host}`,
      detail:
        `Nothing came back. Over https this is usually a certificate the device does not ` +
        `trust — self-signed certificates are rejected without a visible warning here. ` +
        `It can also mean the address is unreachable from this network.`,
    }
  }

  return {
    code: 'NO_RESPONSE',
    title: `Could not reach ${host}`,
    detail:
      `Nothing came back. Check the address and port, that the server is running, and ` +
      `that this device is on a network that can reach it (VPN connected, for example).`,
  }
}

/**
 * A copyable block for bug reports. Deliberately contains no auth token and
 * no stored data — just the URL the user typed and how the attempt failed.
 */
export function buildDiagnosticReport({ url, err, env = getEnvironment() } = {}) {
  const parsed = parseServerUrl(url)
  const classified = err ? classifyConnectionError(err, url, env) : null
  const lines = [
    `time         : ${new Date().toISOString()}`,
    `app origin   : ${env.origin}`,
    `platform     : ${env.platform}${env.native ? ' (native shell)' : ' (browser)'}`,
    `online       : ${env.online}`,
    `server url   : ${url || '(none)'}`,
    `server scheme: ${parsed?.protocol || '(unparsed)'}`,
    `scheme match : ${parsed ? (parsed.protocol === env.protocol ? 'yes' : `no — app is ${env.protocol}`) : 'n/a'}`,
  ]
  if (err) {
    lines.push(
      `error code   : ${err.code || '(none)'}`,
      `error message: ${err.message || '(none)'}`,
      `http status  : ${err.response?.status ?? '(no response)'}`,
      `diagnosis    : ${classified?.code} — ${classified?.title}`,
    )
  }
  lines.push(`user agent   : ${env.userAgent}`)
  return lines.join('\n')
}
