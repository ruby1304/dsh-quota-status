/**
 * dsh-quota-status — client half (browser bundle, served at
 * /plugins/dsh-quota-status/client.js through the `dsh.client` manifest).
 *
 * One minimal `shell.overlay` card anchored bottom-right, fixed width so
 * expanding a row never resizes it: one row per account (status dot +
 * name + value), click a row to expand its detail (DeepSeek topped-up /
 * granted split + a one-line peak countdown, Kimi per-window progress
 * bars with live reset countdowns, updated-at line with a refresh
 * action). DeepSeek values and dots are tier-colored by balance (green
 * ≥100 · yellow 20–99 · red 1–19 · gray below), and DeepSeek rows carry
 * a peak/off-peak pill driven by wall-clock time (peak: 09:00–12:00 &
 * 14:00–18:00 Beijing daily, all other hours off-peak at half price;
 * the full schedule lives in the pill's tooltip). All strings are localized zh/en through the host
 * locale service; all provider data arrives over the loopback Connection
 * RPC channel `/dsh-quota-status`; API keys never reach the browser.
 *
 * Display preferences (rows, thresholds, refresh interval) live in the
 * profile YAML config — the widget itself stays chrome-free on purpose.
 */
(window as any).__ModuleLoader__.load({
	id: "dsh-quota-status",
	factory: (require) => {
		var module = { exports: {} as any };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		var React = require("react");

		var CHANNEL = "/dsh-quota-status";
		var EXTRA_ROW_SLOT = "dsh-quota-status.extra-row";
		var POS_STORAGE_KEY = "dsh-quota-status:pos";
		var LEGACY_SETTINGS_KEY = "dsh-quota-status:settings";
		var NS = "quota-status";

		var DICT = {
			zh: {
				title: "配额余量",
				refresh: "刷新配额余量",
				loading: "加载中…",
				fetchFailed: "查询失败",
				missingKey: "未配置 {ref}",
				codexMissing: "未找到 CLIProxyAPI 的 codex 授权文件",
				balanceUnavailable: "暂时无法获取余额",
				usageUnavailable: "暂时无法获取用量",
				emptyHint: "暂无配置的账户",
				updatedAt: "更新于 {time}",
				notAvailable: "当前不可用",
				balanceSub: "充值 {topped} · 赠送 {granted}",
				weekly: "周限",
				weeklyShort: "周",
				remaining: "剩余 {remaining}/{limit}",
				usedOfLimit: "今日已用 {used} / {limit}",
				remainingAmount: "剩余 {remaining}",
				resetAt: "{when} 重置",
				resetIn: "还有 {span}",
				membership: "套餐 {level}",
				offPeak: "低谷",
				peak: "高峰",
				peakDesc: "高峰 09:00–12:00、14:00–18:00（北京时间）· 其余时段低谷半价",
				offPeakNow: "正在低谷 · {span} 后结束",
				peakNow: "正在高峰 · {span} 后进入低谷",
				settingsTab: "配额余量",
				settingsDescription: "查看账户用量并管理 ChatGPT 登录。",
				accountsTitle: "账户状态",
				chatgptTitle: "ChatGPT 订阅",
				signedInAs: "已登录 {email}",
				authUpdated: "授权更新于 {time}",
				notSignedIn: "未登录（未找到本机授权文件）",
				login: "登录 ChatGPT",
				relogin: "重新登录",
				waitingAuth: "等待浏览器授权…",
				loginOpened: "已在浏览器打开授权页；若未打开请手动访问：",
				openLink: "打开链接",
				loginTimeout: "等待超时，未完成授权",
				loginFailed: "登录进程异常退出，请重试",
				loginDone: "登录成功",
				refreshStatus: "刷新状态",
				gatewayNote: "登录由本机 CLIProxyAPI 完成，OAuth 凭证不会进入浏览器页面。",
			},
			en: {
				title: "Quota",
				refresh: "Refresh quota",
				loading: "Loading…",
				fetchFailed: "Query failed",
				missingKey: "{ref} not configured",
				codexMissing: "No CLIProxyAPI codex auth file found",
				balanceUnavailable: "Balance unavailable",
				usageUnavailable: "Usage unavailable",
				emptyHint: "No accounts configured",
				updatedAt: "Updated {time}",
				notAvailable: "Unavailable",
				balanceSub: "Topped-up {topped} · Granted {granted}",
				weekly: "Weekly",
				weeklyShort: "Wk",
				remaining: "{remaining}/{limit} left",
				usedOfLimit: "Used today {used} / {limit}",
				remainingAmount: "{remaining} left",
				resetAt: "resets {when}",
				resetIn: "{span} left",
				membership: "Plan {level}",
				offPeak: "Off-peak",
				peak: "Peak",
				peakDesc: "Peak 09:00–12:00 & 14:00–18:00 (UTC+8) · off-peak half price",
				offPeakNow: "Off-peak · ends in {span}",
				peakNow: "Peak · off-peak in {span}",
				settingsTab: "Quota",
				settingsDescription: "View account quota and manage ChatGPT sign-in.",
				accountsTitle: "Account status",
				chatgptTitle: "ChatGPT subscription",
				signedInAs: "Signed in as {email}",
				authUpdated: "Authorization updated {time}",
				notSignedIn: "Not signed in (no local auth file found)",
				login: "Sign in with ChatGPT",
				relogin: "Sign in again",
				waitingAuth: "Waiting for browser authorization…",
				loginOpened: "The authorization page opened in your browser. If it did not, open:",
				openLink: "Open link",
				loginTimeout: "Timed out waiting for authorization",
				loginFailed: "The login process exited unexpectedly. Try again.",
				loginDone: "Signed in successfully",
				refreshStatus: "Refresh status",
				gatewayNote: "Sign-in is handled by local CLIProxyAPI; OAuth credentials never enter the browser page.",
			}
		};

		var CSS = [
			"#dsh-quota-status{position:fixed;right:16px;bottom:16px;z-index:900;display:flex;flex-direction:column;align-items:flex-end;pointer-events:auto;color:var(--dsw-alias-label-primary,#1b1b1c);font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,\"Segoe UI\",\"PingFang SC\",\"Microsoft YaHei\",sans-serif);font-size:12px;line-height:1.45;user-select:none;-webkit-user-select:none;touch-action:none;cursor:grab}",
			"#dsh-quota-status.is-dragging{cursor:grabbing}",
			"#dsh-quota-status.is-dragging #dsh-quota-card{box-shadow:0 6px 20px rgba(0,0,0,.16);transition:none}",
			"#dsh-quota-card{width:260px;padding:6px;display:flex;flex-direction:column;gap:2px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:0 2px 12px rgba(0,0,0,.08);box-sizing:border-box;transition:box-shadow .15s ease}",
			"#dsh-quota-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.12)}",
			"#dsh-quota-card .dsh-provider-row{display:flex;align-items:center;gap:8px;padding:3px 8px;border-radius:8px;white-space:nowrap;cursor:pointer;transition:background-color .12s ease,box-shadow .12s ease}",
			"#dsh-quota-card .dsh-provider-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}",
			"#dsh-quota-card .dsh-provider-row.is-open{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));box-shadow:0 1px 4px rgba(15,17,21,.08)}",
			"#dsh-quota-card .dsh-status-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-static-neutral-bluish-400,#adb2b8)}",
			"#dsh-quota-card .state-loading .dsh-status-dot{background:var(--dsw-static-neutral-bluish-400,#adb2b8)}",
			"#dsh-quota-card .state-warn .dsh-status-dot{background:var(--dsw-static-amber-500,#f59e0b)}",
			"#dsh-quota-card .state-error .dsh-status-dot{background:var(--dsw-static-red-500,#ef4444)}",
			"#dsh-quota-card .state-ok .dsh-status-dot{background:var(--dsw-static-green-500,#22c55e)}",
			"#dsh-quota-card .dsh-provider-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:18px}",
			"#dsh-quota-card .dsh-provider-value{display:inline-flex;align-items:center;gap:5px;flex:none;font-weight:600;font-variant-numeric:tabular-nums;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#1b1b1c)}",
			"#dsh-quota-card .dsh-provider-value .dsh-value-sep{color:var(--dsw-alias-label-tertiary,#7f858f);font-weight:400;margin:0 2px}",
			"#dsh-quota-card .dsh-provider-value .dsh-value-label{font-weight:500;color:var(--dsw-alias-label-secondary,#61666b);margin-right:2px}",
			"#dsh-quota-card .dsh-provider-value .dsh-value-seg.state-warn{color:var(--dsw-static-amber-500,#f59e0b)}",
			"#dsh-quota-card .dsh-provider-value .dsh-value-seg.state-error{color:var(--dsw-static-red-500,#ef4444)}",
			"#dsh-quota-card .dsh-provider-value .dsh-value-seg.state-loading{color:var(--dsw-alias-label-secondary,#61666b);font-weight:400}",
			"#dsh-quota-card .dsh-provider-row.lv-green .dsh-status-dot{background:#10b981}",
			"#dsh-quota-card .dsh-provider-row.lv-yellow .dsh-status-dot{background:#f59e0b}",
			"#dsh-quota-card .dsh-provider-row.lv-red .dsh-status-dot{background:#ef4444}",
			"#dsh-quota-card .dsh-provider-row.lv-gray .dsh-status-dot{background:#9ca3af}",
			"#dsh-quota-card .dsh-provider-value .dsh-value-seg.lv-green{color:#10b981}",
			"#dsh-quota-card .dsh-provider-value .dsh-value-seg.lv-yellow{color:#b45309}",
			"#dsh-quota-card .dsh-provider-value .dsh-value-seg.lv-red{color:#ef4444}",
			"#dsh-quota-card .dsh-provider-value .dsh-value-seg.lv-gray{color:#9ca3af}",
			"#dsh-quota-card .dsh-peak-pill{flex:none;display:inline-flex;align-items:center;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600;line-height:16px;letter-spacing:.01em;font-variant-numeric:tabular-nums}",
			"#dsh-quota-card .dsh-peak-pill.is-offpeak{color:var(--dsw-static-green-500,#10b981);background:rgba(16,185,129,.14)}",
			"#dsh-quota-card .dsh-peak-pill.is-peak{color:var(--dsw-alias-label-tertiary,#7f858f);background:var(--dsw-alias-bg-overlay,rgba(0,0,0,.05))}",
			"#dsh-quota-card .dsh-quota-error{padding:4px 8px;color:var(--dsw-static-red-500,#ef4444);font-size:12px;line-height:18px;word-break:break-all}",
			"#dsh-quota-card .dsh-provider-sub{padding:4px 8px;color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:18px}",
			"#dsh-quota-card .dsh-detail{margin:1px 6px 4px;padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-overlay,#ebeef2);box-shadow:0 1px 3px rgba(15,17,21,.06);font-size:12px}",
			"#dsh-quota-card .dsh-detail-line{color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:18px;white-space:normal}",
			"#dsh-quota-card .dsh-detail-line.dsh-peak-now{font-variant-numeric:tabular-nums}",
			"#dsh-quota-card .dsh-window{margin-top:7px}",
			"#dsh-quota-card .dsh-window:first-child{margin-top:0}",
			"#dsh-quota-card .dsh-window-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:17px}",
			"#dsh-quota-card .dsh-window-value{font-variant-numeric:tabular-nums;font-weight:600}",
			"#dsh-quota-card .dsh-progress{position:relative;width:100%;height:4px;margin-top:4px;overflow:hidden;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#f0f1f3)}",
			"#dsh-quota-card .dsh-progress-fill{height:100%;width:0;border-radius:inherit;background:var(--dsw-static-green-500,#22c55e);transition:width 300ms ease,background-color 160ms ease}",
			"#dsh-quota-card .state-warn .dsh-progress-fill,#dsh-quota-card .dsh-progress-fill.state-warn{background:var(--dsw-static-amber-500,#f59e0b)}",
			"#dsh-quota-card .state-error .dsh-progress-fill,#dsh-quota-card .dsh-progress-fill.state-error{background:var(--dsw-static-red-500,#ef4444)}",
			"#dsh-quota-card .dsh-window-caption{margin-top:4px;color:var(--dsw-alias-label-tertiary,#7f858f);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			"#dsh-quota-card .dsh-detail-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:7px;padding-top:5px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06))}",
			"#dsh-quota-card .dsh-detail-time{color:var(--dsw-alias-label-tertiary,#7f858f);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			"#dsh-quota-card .dsh-detail-refresh{display:inline-grid;place-items:center;width:20px;height:20px;padding:0;border:0;border-radius:6px;color:var(--dsw-alias-label-secondary,#61666b);background:transparent;font-size:12px;line-height:1;cursor:pointer;transition:background-color .12s ease,color .12s ease}",
			"#dsh-quota-card .dsh-detail-refresh:hover{color:var(--dsw-alias-label-primary,#1b1b1c);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}",
			"#dsh-quota-card .dsh-detail-refresh:disabled{cursor:default;opacity:.55}",
			"#dsh-quota-card .dsh-detail-refresh.is-loading{animation:dsh-quota-spin .7s linear infinite}",
			"@keyframes dsh-quota-spin{to{transform:rotate(360deg)}}",
			"@media(max-width:720px){#dsh-quota-status{bottom:66px}}",
			".dsh-quota-settings{list-style:none;overflow:hidden;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#1b1b1c);font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,\"Segoe UI\",\"PingFang SC\",\"Microsoft YaHei\",sans-serif)}",
			".dsh-quota-settings .qs-header{width:100%;display:flex;align-items:center;gap:12px;padding:13px 14px;border:0;background:transparent;text-align:left;cursor:pointer;color:inherit;font:inherit}",
			".dsh-quota-settings .qs-header:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.035))}",
			".dsh-quota-settings .qs-head-text{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}",
			".dsh-quota-settings .qs-description{font-size:12px;color:var(--dsw-alias-label-secondary,#61666b)}",
			".dsh-quota-settings .qs-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#8b9096);transition:transform .16s ease}",
			".dsh-quota-settings.is-open .qs-chevron{transform:rotate(180deg)}",
			".dsh-quota-settings .qs-body{display:flex;flex-direction:column;gap:12px;padding:0 14px 14px}",
			".dsh-quota-settings .qs-card{display:flex;flex-direction:column;gap:9px;padding:13px 14px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff)}",
			".dsh-quota-settings .qs-title{font-size:13px;font-weight:600;line-height:20px}",
			".dsh-quota-settings .qs-row{display:flex;align-items:center;gap:8px;min-height:22px;font-size:12px;color:var(--dsw-alias-label-secondary,#61666b)}",
			".dsh-quota-settings .qs-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-quota-settings .qs-value{font-variant-numeric:tabular-nums;font-weight:600;color:var(--dsw-alias-label-primary,#1b1b1c);white-space:nowrap}",
			".dsh-quota-settings .dsh-status-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-static-neutral-bluish-400,#adb2b8)}",
			".dsh-quota-settings .state-ok .dsh-status-dot{background:var(--dsw-static-green-500,#22c55e)}",
			".dsh-quota-settings .state-warn .dsh-status-dot{background:var(--dsw-static-amber-500,#f59e0b)}",
			".dsh-quota-settings .state-error .dsh-status-dot{background:var(--dsw-static-red-500,#ef4444)}",
			".dsh-quota-settings .qs-sub{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary,#8b9096);word-break:break-word}",
			".dsh-quota-settings .qs-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:1px}",
			".dsh-quota-settings .qs-btn{height:30px;padding:0 12px;border:0;border-radius:8px;background:var(--dsw-static-deepseek-500,#4d6bfe);color:#fff;font:inherit;font-weight:600;cursor:pointer}",
			".dsh-quota-settings .qs-btn:hover{filter:brightness(.96)}",
			".dsh-quota-settings .qs-btn:disabled{cursor:default;opacity:.6}",
			".dsh-quota-settings .qs-btn-secondary{height:30px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#61666b);font:inherit;cursor:pointer}",
			".dsh-quota-settings .qs-link{color:var(--dsw-static-deepseek-500,#4d6bfe);text-decoration:none;word-break:break-all}",
			".dsh-quota-settings .qs-success{font-size:12px;color:var(--dsw-static-green-600,#16a34a)}",
			".dsh-quota-settings .qs-error{font-size:12px;color:var(--dsw-static-red-500,#ef4444)}"
		].join("\n");

		function tplReplace(template, params) {
			return String(template).replace(/\{(\w+)\}/g, function (_all, key) {
				return params && params[key] !== undefined ? String(params[key]) : "";
			});
		}

		var ROOT_EDGE = 16;
		var SCREEN_MARGIN = 10;
		var MOBILE_BREAKPOINT = 720;
		var MOBILE_BOTTOM_EDGE = 66;
		var MOBILE_BOTTOM_MARGIN = 60;

		function quotaBottomEdge() {
			return globalThis.innerWidth <= MOBILE_BREAKPOINT ? MOBILE_BOTTOM_EDGE : ROOT_EDGE;
		}

		function quotaBottomMargin() {
			return globalThis.innerWidth <= MOBILE_BREAKPOINT ? MOBILE_BOTTOM_MARGIN : SCREEN_MARGIN;
		}

		/** Pick the edge with more usable space so expansion follows card placement. */
		function chooseVerticalAnchor(rect, viewportHeight, topMargin, bottomMargin) {
			var spaceAbove = Math.max(0, rect.top - topMargin);
			var spaceBelow = Math.max(0, viewportHeight - bottomMargin - rect.bottom);
			return spaceBelow >= spaceAbove ? "top" : "bottom";
		}

		/** Correct translate-y after a height change while keeping one edge fixed. */
		function preserveVerticalAnchor(pos, beforeRect, afterRect, anchor) {
			var beforeEdge = anchor === "top" ? beforeRect.top : beforeRect.bottom;
			var afterEdge = anchor === "top" ? afterRect.top : afterRect.bottom;
			return { dx: pos.dx, dy: pos.dy + beforeEdge - afterEdge };
		}

		function defaultPos() {
			return { dx: 0, dy: 0 };
		}

		function loadPos() {
			try {
				var raw = globalThis.localStorage.getItem(POS_STORAGE_KEY);
				if (raw !== null) {
					var saved = JSON.parse(raw);
					if (typeof saved.dx === "number" && Number.isFinite(saved.dx)
						&& typeof saved.dy === "number" && Number.isFinite(saved.dy)) {
						return { dx: saved.dx, dy: saved.dy };
					}
				}
			} catch (err) {}
			return defaultPos();
		}

		function savePos(pos) {
			try {
				globalThis.localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
			} catch (err) {}
		}

		/**
		 * The root is anchored at right/bottom and moved with translate(dx,dy),
		 * so clamping is a pure box calculation against the viewport.
		 */
		function clampPos(pos, width, height) {
			var bottomEdge = quotaBottomEdge();
			var bottomMargin = quotaBottomMargin();
			var baseLeft = Math.max(ROOT_EDGE, globalThis.innerWidth - width - ROOT_EDGE);
			var baseTop = Math.max(ROOT_EDGE, globalThis.innerHeight - height - bottomEdge);
			var minDx = SCREEN_MARGIN - baseLeft;
			var maxDx = (globalThis.innerWidth - SCREEN_MARGIN) - (baseLeft + width);
			var minDy = SCREEN_MARGIN - baseTop;
			var maxDy = (globalThis.innerHeight - bottomMargin) - (baseTop + height);
			return {
				dx: Math.min(Math.max(pos.dx, minDx), Math.max(minDx, maxDx)),
				dy: Math.min(Math.max(pos.dy, minDy), Math.max(minDy, maxDy))
			};
		}

		function isInteractiveTarget(target) {
			if (!(target instanceof Element)) return false;
			return target.closest("input,select,textarea,label,a,button") !== null;
		}

		function pad2(n) {
			return (n < 10 ? "0" : "") + n;
		}

		/** Local wall-clock reset time: 8/17 12:25. */
		function fmtResetClock(iso) {
			var d = new Date(iso);
			if (!isFinite(d.getTime())) return "";
			return (d.getMonth() + 1) + "/" + d.getDate() + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
		}

		/** Countdown span: 1d3h / 2h15m / 5m / 30s. */
		function fmtCountdown(iso, nowMs) {
			var d = new Date(iso);
			if (!isFinite(d.getTime())) return "";
			var sec = Math.max(0, Math.floor((d.getTime() - nowMs) / 1000));
			var days = Math.floor(sec / 86400);
			var hours = Math.floor(sec % 86400 / 3600);
			var mins = Math.floor(sec % 3600 / 60);
			var secs = sec % 60;
			if (days > 0) return days + "d" + hours + "h";
			if (hours > 0) return hours + "h" + mins + "m";
			if (mins > 0) return mins + "m";
			return secs + "s";
		}

		function collapsedWindowValue(windowView, nowMs) {
			var reset = windowView.percentRemaining <= 0 && windowView.resetAt
				? " · " + fmtCountdown(windowView.resetAt, nowMs)
				: "";
			return windowView.percentRemaining + "%" + reset;
		}

		/** Minute-granularity span for the peak countdown: 7h30m / 45m. */
		function fmtSpanMin(totalMin) {
			var h = Math.floor(totalMin / 60);
			var m = totalMin % 60;
			if (h > 0) return m > 0 ? h + "h" + m + "m" : h + "h";
			return Math.max(1, m) + "m";
		}

		/** LEVEL_ADVANCED → Advanced (raw enum falls through unchanged). */
		function prettyLevel(level) {
			var s = String(level);
			if (s.indexOf("LEVEL_") === 0) {
				s = s.slice(6).toLowerCase();
				return s.charAt(0).toUpperCase() + s.slice(1);
			}
			return s;
		}

		function money(amount, currency) {
			if (!Number.isFinite(amount)) return "—";
			var symbol = currency === "USD" ? "$" : currency === "CNY" ? "¥" : "";
			var text = amount.toFixed(2);
			return symbol ? symbol + text : text + " " + currency;
		}

		/**
		 * DeepSeek peak/off-peak pricing, pure wall-clock math. Mirrors
		 * deepSeekPeakInfo in src/providers.ts — this bundle is standalone
		 * and cannot import from the host module, so keep both in sync.
		 * Peak windows (effective 2026-08-17): 09:00–12:00 and 14:00–18:00
		 * Beijing time; all other hours are off-peak at half the peak rate.
		 */
		function peakInfo(nowMs) {
			var d = new Date(nowMs);
			var minutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 8 * 60) % 1440;
			var peak = (minutes >= 540 && minutes < 720) || (minutes >= 840 && minutes < 1080);
			var boundaries = [540, 720, 840, 1080];
			var next = -1;
			for (var i = 0; i < boundaries.length; i++) {
				if (boundaries[i] > minutes) { next = boundaries[i]; break; }
			}
			return {
				offPeak: !peak,
				minutesLeft: next === -1 ? boundaries[0] + 1440 - minutes : next - minutes
			};
		}

		/** Balance color tier (same scale llm-balance uses): green ≥100, yellow 20–99, red 1–19, gray below. */
		function balanceTier(amount) {
			if (!Number.isFinite(amount)) return "gray";
			if (amount >= 100) return "green";
			if (amount >= 20) return "yellow";
			if (amount >= 1) return "red";
			return "gray";
		}

		function balanceState(amount, critical, warn) {
			if (amount === null || !Number.isFinite(amount)) return "loading";
			if (amount < critical) return "error";
			if (amount < warn) return "warn";
			return "ok";
		}

		function usageState(percent, critical, warn) {
			if (percent === null || !Number.isFinite(percent)) return "loading";
			if (percent <= critical) return "error";
			if (percent <= warn) return "warn";
			return "ok";
		}

		/** Validate the business-neutral display contract supplied by an extra-row Slot entry. */
		function normalizeExtraRow(input) {
			if (input === null || typeof input !== "object") return null;
			var id = typeof input.id === "string" ? input.id.trim() : "";
			var label = typeof input.label === "string" ? input.label.trim() : "";
			var statuses = ["loading", "missing", "error", "ok"];
			if (id.length === 0 || label.length === 0 || statuses.indexOf(input.status) === -1) return null;
			var row: any = {
				id: id,
				label: label,
				status: input.status,
				error: typeof input.error === "string" ? input.error : "",
				fetchedAt: Number.isFinite(input.fetchedAt) ? input.fetchedAt : null,
				refreshing: input.refreshing === true,
				onRefresh: typeof input.onRefresh === "function" ? input.onRefresh : function () {}
			};
			if (input.status !== "ok") return row;
			var view = input.view;
			if (view === null || typeof view !== "object" || view.kind !== "meter") return null;
			var resetMs = new Date(view.resetAt).getTime();
			if (!Number.isFinite(view.used) || view.used < 0
				|| !Number.isFinite(view.limit) || view.limit <= 0
				|| !Number.isFinite(view.remaining) || view.remaining < 0
				|| !Number.isFinite(view.percentRemaining) || view.percentRemaining < 0 || view.percentRemaining > 100
				|| typeof view.unit !== "string" || view.unit.trim().length === 0
				|| !Number.isFinite(resetMs)) return null;
			row.view = {
				kind: "meter",
				used: view.used,
				limit: view.limit,
				remaining: view.remaining,
				unit: view.unit.trim(),
				percentRemaining: view.percentRemaining,
				resetAt: new Date(resetMs).toISOString(),
				warnPercent: Number.isFinite(view.warnPercent) ? Math.max(0, Math.min(100, view.warnPercent)) : 40,
				criticalPercent: Number.isFinite(view.criticalPercent) ? Math.max(0, Math.min(100, view.criticalPercent)) : 15
			};
			return row;
		}

		/** Usage-style rows (Kimi plan windows, Codex subscription windows). */
		function isUsageKind(kind) {
			return kind === "kimi-usage" || kind === "codex-usage";
		}

		/** One row view model for collapsed + detail rendering. */
		function rowView(t, spec, entry) {
			var ref = (entry && typeof entry.error === "string" && entry.error.length > 0) ? entry.error : (spec.credential || "KEY");
			var missingText = spec.kind === "codex-usage" ? t("codexMissing") : tplReplace(t("missingKey"), { ref: ref });
			if (!entry) {
				return { kind: spec.kind, status: "loading", value: "—", sub: t("loading"), windows: [], title: "" };
			}
			if (entry.status === "missing") {
				return { kind: spec.kind, status: "error", value: "—", sub: missingText, windows: [], title: missingText };
			}
			if (entry.status === "error" || !entry.view) {
				return {
					kind: spec.kind, status: "error", value: "—",
					sub: spec.kind === "deepseek-balance" ? t("balanceUnavailable") : t("usageUnavailable"),
					windows: [], title: entry.error || t("fetchFailed")
				};
			}
			if (spec.kind === "deepseek-balance" && entry.view.kind === "balance") {
				var v = entry.view;
				var status = v.available === false ? "error" : balanceState(v.amount, spec.criticalBalance, spec.warnBalance);
				return {
					kind: spec.kind,
					status: status,
					tier: v.available === false ? "gray" : balanceTier(v.amount),
					value: money(v.amount, v.currency),
					sub: v.available === false
						? t("notAvailable")
						: tplReplace(t("balanceSub"), { topped: money(v.toppedUp, v.currency), granted: money(v.granted, v.currency) }),
					windows: [],
					title: ""
				};
			}
			if (isUsageKind(spec.kind) && entry.view.kind === "usage") {
				var u = entry.view;
				var windows = [];
				var worst = null;
				for (var i = 0; i < u.windows.length; i++) {
					var w = u.windows[i];
					var wstatus = usageState(w.percentRemaining, spec.criticalUsagePercent, spec.warnUsagePercent);
					if (worst === null || w.percentRemaining < worst.window.percentRemaining) worst = { window: w, status: wstatus };
					windows.push({ window: w, status: wstatus });
				}
				return {
					kind: spec.kind,
					status: worst ? worst.status : "loading",
					value: "",
					sub: u.membership ? tplReplace(t("membership"), { level: prettyLevel(u.membership) }) : "",
					windows: windows,
					title: ""
				};
			}
			return { kind: spec.kind, status: "loading", value: "—", sub: "", windows: [], title: "" };
		}

		var inject = ["slots", "timer", "connection", "locale"];

		function apply(ctx) {
			ctx.effect(function () {
				var tag = document.createElement("style");
				tag.dataset.plugin = "dsh-quota-status";
				tag.textContent = CSS;
				document.head.append(tag);
				return function () { tag.remove(); };
			});

			ctx.effect(function () {
				return ctx.locale.register(NS, DICT);
			}, "dsh-quota-status: copy dictionaries");

			// The settings panel was removed in favor of YAML config; drop its
			// legacy localStorage record so the browser stays as clean as the UI.
			try { globalThis.localStorage.removeItem(LEGACY_SETTINGS_KEY); } catch (err) {}

			var t = ctx.locale.bind(NS);

			function QuotaStatus(props) {
				var t = props.t;
				var specsState = React.useState(null);
				var specs = specsState[0], setSpecs = specsState[1];
				var dataState = React.useState({});
				var dataById = dataState[0], setDataById = dataState[1];
				var errState = React.useState(null);
				var loadError = errState[0], setLoadError = errState[1];
				var atState = React.useState(null);
				var fetchedAt = atState[0], setFetchedAt = atState[1];
				var refreshState = React.useState(false);
				var refreshing = refreshState[0], setRefreshing = refreshState[1];
				var openState = React.useState(null);
				var openId = openState[0], setOpenId = openState[1];
				var clockState = React.useState(Date.now);
				var nowMs = clockState[0];
				var posState = React.useState(loadPos);
				var pos = posState[0];
				var posRef = React.useRef(pos);
				var draggingState = React.useState(false);
				var dragging = draggingState[0];
				var rootRef = React.useRef(null);
				var dragRef = React.useRef(null);
				var suppressClickRef = React.useRef(false);
				var openAnchorRef = React.useRef(null);
				var transitionRef = React.useRef(null);
				posRef.current = pos;

				function setPosStateSafe(next) {
					posRef.current = next;
					posState[1](next);
				}

				React.useLayoutEffect(function () {
					var el = rootRef.current;
					if (!el) return;
					var rect = el.getBoundingClientRect();
					if (rect.width <= 0 || rect.height <= 0) return;
					var nextPos = posRef.current;
					var pending = transitionRef.current;
					if (pending !== null) {
						nextPos = preserveVerticalAnchor(nextPos, pending.beforeRect, rect, pending.anchor);
						transitionRef.current = null;
					}
					nextPos = clampPos(nextPos, rect.width, rect.height);
					if (nextPos.dx !== posRef.current.dx || nextPos.dy !== posRef.current.dy) {
						setPosStateSafe(nextPos);
					}
					if (openId === null) openAnchorRef.current = null;
				}, [openId, dataById, specs]);

				var loadSpecs = function () {
					return ctx.connection.rpc.call(CHANNEL, "specs", null).then(function (result) {
						if (result && result.ok === true && result.value) {
							setSpecs(result.value);
						} else {
							setLoadError(result && result.error ? result.error.message : t("fetchFailed"));
						}
					}).catch(function (error) {
						setLoadError(String((error && error.message) || error));
					});
				};

				var load = function () {
					return ctx.connection.rpc.call(CHANNEL, "fetch-all", null).then(function (result) {
						if (result && result.ok === true && result.value) {
							var map = {};
							var rows = result.value.rows || [];
							for (var i = 0; i < rows.length; i++) map[rows[i].id] = rows[i];
							setDataById(map);
							setFetchedAt(result.value.fetchedAt || Date.now());
							setLoadError(null);
						} else {
							setLoadError(result && result.error ? result.error.message : t("fetchFailed"));
						}
					}).catch(function (error) {
						setLoadError(String((error && error.message) || error));
					});
				};

				var refreshAll = function () {
					if (refreshing) return Promise.resolve();
					setRefreshing(true);
					return (specs ? Promise.resolve() : loadSpecs()).then(load).then(function () { setRefreshing(false); });
				};

				React.useEffect(function () {
					loadSpecs().then(load);
				}, []);

				var effectiveMs = specs ? specs.refreshMs : 60000;

				React.useEffect(function () {
					return ctx.interval(function () {
						if (!document.hidden) load();
					}, effectiveMs);
				}, [effectiveMs]);

				React.useEffect(function () {
					var onVisible = function () { if (!document.hidden) load(); };
					document.addEventListener("visibilitychange", onVisible);
					return function () { document.removeEventListener("visibilitychange", onVisible); };
				}, []);

				React.useEffect(function () {
					return ctx.interval(function () { clockState[1](Date.now()); }, 1000);
				}, []);

				function onPointerDown(e) {
					if (e.button !== 0 && e.pointerType === "mouse") return;
					if (isInteractiveTarget(e.target)) return;
					dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, odx: posRef.current.dx, ody: posRef.current.dy, moved: false, captured: false };
					draggingState[1](true);
				}

				function onPointerMove(e) {
					var d = dragRef.current;
					if (!d || e.pointerId !== d.id) return;
					var dx = e.clientX - d.sx;
					var dy = e.clientY - d.sy;
					if (Math.abs(dx) + Math.abs(dy) > 5) {
						if (!d.moved) {
							d.moved = true;
							suppressClickRef.current = true;
							if (!d.captured && e.currentTarget.setPointerCapture) {
								d.captured = true;
								e.currentTarget.setPointerCapture(e.pointerId);
							}
						}
					}
					var el = rootRef.current;
					var width = el ? el.offsetWidth : 300;
					var height = el ? el.offsetHeight : 44;
					setPosStateSafe(clampPos({ dx: d.odx + dx, dy: d.ody + dy }, width, height));
				}

				function onPointerUp(e) {
					var d = dragRef.current;
					if (!d || e.pointerId !== d.id) return;
					dragRef.current = null;
					draggingState[1](false);
					if (d.moved) {
						savePos(posRef.current);
						var el = rootRef.current;
						if (openId !== null && el) {
							openAnchorRef.current = chooseVerticalAnchor(el.getBoundingClientRect(), globalThis.innerHeight, SCREEN_MARGIN, quotaBottomMargin());
						}
					}
					window.setTimeout(function () { suppressClickRef.current = false; }, 0);
				}

				function toggleOpen(id) {
					if (suppressClickRef.current) return;
					var nextOpenId = openId === id ? null : id;
					var el = rootRef.current;
					if (el) {
						var rect = el.getBoundingClientRect();
						var anchor = openAnchorRef.current;
						if (anchor === null || openId === null) {
							anchor = chooseVerticalAnchor(rect, globalThis.innerHeight, SCREEN_MARGIN, quotaBottomMargin());
						}
						openAnchorRef.current = anchor;
						transitionRef.current = {
							anchor: anchor,
							beforeRect: { top: rect.top, bottom: rect.bottom }
						};
					}
					setOpenId(nextOpenId);
				}

				function renderExtraRow(input) {
					var row = normalizeExtraRow(input);
					if (row === null) return null;
					var key = "extra:" + row.id;
					var isOpen = openId === key;
					return React.createElement(React.Fragment, { key: key },
						React.createElement(ExtraQuotaRow, {
							row: row,
							t: t,
							nowMs: nowMs,
							open: isOpen,
							onToggle: function () { toggleOpen(key); }
						}),
						isOpen ? React.createElement(ExtraQuotaDetail, {
							row: row,
							t: t,
							nowMs: nowMs
						}) : null);
				}

				var rows = specs ? (specs.rows || []) : [];
				var views = {};
				for (var vi = 0; vi < rows.length; vi++) {
					views[rows[vi].id] = rowView(t, rows[vi], dataById[rows[vi].id]);
				}

				var rowEls = [];
				if (loadError !== null) {
					rowEls.push(React.createElement("div", { key: "err", className: "dsh-quota-error" }, String(loadError)));
				} else if (rows.length === 0) {
					rowEls.push(React.createElement("div", { key: "empty", className: "dsh-provider-sub" }, t("emptyHint")));
				} else {
					for (var ri = 0; ri < rows.length; ri++) {
						(function (row) {
							var isOpen = openId === row.id;
							rowEls.push(React.createElement(ProviderRow, {
								key: row.id,
								spec: row,
								view: views[row.id],
								t: t,
								nowMs: nowMs,
								open: isOpen,
								onToggle: function () { toggleOpen(row.id); }
							}));
							if (isOpen) {
								rowEls.push(React.createElement(ProviderDetail, {
									key: row.id + "-detail",
									spec: row,
									view: views[row.id],
									t: t,
									nowMs: nowMs,
									fetchedAt: fetchedAt,
									refreshing: refreshing,
									onRefresh: refreshAll
								}));
							}
						})(rows[ri]);
					}
				}

				var rootProps = {
					id: "dsh-quota-status",
					ref: rootRef,
					className: dragging ? " is-dragging" : "",
					style: { transform: "translate(" + pos.dx + "px, " + pos.dy + "px)" },
					onPointerDown: onPointerDown,
					onPointerMove: onPointerMove,
					onPointerUp: onPointerUp,
					onPointerCancel: onPointerUp,
					tabIndex: 0,
					role: "group",
					"aria-label": t("title")
				};

				var extraRows = props.renderSlot(EXTRA_ROW_SLOT, { renderRow: renderExtraRow });
				return React.createElement("div", rootProps,
					React.createElement("div", { id: "dsh-quota-card" }, rowEls, extraRows));
			}

			function QuotaSettings() {
				var openState = React.useState(false);
				var open = openState[0], setOpen = openState[1];
				var specsState = React.useState(null);
				var specs = specsState[0], setSpecs = specsState[1];
				var dataState = React.useState({});
				var dataById = dataState[0], setDataById = dataState[1];
				var authState = React.useState(null);
				var auth = authState[0], setAuth = authState[1];
				var phaseState = React.useState("idle");
				var phase = phaseState[0], setPhase = phaseState[1];
				var errorState = React.useState(null);
				var error = errorState[0], setError = errorState[1];
				var localeState = React.useState(0);
				var loginStartedRef = React.useRef(0);
				var deadlineRef = React.useRef(0);

				var loadAccounts = function () {
					return Promise.all([
						ctx.connection.rpc.call(CHANNEL, "specs", null),
						ctx.connection.rpc.call(CHANNEL, "fetch-all", null)
					]).then(function (results) {
						var sr = results[0], dr = results[1];
						if (sr && sr.ok === true && sr.value) setSpecs(sr.value);
						if (dr && dr.ok === true && dr.value) {
							var map = {};
							var rows = dr.value.rows || [];
							for (var i = 0; i < rows.length; i++) map[rows[i].id] = rows[i];
							setDataById(map);
						}
					}).catch(function (cause) {
						setError(String((cause && cause.message) || cause));
					});
				};

				var loadAuth = function () {
					return ctx.connection.rpc.call(CHANNEL, "codex-auth-status", null).then(function (result) {
						if (result && result.ok === true && result.value) {
							setAuth(result.value);
							return result.value;
						}
						throw new Error(result && result.error ? result.error.message : t("fetchFailed"));
					}).catch(function (cause) {
						setError(String((cause && cause.message) || cause));
						return null;
					});
				};

				React.useEffect(function () {
					loadAccounts();
					loadAuth();
					return ctx.locale.subscribe(function () {
						localeState[1](function (value) { return value + 1; });
					});
				}, []);

				React.useEffect(function () {
					if (phase !== "waiting") return;
					var check = function () {
						loadAuth().then(function (value) {
							if (!value || phaseState[0] !== "waiting") return;
							var exitedThisRun = typeof value.loginExitAt === "number" && value.loginExitAt >= loginStartedRef.current;
							if (exitedThisRun && value.loginRunning !== true) {
								if (value.loginExitCode === 0 && value.configured === true) {
									setPhase("done");
									loadAccounts();
								} else {
									setPhase("failed");
								}
							} else if (Date.now() >= deadlineRef.current) {
								setPhase("timeout");
							}
						});
					};
					check();
					return ctx.interval(check, 2000);
				}, [phase]);

				function beginLogin() {
					setError(null);
					setPhase("waiting");
					loginStartedRef.current = Date.now();
					deadlineRef.current = loginStartedRef.current + 4 * 60 * 1000;
					ctx.connection.rpc.call(CHANNEL, "codex-login", null).then(function (result) {
						if (!(result && result.ok === true && result.value && (result.value.started || result.value.loginRunning))) {
							setPhase("failed");
						}
						loadAuth();
					}).catch(function (cause) {
						setError(String((cause && cause.message) || cause));
						setPhase("failed");
					});
				}

				var accountRows = [];
				var rows = specs ? (specs.rows || []) : [];
				for (var ri = 0; ri < rows.length; ri++) {
					var spec = rows[ri];
					var view = rowView(t, spec, dataById[spec.id]);
					var stateClass = view.status === "warn" ? "state-warn" : view.status === "error" ? "state-error" : "state-ok";
					var summary = view.value || view.sub || t("notAvailable");
					if (isUsageKind(spec.kind) && view.windows.length > 0) {
						var pieces = [];
						for (var wi = 0; wi < view.windows.length; wi++) {
							var win = view.windows[wi].window;
							pieces.push((win.key === "weekly" ? t("weeklyShort") : win.label) + " " + win.percentRemaining + "%");
						}
						summary = pieces.join(" · ");
					}
					accountRows.push(React.createElement("div", { key: spec.id, className: "qs-row " + stateClass },
						React.createElement("span", { className: "dsh-status-dot" }),
						React.createElement("span", { className: "qs-name" }, spec.label),
						React.createElement("span", { className: "qs-value" }, summary)));
				}

				var signedIn = auth && auth.configured === true;
				var authMain = signedIn
					? tplReplace(t("signedInAs"), { email: auth.email || "ChatGPT" })
					: t("notSignedIn");
				var authSub = signedIn && auth.lastRefresh
					? tplReplace(t("authUpdated"), { time: new Date(auth.lastRefresh).toLocaleString() })
					: t("gatewayNote");
				var phaseNode = null;
				if (phase === "waiting") phaseNode = React.createElement("div", { className: "qs-sub" }, t("waitingAuth"));
				else if (phase === "done") phaseNode = React.createElement("div", { className: "qs-success" }, t("loginDone"));
				else if (phase === "failed") phaseNode = React.createElement("div", { className: "qs-error" }, t("loginFailed"));
				else if (phase === "timeout") phaseNode = React.createElement("div", { className: "qs-error" }, t("loginTimeout"));

				var urlNode = auth && auth.loginUrl ? React.createElement("div", { className: "qs-sub" },
					t("loginOpened"), " ",
					React.createElement("a", { className: "qs-link", href: auth.loginUrl, target: "_blank", rel: "noreferrer" }, t("openLink"))) : null;

				var body = open ? React.createElement("div", { className: "qs-body" },
					React.createElement("section", { className: "qs-card" },
						React.createElement("div", { className: "qs-title" }, t("chatgptTitle")),
						React.createElement("div", { className: "qs-row " + (signedIn ? "state-ok" : "state-error") },
							React.createElement("span", { className: "dsh-status-dot" }),
							React.createElement("span", { className: "qs-name" }, authMain)),
						React.createElement("div", { className: "qs-sub" }, authSub),
						phaseNode,
						urlNode,
						React.createElement("div", { className: "qs-actions" },
							React.createElement("button", { className: "qs-btn", type: "button", disabled: phase === "waiting", onClick: beginLogin }, phase === "waiting" ? t("waitingAuth") : t(signedIn ? "relogin" : "login")),
							React.createElement("button", { className: "qs-btn-secondary", type: "button", onClick: function () { loadAuth(); loadAccounts(); } }, t("refreshStatus")))),
					React.createElement("section", { className: "qs-card" },
						React.createElement("div", { className: "qs-title" }, t("accountsTitle")),
						accountRows.length > 0 ? accountRows : React.createElement("div", { className: "qs-sub" }, t("loading"))),
					error ? React.createElement("div", { className: "qs-error" }, error) : null) : null;

				return React.createElement("li", { className: "dsh-quota-settings" + (open ? " is-open" : "") },
					React.createElement("button", {
						className: "qs-header",
						type: "button",
						"aria-expanded": open ? "true" : "false",
						onClick: function () { setOpen(function (value) { return !value; }); }
					},
						React.createElement("span", { className: "qs-head-text" },
							React.createElement("span", { className: "qs-title" }, t("settingsTab")),
							React.createElement("span", { className: "qs-description" }, t("settingsDescription"))),
						React.createElement("span", { className: "qs-chevron", "aria-hidden": "true" }, "⌄")),
					body);
			}

			function ProviderRow(props) {
				var t = props.t;
				var view = props.view;
				var spec = props.spec;
				var stateClass = view.status === "loading" ? "state-loading" : view.status === "warn" ? "state-warn" : view.status === "error" ? "state-error" : "state-ok";
				var valueChildren = [];
				if (isUsageKind(spec.kind) && view.windows.length > 0) {
					for (var i = 0; i < view.windows.length; i++) {
						var wv = view.windows[i];
						var win = wv.window;
						var wstate = wv.status === "error" ? "state-error" : wv.status === "warn" ? "state-warn" : "state-ok";
						if (i > 0) valueChildren.push(React.createElement("span", { key: "sep" + i, className: "dsh-value-sep" }, "·"));
						valueChildren.push(React.createElement("span", { key: win.key, className: "dsh-value-seg " + wstate },
							React.createElement("span", { className: "dsh-value-label" }, (win.key === "weekly" ? t("weeklyShort") : win.label) + " "),
							collapsedWindowValue(win, props.nowMs)));
					}
				} else {
					valueChildren.push(React.createElement("span", { key: "main", className: "dsh-value-seg " + (view.tier ? "lv-" + view.tier : stateClass) }, view.value || "—"));
				}
				if (spec.kind === "deepseek-balance") {
					var pk = peakInfo(props.nowMs);
					valueChildren.push(React.createElement("span", {
						key: "peak",
						className: "dsh-peak-pill " + (pk.offPeak ? "is-offpeak" : "is-peak"),
						title: t("peakDesc")
					}, (pk.offPeak ? "☾ " : "☀ ") + t(pk.offPeak ? "offPeak" : "peak")));
				}
				return React.createElement("div", {
					className: "dsh-provider-row " + stateClass + (view.tier ? " lv-" + view.tier : "") + (props.open ? " is-open" : ""),
					role: "button",
					tabIndex: 0,
					"aria-expanded": props.open ? "true" : "false",
					title: view.title || undefined,
					onClick: props.onToggle,
					onKeyDown: function (e) {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							props.onToggle();
						}
					}
				},
					React.createElement("span", { className: "dsh-status-dot" }),
					React.createElement("span", { className: "dsh-provider-name" }, spec.label),
					React.createElement("span", { className: "dsh-provider-value" }, valueChildren));
			}

			function DetailFoot(props) {
				return React.createElement("div", { className: "dsh-detail-foot" },
					React.createElement("span", { className: "dsh-detail-time" },
						props.fetchedAt !== null ? tplReplace(props.t("updatedAt"), { time: new Date(props.fetchedAt).toLocaleTimeString() }) : ""),
					React.createElement("button", {
						className: "dsh-detail-refresh" + (props.refreshing ? " is-loading" : ""),
						type: "button",
						"aria-label": props.t("refresh"),
						title: props.t("refresh"),
						disabled: props.refreshing,
						onClick: function () { props.onRefresh(); }
					}, "↻"));
			}

			function ExtraQuotaRow(props) {
				var row = props.row;
				var state = row.status === "ok" && row.view
					? usageState(row.view.percentRemaining, row.view.criticalPercent, row.view.warnPercent)
					: row.status === "loading" ? "loading" : "error";
				var value = "—";
				if (row.status === "loading") value = props.t("loading");
				if (row.status === "ok" && row.view) {
					value = row.view.percentRemaining + "% · " + fmtCountdown(row.view.resetAt, props.nowMs);
				}
				return React.createElement("div", {
					className: "dsh-provider-row state-" + state + (props.open ? " is-open" : ""),
					role: "button",
					tabIndex: 0,
					"aria-expanded": props.open ? "true" : "false",
					title: row.error || undefined,
					onClick: props.onToggle,
					onKeyDown: function (event) {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							props.onToggle();
						}
					}
				},
					React.createElement("span", { className: "dsh-status-dot" }),
					React.createElement("span", { className: "dsh-provider-name" }, row.label),
					React.createElement("span", { className: "dsh-provider-value" }, value));
			}

			function ExtraQuotaDetail(props) {
				var row = props.row;
				var children = [];
				if (row.status === "ok" && row.view) {
					var view = row.view;
					var state = usageState(view.percentRemaining, view.criticalPercent, view.warnPercent);
					children.push(React.createElement("div", { key: "used", className: "dsh-detail-line" },
						tplReplace(props.t("usedOfLimit"), { used: money(view.used, view.unit), limit: money(view.limit, view.unit) })));
					children.push(React.createElement("div", { key: "remaining", className: "dsh-detail-line" },
						tplReplace(props.t("remainingAmount"), { remaining: money(view.remaining, view.unit) })));
					children.push(React.createElement("div", { key: "progress", className: "dsh-progress" },
						React.createElement("div", { className: "dsh-progress-fill state-" + state, style: { width: view.percentRemaining + "%" } })));
					children.push(React.createElement("div", { key: "reset", className: "dsh-window-caption" },
						tplReplace(props.t("resetAt"), { when: fmtResetClock(view.resetAt) }) + " · "
						+ tplReplace(props.t("resetIn"), { span: fmtCountdown(view.resetAt, props.nowMs) })));
				} else {
					children.push(React.createElement("div", { key: "status", className: "dsh-detail-line" }, row.error || props.t("usageUnavailable")));
				}
				children.push(React.createElement(DetailFoot, {
					key: "foot",
					t: props.t,
					fetchedAt: row.fetchedAt,
					refreshing: row.refreshing,
					onRefresh: row.onRefresh
				}));
				return React.createElement("div", { className: "dsh-detail" }, children);
			}

			function ProviderDetail(props) {
				var t = props.t;
				var view = props.view;
				var children = [];
				if (view.kind === "deepseek-balance") {
					children.push(React.createElement("div", { key: "sub", className: "dsh-detail-line" }, view.sub || t("balanceUnavailable")));
					var pk = peakInfo(props.nowMs);
					children.push(React.createElement("div", { key: "peak-now", className: "dsh-detail-line dsh-peak-now" },
						tplReplace(t(pk.offPeak ? "offPeakNow" : "peakNow"), { span: fmtSpanMin(pk.minutesLeft) })));
				} else if (isUsageKind(view.kind)) {
					for (var i = 0; i < view.windows.length; i++) {
						var wv = view.windows[i];
						var win = wv.window;
						var wstate = wv.status === "error" ? "state-error" : wv.status === "warn" ? "state-warn" : "state-ok";
						var cap = [];
						if (win.resetAt) {
							cap.push(tplReplace(t("resetAt"), { when: fmtResetClock(win.resetAt) }));
							cap.push(tplReplace(t("resetIn"), { span: fmtCountdown(win.resetAt, props.nowMs) }));
						}
						children.push(React.createElement("div", { key: win.key, className: "dsh-window" },
							React.createElement("div", { className: "dsh-window-head" },
								React.createElement("span", null, win.key === "weekly" ? t("weekly") : win.label),
								React.createElement("span", { className: "dsh-window-value " + wstate }, tplReplace(t("remaining"), { remaining: win.remaining, limit: win.limit }))),
							React.createElement("div", { className: "dsh-progress" },
								React.createElement("div", { className: "dsh-progress-fill " + wstate, style: { width: win.percentRemaining + "%" } })),
							cap.length > 0 ? React.createElement("div", { className: "dsh-window-caption" }, cap.join(" · ")) : null));
					}
					if (view.sub) {
						children.push(React.createElement("div", { key: "sub", className: "dsh-detail-line" }, view.sub));
					}
				}
				if (children.length === 0) return null;
				children.push(React.createElement(DetailFoot, {
					key: "foot",
					t: t,
					fetchedAt: props.fetchedAt,
					refreshing: props.refreshing,
					onRefresh: props.onRefresh
				}));
				return React.createElement("div", { className: "dsh-detail" }, children);
			}

			ctx.slots.inject("shell.overlay", () => ctx.slots.register(
				{
					name: "shell.overlay",
					id: "dsh-quota-status",
					order: 120,
					label: () => t("title"),
					locale: NS,
					children: { [EXTRA_ROW_SLOT]: { kind: "list", scope: "root" } }
				},
				(props: any) => React.createElement(QuotaStatus, { t: props.t, renderSlot: props.renderSlot })
			));

			// Add one custom card to the shipped Plugin Configuration tab. Its
			// controls use our loopback RPC directly, so no OAuth secret enters
			// the browser and no core settings namespace allowlist is required.
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register(
				{ name: "settings.plugin.item", id: "quota-status", order: 40, label: () => t("settingsTab") },
				() => React.createElement(QuotaSettings, null)
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
