/**
 * dsh-quota-status — live quota/balance for DeepSeek Harness web.
 *
 * Host half: owns a loopback-only Connection RPC channel `/dsh-quota-status`
 * with two endpoints (`specs` and `fetch-all`). Credentials are resolved
 * through `ctx.credentials` per request and never leave the host; upstream
 * JSON is normalized before it reaches the browser.
 *
 * Client half: a compact `shell.overlay` capsule (DeepSeek balance + Kimi
 * plan windows) expanding into a card with progress bars and reset
 * countdowns.
 * @module dsh-quota-status
 */

import type { Context } from '@deepseek-ai/cordis'
import { ConfigSchema, PLUGIN_ID, resolveConfig } from './config.js'
import type { Config as ConfigInput, ProviderRow as ProviderRowInput } from './config.js'
import { queryProvider } from './providers.js'
import type { ProviderResult, ProviderView } from './providers.js'

export const name = 'quota-status'
export const inject = ['connection', 'credentials']

export interface Config extends ConfigInput {}
export interface ProviderRow extends ProviderRowInput {}
export const Config = ConfigSchema
export {
  deepSeekPeakInfo,
  parseDeepSeekBalance,
  parseKimiUsage,
  parseProviderView,
  queryProvider,
  windowKeyOf,
} from './providers.js'
export type {
  BalanceView,
  PeakInfo,
  UsageView,
  UsageWindow,
  ProviderView,
  ProviderResult,
} from './providers.js'

export const RPC_CHANNEL = '/dsh-quota-status'

/** Structural minimum of the host connection service. */
interface ConnectionLike {
  rpc: {
    handle(
      channel: string,
      handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>,
      options?: { authority?: string },
    ): unknown
  }
}

/** Structural minimum of the credentials service. */
interface CredentialsLike {
  resolve(ref: string): Promise<{ value: string } | undefined>
}

interface HostContext {
  connection: ConnectionLike
  credentials: CredentialsLike
}

interface RowSpec {
  id: string
  label: string
  kind: ProviderRow['kind']
  credential: string
  configured: boolean
  warnBalance: number
  criticalBalance: number
  warnUsagePercent: number
  criticalUsagePercent: number
}

interface RowViewResult {
  id: string
  label: string
  kind: ProviderRow['kind']
  configured: boolean
  status: ProviderResult['status']
  view?: ProviderView
  error?: string
}

const ok = (value: unknown) => ({ ok: true, value })
const fail = (message: string) => ({
  ok: false,
  error: { code: 'internal', message, details: {} },
})

export function apply(ctx: Context, config: Config) {
  const resolved = resolveConfig(config)
  const host = ctx as unknown as HostContext

  const resolveSpecs = async (): Promise<RowSpec[]> => {
    const rows: RowSpec[] = []
    for (const provider of resolved.providers) {
      const hit = await host.credentials.resolve(provider.credential)
      rows.push({
        id: provider.id,
        label: provider.label.length > 0 ? provider.label : provider.id,
        kind: provider.kind,
        credential: provider.credential,
        configured: hit !== undefined && hit.value.length > 0,
        warnBalance: resolved.warnBalance,
        criticalBalance: resolved.criticalBalance,
        warnUsagePercent: resolved.warnUsagePercent,
        criticalUsagePercent: resolved.criticalUsagePercent,
      })
    }
    return rows
  }

  const fetchAll = async (): Promise<RowViewResult[]> => {
    const results: RowViewResult[] = []
    await Promise.all(resolved.providers.map(async (provider) => {
      const base: RowViewResult = {
        id: provider.id,
        label: provider.label.length > 0 ? provider.label : provider.id,
        kind: provider.kind,
        configured: false,
        status: 'missing',
      }
      const hit = await host.credentials.resolve(provider.credential)
      if (hit === undefined || hit.value.length === 0) {
        results.push({ ...base, error: provider.credential })
        return
      }
      base.configured = true
      try {
        const view = await queryProvider(provider.kind, provider.endpoint, hit.value, resolved.timeoutMs)
        results.push({ ...base, status: 'ok', view })
      } catch (error) {
        results.push({
          ...base,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }))
    return results.sort((a, b) => resolved.providers.findIndex((row) => row.id === a.id) - resolved.providers.findIndex((row) => row.id === b.id))
  }

  host.connection.rpc.handle(
    RPC_CHANNEL,
    async (endpoint, payload, _signal) => {
      try {
        if (endpoint === 'specs') {
          return ok({ rows: await resolveSpecs(), refreshMs: resolved.refreshMs, enabled: resolved.enabled })
        }
        if (endpoint === 'fetch-all') {
          if (!resolved.enabled) {
            return ok({ rows: [], fetchedAt: Date.now(), enabled: false })
          }
          return ok({ rows: await fetchAll(), fetchedAt: Date.now(), enabled: true })
        }
        return fail(`unknown endpoint: ${String(endpoint)}`)
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error))
      }
    },
    { authority: 'loopback' },
  )
}

// Keep the plugin row id in sync with the bundle patch for diagnostics.
export const id = PLUGIN_ID
