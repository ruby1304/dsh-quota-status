import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  deepSeekPeakInfo,
  loadCodexAuth,
  parseCodexUsage,
  parseDeepSeekBalance,
  parseKimiUsage,
  queryCodexUsage,
  queryProvider,
  windowKeyOf,
  windowKeyOfSeconds,
} from '../src/providers.js'

const DEEPSEEK_FIXTURE = {
  is_available: true,
  balance_infos: [
    {
      currency: 'CNY',
      total_balance: '119.52',
      granted_balance: '0.00',
      topped_up_balance: '119.52',
    },
  ],
}

const KIMI_FIXTURE = {
  user: {
    membership: { level: 'LEVEL_ADVANCED' },
  },
  usage: {
    limit: '100',
    used: '16',
    remaining: '84',
    resetTime: '2026-08-17T04:25:36.571827Z',
  },
  limits: [
    {
      window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
      detail: {
        limit: '100',
        used: '4',
        remaining: '96',
        resetTime: '2026-08-15T09:25:36.571827Z',
      },
    },
  ],
  parallel: { limit: '30' },
}

describe('parseDeepSeekBalance', () => {
  it('normalizes the official string balance fields', () => {
    expect(parseDeepSeekBalance(DEEPSEEK_FIXTURE)).toEqual({
      kind: 'balance',
      amount: 119.52,
      currency: 'CNY',
      available: true,
      granted: 0,
      toppedUp: 119.52,
    })
  })

  it('treats is_available false as unavailable', () => {
    const view = parseDeepSeekBalance({ ...DEEPSEEK_FIXTURE, is_available: false })
    expect(view.available).toBe(false)
  })

  it('rejects a payload without total_balance', () => {
    expect(() => parseDeepSeekBalance({ balance_infos: [{ currency: 'CNY' }] }))
      .toThrow(/total_balance/)
  })
})

describe('parseKimiUsage', () => {
  it('builds weekly and 5h windows with remaining percentages', () => {
    const view = parseKimiUsage(KIMI_FIXTURE)
    expect(view.kind).toBe('usage')
    expect(view.membership).toBe('LEVEL_ADVANCED')
    expect(view.windows).toEqual([
      {
        key: '5h',
        label: '5h',
        remaining: 96,
        limit: 100,
        used: 4,
        percentRemaining: 96,
        resetAt: '2026-08-15T09:25:36.571827Z',
      },
      {
        key: 'weekly',
        label: 'week',
        remaining: 84,
        limit: 100,
        used: 16,
        percentRemaining: 84,
        resetAt: '2026-08-17T04:25:36.571827Z',
      },
    ])
  })

  it('derives remaining from limit - used when remaining is absent', () => {
    const view = parseKimiUsage({
      usage: { limit: '100', used: '30' },
      limits: [],
    })
    expect(view.windows).toHaveLength(1)
    expect(view.windows[0]).toMatchObject({ key: 'weekly', remaining: 70, used: 30 })
  })

  it('rejects a payload without usage', () => {
    expect(() => parseKimiUsage({ limits: [] })).toThrow(/usage/)
  })
})

describe('windowKeyOf', () => {
  it('normalizes 300 minutes to 5h', () => {
    expect(windowKeyOf({ duration: 300, timeUnit: 'TIME_UNIT_MINUTE' })).toBe('5h')
  })

  it('normalizes 7 days to weekly', () => {
    expect(windowKeyOf({ duration: 7, timeUnit: 'TIME_UNIT_DAY' })).toBe('weekly')
  })

  it('rejects unknown shapes', () => {
    expect(windowKeyOf(undefined)).toBeUndefined()
    expect(windowKeyOf({ duration: 0, timeUnit: 'TIME_UNIT_MINUTE' })).toBeUndefined()
  })
})

