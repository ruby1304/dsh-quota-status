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

import { spawn } from 'node:child_process'
import type { Context } from '@deepseek-ai/cordis'
import { ConfigSchema, DEFAULT_CODEX_AUTH_DIR, PLUGIN_ID, resolveConfig } from './config.js'
import type { Config as ConfigInput, ProviderRow as ProviderRowInput } from './config.js'
import { expandHome, loadCodexAuth, queryCodexUsage, queryProvider } from './providers.js'
import type { ProviderResult, ProviderView } from './providers.js'

export const name = 'quota-status'
export const inject = ['connection', 'credentials']

export interface Config extends ConfigInput {}
export interface ProviderRow extends ProviderRowInput {}
export const Config = ConfigSchema
export {
  deepSeekPeakInfo,
  loadCodexAuth,
  parseCodexUsage,
  parseDeepSeekBalance,
  parseKimiUsage,
  parseProviderView,
  queryCodexUsage,
  queryProvider,
  windowKeyOf,
  windowKeyOfSeconds,
} from './providers.js'
export type {
  BalanceView,
  CodexAuth,
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
      const configured = provider.kind === 'codex-usage'
        ? loadCodexAuth(provider.authDir || DEFAULT_CODEX_AUTH_DIR) !== undefined
        : await host.credentials.resolve(provider.credential).then((hit) => hit !== undefined && hit.value.length > 0)
      rows.push({
        id: provider.id,
        label: provider.label.length > 0 ? provider.label : provider.id,
        kind: provider.kind,
        credential: provider.credential,
        configured,
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
      if (provider.kind === 'codex-usage') {
        const auth = loadCodexAuth(provider.authDir || DEFAULT_CODEX_AUTH_DIR)
        if (auth === undefined) {
          results.push({ ...base, error: provider.authDir || DEFAULT_CODEX_AUTH_DIR })
          return
        }
        base.configured = true
        try {
          const view = await queryCodexUsage(
            provider.endpoint,
            auth,
            resolved.timeoutMs,
            fetch,
            resolved.usageProxyUrl,
          )
          results.push({ ...base, status: 'ok', view })
        } catch (error) {
          results.push({
            ...base,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          })
        }
        return
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

  /** Auth dir of the first codex-usage row (settings-tab login/status act on it). */
  const codexAuthDir = () =>
    resolved.providers.find((row) => row.kind === 'codex-usage')?.authDir || DEFAULT_CODEX_AUTH_DIR

  // ChatGPT login flow state: one CLIProxyAPI `-codex-login` process at a
  // time; its output is scanned for the OAuth URL so the settings tab can
  // surface it when the browser did not open automatically.
  let loginProc: ReturnType<typeof spawn> | null = null
  let loginUrl: string | null = null
  let loginExit: { code: number; at: number } | null = null

  const startCodexLogin = (): boolean => {
    if (loginProc !== null) return false
    loginUrl = null
    loginExit = null
    try {
      const proc = spawn(
        resolved.codexBinary,
        ['-codex-login', '-config', expandHome(resolved.codexConfigPath)],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      )
      loginProc = proc
      const onData = (chunk: unknown) => {
        const match = String(chunk).match(/https:\/\/\S+/)
        if (match) loginUrl = match[0].replace(/["'>\])}，。；]+$/, '')
      }
      proc.stdout?.on('data', onData)
      proc.stderr?.on('data', onData)
      proc.on('exit', (code) => {
        loginProc = null
        loginExit = { code: code ?? -1, at: Date.now() }
      })
      proc.on('error', () => {
        loginProc = null
        loginExit = { code: -1, at: Date.now() }
      })
    } catch {
      loginExit = { code: -1, at: Date.now() }
    }
    return loginProc !== null
  }

  // A login in flight must not outlive the plugin run.
  ctx.effect(() => () => {
    if (loginProc !== null) {
      try {
        loginProc.kill()
      } catch { /* already exited */ }
      loginProc = null
    }
  })

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
        if (endpoint === 'codex-auth-status') {
          const auth = loadCodexAuth(codexAuthDir())
          return ok({
            configured: auth !== undefined,
            ...(auth?.email !== undefined ? { email: auth.email } : {}),
            ...(auth?.expired !== undefined ? { expired: auth.expired } : {}),
            ...(auth?.lastRefresh !== undefined ? { lastRefresh: auth.lastRefresh } : {}),
            loginRunning: loginProc !== null,
            loginUrl,
            loginExitCode: loginExit ? loginExit.code : null,
            loginExitAt: loginExit ? loginExit.at : null,
          })
        }
        if (endpoint === 'codex-login') {
          return ok({ started: startCodexLogin(), loginRunning: loginProc !== null })
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
