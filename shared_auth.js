/**
 * College Simplified — Shared Auth & UI Module
 * ───────────────────────────────────────────
 * Handles: Session, Global UI Injection (Header/Sidebar), 
 *          Notifications, Auth Guards, and Theme.
 */

'use strict';

var AUTH_CONFIG = {
  SESSION_KEY: 'cs_unified_session',
  THEME_KEY: 'cs_theme',
  AUTH_PAGE: 'auth.html',
  HOME_PAGE: 'index.html'
};

/* ══════════════════════════════════════════
   GLOBAL UI INJECTION (NAVBAR & SIDEBAR)
   ══════════════════════════════════════════ */

function injectGlobalUI() {
  if (document.getElementById('global-ui-injected')) return;

  // 1. Inject Shared CSS
  var style = document.createElement('style');
  style.id = 'global-ui-style';
  style.innerHTML = `
    :root {
      --brand: #dc2626; --brand-soft: #fef2f2; --brand-ring: rgba(220, 38, 38, 0.15);
      --ink: #111827; --ink2: #374151; --muted: #6b7280; --bg: #fafafa;
      --card: #ffffff; --stroke: rgba(0, 0, 0, 0.08);
      --shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      --shadow-lg: 0 20px 25px -5px rgba(0,0,0,0.1);
    }
    header { background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--stroke); padding: 0 20px; position: fixed; width: 100%; top: 0; z-index: 500; height: 64px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .header-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; height: 100%; gap: 12px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .logo { font-family: 'Lexend', sans-serif; font-weight: 800; font-size: 1.25rem; color: var(--brand); text-decoration: none; display: flex; align-items: center; gap: 4px; flex-shrink: 0; line-height: 1; }
    .logo span { color: var(--ink); font-size: 1.25rem; font-weight: 800; }
    .sidebar .logo { font-size: 1.1rem; }
    .sidebar .logo span { font-size: 1.1rem; }
    
    @media (max-width: 480px) {
      .logo { font-size: 1rem; gap: 3px; }
      .logo span { font-size: 1rem; }
      .header-left { gap: 6px; }
      .header-inner { gap: 4px; padding: 0 10px; }
    }

    .header-right { display: flex; align-items: center; gap: 12px; }
    .burger { display: grid; place-items: center; background: none; border: none; cursor: pointer; width: 40px; height: 40px; border-radius: 10px; color: var(--ink); transition: 0.2s; }
    .burger:hover { background: var(--brand-soft); color: var(--brand); }

    .sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 600; display: none; backdrop-filter: blur(4px); }
    .sidebar { position: fixed; top: 0; left: -300px; width: 280px; height: 100%; background: var(--card); z-index: 900; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 24px; display: flex; flex-direction: column; gap: 32px; box-shadow: 10px 0 40px rgba(0,0,0,0.1); }
    .sidebar.open { left: 0; }
    .sidebar-overlay.open { display: block; }

    /* Desktop Collapsible State */
    @media (min-width: 1025px) {
      body.sidebar-visible .sidebar { left: 0; box-shadow: none; border-right: 1px solid var(--stroke); }
      body.sidebar-visible { padding-left: 280px; }
      body.sidebar-visible header { width: calc(100% - 280px); left: 280px; }
      .sidebar-overlay { display: none !important; }
    }

    body { transition: padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    header { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }

    .sidebar-profile { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--brand-soft); border-radius: 16px; overflow: hidden; }
    .sidebar-avatar { width: 40px; height: 40px; background: var(--brand); color: #fff; border-radius: 50%; display: grid; place-items: center; font-weight: 800; flex-shrink: 0; }
    .sidebar-user-info { overflow: hidden; min-width: 0; flex: 1; }
    .sidebar-user-name { font-weight: 700; font-size: 14px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sidebar-user-email { font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sidebar-link { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; text-decoration: none; color: var(--ink); font-weight: 600; font-size: 13px; transition: 0.2s; }
    .sidebar-link:hover { background: var(--brand-soft); color: var(--brand); }
    .sidebar-link svg { color: var(--muted); transition: 0.2s; width: 18px; height: 18px; flex-shrink: 0; }
    .sidebar-link:hover svg { color: var(--brand); }
    .sidebar-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 1.5px; padding-left: 14px; margin-top: 12px; margin-bottom: 4px; }
    
    /* Dropdown Styles */
    .sidebar-dropdown { display: flex; flex-direction: column; gap: 2px; }
    .dropdown-content { display: none; flex-direction: column; gap: 2px; padding-left: 32px; border-left: 1.5px solid var(--stroke); margin-left: 22px; margin-top: 4px; margin-bottom: 8px; }
    .dropdown-content.active { display: flex; animation: slideDown 0.3s ease-out; }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    .sidebar-sub-link { display: flex; align-items: center; padding: 8px 12px; border-radius: 10px; text-decoration: none; color: var(--muted); font-size: 12.5px; font-weight: 600; transition: 0.2s; }
    .sidebar-sub-link:hover { color: var(--brand); background: var(--brand-soft); }
    .dropdown-toggle .chevron { margin-left: auto; transition: transform 0.3s; }
    .dropdown-toggle.active .chevron { transform: rotate(180deg); }

    .sidebar-logout { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; border: 1.5px solid var(--stroke); background: none; width: 100%; cursor: pointer; font-weight: 600; color: var(--muted); font-family: inherit; transition: 0.2s; }
    .sidebar-logout:hover { border-color: var(--brand); color: var(--brand); }

    .sidebar-enquiry-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1.5px solid rgba(184, 134, 11, 0.25);
      background: #fef9e7;
      color: #b8860b;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      font-family: inherit;
      transition: all 0.2s ease-in-out;
      width: 100%;
      box-shadow: 0 2px 4px rgba(184, 134, 11, 0.08);
      box-sizing: border-box;
    }
    .sidebar-enquiry-btn:hover {
      background: #fff3cd;
      color: #966b04;
      border-color: rgba(184, 134, 11, 0.45);
      box-shadow: 0 4px 12px rgba(184, 134, 11, 0.15);
      transform: translateY(-1px);
    }
    .sidebar-enquiry-btn svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: #b8860b;
      transition: 0.2s;
    }
    .sidebar-enquiry-btn:hover svg {
      color: #966b04;
    }

    .notif-dropdown-ui { position: absolute; right: 0; top: calc(100% + 12px); width: 340px; max-height: 480px; overflow-y: auto; background: var(--card); border: 1px solid var(--stroke); border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); z-index: 9999; display: none; padding: 8px; }
    .notif-dropdown-ui.show { display: block; animation: navPop 0.2s ease-out; }
    @keyframes navPop { from { opacity: 0; transform: scale(0.95) translateY(-10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @media (max-width: 1024px) {

      .desktop-only { display: none; }
      .burger { display: block; }
      .notif-dropdown-ui { position: fixed; top: 72px; right: 10px; width: calc(100vw - 20px); max-width: 380px; }
    }

    .export-btn-group {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .export-csv-btn, .export-pdf-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: var(--card);
      border: 1.5px solid var(--stroke);
      border-radius: 10px;
      color: var(--ink);
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .export-csv-btn:hover, .export-pdf-btn:hover {
      background: var(--brand-soft);
      border-color: var(--brand);
      color: var(--brand);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px var(--brand-ring);
    }
    .export-csv-btn svg, .export-pdf-btn svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    /* Claim Premium Access Button Styles */
    .claim-premium-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 16px 32px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff !important;
      text-decoration: none;
      border-radius: 14px;
      font-weight: 800;
      border: none;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);
      font-family: 'Lexend', sans-serif;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      margin-top: 12px;
    }
    .claim-premium-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(37, 99, 235, 0.35);
      background: linear-gradient(135deg, #3b82f6, #2563eb);
    }
    @media (min-width: 481px) {
      .claim-premium-btn {
        margin-left: 12px;
        margin-top: 0;
      }
    }
    @media (max-width: 480px) {
      .claim-premium-btn {
        padding: 12px 24px;
        font-size: 13px;
        width: 100%;
        justify-content: center;
      }
    }

    /* Lock Button Group Layout */
    .lock-btn-group {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-top: 20px;
      width: 100%;
    }
    .lock-btn-group .claim-premium-btn {
      margin-left: 0 !important;
      margin-top: 0 !important;
    }
    @media (max-width: 480px) {
      .lock-btn-group {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      .lock-btn-group .unlock-btn,
      .lock-btn-group .cap-unlock-btn,
      .lock-btn-group .claim-premium-btn {
        width: 100% !important;
        justify-content: center;
        text-align: center;
        margin: 0 !important;
      }
    }

    /* Verification Claim Modal Styles */
    .cs-claim-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 999999;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
      padding: 20px;
    }
    .cs-claim-modal.show {
      display: flex;
      opacity: 1;
    }
    .cs-claim-modal-content {
      background: var(--card, #ffffff);
      border: 1px solid var(--stroke, rgba(0,0,0,0.08));
      border-radius: 24px;
      width: 100%;
      max-width: 460px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      transform: scale(0.9) translateY(20px);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      padding: 32px;
      box-sizing: border-box;
    }
    .cs-claim-modal.show .cs-claim-modal-content {
      transform: scale(1) translateY(0);
    }
    .cs-claim-close-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid var(--stroke, rgba(0,0,0,0.08));
      color: #111827;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      transition: all 0.2s;
    }
    .cs-claim-close-btn:hover {
      background: var(--brand-soft, #fef2f2);
      color: var(--brand, #dc2626);
      transform: scale(1.05);
    }
    .cs-claim-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .cs-claim-icon-container {
      width: 64px;
      height: 64px;
      background: #eff6ff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .cs-claim-title {
      font-family: 'Lexend', sans-serif;
      font-weight: 800;
      font-size: 20px;
      color: var(--ink, #111827);
      margin-bottom: 8px;
      margin-top: 0;
    }
    .cs-claim-desc {
      color: var(--muted, #6b7280);
      font-size: 13px;
      line-height: 1.5;
      margin: 0;
    }
    .cs-claim-field {
      margin-bottom: 18px;
      text-align: left;
    }
    .cs-claim-field label {
      display: block;
      font-size: 12.5px;
      font-weight: 700;
      color: var(--ink2, #374151);
      margin-bottom: 6px;
    }
    .cs-claim-field input {
      width: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      border: 1.5px solid var(--stroke, rgba(0, 0, 0, 0.08));
      background: var(--bg, #fafafa);
      color: var(--ink, #111827);
      font-family: inherit;
      font-size: 14px;
      outline: none;
      transition: all 0.2s;
      box-sizing: border-box;
    }
    .cs-claim-field input:focus {
      border-color: #2563eb;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    .cs-claim-submit-btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-family: 'Lexend', sans-serif;
      font-weight: 800;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(29, 78, 216, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 24px;
      box-sizing: border-box;
    }
    .cs-claim-submit-btn:hover {
      background: linear-gradient(135deg, #1d4ed8, #1e40af);
      transform: translateY(-1px);
    }
    .cs-claim-submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .cs-claim-error {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      color: #b91c1c;
      padding: 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 18px;
      text-align: left;
      line-height: 1.4;
    }
    .cs-claim-success {
      background: #f0fdf4;
      border: 1px solid #86efac;
      color: #15803d;
      padding: 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 18px;
      text-align: left;
      line-height: 1.4;
    }
    .cs-btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: cs-spin-modal 0.8s linear infinite;
    }
    @keyframes cs-spin-modal {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // 2. Inject HTML
  var headerHtml = `
    <header id="global-header">
      <div class="header-inner">
        <div class="header-left">
          <button class="burger" onclick="toggleSidebar()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <a class="logo" href="index.html">College <span>Simplified</span></a>
        </div>
        <div class="header-right">
          <div id="notifBellWrap"></div>
        </div>
      </div>
    </header>
  `;

  var sidebarHtml = `
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
    <aside class="sidebar" id="sidebar">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <a class="logo" href="index.html">College <span>Simplified</span></a>
        <button onclick="closeSidebar()" style="background:none;border:none;cursor:pointer;color:var(--muted)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="sidebar-user-area" style="display:flex;flex-direction:column;gap:12px">
        <div id="sidebarProfile"></div>
        <div id="sidebarLogout"></div>
        <div id="sidebarEnquiry">
          <a href="https://forms.gle/E5PYRE6bE6pZVvn39" target="_blank" class="sidebar-enquiry-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Management Seats Enquiry
          </a>
        </div>
      </div>
      <nav style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;padding-right:4px">
        <div class="sidebar-label">Navigation</div>
        <a href="index.html" class="sidebar-link"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> Home</a>
        
        <div class="sidebar-label">Counselling</div>
        <div class="sidebar-dropdown">
          <button class="sidebar-link dropdown-toggle" style="background:none;border:none;width:100%;cursor:pointer" onclick="toggleDropdown('cet')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
            MHT-CET Hub
            <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dropdown-content" id="drop-cet">
            <a href="cet-landing.html" class="sidebar-sub-link">Hub Overview</a>
            <a href="cet_marks.html" class="sidebar-sub-link">Marks vs Percentile</a>
            <a href="cet_rank.html" class="sidebar-sub-link">Percentile vs Rank</a>
            <a href="college_explorer.html" class="sidebar-sub-link">College Explorer & Cutoffs</a>
            <a href="cet_colleges.html" class="sidebar-sub-link">Top Colleges</a>
            <a href="compare_colleges.html" class="sidebar-sub-link">Compare Colleges</a>
            <a href="mht_cet_college_predictor.html" class="sidebar-sub-link">MHT CET College Predictor</a>
            <a href="Branch.html" class="sidebar-sub-link">Branch Prediction Test</a>
            <a href="percentile_vs_college_predictor.html" class="sidebar-sub-link">JEE ALL INDIA Predictor</a>
            <a href="document_checklist.html" class="sidebar-sub-link">Document Checklist</a>
            <a href="preference-builder.html" class="sidebar-sub-link">CET Preference Builder</a>
          </div>
        </div>

        <div class="sidebar-dropdown">
          <button class="sidebar-link dropdown-toggle" style="background:none;border:none;width:100%;cursor:pointer" onclick="toggleDropdown('dse')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>
            DSE Hub (Diploma)
            <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dropdown-content" id="drop-dse">
            <a href="dse-landing.html" class="sidebar-sub-link">Hub Overview</a>
            <a href="dse_cutoff_checker.html" class="sidebar-sub-link">Cutoff Checker</a>
            <a href="dse_college_predictor.html" class="sidebar-sub-link">College Predictor</a>
            <a href="dse_compare_colleges.html" class="sidebar-sub-link">Compare Colleges</a>
            <a href="Branch.html" class="sidebar-sub-link">Branch Prediction Test</a>
            <a href="dse-preference-builder.html" class="sidebar-sub-link">DSE Preference Builder</a>
          </div>
        </div>

        <div class="sidebar-dropdown">
          <button class="sidebar-link dropdown-toggle" style="background:none;border:none;width:100%;cursor:pointer" onclick="toggleDropdown('josaa')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
            JOSAA Hub
            <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dropdown-content" id="drop-josaa">
            <a href="josaa-landing.html" class="sidebar-sub-link">Hub Overview</a>
            <a href="josaa_marks.html" class="sidebar-sub-link">JEE Marks vs Rank</a>
            <a href="josaa_rank.html" class="sidebar-sub-link">JEE Percentile vs Rank</a>
            <a href="josaa.html" class="sidebar-sub-link">JOSAA Predictor</a>
            <a href="josaa_cutoff.html" class="sidebar-sub-link">JOSAA Cutoff Checker</a>
            <a href="Branch.html" class="sidebar-sub-link">Branch Prediction Test</a>
            <a href="josaa-preference-builder.html" class="sidebar-sub-link">JOSAA Pref Builder</a>
          </div>
        </div>

        <div class="sidebar-dropdown">
          <button class="sidebar-link dropdown-toggle" style="background:none;border:none;width:100%;cursor:pointer" onclick="toggleDropdown('csab')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            CSAB Hub
            <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dropdown-content" id="drop-csab">
            <a href="csab-landing.html" class="sidebar-sub-link">Hub Overview</a>
            <a href="csab.html" class="sidebar-sub-link">CSAB Predictor</a>
            <a href="Branch.html" class="sidebar-sub-link">Branch Prediction Test</a>
          </div>
        </div>

        <div class="sidebar-dropdown">
          <button class="sidebar-link dropdown-toggle" style="background:none;border:none;width:100%;cursor:pointer" onclick="toggleDropdown('comedk')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            COMEDK Hub
            <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="dropdown-content" id="drop-comedk">
            <a href="comedk-landing.html" class="sidebar-sub-link">Hub Overview</a>
            <a href="comedk_predictor.html" class="sidebar-sub-link">COMEDK Predictor</a>
            <a href="comedk_cutoff.html" class="sidebar-sub-link">COMEDK Cutoff Checker</a>
            <a href="Branch.html" class="sidebar-sub-link">Branch Prediction Test</a>
            <a href="comedk-preference-builder.html" class="sidebar-sub-link">COMEDK Preference Builder</a>
          </div>
        </div>

        <a href="manipal_cutoff.html" class="sidebar-link"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg> Manipal MET</a>
        
        <div class="sidebar-label">Tools</div>
        <a href="Branch.html" class="sidebar-link"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg> Branch Prediction Test</a>
        <a href="document_checklist.html" class="sidebar-link"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Document Checklist</a>
        <a href="calendar.html" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Event Calendar</a>
        <a href="non-cap-admissions.html" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> NON-CAP Admissions</a>
        <a href="index.html#latest-notices" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Latest Notices</a>


      </nav>
    </aside>
    <div id="global-ui-injected" style="display:none"></div>
  `;

  // Inject the Claim Premium verification modal HTML
  var claimModalHtml = `
    <div id="cs-claim-premium-modal" class="cs-claim-modal">
      <div class="cs-claim-modal-content">
        <button class="cs-claim-close-btn" onclick="window.closeClaimPremiumModal()">&times;</button>
        <div class="cs-claim-header">
          <div class="cs-claim-icon-container">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 11l2 2 4-4"/>
            </svg>
          </div>
          <h2 class="cs-claim-title">Link Purchase / Grant Access</h2>
          <p class="cs-claim-desc">Enter the email and phone number used during payment to link your premium benefits to this account.</p>
        </div>
        
        <div id="cs-claim-error-msg" class="cs-claim-error" style="display:none;"></div>
        <div id="cs-claim-success-msg" class="cs-claim-success" style="display:none;"></div>

        <form id="cs-claim-premium-form" onsubmit="window.submitClaimPremium(event)">
          <div class="cs-claim-field">
            <label for="cs-claim-email">Purchase Email Address</label>
            <input type="email" id="cs-claim-email" required placeholder="e.g. buyer@example.com">
          </div>
          <div class="cs-claim-field">
            <label for="cs-claim-phone">Purchase Phone Number (used as password)</label>
            <input type="text" id="cs-claim-phone" required placeholder="e.g. 9876543210">
          </div>
          <button type="submit" id="cs-claim-submit-btn" class="cs-claim-submit-btn">
            <span class="btn-text">Validate & Activate Premium</span>
            <div class="cs-btn-spinner" style="display:none;"></div>
          </button>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('afterbegin', headerHtml + sidebarHtml + claimModalHtml);
}

