// ═══════════════════════════════════════════════════════════════
// JOBBOT PRO v3 — Frontend JS (with Auth)
// ═══════════════════════════════════════════════════════════════
const APP = { jobs: [], tracker: [], covers: [], allTracker: [], usage: { count: 0, limit: 3, plan: 'free', planExpiry: null } };
const API = '';

// ── AUTH CHECK ─────────────────────────────────────────────────
function getToken() { return localStorage.getItem('jbp_token'); }
function getUser() { try { return JSON.parse(localStorage.getItem('jbp_user')); } catch { return null; } }

function isTokenValid() {
  const token = getToken();
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    // Check if token has expired
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch { return false; }
}

function requireAuth() {
  if (!isTokenValid()) {
    // Clear any stale/expired auth data
    localStorage.removeItem('jbp_token');
    localStorage.removeItem('jbp_user');
    localStorage.removeItem('jbp_profile');
    window.location.href = '/login';
    return false;
  }
  return true;
}

function logout() {
  localStorage.removeItem('jbp_token');
  localStorage.removeItem('jbp_user');
  localStorage.removeItem('jbp_profile');
  window.location.href = '/login';
}

// Auth headers for all API calls
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
}

async function apiFetch(url, opts = {}) {
  opts.headers = { ...authHeaders(), ...opts.headers };
  const res = await fetch(API + url, opts);
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  return res;
}

// Redirect to login if not authenticated
if (!requireAuth()) { throw new Error('redirect'); }

// ── SETUP USER INFO IN NAV ─────────────────────────────────────
(function setupUserNav() {
  const user = getUser();
  if (user) {
    const el = document.getElementById('userNameNav');
    if (el) el.textContent = user.name || user.email || 'User';
    const av = document.getElementById('userAvatar');
    if (av) av.textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
  }
})();

// ── USAGE TRACKING UI ──────────────────────────────────────────
function updateUsageUI(usage) {
  if (!usage) return;
  APP.usage = usage;
  const bar = document.getElementById('usageBar');
  const dotsEl = document.getElementById('usageDots');
  const labelEl = document.getElementById('usageLabelText');
  const countEl = document.getElementById('usageCountLabel');
  if (!bar) return;

  if (usage.plan !== 'free') {
    // Pro user
    bar.classList.add('pro');
    labelEl.textContent = usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1) + ' Pro';
    dotsEl.innerHTML = '';
    countEl.textContent = '∞ Unlimited';
    countEl.className = 'usage-count pro';
    return;
  }

  // Free user — show dots
  const remaining = Math.max(0, usage.limit - usage.count);
  bar.classList.remove('pro');
  labelEl.textContent = 'Free Plan';
  let dots = '';
  for (let i = 0; i < usage.limit; i++) {
    dots += `<span class="usage-dot ${i < usage.count ? 'used' : 'available'}"></span>`;
  }
  dotsEl.innerHTML = dots;
  countEl.textContent = remaining > 0 ? `${remaining} use${remaining === 1 ? '' : 's'} left` : 'No uses left';
  countEl.className = 'usage-count' + (remaining === 0 ? ' warn' : '');
}

async function loadUsage() {
  try {
    const res = await apiFetch('/api/usage');
    const data = await res.json();
    if (data.success) {
      updateUsageUI({ count: data.count, limit: data.limit, plan: data.plan, planExpiry: data.planExpiry });
    }
  } catch(e) {}
}

function showUpgradeModal() {
  document.getElementById('upgradeModal').classList.add('on');
}
function closeUpgradeModal() {
  document.getElementById('upgradeModal').classList.remove('on');
}

