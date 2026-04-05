// ═══════════════════════════════════════════════════════════════
// JOBBOT PRO v3 — UNIVERSAL EDITION — Full JS Engine
// ═══════════════════════════════════════════════════════════════

const APP = { jobs: [], tracker: [], covers: [], allTracker: [] };

// ── CLOCK ──────────────────────────────────────────────────────
function tick() {
  const el = document.getElementById('navClock');
  if(el) el.textContent = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
setInterval(tick,1000); tick();
document.getElementById('scanDate').textContent = new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short'});

// ── TOAST ──────────────────────────────────────────────────────
function toast(msg, type='info', duration=3500) {
  const icons = {success:'✅', error:'❌', info:'ℹ️', warn:'⚠️'};
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-icon">${icons[type]||'ℹ️'}</div><div class="toast-msg">${msg}</div><span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
  c.appendChild(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(), 350); }, duration);
}

// ── LOADING ────────────────────────────────────────────────────
function showLoad(msg='Processing...') { document.getElementById('loadingText').textContent=msg; document.getElementById('loadingOverlay').classList.add('on'); }
function hideLoad() { document.getElementById('loadingOverlay').classList.remove('on'); }

// ── NAVIGATION ─────────────────────────────────────────────────
function gp(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.ntab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.mn-tab').forEach(t=>t.classList.remove('on'));
  document.getElementById('page-'+id)?.classList.add('on');
  document.getElementById('nt-'+id)?.classList.add('on');
  document.getElementById('mn-'+id)?.classList.add('on');
  if(id==='tracker') loadTracker();
  if(id==='analytics') loadAnalytics();
  if(id==='cover') loadCoverNotes();
}

// ── PERSISTENT STORAGE ─────────────────────────────────────────
function saveLocal(key,val) { localStorage.setItem('jbp_'+key, JSON.stringify(val)); }
function loadLocal(key,def=null) { try{ return JSON.parse(localStorage.getItem('jbp_'+key))||def; }catch{ return def; } }

// ── DYNAMIC CHIPS (add/remove any role or location) ────────────
function addChip(containerId, inputId) {
  const input = document.getElementById(inputId);
  const val = input.value.trim();
  if(!val) return;
  const container = document.getElementById(containerId);
  // Prevent duplicates
  const existing = [...container.querySelectorAll('.chip')].map(c=>c.dataset.v);
  if(existing.includes(val)) { toast('Already added!','warn'); return; }
  const chip = document.createElement('span');
  chip.className = 'chip on';
  chip.dataset.v = val;
  const isTeal = containerId === 'locChips';
  if(isTeal) chip.classList.add('teal');
  chip.innerHTML = `${isTeal?'📍 ':''}${val} <span class="chip-x" onclick="event.stopPropagation();this.parentElement.remove()">✕</span>`;
  chip.addEventListener('click', ()=> chip.classList.toggle('on'));
  container.appendChild(chip);
  input.value = '';
  input.focus();
}

