/**
 * College Simplified — AI Counsellor widget
 * ─────────────────────────────────────────
 * Floating chat button (bottom-right) that answers cutoff / ranking / seat
 * questions from the site's 2026 datasets via /api/cs-assistant.
 *
 * Loaded lazily by shared_auth.js after the page has finished loading, so it
 * never affects page HTML, metadata, render-blocking resources or layout (SEO-safe).
 * Public API: window.CSAssistant.open(optionalQuestion)
 */
(function () {
  'use strict';
  if (window.CSAssistant) return;

  var EXCLUDED = /(^|\/)(admin|seed|auth|coming-soon|cet_chatbot)\.html$/i;
  if (EXCLUDED.test(location.pathname)) return;

  var ENDPOINT = '/api/cs-assistant';
  var GUEST_LIMIT = 3;
  var K = { chat: 'cs_ai_chat_v1', guest: 'cs_ai_guest_answers', pending: 'cs_ai_pending', hint: 'cs_ai_hint_seen' };

  /* ───────── storage (never throws) ───────── */
  function sget(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
  function sset(store, k, v) { try { window[store].setItem(k, v); } catch (e) { /* private mode */ } }
  function sdel(store, k) { try { window[store].removeItem(k); } catch (e) { /* ignore */ } }

  function session() {
    try { if (typeof getSession === 'function') return getSession(); } catch (e) { /* ignore */ }
    try { return JSON.parse(localStorage.getItem('cs_unified_session')); } catch (e) { return null; }
  }
  function authState() {
    var s = session();
    return { signedIn: !!(s && s.id), premium: !!(s && (s.role === 'premium' || s.role === 'admin' || s.premium === true)), name: s && s.name ? String(s.name).split(' ')[0] : '' };
  }
  function guestCount() { return parseInt(sget('localStorage', K.guest) || '0', 10) || 0; }

  /* ───────── styles ───────── */
  var CSS = '' +
    ':root{--csai-brand:var(--brand,#dc2626);--csai-brand-dark:#991b1b;--csai-soft:var(--brand-soft,#fef2f2);--csai-ring:var(--brand-ring,rgba(220,38,38,.15));--csai-ink:var(--ink,#111827);--csai-muted:var(--muted,#6b7280);--csai-card:var(--card,#fff);--csai-bg:var(--bg,#fafafa);--csai-stroke:var(--stroke,rgba(0,0,0,.08))}' +
    '.csai-root,.csai-root *{box-sizing:border-box;-webkit-font-smoothing:antialiased}' +
    '.csai-root{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--csai-ink);line-height:1.5}' +
    '.csai-fab{position:fixed;right:22px;bottom:22px;z-index:590;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;display:grid;place-items:center;color:#fff;' +
      'background:linear-gradient(135deg,#ef4444 0%,var(--csai-brand) 45%,var(--csai-brand-dark) 100%);box-shadow:0 12px 28px rgba(220,38,38,.38),0 2px 6px rgba(0,0,0,.12);transition:transform .25s cubic-bezier(.4,0,.2,1),box-shadow .25s}' +
    '.csai-fab:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 16px 34px rgba(220,38,38,.45),0 2px 6px rgba(0,0,0,.12)}' +
    '.csai-fab:focus-visible{outline:3px solid var(--csai-ring);outline-offset:3px}' +
    '.csai-fab::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(220,38,38,.35);animation:csai-pulse 2.6s ease-out infinite}' +
    '.csai-fab.is-open::after{display:none}' +
    '.csai-fab svg{width:28px;height:28px;transition:transform .3s,opacity .2s}' +
    '.csai-fab .csai-x{position:absolute;opacity:0;transform:rotate(-90deg)}' +
    '.csai-fab.is-open .csai-chat{opacity:0;transform:rotate(90deg)}.csai-fab.is-open .csai-x{opacity:1;transform:rotate(0)}' +
    '.csai-badge{position:absolute;top:-2px;right:-2px;background:#fff;color:var(--csai-brand);font:800 10px/1 Lexend,Inter,sans-serif;padding:4px 6px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,.15);letter-spacing:.5px}' +
    '.csai-fab.is-open .csai-badge{display:none}' +
    '.csai-hint{position:fixed;right:92px;bottom:34px;z-index:590;background:var(--csai-card);color:var(--csai-ink);border:1px solid var(--csai-stroke);box-shadow:0 10px 25px rgba(0,0,0,.1);' +
      'padding:9px 14px;border-radius:14px 14px 4px 14px;font:600 13px/1.3 Inter,sans-serif;white-space:nowrap;cursor:pointer;animation:csai-in .35s ease both}' +
    '.csai-hint b{color:var(--csai-brand)}' +
    '.csai-panel{position:fixed;right:22px;bottom:96px;z-index:590;width:400px;height:min(640px,calc(100vh - 128px));display:flex;flex-direction:column;background:var(--csai-card);' +
      'border:1px solid var(--csai-stroke);border-radius:22px;box-shadow:0 24px 60px rgba(17,24,39,.22),0 4px 12px rgba(0,0,0,.06);overflow:hidden;transform-origin:bottom right;' +
      'opacity:0;transform:translateY(12px) scale(.96);pointer-events:none;visibility:hidden;transition:opacity .22s ease,transform .25s cubic-bezier(.4,0,.2,1),visibility 0s linear .25s}' +
    '.csai-panel.is-open{opacity:1;transform:none;pointer-events:auto;visibility:visible;transition:opacity .22s ease,transform .25s cubic-bezier(.4,0,.2,1)}' +
    '.csai-head{position:relative;display:flex;align-items:center;gap:12px;padding:16px 16px 16px 18px;color:#fff;background:linear-gradient(135deg,var(--csai-brand) 0%,var(--csai-brand-dark) 100%)}' +
    '.csai-head::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 140% at 100% 0%,rgba(255,255,255,.18) 0%,transparent 55%);pointer-events:none}' +
    '.csai-ava{flex:0 0 40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28)}' +
    '.csai-ava svg{width:22px;height:22px}' +
    '.csai-title{font:700 15.5px/1.2 Lexend,Inter,sans-serif;letter-spacing:-.01em}' +
    '.csai-sub{font-size:11.5px;opacity:.88;display:flex;align-items:center;gap:6px;margin-top:3px}' +
    '.csai-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 3px rgba(74,222,128,.25)}' +
    '.csai-hbtns{margin-left:auto;display:flex;gap:4px;position:relative;z-index:1}' +
    '.csai-ibtn{width:34px;height:34px;border-radius:10px;border:0;background:transparent;color:#fff;cursor:pointer;display:grid;place-items:center;transition:background .2s}' +
    '.csai-ibtn:hover{background:rgba(255,255,255,.16)}.csai-ibtn:focus-visible{outline:2px solid #fff;outline-offset:1px}.csai-ibtn svg{width:18px;height:18px}' +
    '.csai-body{flex:1;overflow-y:auto;padding:18px 16px 8px;background:var(--csai-bg);scroll-behavior:smooth;overscroll-behavior:contain}' +
    '.csai-body::-webkit-scrollbar{width:6px}.csai-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:6px}' +
    '.csai-msg{display:flex;margin:0 0 14px;animation:csai-in .28s ease both}' +
    '.csai-msg.user{justify-content:flex-end}' +
    '.csai-bubble{max-width:88%;padding:11px 14px;border-radius:16px;font-size:13.6px;word-wrap:break-word;overflow-wrap:anywhere}' +
    '.csai-msg.bot .csai-bubble{background:var(--csai-card);border:1px solid var(--csai-stroke);border-top-left-radius:5px;box-shadow:0 1px 2px rgba(0,0,0,.04);max-width:100%}' +
    '.csai-msg.user .csai-bubble{background:linear-gradient(135deg,var(--csai-brand),#b91c1c);color:#fff;border-top-right-radius:5px;box-shadow:0 4px 12px rgba(220,38,38,.22)}' +
    '.csai-bubble p{margin:0 0 8px}.csai-bubble p:last-child{margin-bottom:0}' +
    '.csai-bubble strong{font-weight:700}.csai-msg.bot .csai-bubble strong{color:var(--csai-ink)}' +
    '.csai-bubble ul,.csai-bubble ol{margin:4px 0 8px;padding-left:20px}.csai-bubble li{margin:3px 0}' +
    '.csai-bubble a{color:var(--csai-brand);font-weight:600;text-decoration:underline;text-underline-offset:2px}' +
    '.csai-msg.user .csai-bubble a{color:#fff}' +
    '.csai-bubble code{background:var(--csai-soft);color:var(--csai-brand-dark);padding:1px 5px;border-radius:5px;font-size:12px}' +
    '.csai-h{font:700 13.8px/1.35 Lexend,Inter,sans-serif;margin:10px 0 6px}' +
    '.csai-tw{margin:8px -4px 10px;overflow-x:auto;border:1px solid var(--csai-stroke);border-radius:12px;background:var(--csai-card)}' +
    '.csai-tw table{border-collapse:collapse;width:100%;font-size:11.8px;line-height:1.35}' +
    '.csai-tw th{background:var(--csai-soft);color:var(--csai-brand-dark);font-weight:700;text-align:left;padding:7px 9px;white-space:nowrap;border-bottom:1px solid var(--csai-ring)}' +
    '.csai-tw th,.csai-tw td{overflow-wrap:normal;word-break:normal}' +
    '.csai-tw td{padding:6px 9px;border-bottom:1px solid var(--csai-stroke);vertical-align:top;white-space:nowrap}' +
    '.csai-tw td.w{white-space:normal;min-width:150px;max-width:220px}' +
    '.csai-tw tr:last-child td{border-bottom:0}.csai-tw tbody tr:nth-child(even) td{background:rgba(0,0,0,.018)}' +
    '.csai-pill{display:inline-block;font-weight:700;font-size:10.5px;padding:2px 8px;border-radius:999px;white-space:nowrap}' +
    '.csai-pill.safe{background:#dcfce7;color:#166534}.csai-pill.likely{background:#fef3c7;color:#92400e}.csai-pill.reach{background:#fee2e2;color:#991b1b}.csai-pill.out{background:#f3f4f6;color:#4b5563}' +
    '.csai-chips{display:flex;flex-wrap:wrap;gap:7px;margin:2px 0 14px}' +
    '.csai-chip{border:1px solid var(--csai-ring);background:var(--csai-soft);color:var(--csai-brand);font:600 12.2px/1.25 Inter,sans-serif;padding:7px 11px;border-radius:999px;cursor:pointer;text-align:left;transition:all .2s}' +
    '.csai-chip:hover{background:var(--csai-brand);color:#fff;border-color:var(--csai-brand)}.csai-chip:focus-visible{outline:2px solid var(--csai-brand);outline-offset:2px}' +
    'a.csai-chip{text-decoration:none;display:inline-flex;align-items:center;gap:5px}' +
    '.csai-typing{display:inline-flex;gap:4px;padding:4px 2px}.csai-typing i{width:7px;height:7px;border-radius:50%;background:var(--csai-brand);opacity:.35;animation:csai-dot 1.2s infinite}' +
    '.csai-typing i:nth-child(2){animation-delay:.15s}.csai-typing i:nth-child(3){animation-delay:.3s}' +
    '.csai-status{font-size:11.5px;color:var(--csai-muted);margin-left:8px}' +
    '.csai-card{border-radius:16px;padding:16px;margin:2px 0 14px;text-align:center;border:1px solid var(--csai-ring);background:linear-gradient(180deg,var(--csai-soft),var(--csai-card));animation:csai-in .3s ease both}' +
    '.csai-card .csai-ci{width:44px;height:44px;margin:0 auto 10px;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--csai-brand),var(--csai-brand-dark));box-shadow:0 8px 18px rgba(220,38,38,.25)}' +
    '.csai-card .csai-ci.gold{background:linear-gradient(135deg,#fbbf24,#d97706);box-shadow:0 8px 18px rgba(217,119,6,.25)}' +
    '.csai-card .csai-ci svg{width:22px;height:22px}' +
    '.csai-card-t{font:700 15px/1.3 Lexend,Inter,sans-serif;margin-bottom:4px}.csai-card-d{font-size:12.8px;color:var(--csai-muted);margin-bottom:12px}' +
    '.csai-cta{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:11px 16px;border-radius:12px;border:0;cursor:pointer;text-decoration:none;color:#fff;' +
      'font:700 13.5px/1 Inter,sans-serif;background:linear-gradient(135deg,var(--csai-brand),var(--csai-brand-dark));box-shadow:0 8px 20px rgba(220,38,38,.25);transition:transform .2s,box-shadow .2s}' +
    '.csai-cta:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(220,38,38,.32)}' +
    '.csai-cta.gold{background:linear-gradient(135deg,#fbbf24,#d97706);box-shadow:0 8px 20px rgba(217,119,6,.25)}' +
    '.csai-cta.ghost{background:transparent;color:var(--csai-brand);box-shadow:none;border:1px solid var(--csai-ring);margin-top:8px}' +
    '.csai-foot{padding:10px 12px 12px;background:var(--csai-card);border-top:1px solid var(--csai-stroke)}' +
    '.csai-quota{font-size:11.5px;color:var(--csai-muted);margin:0 4px 8px;display:flex;justify-content:space-between;gap:8px}' +
    '.csai-quota a{color:var(--csai-brand);font-weight:700;text-decoration:none}' +
    '.csai-form{display:flex;align-items:flex-end;gap:8px;background:var(--csai-bg);border:1.5px solid var(--csai-stroke);border-radius:16px;padding:6px 6px 6px 14px;transition:border-color .2s,box-shadow .2s}' +
    '.csai-form:focus-within{border-color:var(--csai-brand);box-shadow:0 0 0 4px var(--csai-ring);background:var(--csai-card)}' +
    '.csai-input{flex:1;border:0;outline:0;background:transparent;resize:none;font:500 14px/1.45 Inter,sans-serif;color:var(--csai-ink);max-height:120px;padding:7px 0;min-height:22px}' +
    '.csai-input::placeholder{color:#9ca3af}' +
    '.csai-send{flex:0 0 38px;height:38px;border-radius:12px;border:0;cursor:pointer;color:#fff;display:grid;place-items:center;background:var(--csai-brand);transition:background .2s,transform .15s}' +
    '.csai-send:hover{background:var(--csai-brand-dark)}.csai-send:active{transform:scale(.94)}.csai-send:disabled{background:#d1d5db;cursor:not-allowed}.csai-send svg{width:18px;height:18px}' +
    '.csai-disc{font-size:10.5px;color:#9ca3af;text-align:center;margin-top:7px}' +
    /* charts: series colours validated for colour-vision deficiency; identity also carried by legend + data table */
    '.csai-viz{--v1:#dc2626;--v2:#2a78d6;--v3:#1baf7a;--v4:#6250d6;position:relative;background:var(--csai-card);border:1px solid var(--csai-stroke);border-radius:16px;padding:13px 14px 11px;margin:0 0 14px;box-shadow:0 1px 2px rgba(0,0,0,.04);animation:csai-in .28s ease both}' +
    '.csai-vt{font:700 13.2px/1.35 Lexend,Inter,sans-serif}.csai-vs{font-size:11.2px;line-height:1.4;color:var(--csai-muted);margin:2px 0 8px}' +
    '.csai-viz svg{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y}.csai-viz svg text{font:500 10.5px Inter,sans-serif;fill:var(--csai-muted)}.csai-viz svg text.ink{fill:var(--csai-ink);font-weight:700}' +
    '.csai-viz [tabindex]:focus-visible{outline:2px solid var(--csai-brand);outline-offset:2px;border-radius:6px}' +
    '.csai-leg{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0 0 8px;font-size:11.2px;line-height:1.35}.csai-leg span{display:inline-flex;align-items:center;gap:6px}.csai-leg i{flex:0 0 14px;height:3px;border-radius:2px}' +
    '.csai-grp{margin:8px 0 3px}.csai-row{display:grid;grid-template-columns:minmax(0,42%) minmax(0,1fr) 54px;gap:8px;align-items:center;padding:4px 0;border-radius:6px}.csai-row:hover{background:rgba(0,0,0,.03)}' +
    '.csai-rl{min-width:0;font-size:11.6px;line-height:1.25}.csai-rl b,.csai-rl small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.csai-rl small{-webkit-line-clamp:3}.csai-rl b{font-weight:600}.csai-rl small{font-size:10.4px;color:var(--csai-muted)}' +
    '.csai-rv{font-size:11.4px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}' +
    '.csai-trk{position:relative;height:18px}.csai-trk::before{content:"";position:absolute;left:0;right:0;top:8.5px;height:1px;background:rgba(17,24,39,.12)}' +
    '.csai-you{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--csai-ink)}' +
    '.csai-pt{position:absolute;top:4px;width:10px;height:10px;margin-left:-5px;border-radius:50%;box-shadow:0 0 0 2px var(--csai-card)}.csai-pt.reach{background:#dc2626}.csai-pt.likely{background:#b45309}.csai-pt.safe{background:#15803d}' +
    '.csai-bar .csai-row{grid-template-columns:minmax(0,40%) minmax(0,1fr)}.csai-bw{display:flex;align-items:center;gap:6px}.csai-bw i{height:14px;border-radius:0 4px 4px 0;background:var(--v1);min-width:0}.csai-bw b{font-size:11.4px;font-weight:700;white-space:nowrap}' +
    '.csai-tip{position:absolute;z-index:3;pointer-events:none;max-width:230px;background:#111827;color:#fff;border-radius:10px;padding:8px 10px;font-size:11.2px;line-height:1.4;box-shadow:0 8px 20px rgba(0,0,0,.22)}.csai-tip b{font-size:12px}.csai-tip div{display:flex;align-items:center;gap:6px;white-space:nowrap}.csai-tip div span{overflow:hidden;text-overflow:ellipsis}.csai-tip i{flex:0 0 12px;height:3px;border-radius:2px}' +
    '.csai-viz details{margin-top:8px;font-size:11.4px}.csai-viz summary{cursor:pointer;color:var(--csai-brand);font-weight:600;width:max-content}.csai-viz details .csai-tw{margin:6px 0 0}' +
    '@media (forced-colors:active){.csai-pt,.csai-you,.csai-bw i,.csai-leg i{forced-color-adjust:none}}' +
    '@keyframes csai-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '@keyframes csai-dot{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}' +
    '@keyframes csai-pulse{0%{transform:scale(.95);opacity:.9}70%{transform:scale(1.25);opacity:0}100%{opacity:0}}' +
    '@media (max-width:560px){.csai-panel{right:0;left:0;bottom:0;width:100%;height:100%;height:100dvh;border-radius:0;border:0}' +
      '.csai-fab{right:16px;bottom:16px;width:56px;height:56px}.csai-fab.is-open{display:none}.csai-hint{right:82px;bottom:26px}' +
      '.csai-head{padding-top:max(16px,env(safe-area-inset-top))}.csai-foot{padding-bottom:max(12px,env(safe-area-inset-bottom))}.csai-input{font-size:16px}}' +
    /* full-page mode (ai-counsellor.html): the panel fills its server-rendered frame */
    '.csai-root.is-page{height:100%}.csai-root.is-page .csai-panel{position:relative;left:auto;right:auto;bottom:auto;z-index:0;width:100%;height:100%;border:1px solid var(--csai-stroke);border-radius:22px;box-shadow:0 12px 32px rgba(17,24,39,.08)}' +
    '.csai-root.is-page .csai-body{padding:22px 22px 8px}.csai-root.is-page .csai-msg.bot .csai-bubble{max-width:780px}.csai-root.is-page .csai-viz{max-width:600px}.csai-root.is-page .csai-viz svg{max-width:430px}.csai-root.is-page .csai-card{max-width:460px}' +
    '@media (max-width:560px){.csai-root.is-page .csai-body{padding:16px 12px 8px}.csai-root.is-page .csai-panel{border-radius:18px}.csai-root.is-page .csai-head{padding-top:16px}}' +
    '@media (prefers-reduced-motion:reduce){.csai-root *,.csai-fab::after{animation:none!important;transition:none!important}}' +
    '@media print{.csai-root{display:none!important}}';

  var ICON = {
    chat: '<svg class="csai-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12Z"/><path d="M12 8.2l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9.9-1.9Z" fill="currentColor" stroke="none"/></svg>',
    x: '<svg class="csai-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.6L18.5 9.4l-4.7 1.8L12 16l-1.8-4.8L5.5 9.4l4.7-1.8L12 3Z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7Z"/></svg>',
  };

  var SUGGESTIONS = [
    'Which colleges can I get with 95 percentile, OBC, from Pune?',
    'COEP vs VJTI computer cutoff 2026',
    'JEE Main rank 15000, which NITs for CSE?',
    'Create my CAP round preference list',
  ];

  /* ───────── safe markdown → HTML ───────── */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function safeHref(u) {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (/^\/?[a-z0-9_\-./]+\.html([#?][^\s]*)?$/i.test(u)) return u.replace(/^\/+/, '/');
    return null;
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
      var h = safeHref(u.replace(/&amp;/g, '&'));
      if (!h) return t;
      var ext = /^https?:/i.test(h) && h.indexOf(location.host) === -1;
      return '<a href="' + esc(h) + '"' + (ext ? ' target="_blank" rel="noopener nofollow"' : '') + '>' + t + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1<em>$2</em>');
    s = s.replace(/\b(Safe|Likely|Reach|Unlikely|Out of reach(?: \(closest\))?)\b(?![^<]*>)/g, function (m) {
      var c = /^Safe/.test(m) ? 'safe' : /^Likely/.test(m) ? 'likely' : /^Reach/.test(m) ? 'reach' : 'out';
      return '<span class="csai-pill ' + c + '">' + m + '</span>';
    });
    return s;
  }
  function cells(line) { return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); }); }
  function md(src) {
    var lines = String(src || '').replace(/\r/g, '').split('\n');
    var out = [], i = 0, para = [];
    function flush() { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } }
    while (i < lines.length) {
      var l = lines[i];
      if (/^\s*\|.*\|\s*$/.test(l)) {
        flush();
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|?\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
        var head = cells(rows[0]), body = rows.slice(1).filter(function (r) { return !/^\s*\|?\s*:?-{2,}/.test(r); });
        var h = '<div class="csai-tw"><table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        // Long text cells (college names) wrap on spaces; short ones (codes, ranks) stay on one line.
        body.forEach(function (r) { h += '<tr>' + cells(r).map(function (c) { return '<td' + (c.replace(/\*|`/g, '').length > 18 ? ' class="w"' : '') + '>' + inline(c) + '</td>'; }).join('') + '</tr>'; });
        out.push(h + '</tbody></table></div>');
        continue;
      }
      var m;
      if ((m = l.match(/^\s*#{1,4}\s+(.*)$/))) { flush(); out.push('<div class="csai-h">' + inline(m[1]) + '</div>'); i++; continue; }
      if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
        flush();
        var ordered = /^\s*\d+[.)]/.test(l), items = [];
        while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, '')); i++; }
        out.push((ordered ? '<ol>' : '<ul>') + items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + (ordered ? '</ol>' : '</ul>'));
        continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { flush(); i++; continue; }
      if (!l.trim()) { flush(); i++; continue; }
      para.push(l); i++;
    }
    flush();
    return out.join('');
  }

  /* ───────── charts (drawn from server data; text is always set with textContent) ───────── */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var COLORS = ['var(--v1)', 'var(--v2)', 'var(--v3)', 'var(--v4)'];
  function num(n) { return typeof n === 'number' && isFinite(n); }
  function tx(tag, cls, t) { var e = document.createElement(tag); if (cls) e.className = cls; e.textContent = t == null ? '' : String(t); return e; }
  function sv(tag, attrs, t) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (t != null) e.textContent = t; return e; }
  function fmtV(v, metric) {
    if (!num(v)) return '–';
    if (metric === 'pct') return v.toFixed(2);
    return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  function ticks(lo, hi) {
    var span = hi - lo || 1, raw = span / 4.5, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / mag;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag, out = [];
    for (var i = Math.ceil(lo / step - 1e-9); i * step <= hi + step * 1e-9; i++) out.push(+(i * step).toFixed(6));
    return out;
  }
  function tickLabel(v, metric) {
    if (metric === 'pct') return String(+v.toFixed(3));
    return Math.abs(v) >= 10000 ? +(v / 1000).toFixed(1) + 'K' : v.toLocaleString('en-IN');
  }
  function tipFor(card) {
    var t = el('div', 'csai-tip'); t.hidden = true; card.appendChild(t);
    return {
      show: function (nodes, x, y) {
        t.textContent = ''; nodes.forEach(function (n) { t.appendChild(n); }); t.hidden = false;
        var w = card.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
        t.style.left = Math.max(6, Math.min(x - tw / 2, w - tw - 6)) + 'px';
        t.style.top = (y - th - 10 > 4 ? y - th - 10 : y + 16) + 'px';
      },
      hide: function () { t.hidden = true; },
    };
  }
  function rowTip(tip, card, row, value, full) {
    function show() {
      var c = card.getBoundingClientRect(), r = row.getBoundingClientRect();
      tip.show([tx('b', '', value), tx('span', '', ' ' + full)], r.left - c.left + r.width / 2, r.top - c.top);
    }
    row.tabIndex = 0;
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', full + ': ' + value);
    row.addEventListener('pointerenter', show); row.addEventListener('pointerleave', tip.hide);
    row.addEventListener('focus', show); row.addEventListener('blur', tip.hide);
  }
  function dataTable(head, rows) {
    var d = document.createElement('details'); d.appendChild(tx('summary', '', 'View data'));
    var w = el('div', 'csai-tw'), t = document.createElement('table'), th = document.createElement('thead'), tb = document.createElement('tbody'), tr = document.createElement('tr');
    head.forEach(function (h) { tr.appendChild(tx('th', '', h)); }); th.appendChild(tr);
    rows.forEach(function (r) { var x = document.createElement('tr'); r.forEach(function (c) { x.appendChild(tx('td', String(c).length > 18 ? 'w' : '', c)); }); tb.appendChild(x); });
    t.appendChild(th); t.appendChild(tb); w.appendChild(t); d.appendChild(w);
    return d;
  }

  function drawTrend(c, card) {
    var series = c.series.slice(0, 4).filter(function (q) { return q && q.values && q.values.some(num); });
    var all = [];
    series.forEach(function (q) { q.values.forEach(function (v) { if (num(v)) all.push(v); }); });
    if (!all.length || c.labels.length < 2) return false;
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), span = hi - lo || Math.max(Math.abs(hi) * 0.01, 0.02);
    // The student's line joins the scale only when it would not flatten the cutoffs.
    var youIn = num(c.you) && c.you >= lo - span * 1.5 && c.you <= hi + span * 1.5;
    if (youIn) { lo = Math.min(lo, c.you); hi = Math.max(hi, c.you); }
    var pad = (hi - lo || span) * 0.14; lo -= pad; hi += pad;
    if (c.metric === 'pct') hi = Math.min(hi, 100); else lo = Math.max(lo, 0);
    var rank = c.metric === 'rank', W = 340, H = 178, L = 46, R = 16, T = 10, B = 24, n = c.labels.length;
    function X(i) { return L + 10 + (W - L - R - 10) * (i / (n - 1)); }
    function Y(v) { var f = (v - lo) / (hi - lo); return rank ? T + (H - T - B) * f : T + (H - T - B) * (1 - f); }

    card.appendChild(tx('div', 'csai-vs', (c.shared || series.length === 1 ? (c.shared || series[0].name) + '. ' : '') + 'Higher on the chart = tougher to get.' + (num(c.you) && !youIn ? ' Your score (' + fmtV(c.you, c.metric) + ') is off this scale.' : '') + (c.note ? ' ' + c.note + '.' : '')));
    if (series.length > 1) {
      var leg = el('div', 'csai-leg');
      series.forEach(function (q, k) { var it = tx('span', '', ''), key = el('i'); key.style.background = COLORS[k]; it.appendChild(key); it.appendChild(document.createTextNode(q.name)); leg.appendChild(it); });
      card.appendChild(leg);
    }
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', tabindex: '0' });
    svg.setAttribute('aria-label', c.title + '. ' + series.map(function (q) { return q.full + ': ' + c.labels.map(function (l, i) { return l + ' ' + fmtV(q.values[i], c.metric); }).join(', '); }).join('. '));
    ticks(lo, hi).forEach(function (v) {
      if (rank && v < 1) return; // there is no rank 0
      svg.appendChild(sv('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: 'rgba(17,24,39,.08)', 'stroke-width': 1 }));
      svg.appendChild(sv('text', { x: L - 6, y: Y(v) + 3.5, 'text-anchor': 'end' }, tickLabel(v, c.metric)));
    });
    c.labels.forEach(function (l, i) { svg.appendChild(sv('text', { x: X(i), y: H - 6, 'text-anchor': 'middle' }, l)); });
    if (youIn) {
      svg.appendChild(sv('line', { x1: L, x2: W - R, y1: Y(c.you), y2: Y(c.you), stroke: 'var(--csai-ink)', 'stroke-width': 1.5 }));
      svg.appendChild(sv('text', { x: W - R, y: Y(c.you) - 5, 'text-anchor': 'end', 'class': 'ink' }, 'You ' + fmtV(c.you, c.metric)));
    }
    var cross = sv('line', { y1: T, y2: H - B, stroke: 'rgba(17,24,39,.35)', 'stroke-width': 1, visibility: 'hidden' });
    svg.appendChild(cross);
    series.forEach(function (q, k) {
      var d = '', pts = [];
      q.values.forEach(function (v, i) { if (num(v)) { d += (pts.length ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pts.push(i); } });
      if (pts.length > 1) svg.appendChild(sv('path', { d: d, fill: 'none', stroke: COLORS[k], 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      pts.forEach(function (i) { svg.appendChild(sv('circle', { cx: X(i), cy: Y(q.values[i]), r: 4, fill: COLORS[k], stroke: 'var(--csai-card)', 'stroke-width': 2 })); });
    });
    card.appendChild(svg);
    var tip = tipFor(card), cur = n - 1;
    function at(i) {
      cur = i;
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
      var nodes = [tx('div', '', c.labels[i])];
      series.forEach(function (q, k) {
        var r = document.createElement('div'), key = el('i'); key.style.background = COLORS[k];
        r.appendChild(key); r.appendChild(tx('b', '', fmtV(q.values[i], c.metric))); r.appendChild(tx('span', '', q.name)); nodes.push(r);
      });
      var cr = card.getBoundingClientRect(), sr = svg.getBoundingClientRect();
      // Sit beside the crosshair, above the plot, so the lines stay visible.
      tip.show(nodes, sr.left - cr.left + X(i) / W * sr.width, sr.top - cr.top + 6);
    }
    function off() { tip.hide(); cross.setAttribute('visibility', 'hidden'); }
    svg.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, b = 0;
      for (var i = 1; i < n; i++) if (Math.abs(X(i) - x) < Math.abs(X(b) - x)) b = i;
      at(b);
    });
    svg.addEventListener('pointerleave', off); svg.addEventListener('blur', off);
    svg.addEventListener('focus', function () { at(cur); });
    svg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); at(Math.max(0, cur - 1)); }
      if (e.key === 'ArrowRight') { e.preventDefault(); at(Math.min(n - 1, cur + 1)); }
    });
    card.appendChild(dataTable(['Option'].concat(c.labels), series.map(function (q) { return [q.full].concat(q.values.map(function (v) { return fmtV(v, c.metric); })); })));
    return true;
  }

  function drawFit(c, card) {
    var rows = c.rows.filter(function (r) { return r && num(r.value) && /^(Reach|Likely|Safe)$/.test(r.chance); });
    if (rows.length < 2 || !num(c.you)) return false;
    var vals = rows.map(function (r) { return r.value; }).concat([c.you]);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo || 1) * 0.06; lo -= pad; hi += pad;
    var rank = c.metric === 'rank';
    function P(v) { var f = (v - lo) / (hi - lo) * 100; return (rank ? 100 - f : f).toFixed(2) + '%'; } // right = tougher
    card.appendChild(tx('div', 'csai-vs', 'Vertical line = you (' + fmtV(c.you, c.metric) + '). Dots to its right closed tougher than your score.' + (c.note ? ' ' + c.note + '.' : '')));
    var tip = null, pend = [];
    ['Reach', 'Likely', 'Safe'].forEach(function (g) {
      var set = rows.filter(function (r) { return r.chance === g; });
      if (!set.length) return;
      var h = el('div', 'csai-grp'); h.appendChild(tx('span', 'csai-pill ' + g.toLowerCase(), g)); card.appendChild(h);
      set.forEach(function (r) {
        var row = el('div', 'csai-row'), l = el('div', 'csai-rl'), t = el('div', 'csai-trk'), y = el('span', 'csai-you'), p = el('span', 'csai-pt ' + g.toLowerCase());
        l.appendChild(tx('b', '', r.name)); l.appendChild(tx('small', '', r.sub || ''));
        y.style.left = P(c.you); p.style.left = P(r.value); t.appendChild(y); t.appendChild(p);
        row.appendChild(l); row.appendChild(t); row.appendChild(tx('div', 'csai-rv', fmtV(r.value, c.metric)));
        card.appendChild(row); pend.push([row, r]);
      });
    });
    tip = tipFor(card);
    pend.forEach(function (x) { rowTip(tip, card, x[0], fmtV(x[1].value, c.metric), x[1].full + ' (' + x[1].chance + ')'); });
    card.appendChild(dataTable(['Chance', 'Option', rank ? 'Closing rank' : 'Closing'], rows.map(function (r) { return [r.chance, r.full, fmtV(r.value, c.metric)]; })));
    return true;
  }

  function drawBars(c, card) {
    var rows = c.rows.filter(function (r) { return r && num(r.value) && r.value >= 0; });
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }));
    if (rows.length < 2 || !(max > 0)) return false;
    function V(v) { return (c.prefix || '') + fmtV(v) + (c.unit || ''); }
    if (c.note) card.appendChild(tx('div', 'csai-vs', c.note + '.'));
    var box = el('div', 'csai-bar'), tip = null, pend = [];
    rows.forEach(function (r) {
      var row = el('div', 'csai-row'), l = el('div', 'csai-rl'), w = el('div', 'csai-bw'), b = el('i');
      l.appendChild(tx('b', '', r.name));
      b.style.width = 'calc((100% - 76px) * ' + (r.value / max).toFixed(4) + ')';
      w.appendChild(b); w.appendChild(tx('b', '', V(r.value)));
      row.appendChild(l); row.appendChild(w); box.appendChild(row); pend.push([row, r]);
    });
    card.appendChild(box);
    tip = tipFor(card);
    pend.forEach(function (x) { rowTip(tip, card, x[0], V(x[1].value), x[1].full); });
    card.appendChild(dataTable(['Item', 'Value'], rows.map(function (r) { return [r.full, V(r.value)]; })));
    return true;
  }

  // Returns a card, or null. A malformed spec must never break the chat.
  function chartCard(c) {
    try {
      if (!c || typeof c !== 'object') return null;
      var card = el('div', 'csai-viz');
      card.appendChild(tx('div', 'csai-vt', c.title));
      var ok = c.type === 'trend' ? drawTrend(c, card) : c.type === 'fit' ? drawFit(c, card) : c.type === 'bars' ? drawBars(c, card) : false;
      return ok ? card : null;
    } catch (e) { return null; }
  }

  /* ───────── DOM ───────── */
  var root, fab, panel, bodyEl, input, sendBtn, quotaEl, hintEl;
  var mount = null;      // set on ai-counsellor.html, where the chat is part of the page
  var history = [];      // [{role, content, tools?, gate?}]
  var busy = false, ctrl = null;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function build() {
    mount = document.getElementById('cs-ai-page');
    var st = el('style'); st.id = 'csai-style'; st.textContent = CSS; document.head.appendChild(st);
    root = el('div', 'csai-root');
    root.setAttribute('data-nosnippet', '');

    fab = el('button', 'csai-fab', ICON.chat + ICON.x + '<span class="csai-badge">AI</span>');
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Open AI Counsellor chat');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-controls', 'csai-panel');
    fab.addEventListener('click', function () { toggle(); });

    panel = el('div', 'csai-panel');
    panel.id = 'csai-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'College Simplified AI Counsellor');
    panel.innerHTML =
      '<div class="csai-head">' +
        '<div class="csai-ava">' + ICON.spark + '</div>' +
        '<div><div class="csai-title">CS AI Counsellor</div><div class="csai-sub"><span class="csai-dot"></span>Online · 2026 cutoff data</div></div>' +
        '<div class="csai-hbtns"><button type="button" class="csai-ibtn" data-act="reset" aria-label="Start a new chat" title="New chat">' + ICON.reset + '</button>' +
        '<button type="button" class="csai-ibtn" data-act="close" aria-label="Minimise chat" title="Minimise">' + ICON.close + '</button></div>' +
      '</div>' +
      '<div class="csai-body" aria-live="polite"></div>' +
      '<div class="csai-foot">' +
        '<div class="csai-quota" hidden></div>' +
        '<form class="csai-form" autocomplete="off"><textarea class="csai-input" rows="1" maxlength="1000" placeholder="Ask about cutoffs, colleges, ranks…" aria-label="Your question"></textarea>' +
        '<button type="submit" class="csai-send" aria-label="Send">' + ICON.send + '</button></form>' +
        '<div class="csai-disc">Based on 2026 counselling data. Cutoffs change every year, so verify on official portals.</div>' +
      '</div>';

    root.appendChild(panel);
    var typed = '';
    if (mount) {
      // Replace the server-rendered frame, keeping anything already typed into it.
      var early = mount.querySelector('textarea');
      typed = early ? early.value : '';
      root.classList.add('is-page');
      panel.classList.add('is-open');
      panel.setAttribute('role', 'region');
      panel.querySelector('[data-act="close"]').remove();
      mount.textContent = '';
      mount.appendChild(root);
    } else {
      root.appendChild(fab);
      document.body.appendChild(root);
    }

    bodyEl = panel.querySelector('.csai-body');
    input = panel.querySelector('.csai-input');
    sendBtn = panel.querySelector('.csai-send');
    quotaEl = panel.querySelector('.csai-quota');

    var closeBtn = panel.querySelector('[data-act="close"]');
    if (closeBtn) closeBtn.addEventListener('click', function () { toggle(false); });
    panel.querySelector('[data-act="reset"]').addEventListener('click', resetChat);
    panel.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); if (busy) stop(); else ask(input.value); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) ask(input.value); } });
    input.addEventListener('input', autosize);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('is-open')) toggle(false); });
    bodyEl.addEventListener('click', function (e) {
      var chip = e.target.closest('button.csai-chip');
      if (chip && !busy) ask(chip.getAttribute('data-q'));
    });

    try { history = JSON.parse(sget('sessionStorage', K.chat) || '[]') || []; } catch (e) { history = []; }
    renderAll();
    if (mount) { input.value = typed; updateQuota(); autosize(); }

    // One-time hint bubble so students discover the bot.
    if (!mount && !sget('localStorage', K.hint)) {
      setTimeout(function () {
        if (panel.classList.contains('is-open')) return;
        hintEl = el('div', 'csai-hint', 'Confused about cutoffs? <b>Ask AI Counsellor</b>');
        hintEl.addEventListener('click', function () { toggle(true); });
        root.appendChild(hintEl);
        setTimeout(hideHint, 7000);
      }, 4000);
    }

    // Resume a question asked just before sign-in.
    var pend = null;
    try { pend = JSON.parse(sget('localStorage', K.pending) || 'null'); } catch (e) { pend = null; }
    if (pend && authState().signedIn && Date.now() - pend.t < 30 * 60 * 1000) {
      sdel('localStorage', K.pending);
      toggle(true);
      input.value = pend.q; autosize();
    }
  }

  function hideHint() { if (hintEl) { hintEl.remove(); hintEl = null; } sset('localStorage', K.hint, '1'); }
  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; }
  function persist() { sset('sessionStorage', K.chat, JSON.stringify(history.slice(-24))); }
  function scrollEnd() { bodyEl.scrollTop = bodyEl.scrollHeight; }

  function toggle(force) {
    if (mount) { // always open here; "open" just brings it into view
      if (force !== false) { mount.scrollIntoView({ block: 'nearest' }); input.focus({ preventScroll: true }); }
      return;
    }
    var open = typeof force === 'boolean' ? force : !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', open);
    fab.classList.toggle('is-open', open);
    fab.setAttribute('aria-expanded', String(open));
    fab.setAttribute('aria-label', open ? 'Close AI Counsellor chat' : 'Open AI Counsellor chat');
    if (open) {
      hideHint();
      updateQuota();
      setTimeout(function () { if (window.innerWidth > 560) input.focus(); scrollEnd(); }, 220);
    }
    if (window.innerWidth <= 560) document.documentElement.style.overflow = open ? 'hidden' : '';
  }

  function welcomeHTML() {
    var a = authState();
    var hi = a.name ? 'Hi ' + esc(a.name) + '! ' : 'Hi! ';
    return '<div class="csai-msg bot"><div class="csai-bubble"><p>' + hi + "I'm your <strong>AI admission counsellor</strong> 👋</p>" +
      '<p>Ask me about <strong>2026 cutoffs, college chances, seat matrix, placements</strong> or marks → percentile → rank for MHT-CET, JoSAA, CSAB, COMEDK, DSE and Manipal.</p>' +
      '<p>Tip: share your <strong>percentile/rank, category, gender and home district</strong> for an accurate prediction.</p></div></div>' +
      '<div class="csai-chips">' + SUGGESTIONS.map(function (q) { return '<button type="button" class="csai-chip" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>';
  }

  function msgNode(m) {
    if (m.gate === 'signin') return signinCard();
    var wrap = el('div', 'csai-msg ' + (m.role === 'user' ? 'user' : 'bot'));
    var b = el('div', 'csai-bubble');
    if (m.role === 'user') b.textContent = m.content; else b.innerHTML = md(m.content);
    wrap.appendChild(b);
    var frag = document.createDocumentFragment();
    frag.appendChild(wrap);
    if (m.gate === 'purchase') frag.appendChild(purchaseCard(m.url));
    if (m.role !== 'user' && Array.isArray(m.charts)) {
      m.charts.slice(0, 2).forEach(function (c) { var n = chartCard(c); if (n) frag.appendChild(n); });
    }
    if (m.tools && m.tools.length) {
      var chips = el('div', 'csai-chips');
      m.tools.slice(0, 3).forEach(function (t) {
        var h = safeHref(t.href); if (!h) return;
        var a = el('a', 'csai-chip', '↗ ' + esc(t.label)); a.href = h; chips.appendChild(a);
      });
      frag.appendChild(chips);
    }
    return frag;
  }

  function signinCard() {
    var c = el('div', 'csai-card');
    var back = location.pathname.replace(/^\//, '') + location.search;
    c.innerHTML = '<div class="csai-ci">' + ICON.lock + '</div><div class="csai-card-t">Sign in to keep chatting</div>' +
      '<div class="csai-card-d">You\'ve used your ' + GUEST_LIMIT + ' free answers. Sign in (it\'s free) for unlimited cutoff, college and rank answers.</div>' +
      '<a class="csai-cta" href="auth.html?redirect=' + encodeURIComponent(back || 'index.html') + '">Sign in / Create free account</a>';
    return c;
  }
  function purchaseCard(url) {
    var c = el('div', 'csai-card');
    var h = safeHref(url) || 'https://www.conceptsimplified.in/courses';
    c.innerHTML = '<div class="csai-ci gold">' + ICON.crown + '</div><div class="csai-card-t">Get your CAP list made by experts</div>' +
      '<div class="csai-card-d">Personalised preference list, round-by-round strategy and 1-on-1 counsellor support.</div>' +
      '<a class="csai-cta gold" href="' + esc(h) + '" target="_blank" rel="noopener">Purchase Counselling →</a>' +
      (authState().signedIn
        ? (typeof window.openClaimPremiumModal === 'function' ? '<button type="button" class="csai-cta ghost" data-act="claim">Already purchased? Link your purchase</button>' : '')
        : '<a class="csai-cta ghost" href="auth.html?redirect=' + encodeURIComponent(location.pathname.replace(/^\//, '')) + '">Already purchased? Sign in</a>');
    var claim = c.querySelector('[data-act="claim"]');
    if (claim) claim.addEventListener('click', function () { toggle(false); window.openClaimPremiumModal(); });
    return c;
  }

  function renderAll() {
    bodyEl.innerHTML = welcomeHTML();
    history.forEach(function (m) { bodyEl.appendChild(msgNode(m)); });
    scrollEnd();
  }

  function resetChat() {
    if (busy) stop();
    history = []; persist(); renderAll(); updateQuota();
    input.focus();
  }

  function updateQuota() {
    var a = authState();
    if (a.signedIn) { quotaEl.hidden = true; return; }
    var left = Math.max(0, GUEST_LIMIT - guestCount());
    quotaEl.hidden = false;
    var back = encodeURIComponent(location.pathname.replace(/^\//, '') || 'index.html');
    quotaEl.innerHTML = '<span>' + (left ? left + ' free answer' + (left === 1 ? '' : 's') + ' left' : 'Free answers used') + '</span><a href="auth.html?redirect=' + back + '">Sign in for unlimited →</a>';
  }

  function setBusy(b) {
    busy = b;
    sendBtn.innerHTML = b ? ICON.stop : ICON.send;
    sendBtn.setAttribute('aria-label', b ? 'Stop answer' : 'Send');
  }
  function stop() { if (ctrl) ctrl.abort(); }

  /* ───────── ask ───────── */
  function ask(q) {
    q = String(q || '').trim();
    if (!q || busy) return;
    var a = authState();
    input.value = ''; autosize();

    history.push({ role: 'user', content: q });
    bodyEl.appendChild(msgNode(history[history.length - 1]));

    if (!a.signedIn && guestCount() >= GUEST_LIMIT) {
      sset('localStorage', K.pending, JSON.stringify({ q: q, t: Date.now() }));
      history.push({ role: 'assistant', content: '', gate: 'signin' });
      bodyEl.appendChild(signinCard());
      persist(); scrollEnd(); updateQuota();
      return;
    }

    var wrap = el('div', 'csai-msg bot');
    var bub = el('div', 'csai-bubble', '<span class="csai-typing"><i></i><i></i><i></i></span><span class="csai-status">Checking 2026 cutoffs…</span>');
    wrap.appendChild(bub);
    bodyEl.appendChild(wrap);
    scrollEnd();

    var answer = { role: 'assistant', content: '' };
    var text = '', raf = 0, counts = true, gated = false;
    var paint = function () { raf = 0; bub.innerHTML = md(text); scrollEnd(); };

    setBusy(true);
    ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var slow = setTimeout(function () { if (!text) { var s = bub.querySelector('.csai-status'); if (s) s.textContent = 'Thinking through your options…'; } }, 6000);

    var payload = {
      messages: history.filter(function (m) { return !m.gate || m.gate === 'purchase'; }).slice(-10).map(function (m) { return { role: m.role, content: m.content }; }),
      page: location.pathname,
      auth: { signedIn: a.signedIn, premium: a.premium },
      guestAnswers: guestCount(),
    };

    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (!res.ok || !res.body) {
          return res.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || 'Request failed (' + res.status + ')'); });
        }
        var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
        function handle(ev, data) {
          var d; try { d = JSON.parse(data); } catch (e) { return; }
          if (ev === 'delta') { text += d.text || ''; if (!raf) raf = requestAnimationFrame(paint); }
          else if (ev === 'meta') { answer.tools = d.tools || []; }
          else if (ev === 'charts') { if (Array.isArray(d.charts)) answer.charts = d.charts; }
          else if (ev === 'gate') {
            gated = true;
            if (d.gate === 'signin') { answer.gate = 'signin'; }
            if (d.gate === 'purchase') { answer.gate = 'purchase'; answer.url = d.url; }
            if (d.gate === 'purchase' || d.gate === 'premium_tool') counts = false;
          } else if (ev === 'done') { if (d.counts === false) counts = false; }
          else if (ev === 'error') { text += (text ? '\n\n' : '') + (d.message || 'Something went wrong.'); }
        }
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return;
            buf += dec.decode(r.value, { stream: true });
            var idx;
            while ((idx = buf.indexOf('\n\n')) >= 0) {
              var chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
              var ev = (chunk.match(/^event: (.*)$/m) || [])[1], data = (chunk.match(/^data: (.*)$/m) || [])[1];
              if (ev && data) handle(ev, data);
            }
            return pump();
          });
        }
        return pump();
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') { if (!text) delete answer.charts; text += text ? '\n\n_(stopped)_' : '_(stopped)_'; return; }
        if (!text) delete answer.charts;
        text = text || ('Sorry, I could not reach the counsellor right now. ' + (err && err.message ? '(' + err.message + ')' : '') + ' Please try again in a moment.');
        counts = false;
      })
      .then(function () {
        clearTimeout(slow);
        if (raf) cancelAnimationFrame(raf);
        setBusy(false); ctrl = null;
        if (answer.gate === 'signin') {
          sset('localStorage', K.pending, JSON.stringify({ q: q, t: Date.now() }));
          wrap.replaceWith(signinCard());
          history.push(answer);
        } else {
          answer.content = text || 'No answer received. Please try again.';
          var node = msgNode(answer);
          wrap.replaceWith(node);
          history.push(answer);
          if (!authState().signedIn && counts && !gated && text) sset('localStorage', K.guest, String(guestCount() + 1));
        }
        persist(); updateQuota(); scrollEnd();
        if (window.innerWidth > 560) input.focus();
      });
  }

  /* ───────── init ───────── */
  function init() {
    if (document.getElementById('csai-style')) return;
    build();
    window.CSAssistant = {
      open: function (q) { toggle(true); if (q) { input.value = String(q); autosize(); } },
      close: function () { toggle(false); },
    };
  }
  window.CSAssistant = { open: function (q) { init(); window.CSAssistant.open(q); } };
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