describe('parseCodexUsage', () => {
  // Real 2026-08 capture: a Pro account exposes only the weekly primary window.
  const CODEX_FIXTURE = {
    plan_type: 'pro',
    rate_limit: {
      allowed: true,
      limit_reached: false,
      primary_window: { used_percent: 12.4, limit_window_seconds: 604800, reset_at: 1787281247 },
      secondary_window: null,
    },
  }

  it('maps the weekly window by limit_window_seconds, remaining = 100 - used', () => {
    const view = parseCodexUsage(CODEX_FIXTURE)
    expect(view.kind).toBe('usage')
    expect(view.membership).toBe('Pro')
    expect(view.windows).toEqual([
      {
        key: 'weekly',
        label: 'week',
        remaining: 88,
        limit: 100,
        used: 12,
        percentRemaining: 88,
        resetAt: new Date(1787281247 * 1000).toISOString(),
      },
    ])
  })

  it('supports 5h + weekly dual windows and clamps percents', () => {
    const view = parseCodexUsage({
      plan_type: 'plus',
      rate_limit: {
        primary_window: { used_percent: 26, limit_window_seconds: 18000, reset_at: 1787281247 },
        secondary_window: { used_percent: 105, limit_window_seconds: 604800 },
      },
    })
    expect(view.windows.map((w) => w.key)).toEqual(['5h', 'weekly'])
    expect(view.windows[0]).toMatchObject({ remaining: 74, percentRemaining: 74 })
    expect(view.windows[1]).toMatchObject({ remaining: 0, percentRemaining: 0, used: 100 })
    expect(view.membership).toBe('Plus')
  })

  it('rejects payloads without usable windows', () => {
    expect(() => parseCodexUsage({ rate_limit: { primary_window: null, secondary_window: null } })).toThrow(/rate_limit/)
    expect(() => parseCodexUsage({})).toThrow(/rate_limit/)
  })
})

describe('windowKeyOfSeconds', () => {
  it('maps known and unknown durations to stable labels', () => {
    expect(windowKeyOfSeconds(18000)).toBe('5h')
    expect(windowKeyOfSeconds(604800)).toBe('weekly')
    expect(windowKeyOfSeconds(7200)).toBe('2h')
    expect(windowKeyOfSeconds(172800)).toBe('2d')
    expect(windowKeyOfSeconds(5401)).toBe('5401s')
  })
})