// Enter key support for chip inputs
document.getElementById('roleInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); addChip('roleChips','roleInput'); }});
document.getElementById('locInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); addChip('locChips','locInput'); }});

function getChips(id) {
  return [...document.querySelectorAll(`#${id} .chip.on`)].map(c=>c.dataset.v||c.textContent.replace(/📍|🌐|✕/g,'').trim());
}

// ── GROQ API KEY ───────────────────────────────────────────────
function checkGroq() {
  const k = document.getElementById('groqKey').value.trim();
  const b = document.getElementById('groqBadge');
  const d = document.getElementById('apiDot');
  const l = document.getElementById('apiLabel');
  const ok = k.startsWith('gsk_') && k.length > 20;
  b.textContent = ok ? 'SAVED ✓' : 'NOT SET';
  b.className = 'apikey-badge ' + (ok?'ok':'no');
  d.className = 'api-dot ' + (ok?'live':'');
  l.textContent = ok ? 'Groq Connected' : 'Setup Required';
  if(ok) saveLocal('groqKey', k);
}

// ── FIREBASE ───────────────────────────────────────────────────
async function testFirebase() {
  const raw = document.getElementById('fbConfig').value.trim();
  if(!raw) { toast('Paste your Firebase config first!','warn'); return; }
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if(!match) throw new Error('Could not find config object');
    const cfg = eval('('+match[0]+')');
    const ok = window.initFirebase(cfg);
    if(ok) {
      document.getElementById('fbBadge').textContent = 'CONNECTED ✓';
      document.getElementById('fbBadge').className = 'apikey-badge ok';
      saveLocal('fbConfig', match[0]);
      toast('🔥 Firebase connected!','success');
    }
  } catch(e) { toast('Firebase error: '+e.message,'error'); }
}

// ── SAVE ALL ───────────────────────────────────────────────────
function saveAll() {
  const k = document.getElementById('groqKey').value.trim();
  if(!k.startsWith('gsk_')) { toast('Enter your Groq API key first!','warn'); return; }
  const roles = getChips('roleChips');
  const locs = getChips('locChips');
  if(!roles.length) { toast('Add at least one target job role!','warn'); return; }

  const profile = {
    name: document.getElementById('pName').value,
    exp: document.getElementById('pExp').value,
    role: document.getElementById('pRole').value,
    industry: document.getElementById('pIndustry').value,
    skills: document.getElementById('pSkills').value,
    achieve: document.getElementById('pAchieve').value,
    roles: roles,
    locs: locs,
    minSal: document.getElementById('minSal').value,
    shift: document.getElementById('shiftPref').value,
  };
  saveLocal('profile', profile);
  saveLocal('groqKey', k);
  toast('✅ Everything saved! Starting your hunt...','success');
  setTimeout(()=>{ gp('dash'); updateDashStats(); }, 700);
}

// ── BOOT (restore saved data) ──────────────────────────────────
(function boot() {
  const k = loadLocal('groqKey','');
  if(k) { document.getElementById('groqKey').value = k; checkGroq(); }
  const fc = loadLocal('fbConfig','');
  if(fc) {
    document.getElementById('fbConfig').value = fc;
    try { const cfg = eval('('+fc+')'); window.initFirebase(cfg);
      document.getElementById('fbBadge').textContent = 'CONNECTED ✓';
      document.getElementById('fbBadge').className = 'apikey-badge ok';
    } catch(e){}
  }
  const p = loadLocal('profile',null);
  if(p) {
    if(p.name) document.getElementById('pName').value = p.name;
    if(p.exp) document.getElementById('pExp').value = p.exp;
    if(p.role) document.getElementById('pRole').value = p.role;
    if(p.industry) document.getElementById('pIndustry').value = p.industry;
    if(p.skills) document.getElementById('pSkills').value = p.skills;
    if(p.achieve) document.getElementById('pAchieve').value = p.achieve;
    if(p.minSal) document.getElementById('minSal').value = p.minSal;
    if(p.shift) document.getElementById('shiftPref').value = p.shift;
    // Restore dynamic chips
    if(p.roles) p.roles.forEach(r=>{ document.getElementById('roleInput').value=r; addChip('roleChips','roleInput'); });
    if(p.locs) p.locs.forEach(l=>{ document.getElementById('locInput').value=l; addChip('locChips','locInput'); });
  }
  APP.tracker = loadLocal('tracker',[]);
  setTimeout(updateDashStats, 800);
})();

// ── GROQ API CALL ──────────────────────────────────────────────
async function callGroq(prompt) {
  const key = loadLocal('groqKey','');
  if(!key) throw new Error('No Groq API key set. Go to Setup tab.');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+key },
    body: JSON.stringify({ model:'llama-3.3-70b-versatile', messages:[{role:'user',content:prompt}], temperature:0.7, max_tokens:2000 })
  });
  if(!res.ok){ const e=await res.json(); throw new Error(e.error?.message||`HTTP ${res.status}`); }
  const d = await res.json();
  return d.choices[0].message.content;
}

// ── LOG ────────────────────────────────────────────────────────
function log(msg, cls='log-i') {
  const b = document.getElementById('logBox');
  const t = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d = document.createElement('div');
  d.className = 'log-line';
  d.innerHTML = `<span class="log-t">${t}</span><span class="${cls}"> ${msg}</span>`;
  b.appendChild(d); b.scrollTop = b.scrollHeight;
}

