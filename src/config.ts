/**
 * dsh-quota-status configuration: Schemastery schema (validated by Cordis),
 * provider row shapes, and shared types.
 * @module dsh-quota-status/config
 */

import Schema from './vendor/schemastery.mjs'

export const PLUGIN_NAME = 'dsh-quota-status'
export const PLUGIN_ID = 'quota-status'

/** Provider kinds the host adapter understands. */
export type ProviderKind = 'deepseek-balance' | 'kimi-usage'

export interface ProviderRow {
  /** Stable row id used by the client and settings. */
  id: string
  /** Human-readable label. */
  label: string
  /** Adapter kind deciding the endpoint parsing. */
  kind: ProviderKind
  /** Credential reference resolved through ctx.credentials. */
  credential: string
  /** GET endpoint queried with `Authorization: Bearer <credential>`. */
  endpoint: string
}

export interface Config {
  /** Master switch; the host keeps the RPC channel but reports disabled. */
  enabled: boolean
  /** Default client auto-refresh interval. */
  refreshMs: number
  /** Upstream fetch timeout per provider. */
  timeoutMs: number
  /** Balance row "warn" tier (e.g. below 20 shows yellow). */
  warnBalance: number
  /** Balance row "critical" tier (e.g. below 10 shows red). */
  criticalBalance: number
  /** Usage row "warn" remaining percentage (at or below shows yellow). */
  warnUsagePercent: number
  /** Usage row "critical" remaining percentage (at or below shows red). */
  criticalUsagePercent: number
  /** Provider rows. The default list is DeepSeek + Kimi For Coding. */
  providers: ProviderRow[]
}

export const DEFAULT_PROVIDERS: ProviderRow[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'deepseek-balance',
    credential: 'DEEPSEEK_API_KEY',
    endpoint: 'https://api.deepseek.com/user/balance',
  },
  {
    id: 'kimi-coding',
    label: 'Kimi',
    kind: 'kimi-usage',
    credential: 'KIMI_CODING_API_KEY',
    endpoint: 'https://api.kimi.com/coding/v1/usages',
  },
]

export const ConfigSchema = Schema.object({
  enabled: Schema.boolean().default(true),
  refreshMs: Schema.number().step(1).min(5000).default(60000),
  timeoutMs: Schema.number().step(1).min(1000).max(120000).default(15000),
  warnBalance: Schema.number().default(20),
  criticalBalance: Schema.number().default(10),
  warnUsagePercent: Schema.number().step(1).min(1).max(100).default(40),
  criticalUsagePercent: Schema.number().step(1).min(0).max(100).default(15),
  providers: Schema.array(Schema.object({
    id: Schema.string().default(''),
    label: Schema.string().default(''),
    kind: Schema.union([
      Schema.const('deepseek-balance'),
      Schema.const('kimi-usage'),
    ]).default('deepseek-balance'),
    credential: Schema.string().default(''),
    endpoint: Schema.string().default(''),
  })).default(DEFAULT_PROVIDERS),
}) as unknown as (value?: unknown) => Config

export function resolveConfig(config: Config): Config {
  const providers = config.providers
    .filter((row) => row.id.trim().length > 0 && row.credential.trim().length > 0 && row.endpoint.trim().length > 0)
    .map((row) => ({ ...row, id: row.id.trim(), label: row.label.trim(), credential: row.credential.trim(), endpoint: row.endpoint.trim() }))
  const seen = new Set<string>()
  for (const row of providers) {
    if (seen.has(row.id)) {
      throw new Error(`${PLUGIN_NAME}: duplicate provider id ${JSON.stringify(row.id)}`)
    }
    seen.add(row.id)
  }
  return {
    ...config,
    warnBalance: Math.max(config.criticalBalance, config.warnBalance),
    providers,
  }
}