describe('loadCodexAuth', () => {
  it('picks the newest non-disabled codex file and skips malformed ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'codex-auth-'))
    const oldFile = join(dir, 'codex-old@gmail.com-pro.json')
    writeFileSync(oldFile, JSON.stringify({ access_token: 'old', account_id: 'a1' }))
    const past = new Date(Date.now() - 60000)
    utimesSync(oldFile, past, past)
    writeFileSync(join(dir, 'codex-new@gmail.com-pro.json'), JSON.stringify({
      access_token: 'new',
      account_id: 'a2',
      email: 'new@gmail.com',
      expired: '2026-08-30T00:00:00Z',
      last_refresh: '2026-08-17T08:00:00Z',
    }))
    writeFileSync(join(dir, 'codex-bad.json'), 'not json')
    writeFileSync(join(dir, 'other.json'), JSON.stringify({ access_token: 'x', account_id: 'y' }))
    const auth = loadCodexAuth(dir)
    expect(auth).toMatchObject({
      accessToken: 'new',
      accountId: 'a2',
      email: 'new@gmail.com',
      expired: '2026-08-30T00:00:00Z',
      lastRefresh: '2026-08-17T08:00:00Z',
    })
    rmSync(dir, { recursive: true, force: true })
  })

  it('skips disabled files and returns undefined for a missing dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'codex-auth-'))
    writeFileSync(join(dir, 'codex-off@gmail.com-pro.json'), JSON.stringify({ access_token: 't', account_id: 'a', disabled: true }))
    expect(loadCodexAuth(dir)).toBeUndefined()
    expect(loadCodexAuth(join(dir, 'nope'))).toBeUndefined()
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('queryCodexUsage', () => {
  it('sends bearer + account headers and parses the usage view', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = []
    const fetchImpl = async (url: string, init: RequestInit) => {
      seen.push({ url, headers: init.headers as Record<string, string> })
      return new Response(JSON.stringify({
        plan_type: 'pro',
        rate_limit: {
          primary_window: { used_percent: 0, limit_window_seconds: 604800, reset_at: 1787281247 },
          secondary_window: null,
        },
      }), { status: 200 })
    }
    const view = await queryCodexUsage('https://chatgpt.com/backend-api/wham/usage', { accessToken: 'tok', accountId: 'acc', file: '/x' }, 15000, fetchImpl)
    expect(seen[0]?.headers.Authorization).toBe('Bearer tok')
    expect(seen[0]?.headers['chatgpt-account-id']).toBe('acc')
    expect(view.windows[0]?.key).toBe('weekly')
  })

  it('uses the configured proxy for the first request', async () => {
    const dispatchers: unknown[] = []
    const fetchImpl = async (_url: string, init: RequestInit) => {
      dispatchers.push((init as RequestInit & { dispatcher?: unknown }).dispatcher)
      return new Response(JSON.stringify({
        rate_limit: {
          primary_window: { used_percent: 10, limit_window_seconds: 18000, reset_at: 1787281247 },
        },
      }), { status: 200 })
    }
    await queryCodexUsage('https://chatgpt.com/backend-api/wham/usage', { accessToken: 'tok', accountId: 'acc', file: '/x' }, 15000, fetchImpl, 'http://127.0.0.1:7897')
    expect(dispatchers).toHaveLength(1)
    expect(dispatchers[0]).toBeDefined()
  })

  it('falls back to direct when the proxy request cannot connect', async () => {
    const dispatchers: unknown[] = []
    const fetchImpl = async (_url: string, init: RequestInit) => {
      const dispatcher = (init as RequestInit & { dispatcher?: unknown }).dispatcher
      dispatchers.push(dispatcher)
      if (dispatcher !== undefined) throw new TypeError('proxy unavailable')
      return new Response(JSON.stringify({
        rate_limit: {
          primary_window: { used_percent: 10, limit_window_seconds: 18000, reset_at: 1787281247 },
        },
      }), { status: 200 })
    }
    const view = await queryCodexUsage('https://chatgpt.com/backend-api/wham/usage', { accessToken: 'tok', accountId: 'acc', file: '/x' }, 15000, fetchImpl, 'http://127.0.0.1:7897')
    expect(dispatchers).toHaveLength(2)
    expect(dispatchers[0]).toBeDefined()
    expect(dispatchers[1]).toBeUndefined()
    expect(view.windows[0]?.key).toBe('5h')
  })
})

describe('deepSeekPeakInfo', () => {
  // Peak windows (effective 2026-08-17): 01:00–04:00 & 06:00–10:00 UTC
  // = 09:00–12:00 & 14:00–18:00 Beijing; all other hours are off-peak.
  it('flags the exact morning peak start (09:00 Beijing)', () => {
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T01:00:00Z')))
      .toEqual({ offPeak: false, minutesLeft: 180 })
  })

  it('stays off-peak one minute before the morning peak', () => {
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T00:59:00Z')))
      .toEqual({ offPeak: true, minutesLeft: 1 })
  })

  it('treats the 12:00–14:00 midday window as off-peak', () => {
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T04:00:00Z')))
      .toEqual({ offPeak: true, minutesLeft: 120 })
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T05:30:00Z')))
      .toEqual({ offPeak: true, minutesLeft: 30 })
  })

  it('flags the afternoon peak (14:00–18:00 Beijing)', () => {
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T06:00:00Z')))
      .toEqual({ offPeak: false, minutesLeft: 240 })
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T10:00:00Z')))
      .toEqual({ offPeak: true, minutesLeft: 900 })
  })

  it('counts down to the morning peak across midnight', () => {
    // 00:30 Beijing = 16:30 UTC (previous day) → 8h30m until 09:00.
    expect(deepSeekPeakInfo(Date.parse('2026-08-16T16:30:00Z')))
      .toEqual({ offPeak: true, minutesLeft: 510 })
  })
})

describe('queryProvider', () => {
  it('sends bearer auth and parses through the kind adapter', async () => {
    const seen: string[] = []
    const fetchImpl = async (url: string, init: RequestInit) => {
      seen.push(url)
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer sk-test')
      return new Response(JSON.stringify(DEEPSEEK_FIXTURE), { status: 200 })
    }
    const view = await queryProvider('deepseek-balance', 'https://api.deepseek.com/user/balance', 'sk-test', 15000, fetchImpl)
    expect(seen).toEqual(['https://api.deepseek.com/user/balance'])
    expect(view).toMatchObject({ kind: 'balance', amount: 119.52 })
  })

  it('throws on non-2xx and invalid json', async () => {
    const notOk = async () => new Response('nope', { status: 401 })
    await expect(queryProvider('kimi-usage', 'https://x', 'k', 1000, notOk)).rejects.toThrow(/http 401/)

    const badJson = async () => new Response('not json', { status: 200 })
    await expect(queryProvider('kimi-usage', 'https://x', 'k', 1000, badJson)).rejects.toThrow(/invalid json/)
  })
})
