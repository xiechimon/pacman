import { describe, it, expect, afterEach, spyOn } from 'bun:test'
import { loginGitHubCopilot } from '../github-copilot'

const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const COPILOT_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token'
const COPILOT_TOKEN = 'tid=1;exp=2;proxy-ep=proxy.individual.githubcopilot.com;st=x'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * Wrap a handler so we can count calls. Also lets the test inject delays to
 * simulate the real device-flow cadence (5s poll interval) without making
 * the test take 40 seconds.
 */
function installFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): { calls: string[] } {
  const calls: string[] = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push(url)
    return handler(url, init)
  }) as typeof fetch
  return { calls }
}

/** Simulate the full device flow with realistic ~5s poll cadence. */
function installRealisticCopilotFetch(opts: {
  pollDelayMs: number
  pollAnswers?: 'success' | 'pending-then-success'
}): { calls: string[] } {
  const polls: string[] = []
  let pollIndex = 0
  return installFetch(async (url) => {
    if (url === DEVICE_CODE_URL) {
      return json({
        device_code: 'dev-code',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      })
    }
    if (url === ACCESS_TOKEN_URL) {
      polls.push(url)
      const idx = pollIndex++
      await new Promise(r => setTimeout(r, opts.pollDelayMs))
      if (opts.pollAnswers === 'pending-then-success' && idx === 0) {
        return json({ error: 'authorization_pending' })
      }
      return json({ access_token: 'gho_test_token' })
    }
    if (url === COPILOT_TOKEN_URL) {
      // Simulate Copilot API token exchange: ~1s typical.
      await new Promise(r => setTimeout(r, 1000))
      return json({ token: COPILOT_TOKEN, expires_at: 4_102_444_800 })
    }
    // Mock the /models call that login enables gated models for.
    if (url === 'https://api.individual.githubcopilot.com/models') {
      return json({ data: [] })
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
}

const instantSleep = async (): Promise<void> => {}

describe('loginGitHubCopilot — IPC timeout compatibility', () => {
  it('full device flow completes well under the 30s IPC timeout when polls succeed immediately', async () => {
    const { calls } = installRealisticCopilotFetch({ pollDelayMs: 100 })
    const start = Date.now()
    const creds = await loginGitHubCopilot({ sleepFn: instantSleep })
    const elapsed = Date.now() - start
    // 1s Copilot exchange + a touch of overhead; comfortably under 30s.
    expect(elapsed).toBeLessThan(5_000)
    expect(creds.access).toBe(COPILOT_TOKEN)
    expect(calls).toContain(DEVICE_CODE_URL)
    expect(calls).toContain(ACCESS_TOKEN_URL)
    expect(calls).toContain(COPILOT_TOKEN_URL)
  })

  // GREEN: device code is pushed within ~3s even while the poll loop is still
  // blocked on slow polls (5s each). The IPC handler uses this signal to
  // return immediately and let the renderer await the terminal AUTH_RESULT
  // push instead — keeps the call well under REQUEST_TIMEOUT_MS = 30_000.
  it('device code is surfaced within ~3s, before the full 40s flow completes', async () => {
    const { calls } = installRealisticCopilotFetch({ pollDelayMs: 5_000, pollAnswers: 'success' })
    const deviceCodeAt: number[] = []
    const startedAt = Date.now()
    // Kick off login but DON'T await — we want to observe the device-code
    // push landing while the polls are still pending.
    const pending = loginGitHubCopilot({
      sleepFn: (ms, signal) =>
        new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, ms)
          signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')) })
        }),
      onDeviceCode: () => { deviceCodeAt.push(Date.now() - startedAt) },
    })
    // Device code should arrive within ~3s (network + handler dispatch).
    await new Promise(r => setTimeout(r, 3_000))
    expect(deviceCodeAt.length).toBe(1)
    // Don't leave the pending promise dangling.
    pending.catch(() => undefined)
    expect(calls).toContain(DEVICE_CODE_URL)
  }, 10_000)

  // GREEN: the full flow with 5s-per-poll cadence still completes inside the
  // background task that the handler awaits on the renderer's behalf. The
  // promise resolution lands in the 5-7s window — still over the 30s IPC
  // budget *without* the early-return design, so the handler MUST NOT block
  // on it (which the production handler no longer does after this fix).
  it('full flow with slow polls completes around the 5-7s mark', async () => {
    installRealisticCopilotFetch({ pollDelayMs: 5_000, pollAnswers: 'success' })
    const slowSleep = (ms: number, signal: AbortSignal | undefined) =>
      new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, ms)
        signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')) })
      })
    const start = Date.now()
    const creds = await loginGitHubCopilot({ sleepFn: slowSleep })
    const elapsed = Date.now() - start
    expect(creds.access).toBe(COPILOT_TOKEN)
    // One 5s poll + ~1s Copilot exchange = ~6s. Bound generously so the test
    // isn't flaky on a busy CI box.
    expect(elapsed).toBeGreaterThan(5_000)
    expect(elapsed).toBeLessThan(20_000)
  }, 30_000)
})
