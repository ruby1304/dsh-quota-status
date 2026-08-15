# dsh-quota-status

> DeepSeek Harness (DSH) web 插件：在一个紧凑卡片里实时查看 **DeepSeek API 余额** 和 **Kimi For Coding 套餐余量**（周限 + 5 小时窗口），带剩余量、进度条、重置时间与实时倒计时。
>
> A DeepSeek Harness (DSH) web plugin: one compact card for the **DeepSeek API balance** and the **Kimi For Coding plan quota** (weekly + 5h windows) — remaining amounts, progress bars, reset times and live countdowns.

## 功能 / Features

- 开箱即用：默认读取 `DEEPSEEK_API_KEY` 与 `KIMI_CODING_API_KEY`（经 dsh credentials seam，密钥永不进入浏览器）。
- 收起态胶囊：`DeepSeek ¥113.59 · Kimi Wk 84%`，固定 300px 宽、底部右对齐；点击胶囊原地向上展开卡片，再点同一个胶囊收起。
- 可拖动：按住胶囊/卡片空白处拖到任意位置，位置记忆在浏览器本地，设置里可一键恢复默认位置。
- 展开卡片显示每个窗口的进度条、`剩余 84/100`、重置时间与 `1d18h` 实时倒计时。
- 60 秒自动刷新（可调），页面隐藏时暂停，回到前台立即刷新；点击刷新按钮立即查询。
- 设置面板（保存在浏览器本地）：按账户显示/隐藏、刷新间隔、余额与余量预警阈值。
- 仅回环 Connection RPC（`authority: loopback`），API Key 只在宿主进程解析与使用。
- 中英双语，跟随 DSH 设计 token（`--dsw-alias-*`），自动适配深浅主题。

## 安装 / Install

```bash
dsh plugin --profile web add dsh-quota-status
dsh web
```

> 也可以手动加入 profile：`dsh-quota-status` 是 bundle，会通过 `cordis.patch.yml` 插入 `quota-status` 行。

## 配置 / Configuration

默认无需任何配置。在 `~/.dsh/profiles/web/cordis.patch.yml` 里可以按行覆盖：

```yaml
- id: quota-status
  config:
    refreshMs: 30000          # 默认 60000
    timeoutMs: 15000          # 上游查询超时
    warnBalance: 30           # DeepSeek 余额低于 30 变黄
    criticalBalance: 10       # 低于 10 变红
    warnUsagePercent: 40      # Kimi 余量低于 40% 变黄
    criticalUsagePercent: 15  # 低于 15% 变红
    providers:
      - id: deepseek
        label: DeepSeek
        kind: deepseek-balance
        credential: DEEPSEEK_API_KEY
        endpoint: https://api.deepseek.com/user/balance
      - id: kimi-coding
        label: Kimi Coding
        kind: kimi-usage
        credential: KIMI_CODING_API_KEY
        endpoint: https://api.kimi.com/coding/v1/usages
```

`providers` 列表会整体替换默认列表；`kind` 目前支持 `deepseek-balance` 与 `kimi-usage`。

## 数据源 / Data sources

| Provider | Endpoint | Meaning |
|---|---|---|
| DeepSeek | `GET https://api.deepseek.com/user/balance` | 可用余额（充值 + 赠送），按量计费，无重置时间 |
| Kimi For Coding | `GET https://api.kimi.com/coding/v1/usages` | 套餐周限（`usage`）+ 各窗口明细（`limits[]`，含 5h 滚动窗口与 `resetTime`） |

## 开发 / Development

```bash
npm install
npm run typecheck
npm test
npm run build          # 输出 lib/（host + client bundle）
```

- `src/providers.ts`：纯函数适配器，fixture 单测在 `tests/providers.spec.ts`。
- `src/index.ts`：host 半身，拥有 `/dsh-quota-status` RPC channel（`specs` / `fetch-all`）。
- `src/client.ts`：浏览器半身，注册 `shell.overlay` 槽位。

## 安全 / Security

- API Key 只通过 `ctx.credentials.resolve()` 在宿主进程解析，不写入响应、日志或浏览器。
- RPC channel 仅回环可访问（`authority: loopback`），浏览器只收到归一化后的余额/余量视图。
- 上游数据可能略有延迟，仅供参考。

## License

MIT