window.toggleDropdown = function (id) {
  var content = document.getElementById('drop-' + id);
  var btn = content.previousElementSibling;
  content.classList.toggle('active');
  btn.classList.toggle('active');
};

window.toggleSidebar = function () {
  if (window.innerWidth > 1024) {
    var isVis = document.body.classList.toggle('sidebar-visible');
    localStorage.setItem('cs_sidebar_pref', isVis);
  } else {
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebarOverlay');
    var isOpen = sb.classList.toggle('open');
    ov.classList.toggle('open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }
};

window.closeSidebar = function () {
  if (window.innerWidth > 1024) {
    document.body.classList.remove('sidebar-visible');
    localStorage.setItem('cs_sidebar_pref', 'false');
  } else {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }
};

function populateSidebar() {
  var user = getSession();
  var prof = document.getElementById('sidebarProfile');
  var log = document.getElementById('sidebarLogout');
  var adm = document.getElementById('adminArea');

  if (user) {
    log.style.display = '';
    var ini = (user.name || 'U').charAt(0).toUpperCase();
    var badgeHtml = '';
    var avatarStyle = '';
    if (user.role === 'admin') {
      badgeHtml = `<span style="font-size:9px; font-weight:800; color:var(--brand); background:var(--brand-soft); border:1px solid var(--brand-ring); padding:1px 6px; border-radius:100px; text-transform:uppercase; letter-spacing:0.5px; flex-shrink:0;">Admin</span>`;
    } else if (user.role === 'premium') {
      badgeHtml = `<span style="font-size:9px; font-weight:800; color:#b8860b; background:#fef9e7; border:1px solid rgba(184,134,11,0.25); padding:1px 6px; border-radius:100px; text-transform:uppercase; letter-spacing:0.5px; flex-shrink:0;">Premium</span>`;
      avatarStyle = `style="background:linear-gradient(135deg,#fbbf24,#d97706); box-shadow:0 0 8px rgba(217,119,6,0.3);"`;
    }

    prof.innerHTML = `
      <div class="sidebar-profile">
        <div class="sidebar-avatar" ${avatarStyle}>${ini}</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
            ${escAuth(user.name)} ${badgeHtml}
          </div>
          <div class="sidebar-user-email">${escAuth(user.email || '')}</div>
        </div>
      </div>`;

    if (user.role === 'admin') {
      var aLink = document.createElement('a');
      aLink.href = 'admin.html'; aLink.className = 'sidebar-link';
      aLink.style.background = 'var(--brand-soft)'; aLink.style.color = 'var(--brand)';
      aLink.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Admin Panel';
      prof.after(aLink);

      if (adm) adm.innerHTML = '<button onclick="location.href=\'admin.html\'" style="padding:8px 16px; border-radius:12px; font-size:13px; font-weight:700; color:#fff; background:var(--brand); border:none; cursor:pointer">Admin</button>';
    }

    log.innerHTML = '<button class="sidebar-logout" onclick="doLogout()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Logout</button>';
  } else {
    prof.innerHTML = '<a href="' + AUTH_CONFIG.AUTH_PAGE + '" class="sidebar-link" style="background:var(--brand);color:#fff;justify-content:center">Login / Register</a>';
    log.style.display = 'none';
  }
}

async function renderSidebarNotifs() {
  var wrap = document.getElementById('sidebarNotifBell'); if (!wrap) return;
  var user = getSession();
  if (!user) { wrap.innerHTML = '<div style="font-size:12px;color:var(--muted)">Login to see updates</div>'; return; }

  var res = await authApi('getNotifications', { email: user.email });
  var notifs = (res.ok ? res.data : []) || [];
  var del = getNotifDeleted(); notifs = notifs.filter(n => del.indexOf(n.id) < 0);
  if (!notifs.length) { wrap.innerHTML = '<div style="font-size:12px;color:var(--muted)">No new updates</div>'; return; }

  var read = getNotifRead();
  wrap.innerHTML = notifs.slice(0, 3).map(n => {
    var isRead = read.indexOf(n.id) >= 0;
    return `<div style="padding:10px 0;border-bottom:1px solid var(--stroke);font-size:12px;color:var(--ink2)">
      <div style="font-weight:700;display:flex;align-items:center;gap:6px">${isRead ? '' : '<span style="width:6px;height:6px;background:var(--brand);border-radius:50%"></span>'}${escAuth(n.title)}</div>
      <div style="color:var(--muted);margin-top:2px">${escAuth(n.message)}</div>
    </div>`;
  }).join('') + '<a href="#" onclick="toggleNotifDropdown();closeSidebar()" style="display:block;padding-top:10px;font-size:11px;font-weight:700;color:var(--brand);text-decoration:none">View All Notifications →</a>';
}

/* ══════════════════════════════════════════
   SESSION & API
   ══════════════════════════════════════════ */

function getSession() { try { return JSON.parse(localStorage.getItem(AUTH_CONFIG.SESSION_KEY)); } catch (e) { return null; } }
function setSession(user) { localStorage.setItem(AUTH_CONFIG.SESSION_KEY, JSON.stringify(user)); }
function clearSession() { localStorage.removeItem(AUTH_CONFIG.SESSION_KEY); }
function isLoggedIn() { return !!getSession(); }
function doLogout() { 
  clearSession(); 
  if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function') {
    firebase.auth().signOut().catch(console.error);
  }
  window.location.href = AUTH_CONFIG.HOME_PAGE; 
}
function escAuth(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

async function authApi(action, payload) {
  // Proxy to Firestore-based API (firebase_config.js)
  if (typeof fireApi === 'function') {
    return await fireApi(action, payload || {});
  }
  return { ok: false, error: 'Firebase not loaded. Include firebase_config.js before shared_auth.js.' };
}

/* ══════════════════════════════════════════
   INITIALIZATION
   ══════════════════════════════════════════ */

function initAuth(opts) {
  opts = opts || {};

  // Handle reset redirection if params are present in URL of any page
  var params = new URLSearchParams(window.location.search);
  if (params.has('reset') && params.has('email')) {
    if (!window.location.pathname.endsWith('auth.html')) {
      window.location.href = 'auth.html' + window.location.search;
      return null;
    }
  }

  injectGlobalUI();

  // Desktop Sidebar State Restore
  if (window.innerWidth > 1024) {
    var pref = localStorage.getItem('cs_sidebar_pref');
    if (pref === 'true' || pref === null) {
      document.body.classList.add('sidebar-visible');
    }
  }

  populateSidebar();
  renderNotifBell();
  renderSidebarNotifs();
  initTheme();
  renderAuthUI();

  var session = getSession();

  // Sync user status from Firestore in background to allow instant premium access without relogin
  if (session && session.id && typeof db !== 'undefined') {
    db.collection('users').doc(session.id).get().then(function(doc) {
      if (doc.exists) {
        var userData = doc.data();
        var updated = false;

        // Sync role
        if (userData.role !== session.role) {
          session.role = userData.role;
          updated = true;
        }

        // Sync premium status (role === 'premium' or role === 'admin' or premium === true)
        var livePremium = userData.premium === true || userData.role === 'premium' || userData.role === 'admin';
        var cachedPremium = session.premium === true || session.role === 'premium' || session.role === 'admin';
        if (livePremium !== cachedPremium) {
          session.premium = livePremium;
          updated = true;
        }

        // Sync other profile info
        if (userData.name && userData.name !== session.name) {
          session.name = userData.name;
          updated = true;
        }
        if (userData.email && userData.email !== session.email) {
          session.email = userData.email;
          updated = true;
        }

        if (updated) {
          setSession(session);
          populateSidebar();
          renderAuthUI();

          // Hide or show premium banners depending on the updated status
          var isNowPremium = session.role === 'premium' || session.premium === true || session.role === 'admin';
          var banners = document.querySelectorAll('.premium-banners-section');
          banners.forEach(function(el) {
            el.style.display = isNowPremium ? 'none' : '';
          });

          // Reload the page to unlock tools/predictors with the new state
          window.location.reload();
        }
      }
    }).catch(function(err) {
      console.error('Error syncing user session with Firestore:', err);
    });
  }

  var isPremium = session && (session.role === 'premium' || session.premium === true);
  if (isPremium) {
    var hidePremiumElements = function() {
      var banners = document.querySelectorAll('.premium-banners-section');
      banners.forEach(function(el) {
        el.style.display = 'none';
      });
    };
    hidePremiumElements();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hidePremiumElements);
    }
  }

  if (opts.requireLogin && !session) {
    var container = opts.toolContainerId ? document.getElementById(opts.toolContainerId) : null;
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:100px 20px">
          <div style="color:var(--brand);margin-bottom:24px"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <h2 style="font-family:Lexend,sans-serif;font-weight:800;font-size:28px;margin-bottom:12px">Access Restricted</h2>
          <p style="color:var(--muted);max-width:400px;margin:0 auto 32px;line-height:1.6">Please sign in to your account to access our premium counselling tools and predictions.</p>
          <a href="${AUTH_CONFIG.AUTH_PAGE}" style="display:inline-flex;align-items:center;gap:10px;padding:16px 32px;background:var(--brand);color:#fff;text-decoration:none;border-radius:14px;font-weight:800;box-shadow:0 8px 20px var(--brand-ring)">Sign In Now →</a>
        </div>`;
    }
    return null;
  }

  // Check if premium is required and user is not premium/admin
  if (session && opts.requirePremium) {
    var isPremium = session.role === 'premium' || session.premium === true || session.role === 'admin';
    if (!isPremium) {
      var container = opts.toolContainerId ? document.getElementById(opts.toolContainerId) : null;
      if (container) {
        var title = opts.premiumTitle || 'Premium Feature Locked';
        var desc = opts.premiumDescription || 'This advanced preference list builder is reserved for Premium members. Upgrade your account or link your purchase to unlock unlimited choices, expert templates, and custom PDF exports.';
        container.innerHTML = `
          <div style="text-align:center;padding:100px 20px;max-width:550px;margin:0 auto">
            <div style="width:80px;height:80px;background:#fef9e7;border-radius:50%;display:grid;place-items:center;margin:0 auto 24px;box-shadow:0 8px 16px rgba(184,134,11,0.15)">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#b8860b" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
              </svg>
            </div>
            <h2 style="font-family:Lexend,sans-serif;font-weight:800;font-size:28px;margin-bottom:12px;color:var(--ink)">${title}</h2>
            <p style="color:var(--muted);margin-bottom:32px;line-height:1.6;font-size:15px">${desc}</p>
            <div class="lock-btn-group" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
              <a href="https://www.conceptsimplified.in/courses" target="_blank" class="claim-premium-btn" style="margin:0 !important;background:linear-gradient(135deg,#fbbf24,#d97706);box-shadow:0 8px 20px rgba(217,119,6,0.25)">Upgrade to Premium →</a>
              <button onclick="window.openClaimPremiumModal()" class="claim-premium-btn" style="margin:0 !important">Link Purchase / Grant Access</button>
            </div>
          </div>`;
      }
      return null;
    }
  }

  startUpgradeButtonObserver();
  initAdPopup();
  return session || { guest: true };
}

function initTheme() { var t = localStorage.getItem(AUTH_CONFIG.THEME_KEY) || 'light'; document.documentElement.setAttribute('data-theme', t); }

/* ══════════════════════════════════════════
   NOTIFICATIONS BELL
   ══════════════════════════════════════════ */

var NOTIF_READ_KEY = 'cs_notif_read';
var NOTIF_DEL_KEY = 'cs_notif_deleted';
function getNotifRead() { try { return JSON.parse(localStorage.getItem(NOTIF_READ_KEY)) || []; } catch (e) { return []; } }
function getNotifDeleted() { try { return JSON.parse(localStorage.getItem(NOTIF_DEL_KEY)) || []; } catch (e) { return []; } }
function setNotifRead(arr) { localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(arr)); }
function setNotifDeleted(arr) { localStorage.setItem(NOTIF_DEL_KEY, JSON.stringify(arr)); }

function markAllNotifRead() {
  var items = document.querySelectorAll('.notif-drop-item');
  var readArr = getNotifRead();
  items.forEach(function (el) { var id = el.getAttribute('data-id'); if (id && readArr.indexOf(id) < 0) readArr.push(id); });
  setNotifRead(readArr); renderNotifBell(); renderSidebarNotifs();
}

function deleteReadNotifs() {
  var readArr = getNotifRead(); var delArr = getNotifDeleted();
  readArr.forEach(function (id) { if (delArr.indexOf(id) < 0) delArr.push(id); });
  setNotifDeleted(delArr); renderNotifBell(); renderSidebarNotifs();
}

async function renderNotifBell() {
  var bellWrap = document.getElementById('notifBellWrap'); if (!bellWrap) return;
  if (!bellWrap.innerHTML) {
    bellWrap.innerHTML = `
      <div style="position:relative">
        <button onclick="toggleNotifDropdown()" style="position:relative;background:none;border:none;cursor:pointer;padding:8px;color:var(--ink)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span id="notifBadge"></span>
        </button>
        <div id="notifDropdown" class="notif-dropdown-ui">
          <div style="padding:16px;font-family:Lexend,sans-serif;font-weight:800;font-size:16px;border-bottom:1px solid var(--stroke);display:flex;justify-content:space-between;align-items:center">
            Notifications <span id="notifCountTag" style="font-size:10px;background:var(--brand-soft);color:var(--brand);padding:2px 8px;border-radius:100px">0 New</span>
          </div>
          <div id="notifList" style="min-height:100px"></div>
          <div id="notifActions"></div>
        </div>
      </div>`;
  }

  var user = getSession();
  var badge = document.getElementById('notifBadge');
  var list = document.getElementById('notifList');
  var actions = document.getElementById('notifActions');
  var countTag = document.getElementById('notifCountTag');
  if (!user) { list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">Sign in to view notifications</div>'; return; }

  try {
    var res = await authApi('getNotifications', { email: user.email });
    var notifs = (res.ok ? res.data : []) || [];
    var deleted = getNotifDeleted(); notifs = notifs.filter(n => deleted.indexOf(n.id) < 0);
    var readArr = getNotifRead();
    var unread = notifs.filter(n => readArr.indexOf(n.id) < 0).length;

    if (badge) badge.innerHTML = unread > 0 ? `<span style="position:absolute;top:2px;right:2px;width:10px;height:10px;background:var(--brand);border:2px solid var(--white);border-radius:50%"></span>` : '';
    if (countTag) countTag.innerText = unread + ' New';

    if (!notifs.length) { list.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--muted);font-size:13px">All caught up!</div>'; }
    else {
      list.innerHTML = notifs.map(n => {
        var isRead = readArr.indexOf(n.id) >= 0;
        return `<div class="notif-drop-item" data-id="${escAuth(n.id)}" style="padding:16px;border-bottom:1px solid var(--stroke);background:${isRead ? 'transparent' : 'var(--brand-soft)'}">
          <div style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;color:var(--ink)">
            ${isRead ? '' : '<span style="width:7px;height:7px;background:var(--brand);border-radius:50%"></span>'}${escAuth(n.title)}
          </div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px;line-height:1.4">${escAuth(n.message)}</div>
          ${n.link ? `<a href="${escAuth(n.link)}" style="display:inline-block;margin-top:10px;font-size:12px;font-weight:800;color:var(--brand);text-decoration:none">Explore Now →</a>` : ''}
        </div>`;
      }).join('');
    }
    if (actions) {
      actions.innerHTML = notifs.length ? `<div style="display:flex;gap:12px;padding:16px"><button onclick="markAllNotifRead()" style="flex:1;padding:10px;border-radius:12px;font-size:12px;font-weight:700;border:1.5px solid var(--stroke);background:var(--card);cursor:pointer;font-family:inherit">Mark Read</button><button onclick="deleteReadNotifs()" style="flex:1;padding:10px;border-radius:12px;font-size:12px;font-weight:700;border:none;background:var(--brand-soft);color:var(--brand);cursor:pointer;font-family:inherit">Clear History</button></div>` : '';
    }
  } catch (e) { list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">Failed to load.</div>'; }
}

function toggleNotifDropdown() { var dd = document.getElementById('notifDropdown'); if (dd) dd.classList.toggle('show'); }
document.addEventListener('click', function (e) {
  var dd = document.getElementById('notifDropdown'); var bell = document.getElementById('notifBellWrap');
  if (dd && bell && !bell.contains(e.target)) dd.classList.remove('show');
});

function renderAuthUI() {
  var user = getSession(); var authArea = document.getElementById('authArea'); if (!authArea) return;
  if (user) {
    var ini = (user.name || 'U').charAt(0).toUpperCase();
    authArea.innerHTML = `<div style="display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--brand-soft);color:var(--brand);display:grid;place-items:center;font-weight:800;font-size:14px">${ini}</div>
      <button onclick="doLogout()" style="padding:8px 16px;border-radius:12px;font-size:13px;font-weight:700;color:var(--muted);background:none;border:1.5px solid var(--stroke);cursor:pointer;font-family:inherit">Logout</button>
    </div>`;
  } else {
    authArea.innerHTML = `<a href="${AUTH_CONFIG.AUTH_PAGE}" style="padding:10px 20px;border-radius:14px;font-size:14px;font-weight:800;color:#fff;background:var(--brand);text-decoration:none;box-shadow:0 4px 14px var(--brand-ring)">Login</a>`;
  }
}

/* ══════════════════════════════════════════
   ADMIN EXPORT UTILITIES (CSV & PDF)
   ══════════════════════════════════════════ */

function loadDynamicScript(src) {
  return new Promise(function (resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) {
      resolve();
      return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function cleanTableForExport(tableOrId) {
  var table = typeof tableOrId === 'string' ? document.getElementById(tableOrId) : tableOrId;
  if (!table) return null;

  var clone = table.cloneNode(true);
  var rows = clone.querySelectorAll("tr");
  for (var i = 0; i < rows.length; i++) {
    var cells = rows[i].querySelectorAll("td, th");
    for (var j = cells.length - 1; j >= 0; j--) {
      var cellText = cells[j].innerText.trim().toLowerCase();
      var isAction = cellText === 'action' || cellText.includes('visit portal');
      if (isAction) {
        cells[j].parentNode.removeChild(cells[j]);
      }
    }
  }
  return clone;
}

window.exportTableToCSV = function (tableOrId, filename) {
  var cleanedTable = cleanTableForExport(tableOrId);
  if (!cleanedTable) return;

  var csv = [];
  var rows = cleanedTable.querySelectorAll("tr");
  for (var i = 0; i < rows.length; i++) {
    var row = [], cols = rows[i].querySelectorAll("td, th");
    var hasContent = false;
    for (var j = 0; j < cols.length; j++) {
      var data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').trim();
      if (data === '—' || data === '–' || data === '-') {
        data = '';
      }
      data = data.replace(/"/g, '""');
      row.push('"' + data + '"');
      hasContent = true;
    }
    if (hasContent) {
      csv.push(row.join(","));
    }
  }

  if (csv.length === 0) return;

  var csvString = "\uFEFF" + csv.join("\n");
  var blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement("a");
  if (link.download !== undefined) {
    var url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename || 'export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

window.exportTableToPDF = async function (tableOrId, filename) {
  var cleanedTable = cleanTableForExport(tableOrId);
  if (!cleanedTable) return;

  try {
    if (!window.jspdf) {
      await loadDynamicScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    if (!window.jspdf.plugin || !window.jspdf.plugin.autotable) {
      await loadDynamicScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF('l', 'pt', 'a4'); // Landscape A4 size in points

    // Add title
    var title = filename.replace(/\.[^/.]+$/, "").replace(/_/g, " ").toUpperCase();
    doc.setFontSize(14);
    doc.text(title, 40, 30);

    doc.autoTable({
      html: cleanedTable,
      startY: 45,
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [220, 38, 38] }, // Brand primary red color
      margin: { top: 40, left: 40, right: 40, bottom: 40 }
    });

    doc.save(filename || 'export.pdf');
  } catch (err) {
    console.error("Failed to export PDF using jsPDF:", err);
    // Fallback: print the cleaned table in a simple print preview window
    var printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>' + filename + '</title>');
    printWindow.document.write('<style>table { width: 100%; border-collapse: collapse; font-family: sans-serif; } th, td { border: 1px solid #ddd; padding: 10px; text-align: left; } th { background: #dc2626; color: #fff; }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h2 style="font-family:sans-serif;margin-bottom:20px;">' + filename.replace(/\.[^/.]+$/, "").replace(/_/g, " ").toUpperCase() + '</h2>');
    printWindow.document.write(cleanedTable.outerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  }
};

/* ══════════════════════════════════════════
   ADVERTISEMENT POPUP FOR TOOL PAGES
   ══════════════════════════════════════════ */

function initAdPopup() {
  var session = getSession();
  if (session && (session.role === 'premium' || session.premium === true)) {
    return;
  }

  var landingPages = [
    'index.html',
    'cet-landing.html',
    'josaa-landing.html',
    'csab-landing.html',
    'comedk-landing.html',
    'auth.html',
    'admin.html',
    'seed.html'
  ];
  var path = window.location.pathname.split('/').pop();
  if (path === '' || path === '/' || !path) {
    path = 'index.html';
  }
  
  if (landingPages.indexOf(path.toLowerCase()) >= 0) {
    return;
  }

  var adStyle = document.createElement('style');
  adStyle.innerHTML = `
    .cs-ad-modal {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 99999;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.4s ease;
        padding: 20px;
    }
    .cs-ad-modal.show {
        display: flex;
        opacity: 1;
    }
    .cs-ad-modal-content {
        background: var(--card, #ffffff);
        border: 1px solid var(--stroke, rgba(0,0,0,0.08));
        border-radius: 28px;
        width: 100%;
        max-width: 920px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        transform: scale(0.9) translateY(20px);
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .cs-ad-modal.show .cs-ad-modal-content {
        transform: scale(1) translateY(0);
    }
    .cs-ad-close-btn {
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid var(--stroke, rgba(0,0,0,0.08));
        color: #111827;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        font-size: 20px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        transition: all 0.2s;
    }
    .cs-ad-close-btn:hover {
        background: var(--brand-soft, #fef2f2);
        color: var(--brand, #dc2626);
        transform: scale(1.05);
    }
    .cs-ad-header {
        padding: 32px 56px 12px 32px;
        text-align: center;
        position: relative;
    }
    .cs-ad-badge-top {
        background: var(--brand-soft, #fef2f2);
        color: var(--brand, #dc2626);
        padding: 6px 14px;
        border-radius: 100px;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        display: inline-block;
        margin-bottom: 12px;
        border: 1px solid var(--brand-ring, rgba(220,38,38,0.1));
    }
    .cs-ad-header-title {
        font-family: 'Lexend', sans-serif;
        font-weight: 800;
        font-size: 22px;
        color: var(--ink, #111827);
        letter-spacing: -0.01em;
        margin-bottom: 6px;
    }
    .cs-ad-header-desc {
        color: var(--muted, #6b7280);
        font-size: 14px;
        max-width: 600px;
        margin: 0 auto;
        line-height: 1.45;
    }
    .cs-ad-cards-container {
        display: flex;
        gap: 24px;
        padding: 0 32px 32px;
        flex-direction: row;
    }
    .cs-ad-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--card, #ffffff);
        border: 1px solid var(--stroke, rgba(0,0,0,0.08));
        border-radius: 20px;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .cs-ad-card:hover {
        transform: translateY(-4px);
        border-color: var(--brand, #dc2626);
        box-shadow: 0 12px 24px var(--brand-ring, rgba(220, 38, 38, 0.1));
    }
    .cs-ad-image-container {
        width: 100%;
        padding-top: 52%;
        position: relative;
        background: #f3f4f6;
    }
    .cs-ad-image-container img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .cs-ad-text-container {
        padding: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        flex-grow: 1;
    }
    .cs-ad-badge {
        background: var(--brand-soft, #fef2f2);
        color: var(--brand, #dc2626);
        padding: 6px 14px;
        border-radius: 100px;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 12px;
        border: 1px solid var(--brand-ring, rgba(220,38,38,0.1));
    }
    .cs-ad-title {
        font-family: 'Lexend', sans-serif;
        font-weight: 800;
        font-size: 18px;
        color: var(--ink, #111827);
        line-height: 1.3;
        margin-bottom: 8px;
    }
    .cs-ad-description {
        font-size: 13.5px;
        color: var(--muted, #6b7280);
        line-height: 1.45;
        margin-bottom: 20px;
        flex-grow: 1;
    }
    .cs-ad-cta-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 12px 24px;
        background: var(--brand, #dc2626);
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 14px;
        font-family: 'Lexend', sans-serif;
        font-weight: 800;
        font-size: 14px;
        transition: all 0.3s;
        box-shadow: 0 4px 12px var(--brand-ring, rgba(220, 38, 38, 0.15));
        margin-top: auto;
    }
    .cs-ad-cta-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px var(--brand-ring, rgba(220, 38, 38, 0.25));
        background: #b91c1c;
    }
    @media (max-width: 768px) {
        .cs-ad-modal {
            padding: 10px;
        }
        .cs-ad-modal-content {
            max-width: 420px;
            max-height: 95vh;
            overflow-y: auto;
            border-radius: 20px;
        }
        .cs-ad-header {
            padding: 16px 36px 8px 16px;
        }
        .cs-ad-badge-top {
            margin-bottom: 6px;
            padding: 4px 10px;
            font-size: 10px;
        }
        .cs-ad-header-title {
            font-size: 16px;
            margin-bottom: 0px;
        }
        .cs-ad-header-desc {
            display: none;
        }
        .cs-ad-cards-container {
            flex-direction: column;
            gap: 10px;
            padding: 0 12px 16px;
        }
        .cs-ad-card {
            border-radius: 14px;
        }
        .cs-ad-image-container {
            padding-top: 36%;
        }
        .cs-ad-text-container {
            padding: 12px;
        }
        .cs-ad-badge {
            margin-bottom: 6px;
            padding: 4px 10px;
            font-size: 10px;
        }
        .cs-ad-title {
            font-size: 14px;
            margin-bottom: 6px;
        }
        .cs-ad-description {
            display: none;
        }
        .cs-ad-cta-btn {
            padding: 10px 20px;
            font-size: 13px;
            border-radius: 10px;
            margin-top: 4px;
        }
    }
  `;
  document.head.appendChild(adStyle);

  var modalHtml = `
    <div id="cs-ad-modal" class="cs-ad-modal">
      <div class="cs-ad-modal-content">
        <button class="cs-ad-close-btn" onclick="window.closeAdModal()">&times;</button>
        <div class="cs-ad-header">
          <div class="cs-ad-badge-top">Premium Counselling Programs</div>
          <h2 class="cs-ad-header-title">Direct Personal Counselling 2026</h2>
          <p class="cs-ad-header-desc">Get premium mentoring from expert counselors to secure your dream engineering college seat.</p>
        </div>
        <div class="cs-ad-cards-container">
          <div class="cs-ad-card">
            <div class="cs-ad-image-container">
              <img src="https://courses-assets-v2.classplus.co/_next/image?url=/api/proxyimage?url=https%3A%2F%2Fcdn-wl-assets.classplus.co%2Fproduction%2Fsingle%2Fijpsrw%2Fa181e913-c49f-4ed8-8838-c15b38cf7a58.png&w=640&q=75" alt="Simplified Pro">
            </div>
            <div class="cs-ad-text-container">
              <div class="cs-ad-badge">Simplified Pro</div>
              <h3 class="cs-ad-title">Simplified Pro Counselling 2026</h3>
              <p class="cs-ad-description">Maximize your admission chances! Get expert choice filling lists, strategic round analyses, and college tier matches.</p>
              <a href="https://www.conceptsimplified.in/courses/668919" target="_blank" class="cs-ad-cta-btn">Register for Simplified Pro</a>
            </div>
          </div>
          <div class="cs-ad-card">
            <div class="cs-ad-image-container">
              <img src="https://courses-assets-v2.classplus.co/_next/image?url=/api/proxyimage?url=https%3A%2F%2Fcdn-wl-assets.classplus.co%2Fproduction%2Fsingle%2Fijpsrw%2Fbde224eb-a206-48f0-ae15-2d2d20fbfaf5.png&w=640&q=75" alt="Personalized 1:1">
            </div>
            <div class="cs-ad-text-container">
              <div class="cs-ad-badge">Personalized 1:1</div>
              <h3 class="cs-ad-title">Simplified Premium 1:1 counselling</h3>
              <p class="cs-ad-description">Tired of searching manually? Get personalized 1:1 counselling support and dedicated mentoring from expert counselors.</p>
              <a href="https://www.conceptsimplified.in/courses/840574" target="_blank" class="cs-ad-cta-btn">Get Personalized 1:1 Help</a>
            </div>
          </div>
          <div class="cs-ad-card">
            <div class="cs-ad-image-container">
              <img src="https://courses-assets-v2.classplus.co/_next/image?url=/api/proxyimage?url=https%3A%2F%2Fcdn-wl-assets.classplus.co%2Fproduction%2Fsingle%2Fijpsrw%2F79751778-f0dd-4a31-be62-47dd801de8e3.png&w=640&q=75" alt="AI Counselling">
            </div>
            <div class="cs-ad-text-container">
              <div class="cs-ad-badge">AI Counselling</div>
              <h3 class="cs-ad-title">AI-Powered College Predictor Platform</h3>
              <p class="cs-ad-description">Leverage our AI-driven college predictor to get data-backed recommendations, branch predictions, and personalized admission strategies.</p>
              <a href="https://www.conceptsimplified.in/courses/860295" target="_blank" class="cs-ad-cta-btn">Explore AI Counselling</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  window.closeAdModal = function() {
    var modal = document.getElementById('cs-ad-modal');
    if (modal) {
      modal.classList.remove('show');
      setTimeout(function() {
        modal.style.display = 'none';
      }, 400);
    }
  };

  // Close ad when clicking outside modal content
  var adModalElement = document.getElementById('cs-ad-modal');
  if (adModalElement) {
    adModalElement.addEventListener('click', function(e) {
      if (e.target === this) {
        window.closeAdModal();
      }
    });
  }

  function showAd() {
    var modal = document.getElementById('cs-ad-modal');
    if (modal) {
      modal.style.display = 'flex';
      modal.offsetHeight; // force reflow
      modal.classList.add('show');
    }
  }

  // Pop up every 2 minutes
  setInterval(showAd, 120000);
}

/* ══════════════════════════════════════════
   CLAIM PREMIUM / LINK PURCHASE LOGIC
   ══════════════════════════════════════════ */

function injectClaimPremiumButton() {
  var upgradeLinks = Array.from(document.querySelectorAll('a')).filter(function(a) {
    var href = a.getAttribute('href') || '';
    var text = a.innerText || '';
    
    // Exclude banners and ads
    if (a.classList.contains('premium-banner-card') || 
        a.closest('.banners-grid') || 
        a.closest('.premium-banners-section') ||
        a.closest('.cs-ad-card') || 
        a.closest('.cs-ad-modal-content')) {
      return false;
    }
                     
    return href.includes('conceptsimplified.in/courses') || text.includes('Upgrade to Premium');
  });

  upgradeLinks.forEach(function(link) {
    // Check if we already wrapped this link in lock-btn-group
    if (link.parentNode && link.parentNode.classList.contains('lock-btn-group')) {
      return;
    }
    // Check if we already injected a claim button next to this link
    if (link.nextElementSibling && link.nextElementSibling.classList.contains('claim-premium-btn')) {
      return;
    }

    var claimBtn = document.createElement('button');
    claimBtn.className = 'claim-premium-btn';
    claimBtn.type = 'button';
    claimBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 11l2 2 4-4"/>
      </svg>
      Link Purchase / Grant Access
    `;
    claimBtn.onclick = function() {
      window.openClaimPremiumModal();
    };

    // Create wrapper div
    var wrapper = document.createElement('div');
    wrapper.className = 'lock-btn-group';
    
    // Insert wrapper in the DOM right before the link
    link.parentNode.insertBefore(wrapper, link);
    
    // Move the link and newly created button inside the wrapper
    wrapper.appendChild(link);
    wrapper.appendChild(claimBtn);
  });
}

function startUpgradeButtonObserver() {
  // Run once immediately
  injectClaimPremiumButton();

  // Watch for dynamic DOM updates (since calculators swap page views dynamically)
  var observer = new MutationObserver(function() {
    injectClaimPremiumButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

window.openClaimPremiumModal = function() {
  var modal = document.getElementById('cs-claim-premium-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.offsetHeight; // force reflow
    modal.classList.add('show');
    document.getElementById('cs-claim-email').value = '';
    document.getElementById('cs-claim-phone').value = '';
    document.getElementById('cs-claim-error-msg').style.display = 'none';
    document.getElementById('cs-claim-success-msg').style.display = 'none';
  }
};

window.closeClaimPremiumModal = function() {
  var modal = document.getElementById('cs-claim-premium-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(function() {
      modal.style.display = 'none';
    }, 300);
  }
};

// Add listener to close when clicking outside the modal content wrapper
document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById('cs-claim-premium-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        window.closeClaimPremiumModal();
      }
    });
  }
});

window.submitClaimPremium = async function(event) {
  event.preventDefault();
  
  var emailInput = document.getElementById('cs-claim-email');
  var phoneInput = document.getElementById('cs-claim-phone');
  var errorDiv = document.getElementById('cs-claim-error-msg');
  var successDiv = document.getElementById('cs-claim-success-msg');
  var submitBtn = document.getElementById('cs-claim-submit-btn');

  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';

  var email = emailInput.value.trim().toLowerCase();
  var rawPhone = phoneInput.value.trim();
  
  // Normalize phone number (digits only, last 10 digits)
  var numericPhone = rawPhone.replace(/\D/g, '');
  var normalizedPhone = numericPhone.slice(-10);

  if (normalizedPhone.length < 10) {
    errorDiv.innerText = 'Please enter a valid 10-digit phone number.';
    errorDiv.style.display = 'block';
    return;
  }

  // Disable button and show spinner
  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').innerText = 'Validating Purchase...';
  submitBtn.querySelector('.cs-btn-spinner').style.display = 'inline-block';

  try {
    // 1. Fetch current session
    var currentUser = getSession();
    if (!currentUser || !currentUser.id) {
      throw new Error('You must be logged in to claim premium access.');
    }

    if (currentUser.email.toLowerCase() === email) {
      throw new Error('This account already matches the purchase email. It should already have access or will migrate automatically.');
    }

    // 2. Query Firestore for purchase account
    if (typeof db === 'undefined') {
      throw new Error('Database connection is not initialized yet. Please refresh.');
    }
    
    var snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (snap.empty) {
      throw new Error('No purchase record found for this email address. Please make sure the email matches your payment receipt.');
    }

    var purchaseUser = snap.docs[0].data();

    // 3. Verify phone number / password hash
    var enteredHashed = await hashPassword(normalizedPhone);
    var matchesPassword = purchaseUser.password === enteredHashed;
    
    var purchasePhoneDigits = String(purchaseUser.phone || '').replace(/\D/g, '').slice(-10);
    var matchesPhone = purchasePhoneDigits && purchasePhoneDigits === normalizedPhone;

    if (!matchesPassword && !matchesPhone) {
      throw new Error('Incorrect phone number for this purchase account. Please enter the phone number you registered during payment.');
    }

    // 4. Verify account premium status
    if (purchaseUser.role !== 'premium' && purchaseUser.premium !== true) {
      throw new Error('This purchase account does not have Premium status. Please check your payment status.');
    }

    // 5. Grant premium status to the current user's document
    await db.collection('users').doc(currentUser.id).update({
      role: 'premium',
      premium: true,
      claimedFromEmail: email,
      claimedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 6. Update local session state
    currentUser.role = 'premium';
    currentUser.premium = true;
    setSession(currentUser);

    // 7. Show success feedback and reload the page
    successDiv.innerText = 'Premium benefits linked successfully! Reloading page to activate...';
    successDiv.style.display = 'block';

    setTimeout(function() {
      window.location.reload();
    }, 2000);

  } catch (err) {
    console.error('Claim premium error:', err);
    errorDiv.innerText = err.message || 'An error occurred during verification. Please try again.';
    errorDiv.style.display = 'block';
    
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').innerText = 'Validate & Activate Premium';
    submitBtn.querySelector('.cs-btn-spinner').style.display = 'none';
  }
};
