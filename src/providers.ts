/**
 * Provider adapters: upstream JSON → normalized views the client renders.
 * Pure functions only — no credentials, no network outside queryProvider /
 * queryCodexUsage, no filesystem outside loadCodexAuth.
 * @module dsh-quota-status/providers
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ProxyAgent, type Dispatcher } from 'undici'
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

/** DeepSeek peak/off-peak pricing state at one instant. */
export interface PeakInfo {
  /** True outside the two daily peak windows (see deepSeekPeakInfo). */
  offPeak: boolean
  /** Minutes until the next peak ↔ off-peak transition. */
  minutesLeft: number
}

/**
 * DeepSeek peak/off-peak (峰谷) pricing, effective 2026-08-17 per
 * https://api-docs.deepseek.com/quick_start/pricing : peak hours are
 * 01:00–04:00 and 06:00–10:00 UTC = 09:00–12:00 and 14:00–18:00 Beijing
 * time; all other hours (including the 12:00–14:00 midday valley and the
 * overnight window) are off-peak at half the peak rate. Pure wall-clock
 * math — no network, no locale dependence. The client bundle mirrors
 * these few lines (it cannot import from this module), so keep the two
 * copies in sync.
 */
export function deepSeekPeakInfo(nowMs: number): PeakInfo {
  const d = new Date(nowMs)
  const minutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 8 * 60) % 1440
  const peak = (minutes >= 540 && minutes < 720) || (minutes >= 840 && minutes < 1080)
  const boundaries = [540, 720, 840, 1080]
  const next = boundaries.find((b) => b > minutes)
  return {
    offPeak: !peak,
    minutesLeft: next === undefined ? 540 + 1440 - minutes : next - minutes,
  }
}

/** Window key from a codex `limit_window_seconds` value. */
export function windowKeyOfSeconds(seconds: number): string {
  if (seconds === 18000) return '5h'
  if (seconds === 604800) return 'weekly'
  if (seconds % 86400 === 0) return `${seconds / 86400}d`
  if (seconds % 3600 === 0) return `${seconds / 3600}h`
  if (seconds % 60 === 0) return `${seconds / 60}min`
  return `${seconds}s`
}

export interface CodexUsageWindowPayload {
  used_percent?: unknown
  limit_window_seconds?: unknown
  reset_at?: unknown
}

export interface CodexUsagePayload {
  plan_type?: unknown
  rate_limit?: {
    primary_window?: CodexUsageWindowPayload | null
    secondary_window?: CodexUsageWindowPayload | null
  } | null
}

/**
 * Parse `GET https://chatgpt.com/backend-api/wham/usage` (ChatGPT/Codex
 * subscription, observed 2026-08): rate_limit.primary_window /
 * secondary_window keyed by limit_window_seconds (18000 → 5h,
 * 604800 → weekly; a Pro account may expose only the weekly window).
 * `used_percent` is the USED percentage; remaining = 100 - used.
 * `additional_rate_limits` (per-model buckets like Codex Spark) are
 * intentionally ignored to keep the row minimal.
 */
export function parseCodexUsage(payload: unknown): UsageView {
  const rec = (payload ?? {}) as CodexUsagePayload
  const rateLimit = rec.rate_limit ?? undefined
  const rawWindows = [rateLimit?.primary_window, rateLimit?.secondary_window]
  const windows: UsageWindow[] = []
  const seen = new Set<string>()
  for (const raw of rawWindows) {
    if (!raw) continue
    const seconds = toFiniteNumber(raw.limit_window_seconds)
    const used = toFiniteNumber(raw.used_percent)
    if (seconds === undefined || seconds <= 0 || used === undefined) continue
    const key = windowKeyOfSeconds(seconds)
    if (seen.has(key)) continue
    seen.add(key)
    const remainingPct = Math.max(0, Math.min(100, Math.round(100 - used)))
    const resetAt = toFiniteNumber(raw.reset_at)
    windows.push({
      key,
      label: windowLabel(key),
      remaining: remainingPct,
      limit: 100,
      used: Math.max(0, Math.min(100, Math.round(used))),
      percentRemaining: remainingPct,
      ...(resetAt !== undefined && resetAt > 0 ? { resetAt: new Date(resetAt * 1000).toISOString() } : {}),
    })
  }
  if (windows.length === 0) throw new Error('codex-usage: no usable rate_limit window')
  const plan = typeof rec.plan_type === 'string' && rec.plan_type.length > 0 ? rec.plan_type : undefined
  return {
    kind: 'usage',
    ...(plan !== undefined ? { membership: plan.charAt(0).toUpperCase() + plan.slice(1) } : {}),
    windows,
  }
}

