import { describe, expect, it } from 'vitest'
import {
  deepSeekPeakInfo,
  parseDeepSeekBalance,
  parseKimiUsage,
  queryProvider,
  windowKeyOf,
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

describe('deepSeekPeakInfo', () => {
  // Off-peak window: 00:30–08:30 Beijing time = 16:30–00:30 UTC.
  it('flags the exact off-peak start (00:30 Beijing)', () => {
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T16:30:00Z')))
      .toEqual({ offPeak: true, minutesLeft: 480 })
  })

  it('stays peak one minute before the window', () => {
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T16:29:00Z')))
      .toEqual({ offPeak: false, minutesLeft: 1 })
  })

  it('ends off-peak at 08:30 Beijing sharp', () => {
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T00:29:00Z')))
      .toEqual({ offPeak: true, minutesLeft: 1 })
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T00:30:00Z')))
      .toEqual({ offPeak: false, minutesLeft: 960 })
  })

  it('counts down to the next window across midnight', () => {
    // 20:00 Beijing = 12:00 UTC → 4h30m until 00:30.
    expect(deepSeekPeakInfo(Date.parse('2026-08-17T12:00:00Z')))
      .toEqual({ offPeak: false, minutesLeft: 270 })
    // 04:00 Beijing = 20:00 UTC (previous day) → 4h30m left of off-peak.
    expect(deepSeekPeakInfo(Date.parse('2026-08-16T20:00:00Z')))
      .toEqual({ offPeak: true, minutesLeft: 270 })
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
