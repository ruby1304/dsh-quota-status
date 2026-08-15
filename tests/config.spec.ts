import { describe, expect, it } from 'vitest'
import { ConfigSchema, DEFAULT_PROVIDERS, resolveConfig } from '../src/config.js'

describe('ConfigSchema', () => {
  it('fills usable defaults for an empty object', () => {
    const config = ConfigSchema({})
    expect(config.enabled).toBe(true)
    expect(config.refreshMs).toBe(60000)
    expect(config.timeoutMs).toBe(15000)
    expect(config.warnBalance).toBe(20)
    expect(config.criticalBalance).toBe(10)
    expect(config.providers).toHaveLength(DEFAULT_PROVIDERS.length)
    expect(config.providers.map((row) => row.id)).toEqual(['deepseek', 'kimi-coding'])
  })

  it('accepts custom provider rows', () => {
    const config = ConfigSchema({
      providers: [
        {
          id: 'deepseek',
          label: 'DeepSeek',
          kind: 'deepseek-balance',
          credential: 'DEEPSEEK_API_KEY',
          endpoint: 'https://api.deepseek.com/user/balance',
        },
      ],
    })
    expect(config.providers).toHaveLength(1)
  })

  it('rejects a fractional refresh interval', () => {
    expect(() => ConfigSchema({ refreshMs: 1234.5 })).toThrow()
  })
})

describe('resolveConfig', () => {
  it('drops incomplete rows and trims row fields', () => {
    const config = ConfigSchema({})
    const resolved = resolveConfig({
      ...config,
      providers: [
        { id: '', label: 'x', kind: 'kimi-usage', credential: 'K', endpoint: 'https://x' },
        { id: ' deepseek ', label: ' DeepSeek ', kind: 'deepseek-balance', credential: 'DEEPSEEK_API_KEY', endpoint: 'https://api.deepseek.com/user/balance' },
      ],
    })
    expect(resolved.providers).toHaveLength(1)
    expect(resolved.providers[0]).toMatchObject({ id: 'deepseek', label: 'DeepSeek' })
  })

  it('rejects duplicate provider ids', () => {
    const config = ConfigSchema({})
    const row = { id: 'deepseek', label: 'DeepSeek', kind: 'deepseek-balance' as const, credential: 'DEEPSEEK_API_KEY', endpoint: 'https://x' }
    expect(() => resolveConfig({ ...config, providers: [row, { ...row }] })).toThrow(/duplicate provider id/)
  })
})
