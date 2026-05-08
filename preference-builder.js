'use strict';

/* ══════ STATE ══════ */
let cutoffData=[], collegeMetadata=[], selectedBranches=new Set(), matchedColleges=[], selectedColleges=[], prefList=[], allBranchNames=[];
const CATS={
  'Computer & IT':['COMPUTER','INFORMATION TECHNOLOGY','AI','ARTIFICIAL','DATA SCIENCE','MACHINE LEARNING','SOFTWARE','CYBER','ROBOTICS'],
  'Electronics & Telecom':['ELECTRONICS','TELECOMMUNICATION','ENTC','COMMUNICATION','INSTRUMENTATION'],
  'Core Engineering':['MECHANICAL','CIVIL','ELECTRICAL','CHEMICAL','PRODUCTION','METALLURGY','AUTOMOBILE','TEXTILE','MINING'],
  'Biotech & Allied':['BIOTECHNOLOGY','BIO-MEDICAL','BIO MEDICAL','FOOD','AGRICULTURE','PHARMACEUTICAL'],
  'Other Branches':[]
};

/* ══════ STEPPER ══════ */
let currentStep=1;
function goStep(n){
  if(n<1||n>4)return;
  if(n===2&&!validateStep1())return;
  if(n===3&&selectedBranches.size===0){pbToast('Select at least one branch');return}
  if(n===3)generateMatches();
  if(n===4)buildPrefList();
  currentStep=n;
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel'+n).classList.add('active');
  document.querySelectorAll('.step-item').forEach((s,i)=>{
    s.classList.remove('active','done');
    if(i+1<n)s.classList.add('done');
    else if(i+1===n)s.classList.add('active');
  });
  document.querySelectorAll('.step-line').forEach((l,i)=>{
    l.classList.toggle('done',i+1<n);
  });
  window.scrollTo({top:0,behavior:'smooth'});
}

function validateStep1(){
  const p=document.getElementById('inPct').value, r=document.getElementById('inRank').value;
  if(!p||isNaN(parseFloat(p))){pbToast('Enter valid percentile');return false}
  if(!r||isNaN(parseInt(r))){pbToast('Enter valid rank');return false}
  return true;
}

/* ══════ DATA LOADING ══════ */
async function loadData(){
  const loader=document.getElementById('dataLoader');
  try{
    loader.innerHTML='<div class="pb-spinner"></div><span>Loading cutoff data (12MB)...</span>';
    const r1=await fetch('data.json');const j1=await r1.json();
    const raw1=j1['MHT-CET College Data']||j1[Object.keys(j1)[0]]||[];
    cutoffData=raw1.map(r=>({
      code:String(r['Institute Code']||''),name:r['Institute']||r['Institute Name']||'',
      branch:(r['Branch']||r['Branch Name']||'').trim(),
      seatType:r['Seat Type']||'',rank:parseInt(r['Rank'])||0,
      percentile:parseFloat(r['Percentile'])||0
    }));

    loader.querySelector('span').textContent='Loading college metadata...';
    const r2=await fetch('college-data.json');const j2=await r2.json();
    collegeMetadata=(j2['college-data']||[]).map(c=>({
      code:String(c['Institute Code']||''),name:c['Institute Name']||'',
      status:c['Status']||'',intake:c['Total Intake']||0
    }));

    // Extract branches
    const bSet=new Set();
    cutoffData.forEach(r=>{if(r.branch)bSet.add(r.branch)});
    allBranchNames=Array.from(bSet).sort();
    renderBranches();
    loader.style.display='none';
    document.getElementById('predictBtn').disabled=false;
  }catch(e){
    console.error(e);
    loader.innerHTML='<span style="color:var(--brand)">Failed to load data. Please refresh.</span>';
  }
}

