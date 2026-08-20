import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as ts from 'typescript'

const source = readFileSync(new URL('../src/client.ts', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

function functionSource(name: string): string {
  const marker = `function ${name}(`
  const start = source.indexOf(marker)
  if (start < 0) throw new Error(`missing ${name}`)
  const brace = source.indexOf('{', start)
  let depth = 0
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  throw new Error(`unterminated ${name}`)
}

function loadClientHelpers() {
  const names = [
    'fmtCountdown',
    'collapsedWindowValue',
    'normalizeExtraRow',
    'usageState',
    'chooseVerticalAnchor',
    'preserveVerticalAnchor',
  ]
  const script = `${names.map(functionSource).join('\n')}\nreturn { ${names.join(', ')} }`
  const output = ts.transpileModule(script, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return Function(output)() as {
    collapsedWindowValue(windowView: { percentRemaining: number; resetAt?: string }, nowMs: number): string
    normalizeExtraRow(input: unknown): Record<string, unknown> | null
    usageState(percent: number, critical: number, warn: number): string
    chooseVerticalAnchor(
      rect: { top: number; bottom: number },
      viewportHeight: number,
      topMargin: number,
      bottomMargin: number,
    ): 'top' | 'bottom'
    preserveVerticalAnchor(
      pos: { dx: number; dy: number },
      beforeRect: { top: number; bottom: number },
      afterRect: { top: number; bottom: number },
      anchor: 'top' | 'bottom',
    ): { dx: number; dy: number }
  }
}

describe('collapsed usage rows', () => {
  const { collapsedWindowValue } = loadClientHelpers()
  const nowMs = Date.parse('2026-08-17T10:00:00Z')
  const resetAt = new Date(nowMs + (2 * 60 + 13) * 60_000).toISOString()

  it('shows a live reset countdown only for an exhausted window with resetAt', () => {
    expect(collapsedWindowValue({ percentRemaining: 0, resetAt }, nowMs)).toBe('0% · 2h13m')
    expect(collapsedWindowValue({ percentRemaining: 0 }, nowMs)).toBe('0%')
  })

  it('keeps non-exhausted windows minimal', () => {
    expect(collapsedWindowValue({ percentRemaining: 1, resetAt }, nowMs)).toBe('1%')
  })
})

describe('extra-row display contract', () => {
  const { normalizeExtraRow, usageState } = loadClientHelpers()

  it('applies normal, warning, and critical remaining-percent boundaries', () => {
    expect(usageState(41, 15, 40)).toBe('ok')
    expect(usageState(40, 15, 40)).toBe('warn')
    expect(usageState(16, 15, 40)).toBe('warn')
    expect(usageState(15, 15, 40)).toBe('error')
  })

  it('normalizes a meter and drops undeclared input fields', () => {
    const row = normalizeExtraRow({
      id: 'example',
      label: 'Extra quota',
      status: 'ok',
      secret: 'must-not-propagate',
      view: {
        kind: 'meter',
        used: 120,
        limit: 500,
        remaining: 380,
        unit: 'USD',
        percentRemaining: 76,
        resetAt: '2026-08-17T16:00:00.000Z',
        warnPercent: 140,
        criticalPercent: -5,
      },
    })
    expect(row).toMatchObject({
      id: 'example',
      label: 'Extra quota',
      status: 'ok',
      view: { kind: 'meter', percentRemaining: 76, warnPercent: 100, criticalPercent: 0 },
    })
    expect(JSON.stringify(row)).not.toContain('must-not-propagate')
  })

  it('rejects malformed status and meter data', () => {
    expect(normalizeExtraRow({ id: 'x', label: 'X', status: 'unknown' })).toBeNull()
    expect(normalizeExtraRow({
      id: 'x', label: 'X', status: 'ok',
      view: { kind: 'meter', used: 1, limit: 0, remaining: 0, unit: 'USD', percentRemaining: 0, resetAt: 'bad' },
    })).toBeNull()
  })
})

describe('position-aware expansion', () => {
  const { chooseVerticalAnchor, preserveVerticalAnchor } = loadClientHelpers()

  it('expands down near the top and up near the bottom', () => {
    expect(chooseVerticalAnchor({ top: 10, bottom: 126 }, 716, 10, 10)).toBe('top')
    expect(chooseVerticalAnchor({ top: 590, bottom: 706 }, 716, 10, 10)).toBe('bottom')
    expect(chooseVerticalAnchor({ top: 250, bottom: 366 }, 716, 10, 10)).toBe('top')
  })

  it('returns to the same edge when opening and closing', () => {
    const openedAtTop = preserveVerticalAnchor(
      { dx: 0, dy: 0 },
      { top: 10, bottom: 126 },
      { top: -106, bottom: 126 },
      'top',
    )
    expect(openedAtTop).toEqual({ dx: 0, dy: 116 })
    expect(preserveVerticalAnchor(
      openedAtTop,
      { top: 10, bottom: 242 },
      { top: 126, bottom: 242 },
      'top',
    )).toEqual({ dx: 0, dy: 0 })

    expect(preserveVerticalAnchor(
      { dx: 4, dy: -8 },
      { top: 590, bottom: 706 },
      { top: 474, bottom: 706 },
      'bottom',
    )).toEqual({ dx: 4, dy: -8 })
  })
})

describe('row interaction source contract', () => {
  it('keeps keyboard and accessibility semantics without a row chevron', () => {
    for (const name of ['ProviderRow', 'ExtraQuotaRow']) {
      const body = functionSource(name)
      expect(body).toContain('role: "button"')
      expect(body).toContain('tabIndex: 0')
      expect(body).toContain('"aria-expanded"')
      expect(body).toMatch(/(?:e|event)\.key === "Enter"/)
      expect(body).toMatch(/(?:e|event)\.key === " "/)
    }
    expect(source).not.toContain('dsh-row-chevron')
  })

  it('declares and renders the generic child Slot', () => {
    expect(source).toContain('var EXTRA_ROW_SLOT = "dsh-quota-status.extra-row"')
    expect(source).toContain('children: { [EXTRA_ROW_SLOT]: { kind: "list", scope: "root" } }')
    expect(source).toContain('props.renderSlot(EXTRA_ROW_SLOT, { renderRow: renderExtraRow })')
  })

  it('reserves a bottom safe area on narrow screens', () => {
    expect(source).toContain('@media(max-width:720px){#dsh-quota-status{bottom:66px}}')
    expect(source).toContain('var MOBILE_BOTTOM_MARGIN = 60')
    expect(functionSource('clampPos')).toContain('globalThis.innerHeight - bottomMargin')
  })
})

describe('settings extension point', () => {
  it('uses a standalone Plugins tab instead of the namespace-keyed card slot', () => {
    expect(source).toContain('ctx.slots.inject("settings.plugins.tab"')
    expect(source).toContain('{ name: "settings.plugins.tab", id: "quota-status"')
    expect(source).not.toContain('ctx.slots.inject("settings.plugin.item"')
  })
})

describe('DSH rc.8 dynamic client package contract', () => {
  it('declares exact internal peer/dev edges without eager activation', () => {
    const expectedInternal = {
      '@deepseek-ai/dsh-client-connection': '0.1.0-rc.8',
      '@deepseek-ai/dsh-client-locale': '0.1.0-rc.8',
      '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.8',
    }
    expect(manifest.version).toBe('0.4.2')
    expect(manifest.dsh.client).toEqual({
      platform: 'web',
      inject: Object.keys(expectedInternal),
    })
    expect(manifest.dsh.client).not.toHaveProperty('immediately')
    expect(manifest.dsh.client).not.toHaveProperty('external')
    for (const [name, version] of Object.entries(expectedInternal)) {
      expect(manifest.peerDependencies[name]).toBe(version)
      expect(manifest.devDependencies[name]).toBe(version)
      expect(manifest.dependencies[name]).toBeUndefined()
    }
    expect(manifest.peerDependencies['@deepseek-ai/cordis']).toBe('4.0.1')
    expect(manifest.devDependencies['@deepseek-ai/cordis']).toBe('4.0.1')
    expect(manifest.peerDependenciesMeta).toBeUndefined()
    expect(manifest.dependencies['@deepseek-ai/dsh-cordis-client-runner']).toBeUndefined()
    expect(manifest.peerDependencies['@deepseek-ai/dsh-cordis-client-runner']).toBeUndefined()
    expect(manifest.devDependencies['@deepseek-ai/dsh-cordis-client-runner']).toBeUndefined()
  })

  it('keeps React as an implicit shared baseline with a dev-only local copy', () => {
    const required = Array.from(source.matchAll(/require\("([^"]+)"\)/g), (match) => match[1])
    expect(required).toEqual(['react'])
    expect(manifest.devDependencies.react).toBe('18.3.1')
    expect(manifest.dependencies.react).toBeUndefined()
    expect(manifest.peerDependencies.react).toBeUndefined()
  })

  it('wraps every slot registration in the rc.8 slot injection lifecycle', () => {
    expect(source.match(/ctx\.slots\.register\(/g)).toHaveLength(2)
    expect(source.match(/ctx\.slots\.inject\(/g)).toHaveLength(2)
  })
})