/** Expand a leading `~` to the current home directory. */
export function expandHome(path: string): string {
  return path.startsWith('~') ? join(homedir(), path.slice(1)) : path
}

/** OAuth material from one CLIProxyAPI codex auth file. */
export interface CodexAuth {
  accessToken: string
  accountId: string
  /** Account email, when the auth file carries it. */
  email?: string
  /** Token expiry timestamp string recorded by CLIProxyAPI. */
  expired?: string
  /** Last token-refresh timestamp string recorded by CLIProxyAPI. */
  lastRefresh?: string
  /** Absolute auth file path — diagnostics only, never sent to the client. */
  file: string
}

/**
 * Pick the newest non-disabled `codex-*.json` from the CLIProxyAPI auth
 * store. `~` expands to the home directory; a missing/unreadable store or
 * all-disabled/malformed files yield undefined (row shows "not configured").
 */
export function loadCodexAuth(authDir: string): CodexAuth | undefined {
  const dir = expandHome(authDir)
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return undefined
  }
  const candidates = names
    .filter((name) => /^codex-.+\.json$/.test(name))
    .map((name) => {
      const file = join(dir, name)
      let mtimeMs = 0
      try {
        mtimeMs = statSync(file).mtimeMs
      } catch { /* unreadable stat sorts last */ }
      return { file, mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
  for (const candidate of candidates) {
    try {
      const rec = JSON.parse(readFileSync(candidate.file, 'utf8')) as Record<string, unknown>
      const accessToken = typeof rec.access_token === 'string' ? rec.access_token : ''
      const accountId = typeof rec.account_id === 'string' ? rec.account_id : ''
      if (accessToken.length > 0 && accountId.length > 0 && rec.disabled !== true) {
        return {
          accessToken,
          accountId,
          ...(typeof rec.email === 'string' && rec.email.length > 0 ? { email: rec.email } : {}),
          ...(typeof rec.expired === 'string' && rec.expired.length > 0 ? { expired: rec.expired } : {}),
          ...(typeof rec.last_refresh === 'string' && rec.last_refresh.length > 0 ? { lastRefresh: rec.last_refresh } : {}),
          file: candidate.file,
        }
      }
    } catch { /* malformed file → try the next one */ }
  }
  return undefined
}

/** Query the ChatGPT subscription usage endpoint with a CLIProxyAPI codex auth. */
export async function queryCodexUsage(
  endpoint: string,
  auth: CodexAuth,
  timeoutMs: number,
  fetchImpl: FetchJson = fetch,
  proxyUrl = '',
): Promise<UsageView> {
  const request = async (dispatcher?: Dispatcher): Promise<Response> => fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'chatgpt-account-id': auth.accountId,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
    ...(dispatcher === undefined ? {} : { dispatcher }),
  } as RequestInit)

  let response: Response
  if (proxyUrl.trim().length > 0) {
    const agent = new ProxyAgent(proxyUrl.trim())
    try {
      response = await request(agent)
    } catch {
      response = await request()
    } finally {
      await agent.close()
    }
  } else {
    response = await request()
  }
  if (!response.ok) {
    throw new Error(`provider http ${response.status}`)
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('provider returned invalid json')
  }
  return parseCodexUsage(payload)
}

/** Adapter dispatch: one parsed view per provider kind. */
export function parseProviderView(kind: ProviderKind, payload: unknown): ProviderView {
  if (kind === 'deepseek-balance') return parseDeepSeekBalance(payload)
  if (kind === 'kimi-usage') return parseKimiUsage(payload)
  if (kind === 'codex-usage') return parseCodexUsage(payload)
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
