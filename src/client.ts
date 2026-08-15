/**
 * dsh-quota-status — client half (browser bundle, served at
 * /plugins/dsh-quota-status/client.js through the `dsh.client` manifest).
 *
 * Registers one `shell.overlay` slot entry: a collapsed capsule at the
 * bottom-right corner (`DeepSeek ¥114.50 · Kimi 周 84%`) expanding into a
 * card with per-window progress bars and live reset countdowns. Settings
 * (visibility / refresh interval / warn thresholds) are local to the
 * browser. All provider data arrives over the loopback Connection RPC
 * channel `/dsh-quota-status`; API keys never reach the browser.
 */
(window as any).__ModuleLoader__.load({
	id: "dsh-quota-status",
	factory: (require) => {
		var module = { exports: {} as any };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		var React = require("react");

		var CHANNEL = "/dsh-quota-status";
		var STORAGE_KEY = "dsh-quota-status:settings";
		var NS = "quota-status";

		var DICT = {
			zh: {
				title: "配额余量",
				expand: "展开配额余量",
				collapse: "收起配额余量",
				refresh: "刷新配额余量",
				openSettings: "打开设置",
				closeSettings: "关闭设置",
				loading: "加载中…",
				fetchFailed: "查询失败",
				missingKey: "未配置 {ref}",
				balanceUnavailable: "暂时无法获取余额",
				usageUnavailable: "暂时无法获取用量",
				allHidden: "已全部隐藏",
				emptyHint: "所有账户均已隐藏，可在设置中开启",
				updatedAt: "更新于 {time}",
				notAvailable: "当前不可用",
				balanceSub: "充值 {topped} · 赠送 {granted}",
				weekly: "周限",
				rolling5h: "5 小时",
				remaining: "剩余 {remaining}/{limit}",
				resetAt: "{when} 重置",
				resetIn: "还有 {span}",
				membership: "套餐 {level}",
				settingsTitle: "显示设置",
				settingsInterval: "刷新间隔",
				settingsThresholds: "预警阈值",
				settingsBalanceWarn: "余额预警（¥）",
				settingsUsageWarn: "余量预警（%）",
				settingsReset: "恢复默认",
				resetPosition: "恢复位置",
				localOnly: "设置仅保存在本浏览器",
				secondsSuffix: "{n} 秒",
				minutesSuffix: "{n} 分钟",
			},
			en: {
				title: "Quota",
				expand: "Expand quota",
				collapse: "Collapse quota",
				refresh: "Refresh quota",
				openSettings: "Open settings",
				closeSettings: "Close settings",
				loading: "Loading…",
				fetchFailed: "Query failed",
				missingKey: "{ref} not configured",
				balanceUnavailable: "Balance unavailable",
				usageUnavailable: "Usage unavailable",
				allHidden: "all hidden",
				emptyHint: "All accounts are hidden — re-enable them in settings",
				updatedAt: "Updated {time}",
				notAvailable: "Unavailable",
				balanceSub: "Topped-up {topped} · Granted {granted}",
				weekly: "Weekly",
				rolling5h: "5h",
				remaining: "{remaining}/{limit} left",
				resetAt: "resets {when}",
				resetIn: "{span} left",
				membership: "Plan {level}",
				settingsTitle: "Display settings",
				settingsInterval: "Refresh interval",
				settingsThresholds: "Warn thresholds",
				settingsBalanceWarn: "Balance warn",
				settingsUsageWarn: "Quota warn (%)",
				settingsReset: "Reset defaults",
				resetPosition: "Reset position",
				localOnly: "Stored in this browser only",
				secondsSuffix: "{n}s",
				minutesSuffix: "{n} min",
			}
		};

		var REFRESH_CHOICES = [15000, 30000, 60000, 120000, 300000];

		var CSS = [
			"#dsh-quota-status{position:fixed;left:0;top:0;z-index:900;display:flex;flex-direction:column;align-items:flex-end;pointer-events:auto;color:var(--dsw-alias-label-primary,#1b1b1c);font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,\"Segoe UI\",\"PingFang SC\",\"Microsoft YaHei\",sans-serif);font-size:13px;line-height:1.45;user-select:none;-webkit-user-select:none;touch-action:none;cursor:grab}",
			"#dsh-quota-status.is-dragging{cursor:grabbing}",
			"#dsh-quota-status.is-dragging #dsh-quota-capsule,#dsh-quota-status.is-dragging #dsh-quota-card{box-shadow:var(--dsw-shadow-lv3,0 12px 28px rgba(15,17,21,.16),0 4px 12px rgba(15,17,21,.1));transition:none}",
			"#dsh-quota-capsule{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 11px 0 13px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));border-radius:999px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:var(--dsw-shadow-lv2,0 4px 12px rgba(15,17,21,.02),0 2px 8px rgba(15,17,21,.04));cursor:grab;font:inherit;transition:background-color 140ms ease,border-color 140ms ease,box-shadow 140ms ease}",
			"#dsh-quota-capsule:hover{background:var(--dsw-alias-bg-overlay,#ebeef2);border-color:var(--dsw-alias-border-l2,rgba(0,0,0,.16))}",
			"#dsh-quota-capsule .dsh-capsule-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-static-neutral-bluish-400,#adb2b8)}",
			"#dsh-quota-capsule .dsh-capsule-dot.state-ok{background:var(--dsw-static-green-500,#22c55e)}",
			"#dsh-quota-capsule .dsh-capsule-dot.state-warn{background:var(--dsw-static-amber-500,#f59e0b)}",
			"#dsh-quota-capsule .dsh-capsule-dot.state-error{background:var(--dsw-static-red-500,#ef4444)}",
			"#dsh-quota-capsule .dsh-capsule-item{font-variant-numeric:tabular-nums;white-space:nowrap}",
			"#dsh-quota-capsule .dsh-capsule-item.state-loading{color:var(--dsw-alias-label-secondary,#61666b)}",
			"#dsh-quota-capsule .dsh-capsule-item.state-warn{color:var(--dsw-static-amber-500,#f59e0b)}",
			"#dsh-quota-capsule .dsh-capsule-item.state-error{color:var(--dsw-static-red-500,#ef4444)}",
			"#dsh-quota-capsule .dsh-capsule-chevron{color:var(--dsw-alias-label-tertiary,#818590);font-size:11px;line-height:1}",
			"#dsh-quota-card{width:300px;max-width:calc(100vw - 32px);margin-top:6px;padding:12px 14px 14px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));border-radius:14px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:var(--dsw-shadow-lv3,0 10px 30px rgba(15,17,21,.1),0 2px 8px rgba(15,17,21,.06));box-sizing:border-box;cursor:grab}",
			"#dsh-quota-card .dsh-quota-header{display:flex;align-items:center;justify-content:space-between;min-height:24px;margin-bottom:10px}",
			"#dsh-quota-card .dsh-quota-title{color:var(--dsw-alias-label-primary,#1b1b1c);font-size:13px;font-weight:600;letter-spacing:.01em;line-height:20px}",
			"#dsh-quota-card .dsh-quota-actions{display:flex;gap:2px;margin:-3px -4px -3px 0}",
			"#dsh-quota-card .dsh-quota-icon{display:inline-grid;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:8px;color:var(--dsw-alias-label-secondary,#61666b);background:transparent;font-size:15px;line-height:1;cursor:pointer;transition:background-color 140ms ease,color 140ms ease}",
			"#dsh-quota-card .dsh-quota-icon:hover{color:var(--dsw-alias-label-primary,#1b1b1c);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}",
			"#dsh-quota-card .dsh-quota-icon:disabled{cursor:default;opacity:.55}",
			"#dsh-quota-card .dsh-quota-icon.is-loading{animation:dsh-quota-spin .7s linear infinite}",
			"#dsh-quota-card .dsh-quota-icon.is-active{color:var(--dsw-static-deepseek-500,#4176e6);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}",
			"@keyframes dsh-quota-spin{to{transform:rotate(360deg)}}",
			"#dsh-quota-card .dsh-provider{width:100%}",
			"#dsh-quota-card .dsh-provider-main{display:flex;align-items:flex-start;gap:9px}",
			"#dsh-quota-card .dsh-status-dot{flex:none;width:7px;height:7px;margin-top:6px;border-radius:50%;background:var(--dsw-static-green-500,#22c55e)}",
			"#dsh-quota-card .state-loading .dsh-status-dot{background:var(--dsw-static-neutral-bluish-400,#adb2b8)}",
			"#dsh-quota-card .state-warn .dsh-status-dot{background:var(--dsw-static-amber-500,#f59e0b)}",
			"#dsh-quota-card .state-error .dsh-status-dot{background:var(--dsw-static-red-500,#ef4444)}",
			"#dsh-quota-card .dsh-provider-body{flex:1;min-width:0}",
			"#dsh-quota-card .dsh-provider-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}",
			"#dsh-quota-card .dsh-provider-name{overflow:hidden;color:var(--dsw-alias-label-primary,#1b1b1c);font-size:13px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}",
			"#dsh-quota-card .dsh-provider-value{flex:none;color:var(--dsw-alias-label-primary,#1b1b1c);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}",
			"#dsh-quota-card .state-warn .dsh-provider-value{color:var(--dsw-static-amber-500,#f59e0b)}",
			"#dsh-quota-card .state-error .dsh-provider-value{color:var(--dsw-static-red-500,#ef4444)}",
			"#dsh-quota-card .dsh-provider-sub{margin-top:2px;color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:17px}",
			"#dsh-quota-card .dsh-provider-sub .mono{font-variant-numeric:tabular-nums}",
			"#dsh-quota-card .dsh-window{margin-top:7px}",
			"#dsh-quota-card .dsh-window-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:17px}",
			"#dsh-quota-card .dsh-window-value{font-variant-numeric:tabular-nums;font-weight:600}",
			"#dsh-quota-card .dsh-progress{position:relative;width:100%;height:4px;margin-top:4px;overflow:hidden;border-radius:999px;background:var(--dsw-alias-bg-overlay,#ebeef2)}",
			"#dsh-quota-card .dsh-progress-fill{height:100%;width:0;border-radius:inherit;background:var(--dsw-static-green-500,#22c55e);transition:width 300ms ease,background-color 160ms ease}",
			"#dsh-quota-card .state-warn .dsh-progress-fill{background:var(--dsw-static-amber-500,#f59e0b)}",
			"#dsh-quota-card .state-error .dsh-progress-fill{background:var(--dsw-static-red-500,#ef4444)}",
			"#dsh-quota-card .dsh-window-caption{margin-top:4px;color:var(--dsw-alias-label-tertiary,#818590);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}",
			"#dsh-quota-card .dsh-quota-divider{height:1px;margin:10px 0;background:var(--dsw-alias-border-l1,rgba(0,0,0,.06))}",
			"#dsh-quota-card .dsh-quota-error{color:var(--dsw-static-red-500,#ef4444);font-size:12px;line-height:18px;word-break:break-all}",
			"#dsh-quota-card .dsh-setting-section{margin-bottom:10px}",
			"#dsh-quota-card .dsh-setting-title{margin-bottom:6px;color:var(--dsw-alias-label-primary,#1b1b1c);font-size:12px;font-weight:600;line-height:18px}",
			"#dsh-quota-card .dsh-setting-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 0;color:var(--dsw-alias-label-primary,#1b1b1c);font-size:13px;line-height:20px}",
			"#dsh-quota-card .dsh-setting-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			"#dsh-quota-card .dsh-setting-input,#dsh-quota-card .dsh-setting-select{width:104px;padding:3px 8px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.14));border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1b1b1c);font:inherit;font-size:12px;line-height:18px;box-sizing:border-box}",
			"#dsh-quota-card .dsh-setting-check{flex:none;accent-color:var(--dsw-static-deepseek-500,#4176e6)}",
			"#dsh-quota-card .dsh-setting-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.06))}",
			"#dsh-quota-card .dsh-setting-hint{color:var(--dsw-alias-label-tertiary,#818590);font-size:11px;line-height:16px}",
			"#dsh-quota-card .dsh-setting-reset{padding:3px 10px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.14));border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#61666b);font:inherit;font-size:12px;line-height:18px;cursor:pointer}",
			"#dsh-quota-card .dsh-setting-reset:hover{color:var(--dsw-alias-label-primary,#1b1b1c);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}"
		].join("\n");

		function tplReplace(template, params) {
			return String(template).replace(/\{(\w+)\}/g, function (_all, key) {
				return params && params[key] !== undefined ? String(params[key]) : "";
			});
		}

		function readSettings() {
			var base = { hidden: {}, refreshMs: null, warnBalance: null, warnUsage: null };
			try {
				var raw = globalThis.localStorage.getItem(STORAGE_KEY);
				if (raw === null) return base;
				var parsed = JSON.parse(raw);
				if (parsed && typeof parsed === "object") {
					if (parsed.hidden && typeof parsed.hidden === "object") base.hidden = parsed.hidden;
					if (typeof parsed.refreshMs === "number" && Number.isFinite(parsed.refreshMs) && parsed.refreshMs >= 5000) base.refreshMs = parsed.refreshMs;
					if (typeof parsed.warnBalance === "number" && Number.isFinite(parsed.warnBalance) && parsed.warnBalance >= 0) base.warnBalance = parsed.warnBalance;
					if (typeof parsed.warnUsage === "number" && Number.isFinite(parsed.warnUsage) && parsed.warnUsage >= 0 && parsed.warnUsage <= 100) base.warnUsage = parsed.warnUsage;
				}
			} catch (err) {}
			return base;
		}

		function writeSettings(settings) {
			try {
				globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
			} catch (err) {}
		}

		var POS_STORAGE_KEY = "dsh-quota-status:pos";
		var CARD_WIDTH = 300;
		var MARGIN = 10;

		function defaultPos() {
			return {
				x: Math.max(globalThis.innerWidth - CARD_WIDTH - 16, MARGIN),
				y: Math.max(globalThis.innerHeight - 52 - 16, MARGIN)
			};
		}

		function loadPos() {
			try {
				var raw = globalThis.localStorage.getItem(POS_STORAGE_KEY);
				if (raw !== null) {
					var saved = JSON.parse(raw);
					if (typeof saved.x === "number" && Number.isFinite(saved.x)
						&& typeof saved.y === "number" && Number.isFinite(saved.y)) {
						return { x: saved.x, y: saved.y };
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

		function clampPos(x, y, width, height) {
			return {
				x: Math.min(Math.max(x, MARGIN), Math.max(MARGIN, globalThis.innerWidth - width - MARGIN)),
				y: Math.min(Math.max(y, MARGIN), Math.max(MARGIN, globalThis.innerHeight - height - MARGIN))
			};
		}

		function isInteractiveTarget(target) {
			if (!(target instanceof Element)) return false;
			return target.closest("input,select,textarea,label,a") !== null
				|| target.closest(".dsh-quota-icon,.dsh-setting-reset,.dsh-setting-check") !== null;
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

		function money(amount, currency) {
			if (!Number.isFinite(amount)) return "—";
			var symbol = currency === "USD" ? "$" : currency === "CNY" ? "¥" : "";
			var text = amount.toFixed(2);
			return symbol ? symbol + text : text + " " + currency;
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

		/** Effective thresholds for one spec, local overrides win. */
		function effectiveThresholds(spec, settings) {
			var warnBalance = settings.warnBalance !== null ? settings.warnBalance : spec.warnBalance;
			var criticalBalance = spec.criticalBalance;
			var warnUsage = settings.warnUsage !== null ? settings.warnUsage : spec.warnUsagePercent;
			var criticalUsage = spec.criticalUsagePercent;
			return { warnBalance: warnBalance, criticalBalance: criticalBalance, warnUsage: warnUsage, criticalUsage: criticalUsage };
		}

		/** One row view model for capsule + card rendering. */
		function rowView(t, spec, entry, settings, nowMs) {
			var thresholds = effectiveThresholds(spec, settings);
			var ref = (entry && typeof entry.error === "string" && entry.error.length > 0) ? entry.error : (spec.credential || "KEY");
			var missingText = tplReplace(t("missingKey"), { ref: ref });
			if (!entry || entry.status === "missing") {
				return { kind: spec.kind, status: "error", summary: "—", value: "—", sub: missingText, windows: [], title: missingText };
			}
			if (entry.status === "error" || !entry.view) {
				return {
					kind: spec.kind, status: "error", summary: "—", value: "—",
					sub: entry.kind === "balance" || spec.kind === "deepseek-balance" ? t("balanceUnavailable") : t("usageUnavailable"),
					windows: [], title: entry.error || t("fetchFailed")
				};
			}
			if (spec.kind === "deepseek-balance" && entry.view.kind === "balance") {
				var v = entry.view;
				var status = v.available === false ? "error" : balanceState(v.amount, thresholds.criticalBalance, thresholds.warnBalance);
				return {
					kind: spec.kind,
					status: status,
					summary: money(v.amount, v.currency),
					value: money(v.amount, v.currency),
					sub: v.available === false
						? t("notAvailable")
						: tplReplace(t("balanceSub"), { topped: money(v.toppedUp, v.currency), granted: money(v.granted, v.currency) }),
					windows: [],
					title: ""
				};
			}
			if (spec.kind === "kimi-usage" && entry.view.kind === "usage") {
				var u = entry.view;
				var windows = [];
				var worst = null;
				for (var i = 0; i < u.windows.length; i++) {
					var w = u.windows[i];
					var wstatus = usageState(w.percentRemaining, thresholds.criticalUsage, thresholds.warnUsage);
					if (worst === null || w.percentRemaining < worst.window.percentRemaining) worst = { window: w, status: wstatus };
					windows.push({ window: w, status: wstatus });
				}
				var label = worst ? (worst.window.key === "weekly" ? t("weekly") : worst.window.label) : "";
				var summary = worst ? label + " " + worst.window.percentRemaining + "%" : "—";
				return {
					kind: spec.kind,
					status: worst ? worst.status : "loading",
					summary: summary,
					value: "",
					sub: u.membership ? tplReplace(t("membership"), { level: u.membership }) : "",
					windows: windows,
					title: ""
				};
			}
			return { kind: spec.kind, status: "loading", summary: "—", value: "—", sub: "", windows: [], title: "" };
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
				var expState = React.useState(false);
				var expanded = expState[0], setExpanded = expState[1];
				var setOpen = React.useState(false);
				var settingsOpen = setOpen[0], setSettingsOpen = setOpen[1];
				var refreshState = React.useState(false);
				var refreshing = refreshState[0], setRefreshing = refreshState[1];
				var settingsState = React.useState(readSettings);
				var settings = settingsState[0];
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
				posRef.current = pos;

				var updateSettings = function (next) {
					writeSettings(next);
					settingsState[1](next);
				};

				/** Keep the widget fully on-screen as capsule/card height changes. */
				React.useLayoutEffect(function () {
					var el = rootRef.current;
					if (!el) return;
					var rect = el.getBoundingClientRect();
					if (rect.width <= 0 || rect.height <= 0) return;
					setPosStateSafe(clampPos(posRef.current.x, posRef.current.y, rect.width, rect.height));
				}, [expanded, settingsOpen, dataById, specs]);

				function setPosStateSafe(next) {
					posRef.current = next;
					posState[1](next);
				}

				function onPointerDown(e) {
					if (e.button !== 0 && e.pointerType === "mouse") return;
					if (isInteractiveTarget(e.target)) return;
					if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
					dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: posRef.current.x, oy: posRef.current.y, moved: false };
					draggingState[1](true);
				}

				function onPointerMove(e) {
					var d = dragRef.current;
					if (!d || e.pointerId !== d.id) return;
					var dx = e.clientX - d.sx;
					var dy = e.clientY - d.sy;
					if (Math.abs(dx) + Math.abs(dy) > 5) {
						d.moved = true;
						suppressClickRef.current = true;
					}
					var el = rootRef.current;
					var width = el ? el.offsetWidth : CARD_WIDTH;
					var height = el ? el.offsetHeight : 44;
					setPosStateSafe(clampPos(d.ox + dx, d.oy + dy, width, height));
				}

				function onPointerUp(e) {
					var d = dragRef.current;
					if (!d || e.pointerId !== d.id) return;
					dragRef.current = null;
					draggingState[1](false);
					if (d.moved) savePos(posRef.current);
					window.setTimeout(function () { suppressClickRef.current = false; }, 0);
				}

				function onKeyDown(e) {
					if (isInteractiveTarget(e.target)) return;
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setExpanded(true);
					}
				}

				var dragProps = {
					ref: rootRef,
					className: "dsh-quota-drag",
					style: { left: pos.x + "px", top: pos.y + "px" },
					onPointerDown: onPointerDown,
					onPointerMove: onPointerMove,
					onPointerUp: onPointerUp,
					onPointerCancel: onPointerUp,
					onClick: function (e) {
						if (expanded || suppressClickRef.current || isInteractiveTarget(e.target)) return;
						setExpanded(true);
					},
					onKeyDown: onKeyDown,
					tabIndex: 0,
					role: "group",
					"aria-label": t("title")
				};

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

				var effectiveMs = settings.refreshMs !== null && settings.refreshMs !== undefined
					? settings.refreshMs
					: (specs ? specs.refreshMs : 60000);

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

				// Live countdown ticks once per second while the card is expanded.
				React.useEffect(function () {
					if (!expanded) return undefined;
					var timer = window.setInterval(function () { clockState[1](Date.now()); }, 1000);
					return function () { window.clearInterval(timer); };
				}, [expanded]);

				var rows = [];
				var views = {};
				if (specs) {
					var specRows = specs.rows || [];
					for (var si = 0; si < specRows.length; si++) {
						if (settings.hidden[specRows[si].id]) continue;
						rows.push(specRows[si]);
					}
					for (var vi = 0; vi < specRows.length; vi++) {
						views[specRows[vi].id] = rowView(t, specRows[vi], dataById[specRows[vi].id], settings, nowMs);
					}
				}

				if (!expanded) {
					var pairs = [];
					if (specs === null && loadError !== null) {
						pairs.push(React.createElement("span", { key: "err", className: "dsh-capsule-item state-error" }, "—"));
					} else if (rows.length === 0) {
						pairs.push(React.createElement("span", { key: "none", className: "dsh-capsule-item state-loading" }, t("allHidden")));
					} else {
						for (var pi = 0; pi < rows.length; pi++) {
							var rspec = rows[pi];
							var view = views[rspec.id];
							pairs.push(React.createElement("span", { key: rspec.id + "-dot", className: "dsh-capsule-dot state-" + view.status }));
							pairs.push(React.createElement("span", { key: rspec.id + "-name", className: "dsh-capsule-item state-" + view.status }, rspec.label));
							pairs.push(React.createElement("span", { key: rspec.id + "-value", className: "dsh-capsule-item state-" + view.status }, view.summary));
							if (pi < rows.length - 1) pairs.push(React.createElement("span", { key: rspec.id + "-sep", className: "dsh-capsule-item" }, "·"));
						}
					}
					pairs.push(React.createElement("span", { key: "chevron", className: "dsh-capsule-chevron" }, "▴"));
					return React.createElement("div", {
						id: "dsh-quota-status",
						ref: dragProps.ref,
						className: (dragging ? " is-dragging" : ""),
						style: dragProps.style,
						onPointerDown: dragProps.onPointerDown,
						onPointerMove: dragProps.onPointerMove,
						onPointerUp: dragProps.onPointerUp,
						onPointerCancel: dragProps.onPointerCancel,
						onClick: dragProps.onClick,
						onKeyDown: dragProps.onKeyDown,
						tabIndex: 0,
						role: "group",
						"aria-label": dragProps["aria-label"]
					},
						React.createElement("button", {
							id: "dsh-quota-capsule",
							type: "button",
							"aria-label": t("expand"),
							"aria-expanded": "false",
							onClick: function () {
								if (suppressClickRef.current) return;
								setExpanded(true);
							}
						}, pairs));
				}

				var bodyChildren = [];
				if (settingsOpen) {
					var choices = [];
					for (var ci = 0; ci < REFRESH_CHOICES.length; ci++) {
						var cv = REFRESH_CHOICES[ci];
						choices.push(React.createElement("option", { key: cv, value: String(cv) }, cv >= 60000 ? tplReplace(t("minutesSuffix"), { n: cv / 60000 }) : tplReplace(t("secondsSuffix"), { n: cv / 1000 })));
					}
					var hiddenRows = [];
					var specRows2 = specs ? (specs.rows || []) : [];
					for (var hi = 0; hi < specRows2.length; hi++) {
						(function (spec) {
							hiddenRows.push(React.createElement("div", { key: spec.id, className: "dsh-setting-row" },
								React.createElement("span", { className: "dsh-setting-name" }, spec.label),
								React.createElement("input", {
									className: "dsh-setting-check",
									type: "checkbox",
									checked: settings.hidden[spec.id] !== true,
									onChange: function (e) {
										var next = { hidden: Object.assign({}, settings.hidden) };
										if (e.target.checked) delete next.hidden[spec.id];
										else next.hidden[spec.id] = true;
										updateSettings(Object.assign({}, settings, next));
									}
								})));
						})(specRows2[hi]);
					}
					bodyChildren.push(
						React.createElement("div", { key: "s", className: "dsh-setting-section" },
							React.createElement("div", { className: "dsh-setting-title" }, t("settingsTitle")),
							React.createElement("div", { className: "dsh-setting-row" },
								React.createElement("span", { className: "dsh-setting-name" }, t("settingsInterval")),
								React.createElement("select", {
									className: "dsh-setting-select",
									value: String(effectiveMs),
									onChange: function (e) { updateSettings(Object.assign({}, settings, { refreshMs: Number(e.target.value) })); }
								}, choices)),
							hiddenRows,
							React.createElement("div", { className: "dsh-setting-row" },
								React.createElement("span", { className: "dsh-setting-name" }, t("settingsBalanceWarn")),
								React.createElement("input", {
									className: "dsh-setting-input",
									type: "number",
									min: "0",
									value: settings.warnBalance !== null ? settings.warnBalance : (specs ? specs.rows[0].warnBalance : 20),
									onChange: function (e) { updateSettings(Object.assign({}, settings, { warnBalance: Number(e.target.value) })); }
								})),
							React.createElement("div", { className: "dsh-setting-row" },
								React.createElement("span", { className: "dsh-setting-name" }, t("settingsUsageWarn")),
								React.createElement("input", {
									className: "dsh-setting-input",
									type: "number",
									min: "0",
									max: "100",
									value: settings.warnUsage !== null ? settings.warnUsage : (specs ? specs.rows[0].warnUsagePercent : 40),
									onChange: function (e) { updateSettings(Object.assign({}, settings, { warnUsage: Number(e.target.value) })); }
								})),
							React.createElement("div", { className: "dsh-setting-actions" },
								React.createElement("span", { className: "dsh-setting-hint" }, t("localOnly")),
								React.createElement("span", { style: { display: "flex", gap: "6px" } },
									React.createElement("button", { className: "dsh-setting-reset", type: "button", onClick: function () { var next = defaultPos(); setPosStateSafe(next); savePos(next); } }, t("resetPosition")),
									React.createElement("button", { className: "dsh-setting-reset", type: "button", onClick: function () { updateSettings({ hidden: {}, refreshMs: null, warnBalance: null, warnUsage: null }); } }, t("settingsReset"))
								)
							)
						)
					);
				} else if (loadError !== null) {
					bodyChildren.push(React.createElement("div", { key: "err", className: "dsh-quota-error" }, String(loadError)));
				} else if (rows.length === 0) {
					bodyChildren.push(React.createElement("div", { key: "empty", className: "dsh-provider-sub" }, t("emptyHint")));
				} else {
					for (var ri = 0; ri < rows.length; ri++) {
						if (ri > 0) bodyChildren.push(React.createElement("div", { key: rows[ri].id + "-div", className: "dsh-quota-divider" }));
						var row = rows[ri];
						var rv = views[row.id];
						bodyChildren.push(React.createElement(ProviderRow, { key: row.id, spec: row, view: rv, t: t }));
					}
					if (fetchedAt !== null) {
						bodyChildren.push(React.createElement("div", { key: "at", className: "dsh-quota-divider" }));
						bodyChildren.push(React.createElement("div", { key: "at-text", className: "dsh-window-caption" },
							tplReplace(t("updatedAt"), { time: new Date(fetchedAt).toLocaleTimeString() })));
					}
				}

				return React.createElement("div", {
					id: "dsh-quota-status",
					ref: dragProps.ref,
					className: (dragging ? " is-dragging" : ""),
					style: dragProps.style,
					onPointerDown: dragProps.onPointerDown,
					onPointerMove: dragProps.onPointerMove,
					onPointerUp: dragProps.onPointerUp,
					onPointerCancel: dragProps.onPointerCancel,
					onClick: dragProps.onClick,
					onKeyDown: dragProps.onKeyDown,
					tabIndex: 0,
					role: "group",
					"aria-label": dragProps["aria-label"]
				},
					React.createElement("div", { id: "dsh-quota-card" },
						React.createElement("div", { className: "dsh-quota-header" },
							React.createElement("div", { className: "dsh-quota-title" }, t("title")),
							React.createElement("div", { className: "dsh-quota-actions" },
								React.createElement("button", {
									className: "dsh-quota-icon" + (refreshing ? " is-loading" : ""),
									type: "button",
									"aria-label": t("refresh"),
									disabled: refreshing,
									onClick: function () { refreshAll(); }
								}, "↻"),
								React.createElement("button", {
									className: "dsh-quota-icon" + (settingsOpen ? " is-active" : ""),
									type: "button",
									"aria-label": settingsOpen ? t("closeSettings") : t("openSettings"),
									"aria-expanded": settingsOpen ? "true" : "false",
									onClick: function () { setSettingsOpen(!settingsOpen); }
								}, "⚙"),
								React.createElement("button", {
									className: "dsh-quota-icon",
									type: "button",
									"aria-label": t("collapse"),
									onClick: function () { setExpanded(false); }
								}, "▾"))),
						bodyChildren));
			}

			function ProviderRow(props) {
				var t = props.t;
				var view = props.view;
				var spec = props.spec;
				var stateClass = view.status === "loading" ? "state-loading" : view.status === "warn" ? "state-warn" : view.status === "error" ? "state-error" : "state-ok";
				var children = [];
				if (spec.kind === "kimi-usage" && view.windows.length > 0) {
					for (var i = 0; i < view.windows.length; i++) {
						var wv = view.windows[i];
						var win = wv.window;
						var wstate = wv.status === "error" ? "state-error" : wv.status === "warn" ? "state-warn" : "state-ok";
						var cap = [];
						if (win.resetAt) {
							cap.push(tplReplace(t("resetAt"), { when: fmtResetClock(win.resetAt) }));
							cap.push(tplReplace(t("resetIn"), { span: fmtCountdown(win.resetAt, Date.now()) }));
						}
						children.push(React.createElement("div", { key: win.key, className: "dsh-window" },
							React.createElement("div", { className: "dsh-window-head" },
								React.createElement("span", null, win.key === "weekly" ? t("weekly") : win.label),
								React.createElement("span", { className: "dsh-window-value " + wstate }, tplReplace(t("remaining"), { remaining: win.remaining, limit: win.limit }))),
							React.createElement("div", { className: "dsh-progress" },
								React.createElement("div", { className: "dsh-progress-fill " + wstate, style: { width: win.percentRemaining + "%" } })),
							cap.length > 0 ? React.createElement("div", { className: "dsh-window-caption" }, cap.join(" · ")) : null));
					}
				}
				return React.createElement("div", { className: "dsh-provider " + stateClass },
					React.createElement("div", { className: "dsh-provider-main" },
						React.createElement("span", { className: "dsh-status-dot" }),
						React.createElement("div", { className: "dsh-provider-body" },
							React.createElement("div", { className: "dsh-provider-head" },
								React.createElement("span", { className: "dsh-provider-name" }, spec.label),
								React.createElement("span", { className: "dsh-provider-value" }, view.value)),
							view.sub ? React.createElement("div", { className: "dsh-provider-sub" }, view.sub) : null,
							children)));
			}

			ctx.slots.inject("shell.overlay", () => ctx.slots.register(
				{ name: "shell.overlay", id: "dsh-quota-status", order: 120, label: () => t("title"), locale: NS },
				(props: any) => React.createElement(QuotaStatus, { t: props.t })
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