/* ══════ BRANCH RENDERING ══════ */
function categorizeBranch(b){
  const u=b.toUpperCase();
  for(const[cat,kws]of Object.entries(CATS)){
    if(cat==='Other Branches')continue;
    if(kws.some(k=>{const re=new RegExp('\\b'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');return re.test(u)}))return cat;
  }
  return 'Other Branches';
}

function renderBranches(){
  const container=document.getElementById('branchContainer');
  const grouped={};
  Object.keys(CATS).forEach(c=>grouped[c]=[]);
  allBranchNames.forEach(b=>{const cat=categorizeBranch(b);grouped[cat].push(b)});

  let html='<div class="branch-select-all" onclick="toggleAllBranches()"><div class="branch-chk" id="chkAll">✓</div> Select All Branches ('+allBranchNames.length+')</div>';

  Object.entries(grouped).forEach(([cat,branches])=>{
    if(!branches.length)return;
    const selCount=branches.filter(b=>selectedBranches.has(b)).length;
    html+=`<div class="branch-cat">
      <div class="branch-cat-head" onclick="toggleCatCollapse(this)">
        <div class="branch-cat-name"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${cat}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="branch-cat-count">${selCount}/${branches.length}</span>
          <button class="branch-cat-toggle" onclick="event.stopPropagation();toggleCategory('${cat}')">Select All</button>
        </div>
      </div>
      <div class="branch-list" style="display:none">`;
    branches.forEach(b=>{
      const sel=selectedBranches.has(b)?'selected':'';
      html+=`<div class="branch-opt ${sel}" onclick="toggleBranch('${b.replace(/'/g,"\\'")}')"><div class="branch-chk">${sel?'✓':''}</div><span>${b}</span></div>`;
    });
    html+='</div></div>';
  });

  container.innerHTML=html;
  renderBranchChips();
  updateAllChk();
}

function toggleCatCollapse(el){
  const list=el.nextElementSibling;
  list.style.display=list.style.display==='none'?'grid':'none';
}

function toggleBranch(b){
  if(selectedBranches.has(b))selectedBranches.delete(b);
  else selectedBranches.add(b);
  renderBranches();
}

function toggleCategory(cat){
  const grouped={};
  Object.keys(CATS).forEach(c=>grouped[c]=[]);
  allBranchNames.forEach(b=>{grouped[categorizeBranch(b)].push(b)});
  const branches=grouped[cat]||[];
  const allSel=branches.every(b=>selectedBranches.has(b));
  branches.forEach(b=>{if(allSel)selectedBranches.delete(b);else selectedBranches.add(b)});
  renderBranches();
}

function toggleAllBranches(){
  if(selectedBranches.size===allBranchNames.length){selectedBranches.clear()}
  else{allBranchNames.forEach(b=>selectedBranches.add(b))}
  renderBranches();
}

function updateAllChk(){
  const el=document.getElementById('chkAll');
  if(el)el.textContent=selectedBranches.size===allBranchNames.length?'✓':'';
}

function renderBranchChips(){
  const row=document.getElementById('branchChips');
  if(!row)return;
  if(selectedBranches.size===0){row.innerHTML='<span style="color:var(--muted);font-size:12px">No branches selected</span>';return}
  if(selectedBranches.size>8){row.innerHTML=`<span class="bchip">${selectedBranches.size} branches selected</span>`;return}
  row.innerHTML=Array.from(selectedBranches).map(b=>`<span class="bchip">${b}<span class="bchip-x" onclick="toggleBranch('${b.replace(/'/g,"\\'")}')">×</span></span>`).join('');
}

/* ══════ COLLEGE MATCHING (Step 3) ══════ */
function generateMatches(){
  const pct=parseFloat(document.getElementById('inPct').value);
  const rank=parseInt(document.getElementById('inRank').value);
  const region=document.getElementById('inRegion').value;
  const colType=document.getElementById('inColType').value;
  const minority=document.getElementById('inMinority').value;
  const category=document.getElementById('inCategory').value;

  // Build category seat filter
  const catMap={'OPEN':'OPEN','OBC':'OBC','SC':'SC','ST':'ST','VJ/DT':'VJ','NT1':'NT1','NT2':'NT2','NT3':'NT3','EWS':'EWS','TFWS':'TFWS'};
  const searchCat=catMap[category]||'OPEN';

  // Filter cutoff data
  let filtered=cutoffData.filter(r=>{
    if(!selectedBranches.has(r.branch))return false;
    if(searchCat!=='OPEN'&&!(r.seatType||'').includes(searchCat))return false;
    if(searchCat==='OPEN'&&!(r.seatType||'').includes('OPEN'))return false;
    return true;
  });

  // Group by institute+branch, pick closest percentile
  const groups={};
  filtered.forEach(r=>{
    const key=r.code+'|'+r.branch;
    if(!groups[key]||Math.abs(r.percentile-pct)<Math.abs(groups[key].percentile-pct)){
      groups[key]=r;
    }
  });

  let results=Object.values(groups);

  // Enrich with college metadata
  const metaMap={};
  collegeMetadata.forEach(c=>metaMap[c.code]=c);

  results=results.map(r=>{
    const meta=metaMap[r.code]||{};
    const status=(meta.status||'').toLowerCase();
    return{
      ...r, instituteName:meta.name||r.name,
      status:meta.status||'', intake:meta.intake||0,
      isGov:status.includes('government'),
      isAided:status.includes('aided'),
      isAuto:status.includes('autonomous'),
      isMinority:status.includes('minority'),
      minorityType:extractMinority(meta.status||''),
      diff:r.percentile-pct
    };
  });

  // Apply optional filters
  if(colType){
    results=results.filter(r=>{
      if(colType==='Government')return r.isGov;
      if(colType==='Aided')return r.isAided;
      if(colType==='Autonomous')return r.isAuto;
      if(colType==='Un-Aided')return !r.isGov&&!r.isAided;
      return true;
    });
  }
  if(minority){
    results=results.filter(r=>r.isMinority&&r.minorityType.toLowerCase().includes(minority.toLowerCase()));
  }
  if(region){
    results=results.filter(r=>(r.instituteName||'').toLowerCase().includes(region.toLowerCase()));
  }

  // Split: reachable vs aspirational
  const reachable=results.filter(r=>r.percentile<=pct).sort((a,b)=>b.percentile-a.percentile);
  const aspirational=results.filter(r=>r.percentile>pct).sort((a,b)=>a.percentile-b.percentile).slice(0,6);

  aspirational.forEach(r=>r.isAspirational=true);
  matchedColleges=[...aspirational,...reachable];

  // Auto-select reachable + aspirational
  selectedColleges=matchedColleges.map((_,i)=>i);
  renderColleges();
}

function extractMinority(status){
  const m=status.match(/(Religious Minority\s*-\s*\w+|Linguistic Minority\s*-\s*\w+)/i);
  return m?m[1]:'';
}

function renderColleges(filter='all'){
  const grid=document.getElementById('collegeGrid');
  const countEl=document.getElementById('matchCount');
  let items=matchedColleges;

  if(filter==='aspirational')items=matchedColleges.filter(r=>r.isAspirational);
  else if(filter==='reachable')items=matchedColleges.filter(r=>!r.isAspirational);
  else if(filter==='government')items=matchedColleges.filter(r=>r.isGov);
  else if(filter==='autonomous')items=matchedColleges.filter(r=>r.isAuto);

  countEl.textContent=items.length+' colleges found ('+selectedColleges.length+' selected)';

  if(!items.length){
    grid.innerHTML='<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><h3>No Matches</h3><p>Try adjusting your filters or branch preferences.</p></div>';
    return;
  }

  grid.innerHTML=items.map((c,idx)=>{
    const realIdx=matchedColleges.indexOf(c);
    const sel=selectedColleges.includes(realIdx);
    const asp=c.isAspirational?'aspirational':'';
    const tags=[];
    if(c.isGov)tags.push('<span class="col-tag gov">Government</span>');
    if(c.isAuto)tags.push('<span class="col-tag auto">Autonomous</span>');
    if(c.isMinority)tags.push('<span class="col-tag minority">'+escH(c.minorityType||'Minority')+'</span>');
    if(c.isAided)tags.push('<span class="col-tag">Aided</span>');

    return`<div class="col-card ${sel?'selected':''} ${asp}" onclick="toggleCollege(${realIdx})">
      <div class="col-chk">${sel?'✓':''}</div>
      <div class="col-name">${escH(c.instituteName)}</div>
      <div class="col-meta">${tags.join('')}<span class="col-tag">${escH(c.branch)}</span></div>
      <div class="col-pct">${c.percentile.toFixed(2)}%<small>Cutoff | Code: ${c.code}</small></div>
    </div>`;
  }).join('');
}

function toggleCollege(idx){
  const i=selectedColleges.indexOf(idx);
  if(i>=0)selectedColleges.splice(i,1);else selectedColleges.push(idx);
  renderColleges(document.querySelector('.filter-chip.active')?.dataset.f||'all');
}

function filterColleges(f,el){
  document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderColleges(f);
}

/* ══════ PREFERENCE LIST (Step 4) ══════ */
function buildPrefList(){
  prefList=selectedColleges.map(idx=>({...matchedColleges[idx],idx}));
  renderPrefList();
  renderSuggestions();
  renderAspirational();
}

/* ══════ ASPIRATIONAL TAB ══════ */
function renderAspirational(){
  const grid=document.getElementById('aspGrid');
  if(!grid)return;
  const pct=parseFloat(document.getElementById('inPct').value)||0;
  // Get ALL colleges above percentile (not just 6)
  const allAsp=matchedColleges.filter(r=>r.isAspirational);
  // Also find more aspirational candidates from full results
  const metaMap={};
  collegeMetadata.forEach(c=>metaMap[c.code]=c);
  const extraAsp=cutoffData.filter(r=>{
    if(!selectedBranches.has(r.branch))return false;
    if(r.percentile<=pct)return false;
    if(r.percentile>pct+10)return false;
    if(allAsp.some(a=>a.code===r.code&&a.branch===r.branch))return false;
    return true;
  }).slice(0,20).map(r=>{
    const meta=metaMap[r.code]||{};
    const status=(meta.status||'').toLowerCase();
    return{...r,instituteName:meta.name||r.name,status:meta.status||'',
      isGov:status.includes('government'),isAuto:status.includes('autonomous'),
      isMinority:status.includes('minority'),minorityType:extractMinority(meta.status||''),
      isAided:status.includes('aided'),isAspirational:true,diff:r.percentile-pct};
  });
  const combined=[...allAsp,...extraAsp];
  // Deduplicate
  const seen=new Set();
  const unique=combined.filter(c=>{const k=c.code+'|'+c.branch;if(seen.has(k))return false;seen.add(k);return true});
  unique.sort((a,b)=>a.percentile-b.percentile);

  if(!unique.length){
    grid.innerHTML='<div class="empty-state"><h3>No Aspirational Colleges</h3><p>No colleges found above your percentile for selected branches.</p></div>';
    return;
  }
  const inPref=new Set(prefList.map(p=>p.code+'|'+p.branch));
  grid.innerHTML=unique.map(c=>{
    const key=c.code+'|'+c.branch;
    const inList=inPref.has(key);
    const tags=[];
    if(c.isGov)tags.push('<span class="col-tag gov">Government</span>');
    if(c.isAuto)tags.push('<span class="col-tag auto">Autonomous</span>');
    if(c.isMinority)tags.push('<span class="col-tag minority">'+escH(c.minorityType||'Minority')+'</span>');
    return`<div class="col-card ${inList?'selected':''} aspirational" onclick="toggleAspirational('${c.code}','${c.branch.replace(/'/g,"\\'")}')">
      <div class="col-chk">${inList?'✓':''}</div>
      <div class="col-name">${escH(c.instituteName)}</div>
      <div class="col-meta">${tags.join('')}<span class="col-tag">${escH(c.branch)}</span></div>
      <div class="col-pct">${c.percentile.toFixed(2)}%<small>Cutoff (${(c.percentile-pct).toFixed(2)}% above yours) | Code: ${c.code}</small></div>
    </div>`;
  }).join('');
}

function toggleAspirational(code,branch){
  const key=code+'|'+branch;
  const idx=prefList.findIndex(p=>p.code===code&&p.branch===branch);
  if(idx>=0){
    prefList.splice(idx,1);
    pbToast('Removed from preference list');
  } else {
    const c=matchedColleges.find(r=>r.code===code&&r.branch===branch);
    if(c){prefList.push({...c});pbToast('Added to preference list');}
  }
  renderPrefList();renderAspirational();renderSuggestions();
}

function renderPrefList(){
  const list=document.getElementById('prefListUl');
  const count=document.getElementById('prefCount');
  count.textContent=prefList.length+' colleges';

  if(!prefList.length){
    list.innerHTML='<div class="empty-state" style="padding:40px"><h3>No colleges added</h3><p>Go back and select colleges.</p></div>';
    return;
  }

  list.innerHTML=prefList.map((c,i)=>`<li class="pref-item ${c.isAspirational?'asp-item':''}" draggable="true" data-idx="${i}" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dropItem(event)" ondragend="dragEnd(event)">
    <div class="pref-grip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg></div>
    <div class="pref-num">${i+1}</div>
    <div class="pref-info"><div class="pref-name">${escH(c.instituteName||c.name)}</div><div class="pref-branch">${escH(c.branch)} <span class="pref-code">${c.code}</span></div></div>
    <button class="pref-remove" onclick="removePref(${i})" title="Remove">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </li>`).join('');
}

function removePref(i){prefList.splice(i,1);renderPrefList()}

/* ══════ DRAG & DROP ══════ */
let dragIdx=null;
function dragStart(e){dragIdx=+e.target.closest('.pref-item').dataset.idx;e.target.closest('.pref-item').classList.add('dragging')}
function dragOver(e){e.preventDefault();const item=e.target.closest('.pref-item');if(item)item.classList.add('drag-over')}
function dropItem(e){
  e.preventDefault();
  document.querySelectorAll('.pref-item').forEach(el=>el.classList.remove('drag-over'));
  const targetIdx=+e.target.closest('.pref-item').dataset.idx;
  if(dragIdx===null||dragIdx===targetIdx)return;
  const [moved]=prefList.splice(dragIdx,1);
  prefList.splice(targetIdx,0,moved);
  renderPrefList();
}
function dragEnd(e){dragIdx=null;document.querySelectorAll('.pref-item').forEach(el=>el.classList.remove('dragging','drag-over'))}

/* ══════ SUGGESTIONS ══════ */
function renderSuggestions(){
  const panel=document.getElementById('suggList');
  const prefCodes=new Set(prefList.map(c=>c.code+'|'+c.branch));
  const suggs=matchedColleges.filter(c=>!prefCodes.has(c.code+'|'+c.branch)).slice(0,10);

  if(!suggs.length){panel.innerHTML='<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No more suggestions</div>';return}

  panel.innerHTML=suggs.map((c,i)=>`<div class="sugg-item">
    <div class="sugg-info"><div class="sugg-name">${escH(c.instituteName||c.name)}</div><div class="sugg-sub">${escH(c.branch)} | ${c.percentile.toFixed(2)}%</div></div>
    <button class="sugg-add" onclick="addSuggestion(${matchedColleges.indexOf(c)})">+ Add</button>
  </div>`).join('');
}

function addSuggestion(idx){
  const c=matchedColleges[idx];
  if(!c)return;
  if(prefList.some(p=>p.code===c.code&&p.branch===c.branch)){pbToast('Already in list');return}
  prefList.push({...c,idx});
  renderPrefList();renderSuggestions();
  pbToast('Added to preference list');
}

/* ══════ PDF EXPORT ══════ */
function exportPDF(){
  if(!prefList.length){pbToast('Add colleges to export');return}
  const pct=document.getElementById('inPct').value;
  const rank=document.getElementById('inRank').value;
  const cat=document.getElementById('inCategory').value;

  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>MHT-CET Preference List</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:800px;margin:0 auto}
    h1{font-size:22px;margin-bottom:4px}h2{font-size:14px;color:#666;margin-bottom:24px;font-weight:normal}
    .info{display:flex;gap:32px;margin-bottom:24px;font-size:13px;flex-wrap:wrap}
    .info div{background:#f8f8f8;padding:10px 16px;border-radius:8px}.info strong{color:#dc2626}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
    th{background:#f1f1f1;padding:10px 12px;text-align:left;font-weight:700;border:1px solid #ddd}
    td{padding:9px 12px;border:1px solid #ddd}tr:nth-child(even){background:#fafafa}
    .asp{background:#fff7ed;font-style:italic}.footer{margin-top:32px;font-size:11px;color:#999;text-align:center}
    @media print{body{padding:20px}}
  </style></head><body>
  <h1>MHT-CET Counselling — Preference List</h1>
  <h2>Generated by College Simplified on ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</h2>
  <div class="info">
    <div>Percentile: <strong>${pct}%</strong></div>
    <div>Rank: <strong>${rank}</strong></div>
    <div>Category: <strong>${cat}</strong></div>
    <div>Total Preferences: <strong>${prefList.length}</strong></div>
  </div>
  <table><thead><tr><th>#</th><th>Institute Code</th><th>Institute Name</th><th>Branch</th><th>Cutoff %ile</th><th>Type</th></tr></thead><tbody>
  ${prefList.map((c,i)=>`<tr class="${c.isAspirational?'asp':''}"><td>${i+1}</td><td>${c.code}</td><td>${escH(c.instituteName||c.name)}</td><td>${escH(c.branch)}</td><td>${c.percentile.toFixed(2)}</td><td>${c.isAspirational?'Aspirational':'Reachable'}</td></tr>`).join('')}
  </tbody></table>
  <div class="footer">This is a system-generated preference list. Please verify all details with official MHT-CET CAP portal before final submission.<br>© College Simplified ${new Date().getFullYear()}</div>
  </body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),500);
}

/* ══════ SIDEBAR TABS ══════ */
function switchSideTab(tab){
  document.querySelectorAll('.sidebar-tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.sidebar-content').forEach(c=>c.classList.toggle('active',c.id==='side-'+tab));
}

/* ══════ UTILS ══════ */
function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function pbToast(msg){
  let t=document.getElementById('pbToast');
  if(!t){t=document.createElement('div');t.id='pbToast';t.className='pb-toast';document.body.appendChild(t)}
  t.textContent=msg;t.style.display='flex';
  clearTimeout(t._tid);t._tid=setTimeout(()=>t.style.display='none',3000);
}

/* ══════ BOOT ══════ */
async function boot(){
  const session=initAuth({requireLogin:true,toolContainerId:'toolArea'});
  if(!session)return;
  // Premium check
  const user=getSession();
  if(user&&user.role!=='admin'&&user.role!=='premium'){
    document.getElementById('toolArea').innerHTML=`<div style="text-align:center;padding:100px 20px">
      <div style="color:var(--gold);margin-bottom:20px"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
      <h2 style="font-family:Lexend,sans-serif;font-weight:800;font-size:28px;margin-bottom:12px">Premium Feature</h2>
      <p style="color:var(--muted);max-width:420px;margin:0 auto 32px;line-height:1.6">The Preference List Builder is available exclusively for Premium members. Upgrade to unlock smart counselling tools.</p>
      <a href="index.html" style="display:inline-flex;align-items:center;gap:10px;padding:16px 32px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#78350f;text-decoration:none;border-radius:14px;font-weight:800">Upgrade to Premium →</a>
    </div>`;
    return;
  }
  await loadData();
}

// Expose globals
window.goStep=goStep;window.toggleBranch=toggleBranch;window.toggleCategory=toggleCategory;
window.toggleAllBranches=toggleAllBranches;window.toggleCatCollapse=toggleCatCollapse;
window.toggleCollege=toggleCollege;window.filterColleges=filterColleges;
window.removePref=removePref;window.addSuggestion=addSuggestion;
window.exportPDF=exportPDF;window.switchSideTab=switchSideTab;
window.dragStart=dragStart;window.dragOver=dragOver;window.dropItem=dropItem;window.dragEnd=dragEnd;
window.toggleAspirational=toggleAspirational;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
