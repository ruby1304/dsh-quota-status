# dsh-quota-status vs dsh-plugin-llm-balance

Both plugins were installed side-by-side into the same throwaway `web`
profile and smoke-tested against the real credentials on 2026-08-15.

## Observed result (fresh profile, no recent sessions)

| | dsh-plugin-llm-balance 0.2.1 | dsh-quota-status 0.1.0 |
|---|---|---|
| First render | `等待会话… —` (waits for recent providers) | `DeepSeek ¥113.23 · Kimi Coding Weekly 84%` |
| DeepSeek balance | hidden until DeepSeek is used once | shown immediately |
| Kimi windows | hidden until Kimi is used once | Weekly + 5h shown immediately |
| Reset countdown | date only, inside a hover tooltip | live `4h53m` / `1d18h` in the card |
| Exact remaining | hover only | `100/100 left` / `84/100 left` in the card |

## Feature comparison

| Capability | dsh-plugin-llm-balance | dsh-quota-status |
|---|---|---|
| Provider discovery | recently-used providers (≤3, post-install) | configured rows shown immediately |
| Default keys | `DEEPSEEK_API_KEY` + `KIMI_CODING_API_KEY` | same |
| Kimi weekly + 5h windows | yes (percentages in the row) | yes (remaining + progress + countdown) |
| Kimi membership level | tooltip only | visible row subtitle |
| Kimi monthly quota (cookie) | no | not yet (planned extension point) |
| Settings UI | none (YAML only) | refresh interval, per-provider hide, warn thresholds |
| Security boundary | raw WebServer route, LAN-readable on `--host 0.0.0.0` | loopback-only Connection RPC |
| Keys in browser | no | no |
| Draggable | yes | no (fixed bottom-right) |
| Extra providers | DeepSeek / Moonshot / Kimi | DeepSeek / Kimi (adapter seam for more) |
| i18n | hard-coded | zh/en locale dictionaries |
| Tests | not shipped in npm tarball | 16 unit tests + Playwright smoke |

## Replacement recommendation

Replace path 1 with `dsh-quota-status` once the following are accepted:

1. **MVP parity** — DeepSeek balance and Kimi weekly/5h windows render
   immediately with auto-refresh (already verified in a real browser).
2. **Wanted extras** — draggable position, Kimi monthly quota via optional
   `kimi-auth` cookie, and optional Moonshot/MiniMax rows can land as 0.2.x.
3. **No regression** — `dsh plugin --profile web remove dsh-plugin-llm-balance`
   leaves the profile with `dsh-quota-status` only; re-run the Playwright
   smoke to confirm.

Until then both plugins can coexist (verified: separate host routes and
separate `shell.overlay` slot ids, no boot conflict).
