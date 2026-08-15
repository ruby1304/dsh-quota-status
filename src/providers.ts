/**
 * Provider adapters: upstream JSON → normalized views the client renders.
 * Pure functions only — no credentials, no network outside queryProvider.
 * @module dsh-quota-status/providers
 */

import type { ProviderKind } from './config.js'

/** Monetary balance view (DeepSeek). */
export interface BalanceView {
  kind: 'balance'
  amount: number
  currency: string
  available: boolean
  granted: number | null
  toppedUp: number | null
}

/** One quota window (Kimi weekly / 5h rolling). */
export interface UsageWindow {
  key: string
  label: string
  remaining: number
  limit: number
  used: number
  /** Remaining percentage, 0-100 integer. */
  percentRemaining: number
  /** ISO timestamp from the provider, when present. */
  resetAt?: string
}

/** Plan-quota view (Kimi For Coding). */
export interface UsageView {
  kind: 'usage'
  membership?: string
  windows: UsageWindow[]
}

export type ProviderView = BalanceView | UsageView

/** One provider adapter outcome used by the RPC layer. */
export interface ProviderResult {
  id: string
  label: string
  kind: ProviderKind
  /** Provider row was configured but its credential did not resolve. */
  configured: boolean
  credential: string
  status: 'ok' | 'missing' | 'error'
  view?: ProviderView
  error?: string
}

/** Finite number from number/string, undefined otherwise. */
export function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function roundPercent(remaining: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((remaining / limit) * 100)))
}

/** Window label from a Kimi `{duration, timeUnit}` object. */
export function windowKeyOf(window: unknown): string | undefined {
  if (window === null || typeof window !== 'object') return undefined
  const rec = window as Record<string, unknown>
  const duration = toFiniteNumber(rec.duration)
  if (duration === undefined || duration <= 0) return undefined
  const unit = typeof rec.timeUnit === 'string' ? rec.timeUnit : ''
  if (unit === 'TIME_UNIT_MINUTE' || unit === 'MINUTE') {
    return duration % 60 === 0 ? `${duration / 60}h` : `${duration}min`
  }
  if (unit === 'TIME_UNIT_HOUR' || unit === 'HOUR') return `${duration}h`
  if (unit === 'TIME_UNIT_DAY' || unit === 'DAY') return duration === 7 ? 'weekly' : `${duration}d`
  return undefined
}

/** Display label for a normalized window key. */
export function windowLabel(key: string): string {
  if (key === 'weekly') return 'week'
  if (key === '5h') return '5h'
  return key
}

interface KimiWindowDetail {
  limit?: unknown
  used?: unknown
  remaining?: unknown
  resetTime?: unknown
}

export interface KimiUsagePayload {
  usage?: {
    limit?: unknown
    used?: unknown
    remaining?: unknown
    resetTime?: unknown
  }
  limits?: Array<{
    window?: unknown
    detail?: KimiWindowDetail
  }>
  user?: {
    membership?: {
      level?: unknown
    }
  }
}

/**
 * Parse the official `GET https://api.kimi.com/coding/v1/usages` payload:
 * top-level usage is the weekly plan quota; `limits[]` carries window
 * details (the 300-minute window is the 5h rolling limit).
 */
export function parseKimiUsage(payload: unknown): UsageView {
  const rec = (payload ?? {}) as KimiUsagePayload
  const usage = rec.usage
  const limit = toFiniteNumber(usage?.limit)
  const used = toFiniteNumber(usage?.used)
  const remaining = toFiniteNumber(usage?.remaining)
    ?? (limit !== undefined && used !== undefined ? limit - used : undefined)
  if (limit === undefined || remaining === undefined) {
    throw new Error('kimi-usage: missing usage.limit / usage.remaining')
  }
  const usedFinal = used ?? limit - remaining

  const windows: UsageWindow[] = []
  const seen = new Set<string>()
  const push = (key: string | undefined, detail: KimiWindowDetail | undefined): void => {
    if (key === undefined || detail === undefined || seen.has(key)) return
    const dLimit = toFiniteNumber(detail.limit)
    const dRemaining = toFiniteNumber(detail.remaining)
      ?? (toFiniteNumber(detail.used) !== undefined && dLimit !== undefined ? dLimit - toFiniteNumber(detail.used)! : undefined)
    if (dLimit === undefined || dRemaining === undefined || dLimit <= 0) return
    const dUsed = toFiniteNumber(detail.used) ?? dLimit - dRemaining
    seen.add(key)
    windows.push({
      key,
      label: windowLabel(key),
      remaining: dRemaining,
      limit: dLimit,
      used: Math.max(0, Math.min(dLimit, dUsed)),
      percentRemaining: roundPercent(dRemaining, dLimit),
      ...(typeof detail.resetTime === 'string' && detail.resetTime.length > 0 ? { resetAt: detail.resetTime } : {}),
    })
  }

  if (Array.isArray(rec.limits)) {
    for (const item of rec.limits) {
      push(windowKeyOf(item?.window), item?.detail)
    }
  }
  push('weekly', {
    limit,
    used: usedFinal,
    remaining,
    resetTime: usage?.resetTime,
  })

  const membership = typeof rec.user?.membership?.level === 'string'
    ? rec.user.membership.level
    : undefined
  return {
    kind: 'usage',
    ...(membership !== undefined ? { membership } : {}),
    windows,
  }
}

export interface DeepSeekBalancePayload {
  is_available?: unknown
  balance_infos?: Array<{
    currency?: unknown
    total_balance?: unknown
    granted_balance?: unknown
    topped_up_balance?: unknown
  }>
}

/** Parse `GET https://api.deepseek.com/user/balance`. */
export function parseDeepSeekBalance(payload: unknown): BalanceView {
  const rec = (payload ?? {}) as DeepSeekBalancePayload
  const infos = Array.isArray(rec.balance_infos) ? rec.balance_infos : []
  const first = infos.find((item) => toFiniteNumber(item?.total_balance) !== undefined)
  const amount = first === undefined ? undefined : toFiniteNumber(first.total_balance)
  if (first === undefined || amount === undefined) throw new Error('deepseek-balance: missing balance_infos[0].total_balance')
  return {
    kind: 'balance',
    amount,
    currency: typeof first.currency === 'string' && first.currency.length > 0 ? first.currency : 'CNY',
    available: rec.is_available !== false,
    granted: toFiniteNumber(first.granted_balance) ?? null,
    toppedUp: toFiniteNumber(first.topped_up_balance) ?? null,
  }
}

/** Adapter dispatch: one parsed view per provider kind. */
export function parseProviderView(kind: ProviderKind, payload: unknown): ProviderView {
  if (kind === 'deepseek-balance') return parseDeepSeekBalance(payload)
  if (kind === 'kimi-usage') return parseKimiUsage(payload)
  throw new Error(`unknown provider kind: ${String(kind)}`)
}

export type FetchJson = (url: string, init: RequestInit) => Promise<Response>

/** Query one provider with a resolved credential; throws on any failure. */
export async function queryProvider(
  kind: ProviderKind,
  endpoint: string,
  credential: string,
  timeoutMs: number,
  fetchImpl: FetchJson = fetch,
): Promise<ProviderView> {
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${credential}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`provider http ${response.status}`)
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('provider returned invalid json')
  }
  return parseProviderView(kind, payload)
}
