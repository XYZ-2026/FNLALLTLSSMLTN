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

    .sidebar-profile { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--brand-soft); border-radius: 16px; margin-top: 8px; overflow: hidden; }
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
      <div id="sidebarProfile"></div>
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
            <a href="cutoff_checker.html" class="sidebar-sub-link">CET Cutoff Checker</a>
            <a href="cet_colleges.html" class="sidebar-sub-link">Top Colleges</a>
            <a href="compare_colleges.html" class="sidebar-sub-link">Compare Colleges</a>
            <a href="mht_cet_college_predictor.html" class="sidebar-sub-link">MHT CET College Predictor</a>
            <a href="engineering-psychometric-test.html" class="sidebar-sub-link">Engineering Psychometric Test</a>
            <a href="percentile_vs_college_predictor.html" class="sidebar-sub-link">JEE ALL INDIA Predictor</a>
            <a href="document_checklist.html" class="sidebar-sub-link">Document Checklist</a>
            <a href="preference-builder.html" class="sidebar-sub-link" style="color:#b8860b;font-weight:700">⭐ CET Preference Builder</a>
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
            <a href="josaa-preference-builder.html" class="sidebar-sub-link" style="color:#b8860b;font-weight:700">⭐ JOSAA Pref Builder</a>
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
          </div>
        </div>

        <a href="manipal_cutoff.html" class="sidebar-link"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg> Manipal MET</a>
        
        <div class="sidebar-label">Tools</div>
        <a href="document_checklist.html" class="sidebar-link"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Document Checklist</a>
        <a href="calendar.html" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Event Calendar</a>
        <a href="non-cap-admissions.html" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> NON-CAP Admissions</a>
        <a href="index.html#latest-notices" class="sidebar-link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Latest Notices</a>

        <div class="sidebar-label">Premium Tools</div>
        <a href="preference-builder.html" class="sidebar-link" style="background:linear-gradient(135deg,#fef9e7,#fdf2e9);border:1px solid rgba(184,134,11,0.2);margin-bottom:4px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b8860b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span style="color:#b8860b;font-weight:800">MHT-CET Pref Builder</span>
        </a>
        <a href="josaa-preference-builder.html" class="sidebar-link" style="background:linear-gradient(135deg,#fef9e7,#fdf2e9);border:1px solid rgba(184,134,11,0.2)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b8860b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span style="color:#b8860b;font-weight:800">JOSAA Pref Builder</span>
        </a>
      </nav>

      <div id="sidebarLogout" style="margin-top:auto"></div>
    </aside>
    <div id="global-ui-injected" style="display:none"></div>
  `;

  document.body.insertAdjacentHTML('afterbegin', headerHtml + sidebarHtml);
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
    var ini = (user.name || 'U').charAt(0).toUpperCase();
    prof.innerHTML = `
      <div class="sidebar-profile">
        <div class="sidebar-avatar">${ini}</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">${escAuth(user.name)}</div>
          <div class="sidebar-user-email">${escAuth(user.email || '')}</div>
        </div>
      </div>`;

    if (user.role === 'admin') {
      var aLink = document.createElement('a');
      aLink.href = 'admin.html'; aLink.className = 'sidebar-link';
      aLink.style.background = 'var(--brand-soft)'; aLink.style.color = 'var(--brand)'; aLink.style.marginTop = '8px';
      aLink.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> Admin Panel';
      prof.after(aLink);

      if (adm) adm.innerHTML = '<button onclick="location.href=\'admin.html\'" style="padding:8px 16px; border-radius:12px; font-size:13px; font-weight:700; color:#fff; background:var(--brand); border:none; cursor:pointer">Admin</button>';
    }

    log.innerHTML = '<button class="sidebar-logout" onclick="doLogout()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Logout</button>';
  } else {
    prof.innerHTML = '<a href="' + AUTH_CONFIG.AUTH_PAGE + '" class="sidebar-link" style="background:var(--brand);color:#fff;justify-content:center">Login / Register</a>';
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
function doLogout() { clearSession(); window.location.href = AUTH_CONFIG.HOME_PAGE; }
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
              <img src="paid%20banners/banner1.webp" alt="Simplified Pro">
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
              <img src="paid%20banners/banner2.webp" alt="Personalized 1:1">
            </div>
            <div class="cs-ad-text-container">
              <div class="cs-ad-badge">Personalized 1:1</div>
              <h3 class="cs-ad-title">Simplified Premium 1:1 counselling</h3>
              <p class="cs-ad-description">Tired of searching manually? Get personalized 1:1 counselling support and dedicated mentoring from expert counselors.</p>
              <a href="https://www.conceptsimplified.in/courses/840574" target="_blank" class="cs-ad-cta-btn">Get Personalized 1:1 Help</a>
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