// ── SCAN & MATCH (AI-GENERATED JOBS) ───────────────────────────
async function startScan() {
  const key = loadLocal('groqKey','');
  if(!key) { toast('Set up your Groq API key first!','warn'); gp('setup'); return; }
  const p = loadLocal('profile',null);
  if(!p || !p.roles?.length) { toast('Set up your profile and add target roles first!','warn'); gp('setup'); return; }

  const btn = document.getElementById('scanBtn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> AI Scanning...';
  const wrap = document.getElementById('jobsWrap');
  wrap.innerHTML = `<div class="empty-state"><div class="empty-icon" style="animation:spin 1.2s linear infinite">⚙️</div><h4>AI Scanning...</h4><p>Generating and scoring jobs matched to your profile</p></div>`;

  const portals = [];
  if(document.getElementById('cp-naukri')?.classList.contains('on')) portals.push('Naukri');
  if(document.getElementById('cp-linkedin')?.classList.contains('on')) portals.push('LinkedIn');
  if(document.getElementById('cp-indeed')?.classList.contains('on')) portals.push('Indeed');
  if(document.getElementById('cp-glassdoor')?.classList.contains('on')) portals.push('Glassdoor');

  log(`Roles: ${p.roles.join(', ')}`);
  log(`Locations: ${(p.locs||['Any']).join(', ')} · Portals: ${portals.join(', ')}`);
  log('Asking Groq AI to find & score jobs...');

  const prompt = `You are a job search AI. Generate 10-12 realistic job listings and score them for a candidate.

CANDIDATE PROFILE:
- Name: ${p.name || 'Job Seeker'}
- Experience: ${p.exp || 'Not specified'}
- Current Role: ${p.role || 'Not specified'}
- Industry: ${p.industry || 'Not specified'}
- Skills: ${p.skills || 'Not specified'}
- Key Achievement: ${p.achieve || 'Not specified'}
- Target Roles: ${p.roles.join(', ')}
- Preferred Locations: ${(p.locs||[]).join(', ') || 'Any'}
- Work Preference: ${p.shift || 'Any'}
- Min Salary: ${p.minSal || 'Not specified'}

PORTALS TO USE: ${portals.join(', ') || 'LinkedIn, Indeed'}

Generate REALISTIC job listings that would actually exist on these portals for the target roles. Return ONLY a valid JSON array, no markdown, no explanation:

[{
  "id": 1,
  "company": "Real Company Name",
  "title": "Exact Job Title",
  "loc": "City",
  "portal": "linkedin",
  "salary": "salary range",
  "exp": "experience range",
  "shift": "Day/Remote/Hybrid",
  "url": "https://portal-url.com/careers",
  "skills": ["skill1","skill2","skill3","skill4","skill5"],
  "score": 85,
  "verdict": "STRONG MATCH",
  "reasons": "10-15 word specific reason why this matches",
  "apply": true
}, ...]

RULES:
- Use REAL well-known companies that hire for these roles
- score: 0-100 (skills overlap 50%, location 20%, work-type 20%, salary 10%)
- "STRONG MATCH" ≥75, "GOOD MATCH" 55-74, "WEAK MATCH" <55
- Vary scores realistically (not all high)
- skills array: 5-7 relevant skills for each job
- Each job should have a portal from: ${portals.map(p=>p.toLowerCase()).join(', ')}`;

  try {
    const raw = await callGroq(prompt);
    const clean = raw.replace(/```json|```/g,'').trim();
    APP.jobs = JSON.parse(clean);
    APP.jobs.sort((a,b)=>b.score-a.score);
    log(`✓ Found ${APP.jobs.length} jobs!`, 'log-ok');
  } catch(e) {
    log('AI response parse error: '+e.message, 'log-e');
    toast('Error parsing AI response. Try again!','error');
    btn.disabled = false; btn.innerHTML = '🔍 Scan & Match Jobs'; return;
  }

  document.getElementById('sFound').textContent = APP.jobs.length;
  renderJobs(); updateDashStats();
  btn.disabled = false; btn.innerHTML = '🔄 Refresh Scan';
  document.getElementById('jobsLabel').textContent = `${APP.jobs.length} matched`;
  toast(`Found ${APP.jobs.length} jobs matched to your profile!`,'success');
}

// ── RENDER JOBS ────────────────────────────────────────────────
function renderJobs() {
  const wrap = document.getElementById('jobsWrap');
  const sortBy = document.getElementById('sortBy')?.value||'score';
  const showF = document.getElementById('showFilter')?.value||'all';
  let jobs = [...APP.jobs];
  if(showF==='pending') jobs = jobs.filter(j=>!isApplied(j.id));
  else if(showF==='applied') jobs = jobs.filter(j=>isApplied(j.id));
  else if(showF==='top') jobs = jobs.filter(j=>j.score>=75);
  if(sortBy==='score') jobs.sort((a,b)=>b.score-a.score);
  else if(sortBy==='company') jobs.sort((a,b)=>a.company.localeCompare(b.company));

  if(!jobs.length){ wrap.innerHTML=`<div class="empty-state"><div class="empty-icon">🔍</div><h4>No Results</h4><p>Try adjusting filters or scanning again.</p></div>`; return; }

  const mySkills = (loadLocal('profile',null)?.skills||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);

  wrap.innerHTML = jobs.map((j,i)=>{
    const sc = j.score>=75?'h':j.score>=55?'m':'l';
    const applied = isApplied(j.id);
    const top5 = i<5&&!applied;
    const pi = {naukri:'📋 NAUKRI',linkedin:'💼 LINKEDIN',indeed:'🔍 INDEED',glassdoor:'🏢 GLASSDOOR'}[j.portal?.toLowerCase()]||'💼 '+j.portal;
    const matched = (j.skills||[]).filter(s=>mySkills.some(ms=>ms&&s.toLowerCase().includes(ms)));
    const other = (j.skills||[]).filter(s=>!matched.includes(s));

    return `<div class="job-card ${applied?'applied':''} fu" style="animation-delay:${i*.05}s">
      <div class="jc-row1">
        <div class="jc-left">
          <div class="jc-portal-tag">${pi}</div>
          <div class="jc-company">${j.company}</div>
          <div class="jc-title">${j.title}</div>
        </div>
        <div class="score-block"><div class="score-num ${sc}">${j.score}</div><div class="score-pct">% Match</div></div>
      </div>
      <div class="jc-pills">
        <span class="jpill">📍 ${j.loc}</span>
        <span class="jpill">💰 ${j.salary}</span>
        <span class="jpill">⏱ ${j.exp||''}</span>
        <span class="jpill">🕐 ${j.shift||'Day'}</span>
        ${top5?'<span class="jpill top">★ TOP PICK</span>':''}
        ${applied?'<span class="jpill done">✓ Applied</span>':''}
        <span class="jpill">${j.verdict}</span>
      </div>
      <div class="jc-ai"><strong>AI:</strong> ${j.reasons}</div>
      <div class="jc-skills">
        ${matched.map(s=>`<span class="stag match">✓ ${s}</span>`).join('')}
        ${other.map(s=>`<span class="stag">${s}</span>`).join('')}
      </div>
      <div class="jc-actions">
        <button class="jbtn primary" onclick="window.open('${j.url||'#'}','_blank')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Apply Now</button>
        <button class="jbtn" onclick="openCoverModal(${j.id})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Cover Note</button>
        ${applied
          ?`<button class="jbtn" onclick="undoApply(${j.id})">↩ Undo</button>`
          :`<button class="jbtn teal" onclick="markApply(${j.id})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/></svg>Mark Applied</button>`}
      </div>
    </div>`;
  }).join('');
}

// ── APPLIED TRACKING ───────────────────────────────────────────
function isApplied(id) { return APP.tracker.some(t=>t.jobId===id&&t.status==='applied'); }

async function markApply(id) {
  const j = APP.jobs.find(x=>x.id===id); if(!j) return;
  const entry = { jobId:id, company:j.company, title:j.title, loc:j.loc, score:j.score, portal:j.portal, status:'applied', dateStr:new Date().toDateString(), timestamp:Date.now() };
  if(window.fbReady && window.fbReady()) {
    try { const fb=window._firebase; const ref=await fb.addDoc(fb.collection(window._db,'applications'),{...entry,createdAt:fb.Timestamp.now()}); entry.fbId=ref.id; toast(`✅ Saved: ${j.company}`,'success'); } catch(e){ toast('DB save failed, using local','warn'); }
  } else { toast(`✅ Applied: ${j.company} (local)`,'success'); }
  APP.tracker = APP.tracker.filter(t=>t.jobId!==id); APP.tracker.push(entry); saveLocal('tracker',APP.tracker);
  log(`✓ Applied: ${j.company} — ${j.title}`, 'log-ok');
  renderJobs(); updateDashStats();
}

async function undoApply(id) {
  APP.tracker = APP.tracker.filter(t=>t.jobId!==id); saveLocal('tracker',APP.tracker);
  if(window.fbReady&&window.fbReady()){ try{ const fb=window._firebase; const s=await fb.getDocs(fb.query(fb.collection(window._db,'applications'),fb.where('jobId','==',id))); s.forEach(async d=>{await fb.deleteDoc(fb.doc(window._db,'applications',d.id));}); }catch(e){} }
  renderJobs(); updateDashStats(); toast('Application removed','info');
}

// ── TRACKER ────────────────────────────────────────────────────
async function loadTracker() {
  const body = document.getElementById('trackerBody');
  body.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:40px">Loading...</td></tr>`;
  let data = [];
  if(window.fbReady&&window.fbReady()){
    try{ const fb=window._firebase; const s=await fb.getDocs(fb.query(fb.collection(window._db,'applications'),fb.orderBy('createdAt','desc'))); data=s.docs.map(d=>({...d.data(),fbId:d.id})); APP.allTracker=data; APP.tracker=data; saveLocal('tracker',data); }catch(e){ data=loadLocal('tracker',[]); APP.allTracker=data; }
  } else { data=loadLocal('tracker',[]); APP.allTracker=data; }
  renderTrackerTable(data); updateDashStats(); updateGoalBar(data);
}

function renderTrackerTable(data) {
  const body = document.getElementById('trackerBody');
  if(!data.length){ body.innerHTML=`<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:50px;font-size:13px">No applications yet. Start from the Hunt tab!</td></tr>`; return; }
  body.innerHTML = data.map((t,i)=>{
    const sc=t.score>=75?'h':t.score>=55?'m':'l';
    const pi={naukri:'📋',linkedin:'💼',indeed:'🔍',glassdoor:'🏢'}[t.portal?.toLowerCase()]||'💼';
    return`<tr><td style="color:var(--muted);font-family:var(--mono);font-size:11px">${data.length-i}</td><td><div class="tbl-company">${t.company}</div></td><td><div class="tbl-role" title="${t.title}">${t.title}</div></td><td style="color:var(--sub);font-size:12px">${t.loc}</td><td><span class="score-sm ${sc}">${t.score}%</span></td><td style="font-size:12px">${pi}</td><td><span class="status-badge sb-${t.status||'pending'}">${(t.status||'pending').toUpperCase()}</span></td><td style="color:var(--muted);font-family:var(--mono);font-size:10px;white-space:nowrap">${t.dateStr||'—'}</td><td><select class="action-sel" onchange="updateStatus('${t.fbId||''}',${t.jobId||0},this.value,'${t.company}')"><option ${t.status==='applied'?'selected':''} value="applied">Applied</option><option ${t.status==='interview'?'selected':''} value="interview">Interview</option><option ${t.status==='offer'?'selected':''} value="offer">Offer</option><option ${t.status==='rejected'?'selected':''} value="rejected">Rejected</option><option ${t.status==='pending'?'selected':''} value="pending">Pending</option></select></td><td><button class="tbl-del" onclick="deleteApp('${t.fbId||''}',${t.jobId||0})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td></tr>`;
  }).join('');
}

async function updateStatus(fbId,jobId,status,company) {
  if(fbId&&window.fbReady&&window.fbReady()){ try{ const fb=window._firebase; await fb.updateDoc(fb.doc(window._db,'applications',fbId),{status}); }catch(e){} }
  const local=loadLocal('tracker',[]); const idx=local.findIndex(t=>t.fbId===fbId||t.jobId===jobId);
  if(idx>=0){ local[idx].status=status; saveLocal('tracker',local); APP.tracker=local; }
  const msgs={interview:'🎉 Interview!',offer:'🏆 Offer!',rejected:'Keep going!',applied:'Applied',pending:'Pending'};
  toast(`${company}: ${msgs[status]||status}`,status==='offer'||status==='interview'?'success':'info');
  updateDashStats();
}

async function deleteApp(fbId,jobId) {
  if(!confirm('Remove this application?')) return;
  if(fbId&&window.fbReady&&window.fbReady()){ try{ const fb=window._firebase; await fb.deleteDoc(fb.doc(window._db,'applications',fbId)); }catch(e){} }
  const local=loadLocal('tracker',[]).filter(t=>t.fbId!==fbId&&t.jobId!==jobId); saveLocal('tracker',local); APP.tracker=local;
  APP.allTracker=APP.allTracker.filter(t=>t.fbId!==fbId&&t.jobId!==jobId); loadTracker(); toast('Deleted','info');
}

function filterTable() {
  const q=document.getElementById('tblSearch').value.toLowerCase();
  const s=document.getElementById('tblStatusFilter').value;
  let data=[...APP.allTracker];
  if(q) data=data.filter(t=>t.company?.toLowerCase().includes(q)||t.title?.toLowerCase().includes(q));
  if(s) data=data.filter(t=>t.status===s);
  renderTrackerTable(data);
}

function updateGoalBar(data) {
  const today=new Date().toDateString();
  const c=data.filter(t=>t.dateStr===today&&t.status==='applied').length;
  document.getElementById('goalBar').style.width=Math.min(100,(c/5)*100)+'%';
  document.getElementById('goalCount').textContent=`${c}/5`;
}

function exportCSV() {
  const data=APP.allTracker; if(!data.length){toast('No data','warn');return;}
  const cols=['company','title','loc','score','portal','status','dateStr'];
  const csv=[cols.join(','),...data.map(r=>cols.map(c=>`"${r[c]||''}"`).join(','))].join('\n');
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='jobbot_applications.csv'; a.click(); toast('CSV exported!','success');
}

// ── DASHBOARD STATS ────────────────────────────────────────────
async function updateDashStats() {
  let data=APP.tracker.length?APP.tracker:loadLocal('tracker',[]);
  const today=new Date().toDateString();
  const todayA=data.filter(t=>t.dateStr===today&&t.status==='applied').length;
  const scores=APP.jobs.map(j=>j.score);
  const avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null;
  document.getElementById('sToday').textContent=todayA;
  document.getElementById('sTotal').textContent=data.length;
  document.getElementById('sAvg').textContent=avg?avg+'%':'—';
  document.getElementById('sTodayTrend').textContent=todayA>=5?'🎯 Goal!':todayA>0?`+${todayA}`:'';
}

// ── ANALYTICS ──────────────────────────────────────────────────
async function loadAnalytics() {
  let data=APP.allTracker.length?APP.allTracker:loadLocal('tracker',[]);
  if(window.fbReady&&window.fbReady()){ try{ const fb=window._firebase; const s=await fb.getDocs(fb.collection(window._db,'applications')); data=s.docs.map(d=>d.data()); APP.allTracker=data; }catch(e){} }
  const interviews=data.filter(t=>t.status==='interview').length;
  const offers=data.filter(t=>t.status==='offer').length;
  const rate=data.length?Math.round(((interviews+offers)/data.length)*100):0;
  const best=data.length?Math.max(...data.map(t=>t.score||0)):0;
  const weekAgo=Date.now()-7*24*3600*1000;
  document.getElementById('aWeek').textContent=data.filter(t=>t.timestamp>weekAgo).length;
  document.getElementById('aInter').textContent=interviews;
  document.getElementById('aRate').textContent=rate+'%';
  document.getElementById('aBest').textContent=best?best+'%':'—';

  const days=[],counts=[];
  for(let i=13;i>=0;i--){ const d=new Date();d.setDate(d.getDate()-i); days.push(d.toLocaleDateString('en-IN',{month:'short',day:'numeric'})); counts.push(data.filter(t=>t.dateStr===d.toDateString()).length); }
  const statuses=['applied','interview','offer','rejected','pending'];
  const statusCounts=statuses.map(s=>data.filter(t=>t.status===s).length);
  const coMap={};data.forEach(t=>{coMap[t.company]=(coMap[t.company]||0)+1;});
  const companies=Object.entries(coMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const portalMap={};data.forEach(t=>{const p=(t.portal||'').toLowerCase();portalMap[p]=(portalMap[p]||0)+1;});

  const darkOpts={chart:{background:'transparent',foreColor:'#7C8DB5'},grid:{borderColor:'rgba(255,255,255,0.07)'},tooltip:{theme:'dark'},dataLabels:{enabled:false}};
  if(!window.ApexCharts) return;

  document.getElementById('chartTimeline').innerHTML='';
  new ApexCharts(document.getElementById('chartTimeline'),{...darkOpts,chart:{...darkOpts.chart,type:'area',height:200,toolbar:{show:false}},series:[{name:'Applications',data:counts}],xaxis:{categories:days,labels:{style:{fontSize:'10px',colors:'#4A5568'}}},yaxis:{labels:{style:{colors:'#4A5568'}},min:0,forceNiceScale:true},fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:.4,opacityTo:.05,stops:[0,100]}},stroke:{curve:'smooth',width:2.5},colors:['#FF6B35']}).render();

  document.getElementById('chartStatus').innerHTML='';
  new ApexCharts(document.getElementById('chartStatus'),{...darkOpts,chart:{...darkOpts.chart,type:'donut',height:200,toolbar:{show:false}},series:statusCounts,labels:statuses.map(s=>s.charAt(0).toUpperCase()+s.slice(1)),colors:['#00D9AA','#4F8EF7','#A78BFA','#FF4757','#F5C842'],legend:{position:'bottom',labels:{colors:'#7C8DB5'},fontSize:'11px'},plotOptions:{pie:{donut:{size:'65%'}}}}).render();

  document.getElementById('chartCompany').innerHTML='';
  new ApexCharts(document.getElementById('chartCompany'),{...darkOpts,chart:{...darkOpts.chart,type:'bar',height:200,toolbar:{show:false}},series:[{name:'Apps',data:companies.map(c=>c[1])}],xaxis:{categories:companies.map(c=>c[0]),labels:{style:{fontSize:'10px',colors:'#4A5568'}}},yaxis:{labels:{style:{colors:'#4A5568'}},min:0,forceNiceScale:true},colors:['#FF6B35'],plotOptions:{bar:{borderRadius:5,columnWidth:'55%'}}}).render();

  const pLabels=Object.keys(portalMap).filter(k=>portalMap[k]>0);
  const pValues=pLabels.map(k=>portalMap[k]);
  document.getElementById('chartPortal').innerHTML='';
  if(pLabels.length) new ApexCharts(document.getElementById('chartPortal'),{...darkOpts,chart:{...darkOpts.chart,type:'pie',height:200,toolbar:{show:false}},series:pValues,labels:pLabels.map(l=>l.charAt(0).toUpperCase()+l.slice(1)),colors:['#FF6B35','#4F8EF7','#00D9AA','#A78BFA'],legend:{position:'bottom',labels:{colors:'#7C8DB5'},fontSize:'11px'}}).render();
}

// ── COVER NOTES ────────────────────────────────────────────────
function buildCoverPrompt(company, title, jd) {
  const p = loadLocal('profile',null)||{};
  return `Write a professional cover note for this job application.

CANDIDATE: ${p.name||'Job Seeker'}
Experience: ${p.exp||'Not specified'}
Current Role: ${p.role||'Not specified'}
Industry: ${p.industry||'Not specified'}
Skills: ${p.skills||'Not specified'}
Key Achievement: ${p.achieve||'Not specified'}

JOB: ${title||'Role'} at ${company||'Company'}
JOB DESCRIPTION:
${jd||'Not provided'}

Write a 160-190 word cover note:
- Subject line at top
- Strong opening (NOT "I am writing to...")
- 2-3 specific matching skills from JD
- One achievement with a number
- Professional, confident tone
- Clear call to action
- Sign off as ${p.name||'[Your Name]'}`;
}

async function genCustomCover() {
  const jd=document.getElementById('customJD').value.trim();
  if(!jd){toast('Paste a job description!','warn');return;}
  showLoad('Writing cover note...');
  try{ const note=await callGroq(buildCoverPrompt('Custom','',jd)); document.getElementById('coverOutLabel').textContent='Custom Cover Note'; document.getElementById('coverPre').textContent=note; document.getElementById('coverOutput').style.display='block'; document.getElementById('coverSaveStatus').textContent=''; hideLoad(); }catch(e){hideLoad();toast('Error: '+e.message,'error');}
}

async function genColdEmail() {
  const co=document.getElementById('coldCo').value.trim();
  const role=document.getElementById('coldRole').value.trim();
  if(!co||!role){toast('Fill company and role!','warn');return;}
  showLoad('Writing cold email...');
  try{ const p=loadLocal('profile',null)||{};
    const email=await callGroq(`Write a cold outreach email from a job seeker to HR/recruiter.\n\nSENDER: ${p.name||'Job Seeker'}\nExp: ${p.exp||'Entry level'}\nCurrent: ${p.role||'Not specified'}\nSkills: ${p.skills||'Not specified'}\nAchievement: ${p.achieve||'Not specified'}\n\nTARGET: ${co}\nROLE: ${role}\n\nWrite 140-160 word cold email:\n- Subject line\n- Direct, confident, not generic\n- Show specific value\n- Ask for a brief call\n- Professional sign-off`);
    document.getElementById('coverOutLabel').textContent=`Cold Email → ${co}`; document.getElementById('coverPre').textContent=email; document.getElementById('coverOutput').style.display='block'; document.getElementById('coverSaveStatus').textContent=''; hideLoad();
  }catch(e){hideLoad();toast('Error: '+e.message,'error');}
}

async function openCoverModal(jobId) {
  const j=APP.jobs.find(x=>x.id===jobId); if(!j)return;
  document.getElementById('modalTitle').textContent=`${j.company} — ${j.title}`;
  document.getElementById('modalPre').textContent='';
  document.getElementById('modalLoading').style.display='block';
  document.getElementById('coverModal').classList.add('on');
  try{ const note=await callGroq(buildCoverPrompt(j.company,j.title,`Skills: ${(j.skills||[]).join(', ')}. Location: ${j.loc}. Salary: ${j.salary}.`));
    document.getElementById('modalLoading').style.display='none'; document.getElementById('modalPre').textContent=note; saveCoverToDB(j.company,j.title,note);
  }catch(e){ document.getElementById('modalLoading').style.display='none'; document.getElementById('modalPre').textContent='Error: '+e.message; }
}

async function saveCoverToDB(company,role,note) {
  if(window.fbReady&&window.fbReady()){ try{ const fb=window._firebase; await fb.addDoc(fb.collection(window._db,'coverNotes'),{company,role,note,date:new Date().toDateString(),createdAt:fb.Timestamp.now()}); }catch(e){} }
  const covers=loadLocal('covers',[]); covers.unshift({company,role,note,date:new Date().toDateString()}); saveLocal('covers',covers.slice(0,20));
}

async function saveCoverNote() { const note=document.getElementById('coverPre').textContent; const label=document.getElementById('coverOutLabel').textContent; await saveCoverToDB(label,'',note); document.getElementById('coverSaveStatus').textContent='✓ Saved!'; toast('Saved!','success'); }

async function loadCoverNotes() {
  let notes=[];
  if(window.fbReady&&window.fbReady()){ try{ const fb=window._firebase; const s=await fb.getDocs(fb.query(fb.collection(window._db,'coverNotes'),fb.orderBy('createdAt','desc'))); notes=s.docs.map(d=>({...d.data(),fbId:d.id})); }catch(e){notes=loadLocal('covers',[]); } } else { notes=loadLocal('covers',[]); }
  const wrap=document.getElementById('savedNotesWrap');
  if(!notes.length){wrap.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">No saved notes yet.</div>';return;}
  wrap.innerHTML=notes.slice(0,10).map((n,i)=>`<div class="saved-note fu" style="animation-delay:${i*.04}s"><div class="sn-head"><div><div class="sn-company">${n.company}</div><div class="sn-role">${n.role||''}</div></div><div class="sn-date">${n.date||''}</div></div><div class="sn-preview">${(n.note||'').substring(0,180)}...</div><div class="sn-actions"><button class="out-btn" onclick="navigator.clipboard.writeText(window._cvNotes[${i}].note);toast('Copied!','success')">📋 Copy</button><button class="out-btn" onclick="expandNote(${i})" id="expBtn${i}">⬇ Full</button></div><div id="fullNote${i}" style="display:none;margin-top:12px;font-size:13px;line-height:1.8;color:var(--sub);white-space:pre-wrap;background:rgba(0,0,0,.2);padding:14px;border-radius:10px">${n.note||''}</div></div>`).join('');
  window._cvNotes=notes;
}

function expandNote(i) { const el=document.getElementById('fullNote'+i); const btn=document.getElementById('expBtn'+i); if(el.style.display==='none'){el.style.display='block';btn.textContent='⬆ Hide';}else{el.style.display='none';btn.textContent='⬇ Full';} }
function closeModal() { document.getElementById('coverModal').classList.remove('on'); }
function copyModal() { navigator.clipboard.writeText(document.getElementById('modalPre').textContent); toast('📋 Copied!','success'); }
function copyCoverOut() { navigator.clipboard.writeText(document.getElementById('coverPre').textContent); toast('📋 Copied!','success'); }
