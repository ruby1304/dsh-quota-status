import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigSchema } from '../src/config.js'
import {
  apply,
  QUOTA_STATUS_SERVICE,
  QUOTA_STATUS_SERVICE_SCHEMA,
  type QuotaStatusService,
} from '../src/index.js'

afterEach(() => vi.unstubAllGlobals())

describe('quotaStatus sibling service', () => {
  it('provides fresh normalized rows without returning credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('deepseek')) return Response.json({
        is_available: true,
        balance_infos: [{ currency: 'CNY', total_balance: '88.50', granted_balance: '0', topped_up_balance: '88.50' }],
      })
      return Response.json({
        user: { membership: { level: 'LEVEL_ADVANCED' } },
        usage: { limit: 100, used: 25, remaining: 75 },
      })
    }))
    let service: QuotaStatusService | undefined
    const ctx = {
      get: () => undefined,
      provide(name: string, value: QuotaStatusService) {
        expect(name).toBe(QUOTA_STATUS_SERVICE)
        service = value
      },
      effect(callback: () => unknown) { callback() },
      connection: { rpc: { handle() {} } },
      credentials: {
        async resolve(ref: string) {
          return { value: ref === 'DEEPSEEK_API_KEY' ? 'deepseek-secret' : 'kimi-secret' }
        },
      },
    }
    apply(ctx as never, ConfigSchema({}))

    const snapshot = await service!.read()
    expect(snapshot.schemaVersion).toBe(QUOTA_STATUS_SERVICE_SCHEMA)
    expect(snapshot.rows).toMatchObject([
      { id: 'deepseek', status: 'ok', view: { kind: 'balance', amount: 88.5 } },
      { id: 'kimi-coding', status: 'ok', view: { kind: 'usage', membership: 'LEVEL_ADVANCED' } },
    ])
    expect(JSON.stringify(snapshot)).not.toContain('deepseek-secret')
    expect(JSON.stringify(snapshot)).not.toContain('kimi-secret')
  })
})
