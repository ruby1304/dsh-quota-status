/**
 * Copy the vendored Schemastery runtime into lib/ so the built host can run
 * with zero runtime dependencies (same approach as dsh-quota-panel).
 */
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = new URL('..', import.meta.url)
const src = resolve(root.pathname, 'src/vendor')
const dest = resolve(root.pathname, 'lib/vendor')
rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