async function activatePlan(planType) {
  const btn = event.target;
  btn.disabled = true; btn.textContent = 'Activating...';
  try {
    // 1. Create order
    const res = await apiFetch('/api/create-order', { method: 'POST', body: JSON.stringify({ plan: planType }) });
    const orderData = await res.json();
    if (!orderData.success) throw new Error(orderData.error);
    
    // 2. Open Razorpay Checkout
    const options = {
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'JobBot Pro',
      description: `${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan`,
      order_id: orderData.order_id,
      theme: { color: '#00D9AA' },
      handler: async function (response) {
        // 3. Verify payment
        try {
          btn.textContent = 'Verifying...';
          const verifyRes = await apiFetch('/api/verify-payment', {
            method: 'POST',
            body: JSON.stringify({
              plan: planType,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          const verifyData = await verifyRes.json();
          if (!verifyData.success) throw new Error(verifyData.error);
          
          toast(`🎉 ${planType.charAt(0).toUpperCase() + planType.slice(1)} plan activated!`, 'success');
          closeUpgradeModal();
          await loadUsage();
        } catch (e) {
          toast('Verification failed: ' + e.message, 'error');
          btn.disabled = false;
          btn.textContent = planType === 'weekly' ? 'Get Weekly' : 'Get Monthly';
        }
      },
      prefill: {
        name: getUser()?.name || '',
        email: getUser()?.email || ''
      },
      modal: {
        ondismiss: function() {
          btn.disabled = false;
          btn.textContent = planType === 'weekly' ? 'Get Weekly' : 'Get Monthly';
        }
      }
    };
    
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response){
      toast('Payment failed: ' + response.error.description, 'error');
    });
    rzp.open();
    
  } catch(e) {
    toast('Upgrade failed: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = planType === 'weekly' ? 'Get Weekly' : 'Get Monthly';
  }
}

function handleLimitError(e) {
  if (e?.error === 'FREE_LIMIT_REACHED' || e?.message?.includes('FREE_LIMIT_REACHED')) {
    showUpgradeModal();
    return true;
  }
  return false;
}

// ── CLOCK ──────────────────────────────────────────────────────
function tick() { const el=document.getElementById('navClock'); if(el) el.textContent=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
setInterval(tick,1000); tick();
document.getElementById('scanDate').textContent = new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short'});

// ── TOAST ──────────────────────────────────────────────────────
function toast(msg, type='info', duration=3500) {
  const icons={success:'✅',error:'❌',info:'ℹ️',warn:'⚠️'};
  const c=document.getElementById('toast-container');
  const t=document.createElement('div'); t.className=`toast ${type}`;
  t.innerHTML=`<div class="toast-icon">${icons[type]||'ℹ️'}</div><div class="toast-msg">${msg}</div><span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
  c.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),350);},duration);
}

function showLoad(msg='Processing...'){document.getElementById('loadingText').textContent=msg;document.getElementById('loadingOverlay').classList.add('on');}
function hideLoad(){document.getElementById('loadingOverlay').classList.remove('on');}

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

// ── LOCAL STORAGE ──────────────────────────────────────────────
function saveLocal(key,val){localStorage.setItem('jbp_'+key,JSON.stringify(val));}
function loadLocal(key,def=null){try{return JSON.parse(localStorage.getItem('jbp_'+key))||def;}catch{return def;}}

// ── DYNAMIC CHIPS ──────────────────────────────────────────────
function addChip(containerId,inputId){
  const input=document.getElementById(inputId); const val=input.value.trim(); if(!val) return;
  const container=document.getElementById(containerId);
  const existing=[...container.querySelectorAll('.chip')].map(c=>c.dataset.v);
  if(existing.includes(val)){toast('Already added!','warn');return;}
  const chip=document.createElement('span');chip.className='chip on';chip.dataset.v=val;
  const isTeal=containerId==='locChips'; if(isTeal) chip.classList.add('teal');
  chip.innerHTML=`${isTeal?'📍 ':''}${val} <span class="chip-x" onclick="event.stopPropagation();this.parentElement.remove()">✕</span>`;
  chip.addEventListener('click',()=>chip.classList.toggle('on'));
  container.appendChild(chip); input.value=''; input.focus();
}
document.getElementById('roleInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addChip('roleChips','roleInput');}});
document.getElementById('locInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addChip('locChips','locInput');}});
function getChips(id){return[...document.querySelectorAll(`#${id} .chip.on`)].map(c=>c.dataset.v||c.textContent.replace(/📍|🌐|✕/g,'').trim());}

// ── SAVE PROFILE ───────────────────────────────────────────────
async function saveAll() {
  const roles=getChips('roleChips'); const locs=getChips('locChips');
  const name=document.getElementById('pName').value.trim();
  const exp=document.getElementById('pExp').value.trim();
  const role=document.getElementById('pRole').value.trim();
  const industry=document.getElementById('pIndustry').value.trim();
  const skills=document.getElementById('pSkills').value.trim();
  const achieve=document.getElementById('pAchieve').value.trim();
  const minSal=document.getElementById('minSal').value.trim();

  if(!name || !exp || !role || !industry || !skills || !achieve || !minSal || !roles.length || !locs.length){
    toast('Please fill all profile and preference fields!','warn');
    return;
  }

  const profile={
    name, exp, role, industry, skills, achieve,
    roles, locs, minSal, shift:document.getElementById('shiftPref').value,
  };
  saveLocal('profile',profile);
  // Also save to Firebase user profile
  try { await apiFetch('/api/auth/profile', { method:'PUT', body:JSON.stringify(profile) }); } catch(e) {}
  toast('✅ Profile saved! Starting your hunt...','success');
  setTimeout(()=>{gp('dash');updateDashStats();},700);
}

// ── BOOT ───────────────────────────────────────────────────────
(async function boot(){
  // Try to load profile + usage from server first
  try {
    const res = await apiFetch('/api/auth/me');
    const data = await res.json();
    if (data.success) {
      if (data.user?.profile && Object.keys(data.user.profile).length) {
        saveLocal('profile', data.user.profile);
      }
      if (data.usage) updateUsageUI(data.usage);
    }
  } catch(e) {}

  // Profile is kept in localStorage for scan/cover features,
  // but setup form fields are NOT pre-filled on page load.
  APP.tracker=loadLocal('tracker',[]);
  setTimeout(updateDashStats,800);
})();

// ── LOG ────────────────────────────────────────────────────────
function log(msg,cls='log-i'){
  const b=document.getElementById('logBox');
  const t=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d=document.createElement('div');d.className='log-line';
  d.innerHTML=`<span class="log-t">${t}</span><span class="${cls}"> ${msg}</span>`;
  b.appendChild(d);b.scrollTop=b.scrollHeight;
}

// ── SCAN ───────────────────────────────────────────────────────
async function startScan() {
  const p=loadLocal('profile',null);
  if(!p || !p.roles?.length || !p.locs?.length || !p.name || !p.exp || !p.role || !p.industry || !p.skills || !p.achieve || !p.minSal){
    toast('Please complete your profile and preferences first!','warn');
    gp('setup');
    return;
  }
  const btn=document.getElementById('scanBtn');
  btn.disabled=true;btn.innerHTML='<div class="spinner"></div> AI Scanning...';
  document.getElementById('jobsWrap').innerHTML=`<div class="empty-state"><div class="empty-icon" style="animation:spin 1.2s linear infinite">⚙️</div><h4>AI Scanning...</h4><p>Generating matched jobs</p></div>`;

  const portals=['LinkedIn', 'Indeed', 'Naukri', 'Glassdoor', 'Company Website'];

  log(`Roles: ${p.roles.join(', ')}`);
  log('Scanning...');

  try {
    const res=await apiFetch('/api/scan',{method:'POST',body:JSON.stringify({profile:p,portals})});
    const data=await res.json();
    if(!data.success) {
      if(data.error === 'FREE_LIMIT_REACHED') { showUpgradeModal(); btn.disabled=false;btn.innerHTML='🔍 Scan & Match Jobs'; document.getElementById('jobsWrap').innerHTML=`<div class="empty-state"><div class="empty-icon">🔒</div><h4>Free Limit Reached</h4><p>Upgrade to continue scanning</p></div>`; return; }
      throw new Error(data.error);
    }
    APP.jobs=data.jobs;
    if(data.usage) updateUsageUI(data.usage);
    log(`✓ Found ${APP.jobs.length} jobs!`,'log-ok');
  } catch(e) {
    log('Error: '+e.message,'log-e');
    toast('Scan error: '+e.message,'error');
    btn.disabled=false;btn.innerHTML='🔍 Scan & Match Jobs';return;
  }

  document.getElementById('sFound').textContent=APP.jobs.length;
  renderJobs();updateDashStats();
  btn.disabled=false;btn.innerHTML='🔄 Refresh Scan';
  document.getElementById('jobsLabel').textContent=`${APP.jobs.length} matched`;
  toast(`Found ${APP.jobs.length} matched jobs!`,'success');
}

// ── RENDER JOBS ────────────────────────────────────────────────
function renderJobs() {
  const wrap=document.getElementById('jobsWrap');
  const sortBy=document.getElementById('sortBy')?.value||'score';
  const showF=document.getElementById('showFilter')?.value||'all';
  let jobs=[...APP.jobs];
  if(showF==='pending') jobs=jobs.filter(j=>!isApplied(j.id));
  else if(showF==='applied') jobs=jobs.filter(j=>isApplied(j.id));
  else if(showF==='top') jobs=jobs.filter(j=>j.score>=75);
  if(sortBy==='score') jobs.sort((a,b)=>b.score-a.score);
  else if(sortBy==='company') jobs.sort((a,b)=>a.company.localeCompare(b.company));
  if(!jobs.length){wrap.innerHTML=`<div class="empty-state"><div class="empty-icon">🔍</div><h4>No Results</h4><p>Adjust filters or scan again.</p></div>`;return;}

  const mySkills=(loadLocal('profile',null)?.skills||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
  wrap.innerHTML=jobs.map((j,i)=>{
    const sc=j.score>=75?'h':j.score>=55?'m':'l';
    const applied=isApplied(j.id);const top5=i<5&&!applied;
    const pi={naukri:'📋 NAUKRI',linkedin:'💼 LINKEDIN',indeed:'🔍 INDEED',glassdoor:'🏢 GLASSDOOR','company website':'🌐 COMPANY SITE'}[j.portal?.toLowerCase()]||'💼 '+j.portal;
    const matched=(j.skills||[]).filter(s=>mySkills.some(ms=>ms&&s.toLowerCase().includes(ms)));
    const other=(j.skills||[]).filter(s=>!matched.includes(s));
    return`<div class="job-card ${applied?'applied':''} fu" style="animation-delay:${i*.05}s">
      <div class="jc-row1"><div class="jc-left"><div class="jc-portal-tag">${pi}</div><div class="jc-company">${j.company}</div><div class="jc-title">${j.title}</div></div><div class="score-block"><div class="score-num ${sc}">${j.score}</div><div class="score-pct">% Match</div></div></div>
      <div class="jc-pills"><span class="jpill">📍 ${j.loc}</span><span class="jpill">💰 ${j.salary}</span><span class="jpill">⏱ ${j.exp||''}</span><span class="jpill">🕐 ${j.shift||'Day'}</span>${top5?'<span class="jpill top">★ TOP</span>':''}${applied?'<span class="jpill done">✓ Applied</span>':''}<span class="jpill">${j.verdict}</span></div>
      <div class="jc-ai"><strong>AI:</strong> ${j.reasons}</div>
      <div class="jc-skills">${matched.map(s=>`<span class="stag match">✓ ${s}</span>`).join('')}${other.map(s=>`<span class="stag">${s}</span>`).join('')}</div>
      <div class="jc-actions">
        ${j.url && j.url.startsWith('http') ?
        `<button class="jbtn primary" onclick="window.open('${j.url}', '_blank')"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Apply Now</button>` :
        `<button class="jbtn primary" disabled style="opacity:0.6;cursor:not-allowed;background-color:#555;" title="Direct apply link not available"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Direct URL Unavailable</button>`}
        <button class="jbtn" onclick="openCoverModal(${j.id})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Cover</button>
        ${applied?`<button class="jbtn" onclick="undoApply(${j.id})">↩ Undo</button>`:`<button class="jbtn teal" onclick="markApply(${j.id})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/></svg>Applied</button>`}
      </div></div>`;
  }).join('');
}

// ── APPLIED TRACKING ───────────────────────────────────────────
function isApplied(id){return APP.tracker.some(t=>t.jobId===id&&t.status==='applied');}

async function markApply(id) {
  const j=APP.jobs.find(x=>x.id===id);if(!j) return;
  const entry={jobId:id,company:j.company,title:j.title,loc:j.loc,score:j.score,portal:j.portal,status:'applied',dateStr:new Date().toDateString(),timestamp:Date.now()};
  try{
    const res=await apiFetch('/api/applications',{method:'POST',body:JSON.stringify(entry)});
    const data=await res.json();if(data.fbId) entry.fbId=data.fbId;
    toast(`✅ ${j.company} saved!`,'success');
  }catch(e){toast(`Applied: ${j.company} (local)`,'success');}
  APP.tracker=APP.tracker.filter(t=>t.jobId!==id);APP.tracker.push(entry);saveLocal('tracker',APP.tracker);
  log(`✓ Applied: ${j.company}`,'log-ok');renderJobs();updateDashStats();
}

async function undoApply(id) {
  const entry=APP.tracker.find(t=>t.jobId===id);
  if(entry?.fbId){try{await apiFetch('/api/applications/'+entry.fbId,{method:'DELETE'});}catch(e){}}
  else{try{await apiFetch('/api/applications/by-job/'+id,{method:'DELETE'});}catch(e){}}
  APP.tracker=APP.tracker.filter(t=>t.jobId!==id);saveLocal('tracker',APP.tracker);
  renderJobs();updateDashStats();toast('Removed','info');
}

// ── TRACKER ────────────────────────────────────────────────────
async function loadTracker() {
  const body=document.getElementById('trackerBody');
  body.innerHTML=`<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:40px">Loading...</td></tr>`;
  let data=[];
  try{const res=await apiFetch('/api/applications');const r=await res.json();
    if(r.success&&r.data.length){data=r.data;APP.allTracker=data;APP.tracker=data;saveLocal('tracker',data);}
    else{data=loadLocal('tracker',[]);APP.allTracker=data;}
  }catch(e){data=loadLocal('tracker',[]);APP.allTracker=data;}
  renderTrackerTable(data);updateDashStats();updateGoalBar(data);
}

function renderTrackerTable(data) {
  const body=document.getElementById('trackerBody');
  if(!data.length){body.innerHTML=`<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:50px">No applications yet.</td></tr>`;return;}
  body.innerHTML=data.map((t,i)=>{
    const sc=t.score>=75?'h':t.score>=55?'m':'l';
    const pi={naukri:'📋',linkedin:'💼',indeed:'🔍',glassdoor:'🏢'}[t.portal?.toLowerCase()]||'💼';
    return`<tr><td style="color:var(--muted);font-family:var(--mono);font-size:11px">${data.length-i}</td><td><div class="tbl-company">${t.company}</div></td><td><div class="tbl-role" title="${t.title}">${t.title}</div></td><td style="color:var(--sub);font-size:12px">${t.loc}</td><td><span class="score-sm ${sc}">${t.score}%</span></td><td>${pi}</td><td><span class="status-badge sb-${t.status||'pending'}">${(t.status||'pending').toUpperCase()}</span></td><td style="color:var(--muted);font-family:var(--mono);font-size:10px">${t.dateStr||'—'}</td><td><select class="action-sel" onchange="updateStatus('${t.fbId||''}',${t.jobId||0},this.value,'${t.company}')"><option ${t.status==='applied'?'selected':''} value="applied">Applied</option><option ${t.status==='interview'?'selected':''} value="interview">Interview</option><option ${t.status==='offer'?'selected':''} value="offer">Offer</option><option ${t.status==='rejected'?'selected':''} value="rejected">Rejected</option><option ${t.status==='pending'?'selected':''} value="pending">Pending</option></select></td><td><button class="tbl-del" onclick="deleteApp('${t.fbId||''}',${t.jobId||0})"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></td></tr>`;
  }).join('');
}

async function updateStatus(fbId,jobId,status,company) {
  if(fbId){try{await apiFetch('/api/applications/'+fbId,{method:'PUT',body:JSON.stringify({status})});}catch(e){}}
  const local=loadLocal('tracker',[]);const idx=local.findIndex(t=>t.fbId===fbId||t.jobId===jobId);
  if(idx>=0){local[idx].status=status;saveLocal('tracker',local);APP.tracker=local;}
  const msgs={interview:'🎉 Interview!',offer:'🏆 Offer!',rejected:'Keep going!',applied:'Applied',pending:'Pending'};
  toast(`${company}: ${msgs[status]||status}`,status==='offer'||status==='interview'?'success':'info');updateDashStats();
}

async function deleteApp(fbId,jobId) {
  if(!confirm('Remove?')) return;
  if(fbId){try{await apiFetch('/api/applications/'+fbId,{method:'DELETE'});}catch(e){}}
  const local=loadLocal('tracker',[]).filter(t=>t.fbId!==fbId&&t.jobId!==jobId);
  saveLocal('tracker',local);APP.tracker=local;APP.allTracker=APP.allTracker.filter(t=>t.fbId!==fbId&&t.jobId!==jobId);
  loadTracker();toast('Deleted','info');
}

function filterTable(){
  const q=document.getElementById('tblSearch').value.toLowerCase();
  const s=document.getElementById('tblStatusFilter').value;
  let data=[...APP.allTracker];
  if(q) data=data.filter(t=>t.company?.toLowerCase().includes(q)||t.title?.toLowerCase().includes(q));
  if(s) data=data.filter(t=>t.status===s);
  renderTrackerTable(data);
}

function updateGoalBar(data){const today=new Date().toDateString();const c=data.filter(t=>t.dateStr===today&&t.status==='applied').length;document.getElementById('goalBar').style.width=Math.min(100,(c/5)*100)+'%';document.getElementById('goalCount').textContent=`${c}/5`;}

function exportCSV(){const data=APP.allTracker;if(!data.length){toast('No data','warn');return;}const cols=['company','title','loc','score','portal','status','dateStr'];const csv=[cols.join(','),...data.map(r=>cols.map(c=>`"${r[c]||''}"`).join(','))].join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='jobbot_applications.csv';a.click();toast('Exported!','success');}

// ── DASHBOARD STATS ────────────────────────────────────────────
async function updateDashStats(){
  let data=APP.tracker.length?APP.tracker:loadLocal('tracker',[]);
  const today=new Date().toDateString();
  document.getElementById('sToday').textContent=data.filter(t=>t.dateStr===today&&t.status==='applied').length;
  document.getElementById('sTotal').textContent=data.length;
  const scores=APP.jobs.map(j=>j.score);
  document.getElementById('sAvg').textContent=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)+'%':'—';
  const td=data.filter(t=>t.dateStr===today&&t.status==='applied').length;
  document.getElementById('sTodayTrend').textContent=td>=5?'🎯 Goal!':td>0?`+${td}`:'';
}

// ── ANALYTICS ──────────────────────────────────────────────────
async function loadAnalytics(){
  let data=APP.allTracker.length?APP.allTracker:loadLocal('tracker',[]);
  try{const res=await apiFetch('/api/applications');const r=await res.json();if(r.success&&r.data.length){data=r.data;APP.allTracker=data;}}catch(e){}

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
  for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toLocaleDateString('en-IN',{month:'short',day:'numeric'}));counts.push(data.filter(t=>t.dateStr===d.toDateString()).length);}
  const statuses=['applied','interview','offer','rejected','pending'];
  const statusCounts=statuses.map(s=>data.filter(t=>t.status===s).length);
  const coMap={};data.forEach(t=>{coMap[t.company]=(coMap[t.company]||0)+1;});
  const companies=Object.entries(coMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const portalMap={};data.forEach(t=>{const p=(t.portal||'').toLowerCase();portalMap[p]=(portalMap[p]||0)+1;});

  const dk={chart:{background:'transparent',foreColor:'#7C8DB5'},grid:{borderColor:'rgba(255,255,255,0.07)'},tooltip:{theme:'dark'},dataLabels:{enabled:false}};
  if(!window.ApexCharts) return;

  document.getElementById('chartTimeline').innerHTML='';
  new ApexCharts(document.getElementById('chartTimeline'),{...dk,chart:{...dk.chart,type:'area',height:200,toolbar:{show:false}},series:[{name:'Apps',data:counts}],xaxis:{categories:days,labels:{style:{fontSize:'10px',colors:'#4A5568'}}},yaxis:{labels:{style:{colors:'#4A5568'}},min:0,forceNiceScale:true},fill:{type:'gradient',gradient:{shadeIntensity:1,opacityFrom:.4,opacityTo:.05,stops:[0,100]}},stroke:{curve:'smooth',width:2.5},colors:['#FF6B35']}).render();

  document.getElementById('chartStatus').innerHTML='';
  new ApexCharts(document.getElementById('chartStatus'),{...dk,chart:{...dk.chart,type:'donut',height:200,toolbar:{show:false}},series:statusCounts,labels:statuses.map(s=>s.charAt(0).toUpperCase()+s.slice(1)),colors:['#00D9AA','#4F8EF7','#A78BFA','#FF4757','#F5C842'],legend:{position:'bottom',labels:{colors:'#7C8DB5'},fontSize:'11px'},plotOptions:{pie:{donut:{size:'65%'}}}}).render();

  document.getElementById('chartCompany').innerHTML='';
  new ApexCharts(document.getElementById('chartCompany'),{...dk,chart:{...dk.chart,type:'bar',height:200,toolbar:{show:false}},series:[{name:'Apps',data:companies.map(c=>c[1])}],xaxis:{categories:companies.map(c=>c[0]),labels:{style:{fontSize:'10px',colors:'#4A5568'}}},yaxis:{labels:{style:{colors:'#4A5568'}},min:0,forceNiceScale:true},colors:['#FF6B35'],plotOptions:{bar:{borderRadius:5,columnWidth:'55%'}}}).render();

  const pL=Object.keys(portalMap).filter(k=>portalMap[k]>0),pV=pL.map(k=>portalMap[k]);
  document.getElementById('chartPortal').innerHTML='';
  if(pL.length) new ApexCharts(document.getElementById('chartPortal'),{...dk,chart:{...dk.chart,type:'pie',height:200,toolbar:{show:false}},series:pV,labels:pL.map(l=>l.charAt(0).toUpperCase()+l.slice(1)),colors:['#FF6B35','#4F8EF7','#00D9AA','#A78BFA'],legend:{position:'bottom',labels:{colors:'#7C8DB5'},fontSize:'11px'}}).render();
}

// ── COVER NOTES ────────────────────────────────────────────────
async function genCustomCover(){
  const jd=document.getElementById('customJD').value.trim();
  if(!jd){toast('Paste a job description!','warn');return;}
  showLoad('Generating cover note...');
  try{
    const p=loadLocal('profile',null)||{};
    const res=await apiFetch('/api/cover',{method:'POST',body:JSON.stringify({profile:p,company:'Custom',title:'',jd})});
    const data=await res.json();
    if(!data.success) { if(data.error==='FREE_LIMIT_REACHED'){hideLoad();showUpgradeModal();return;} throw new Error(data.error); }
    document.getElementById('coverOutLabel').textContent='Custom Cover Note';
    document.getElementById('coverPre').textContent=data.note;
    document.getElementById('coverOutput').style.display='block';
    document.getElementById('coverSaveStatus').textContent='';hideLoad();
  }catch(e){hideLoad();toast('Error: '+e.message,'error');}
}

async function genColdEmail(){
  const co=document.getElementById('coldCo').value.trim();
  const role=document.getElementById('coldRole').value.trim();
  if(!co||!role){toast('Fill company & role!','warn');return;}
  showLoad('Writing cold email...');
  try{
    const p=loadLocal('profile',null)||{};
    const res=await apiFetch('/api/cold-email',{method:'POST',body:JSON.stringify({profile:p,company:co,role})});
    const data=await res.json();
    if(!data.success) { if(data.error==='FREE_LIMIT_REACHED'){hideLoad();showUpgradeModal();return;} throw new Error(data.error); }
    document.getElementById('coverOutLabel').textContent=`Cold Email → ${co}`;
    document.getElementById('coverPre').textContent=data.note;
    document.getElementById('coverOutput').style.display='block';
    document.getElementById('coverSaveStatus').textContent='';hideLoad();
  }catch(e){hideLoad();toast('Error: '+e.message,'error');}
}

async function openCoverModal(jobId){
  const j=APP.jobs.find(x=>x.id===jobId);if(!j) return;
  document.getElementById('modalTitle').textContent=`${j.company} — ${j.title}`;
  document.getElementById('modalPre').textContent='';
  document.getElementById('modalLoading').style.display='block';
  document.getElementById('coverModal').classList.add('on');
  try{
    const p=loadLocal('profile',null)||{};
    const res=await apiFetch('/api/cover',{method:'POST',body:JSON.stringify({profile:p,company:j.company,title:j.title,jd:`Skills: ${(j.skills||[]).join(', ')}. Location: ${j.loc}. Salary: ${j.salary}.`})});
    const data=await res.json();if(!data.success) throw new Error(data.error);
    document.getElementById('modalLoading').style.display='none';
    document.getElementById('modalPre').textContent=data.note;
    saveCoverToDB(j.company,j.title,data.note);
  }catch(e){document.getElementById('modalLoading').style.display='none';document.getElementById('modalPre').textContent='Error: '+e.message;}
}

async function saveCoverToDB(company,role,note){
  try{await apiFetch('/api/cover-notes',{method:'POST',body:JSON.stringify({company,role,note,date:new Date().toDateString()})});}catch(e){}
  const covers=loadLocal('covers',[]);covers.unshift({company,role,note,date:new Date().toDateString()});saveLocal('covers',covers.slice(0,20));
}

async function saveCoverNote(){const note=document.getElementById('coverPre').textContent;const label=document.getElementById('coverOutLabel').textContent;await saveCoverToDB(label,'',note);document.getElementById('coverSaveStatus').textContent='✓ Saved!';toast('Saved!','success');}

async function loadCoverNotes(){
  let notes=[];
  try{const res=await apiFetch('/api/cover-notes');const r=await res.json();if(r.success&&r.data.length) notes=r.data;else notes=loadLocal('covers',[]);}catch(e){notes=loadLocal('covers',[]);}
  const wrap=document.getElementById('savedNotesWrap');
  if(!notes.length){wrap.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:30px">No saved notes yet.</div>';return;}
  wrap.innerHTML=notes.slice(0,10).map((n,i)=>`<div class="saved-note fu" style="animation-delay:${i*.04}s"><div class="sn-head"><div><div class="sn-company">${n.company}</div><div class="sn-role">${n.role||''}</div></div><div class="sn-date">${n.date||''}</div></div><div class="sn-preview">${(n.note||'').substring(0,180)}...</div><div class="sn-actions"><button class="out-btn" onclick="navigator.clipboard.writeText(window._cvNotes[${i}].note);toast('Copied!','success')">📋 Copy</button><button class="out-btn" onclick="expandNote(${i})" id="expBtn${i}">⬇ Full</button></div><div id="fullNote${i}" style="display:none;margin-top:12px;font-size:13px;line-height:1.8;color:var(--sub);white-space:pre-wrap;background:rgba(0,0,0,.2);padding:14px;border-radius:10px">${n.note||''}</div></div>`).join('');
  window._cvNotes=notes;
}

function expandNote(i){const el=document.getElementById('fullNote'+i);const btn=document.getElementById('expBtn'+i);if(el.style.display==='none'){el.style.display='block';btn.textContent='⬆ Hide';}else{el.style.display='none';btn.textContent='⬇ Full';}}
function closeModal(){document.getElementById('coverModal').classList.remove('on');}
function copyModal(){navigator.clipboard.writeText(document.getElementById('modalPre').textContent);toast('📋 Copied!','success');}
function copyCoverOut(){navigator.clipboard.writeText(document.getElementById('coverPre').textContent);toast('📋 Copied!','success');}
