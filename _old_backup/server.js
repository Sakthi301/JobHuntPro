// ═══════════════════════════════════════════════════════════════
// JOBBOT PRO v3 — Backend Server with Auth
// ═══════════════════════════════════════════════════════════════
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GROQ_KEY = process.env.GROQ_API_KEY;
const FB_API_KEY = process.env.FIREBASE_API_KEY;

// ── Firebase Setup ─────────────────────────────────────────────
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');

let db = null;
let fbAuth = null;

function initFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || projectId === 'your-project-id') {
    console.log('⚠️  Firebase not configured');
    return;
  }
  try {
    const fbApp = initializeApp({
      apiKey: FB_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
    });
    db = getFirestore(fbApp);
    fbAuth = getAuth(fbApp);
    console.log('🔥 Firebase + Auth connected!');
  } catch (e) {
    console.error('Firebase init error:', e.message);
  }
}
initFirebase();

// ── Auth Middleware ─────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const token = authHeader.split(' ')[1];
  try {
    // Decode Firebase ID token (JWT) to extract uid
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    if (!payload.user_id) throw new Error('Invalid token payload');
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return res.status(401).json({ success: false, error: 'Token expired. Please login again.' });
    }
    req.uid = payload.user_id;
    req.userEmail = payload.email;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// ── Freemium Usage Tracking ────────────────────────────────────
const FREE_LIMIT = 3;

async function getUserUsage(uid) {
  if (!db) return { usageCount: 0, plan: 'free', planExpiry: null };
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return { usageCount: 0, plan: 'free', planExpiry: null };
    const data = userDoc.data();
    // Check if paid plan has expired
    if (data.plan && data.plan !== 'free' && data.planExpiry) {
      const expiry = data.planExpiry.toDate ? data.planExpiry.toDate() : new Date(data.planExpiry);
      if (expiry < new Date()) {
        // Plan expired — revert to free
        await updateDoc(doc(db, 'users', uid), { plan: 'free', planExpiry: null });
        return { usageCount: data.usageCount || 0, plan: 'free', planExpiry: null };
      }
      return { usageCount: data.usageCount || 0, plan: data.plan, planExpiry: expiry.toISOString() };
    }
    return { usageCount: data.usageCount || 0, plan: data.plan || 'free', planExpiry: null };
  } catch (e) {
    return { usageCount: 0, plan: 'free', planExpiry: null };
  }
}

async function incrementUsage(uid) {
  if (!db) return;
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const current = userDoc.exists() ? (userDoc.data().usageCount || 0) : 0;
    await updateDoc(doc(db, 'users', uid), { usageCount: current + 1 });
  } catch (e) {}
}

async function checkUsageLimit(req, res, next) {
  try {
    const usage = await getUserUsage(req.uid);
    if (usage.plan !== 'free') return next(); // paid users pass through
    if (usage.usageCount >= FREE_LIMIT) {
      return res.status(403).json({
        success: false,
        error: 'FREE_LIMIT_REACHED',
        message: 'You have used all 3 free scans. Upgrade to continue!',
        usageCount: usage.usageCount,
        limit: FREE_LIMIT,
      });
    }
    req.usageCount = usage.usageCount;
    next();
  } catch (e) {
    next(); // on error, allow through
  }
}

// ── Groq API Helper ────────────────────────────────────────────
async function callGroq(prompt, maxTokens = 2000) {
  if (!GROQ_KEY || GROQ_KEY === 'gsk_your_key_here') {
    throw new Error('Groq API key not configured');
  }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_KEY },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });
  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.error?.message || `Groq HTTP ${res.status}`);
  }
  const d = await res.json();
  return d.choices[0].message.content;
}

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES (public — no middleware)
// ═══════════════════════════════════════════════════════════════

// ── Signup ─────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) throw new Error('Email and password required');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    if (!fbAuth) throw new Error('Auth service not available');

    // Create user in Firebase Auth
    const cred = await createUserWithEmailAndPassword(fbAuth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const token = await cred.user.getIdToken();

    // Save user profile in Firestore with free plan
    if (db) {
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: name || '',
        email,
        createdAt: Timestamp.now(),
        profile: {},
        usageCount: 0,
        plan: 'free',
        planExpiry: null,
      });
    }

    res.json({
      success: true,
      token,
      user: { uid: cred.user.uid, name, email },
    });
  } catch (e) {
    const msg = e.code === 'auth/email-already-in-use' ? 'This email is already registered. Try signing in.'
      : e.code === 'auth/weak-password' ? 'Password is too weak. Use at least 6 characters.'
      : e.code === 'auth/invalid-email' ? 'Invalid email address.'
      : e.message;
    res.status(400).json({ success: false, error: msg });
  }
});

// ── Login ──────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new Error('Email and password required');
    if (!fbAuth) throw new Error('Auth service not available');

    const cred = await signInWithEmailAndPassword(fbAuth, email, password);
    const token = await cred.user.getIdToken();

    // Get user profile from Firestore
    let userData = { name: cred.user.displayName || '', email };
    if (db) {
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (userDoc.exists()) {
        userData = { ...userData, ...userDoc.data() };
      }
    }

    res.json({
      success: true,
      token,
      user: { uid: cred.user.uid, name: userData.name, email },
    });
  } catch (e) {
    const msg = e.code === 'auth/user-not-found' ? 'No account found with this email.'
      : e.code === 'auth/wrong-password' ? 'Incorrect password.'
      : e.code === 'auth/invalid-credential' ? 'Invalid email or password.'
      : e.code === 'auth/too-many-requests' ? 'Too many attempts. Try again later.'
      : e.message;
    res.status(401).json({ success: false, error: msg });
  }
});

// ── Get current user profile ───────────────────────────────────
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    if (!db) return res.json({ success: true, user: { uid: req.uid, email: req.userEmail } });
    const userDoc = await getDoc(doc(db, 'users', req.uid));
    if (!userDoc.exists()) return res.json({ success: true, user: { uid: req.uid, email: req.userEmail } });
    const data = userDoc.data();
    const usage = await getUserUsage(req.uid);
    res.json({
      success: true,
      user: { uid: req.uid, name: data.name, email: data.email, profile: data.profile || {} },
      usage: { count: usage.usageCount, limit: FREE_LIMIT, plan: usage.plan, planExpiry: usage.planExpiry },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Save user profile ──────────────────────────────────────────
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    if (!db) return res.json({ success: true });
    await updateDoc(doc(db, 'users', req.uid), { profile: req.body, updatedAt: Timestamp.now() });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Usage status ───────────────────────────────────────────────
app.get('/api/usage', authMiddleware, async (req, res) => {
  try {
    const usage = await getUserUsage(req.uid);
    res.json({ success: true, count: usage.usageCount, limit: FREE_LIMIT, plan: usage.plan, planExpiry: usage.planExpiry });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Activate plan (Razorpay integration) ───────────────────────
const razorpayInst = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post('/api/create-order', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['weekly', 'monthly'].includes(plan)) return res.status(400).json({ success: false, error: 'Invalid plan' });
    const amount = plan === 'weekly' ? 9900 : 24900; // in paise
    const options = {
      amount,
      currency: 'INR',
      receipt: `rcpt_${req.uid.slice(0, 10)}_${Date.now()}`
    };
    const order = await razorpayInst.orders.create(options);
    res.json({ success: true, order_id: order.id, amount: order.amount, currency: order.currency, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/verify-payment', authMiddleware, async (req, res) => {
  try {
    if (!db) return res.status(400).json({ success: false, error: 'Database not available' });
    const { plan, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!['weekly', 'monthly'].includes(plan)) return res.status(400).json({ success: false, error: 'Invalid plan' });
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const expectedSignature = hmac.digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    const now = new Date();
    const expiry = plan === 'weekly'
      ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    await updateDoc(doc(db, 'users', req.uid), {
      plan,
      planExpiry: Timestamp.fromDate(expiry),
      upgradedAt: Timestamp.now(),
    });
    
    res.json({ success: true, plan, planExpiry: expiry.toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PROTECTED API ROUTES (require auth + usage check on AI features)
// ═══════════════════════════════════════════════════════════════

// ── Serve static files ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Scan Jobs (usage-limited) ──────────────────────────────────
app.post('/api/scan', authMiddleware, checkUsageLimit, async (req, res) => {
  try {
    const { profile, portals } = req.body;
    const targetRole = (profile.roles && profile.roles.length > 0) ? profile.roles[0] : (profile.role || 'Developer');
    const targetLoc = (profile.locs && profile.locs.length > 0) ? profile.locs[0] : 'India';
    
    let fetchedJobs = [];

    const getCleanUrl = (url) => {
      if (!url) return '';
      const lowerUrl = url.toLowerCase();
      // Only keep direct links by invalidating known tracking/redirect proxies
      if (lowerUrl.includes('adzuna.com/land') || lowerUrl.includes('adzuna.in/land') || lowerUrl.includes('google.com/search') || lowerUrl.includes('rapidapi')) return '';
      return url;
    };

    // 1. Fetch from RapidAPI JSearch (PRIMARY)
    try {
      // Increased num_pages to 3 to get a larger pool of direct links
      const jsearchUrl = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(targetRole + ' in ' + targetLoc)}&num_pages=3`;
      const jsRes = await fetch(jsearchUrl, { headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' } });
      if (jsRes.ok) {
        const jsData = await jsRes.json();
        const mapped = (jsData.data || []).map(j => {
          let bestApplyUrl = j.job_apply_link || '';
          if (j.apply_options && j.apply_options.length > 0) {
            const directOpt = j.apply_options.find(o => o.is_direct);
            if (directOpt && directOpt.apply_link) bestApplyUrl = directOpt.apply_link;
            else if (!bestApplyUrl) bestApplyUrl = j.apply_options[0].apply_link;
          }
          return {
            id: Math.floor(Math.random()*10000),
            title: j.job_title,
            company: j.employer_name || 'Unknown',
            loc: j.job_city ? `${j.job_city}, ${j.job_country || ''}`.trim() : targetLoc,
            url: getCleanUrl(bestApplyUrl),
            description: (j.job_description || '').substring(0, 400),
            salary: j.job_min_salary ? `$${j.job_min_salary}` : 'Not specified',
            portal: j.job_publisher || 'JSearch'
          };
        });
        fetchedJobs.push(...mapped);
      } else {
        const errText = await jsRes.text();
        console.error(`JSearch API failed with status ${jsRes.status}: ${errText}`);
      }
    } catch (e) { console.log('JSearch fetch exception', e.message); }

    // 3. Deduplicate & Merge Logic
    const uniqueMap = new Map();
    fetchedJobs.forEach(job => {
      const key = `${job.company.toLowerCase()}|${job.title.toLowerCase()}`;
      if (!uniqueMap.has(key) || (!uniqueMap.get(key).url && job.url)) {
        uniqueMap.set(key, job);
      }
    });

    let finalJobs = Array.from(uniqueMap.values());
    finalJobs.sort((a,b) => (b.url ? 1 : 0) - (a.url ? 1 : 0));
    
    // Filtering: Only include jobs with valid direct links
    let directJobs = finalJobs.filter(j => j.url && j.url !== '');
    
    if (directJobs.length >= 5) {
      // Exclude jobs with only redirect/tracking links if we have enough direct link jobs
      fetchedJobs = directJobs.slice(0, 20);
    } else {
      // Fallback: If no / few direct link is available, include some non-direct ones
      // This will trigger the "Direct apply link not available" UI for those jobs
      fetchedJobs = finalJobs.slice(0, 20);
    }

    let prompt;
    if (fetchedJobs.length === 0) {
      console.log('JSearch returned empty/failed. Falling back to AI generation mock data.');
      prompt = `You are a job search AI. Generate 8-10 realistic job listings and score them for a candidate.

CANDIDATE PROFILE:
- Name: ${profile.name || 'Job Seeker'}
- Experience: ${profile.exp || 'Not specified'}
- Current Role: ${profile.role || 'Not specified'}
- Skills: ${profile.skills || 'Not specified'}
- Target Roles: ${(profile.roles || ['Developer']).join(', ')}
- Locations: ${(profile.locs || ['India']).join(', ')}

PORTALS TO USE: ${portals.join(', ') || 'LinkedIn, Indeed'}

Generate REALISTIC job listings that would actually exist. Return ONLY a valid JSON array matching this schema:
[{"id":1,"company":"Company Name","title":"Job Title","loc":"City","portal":"linkedin","salary":"$X","exp":"Y years","shift":"Day","url":"https://example.com/jobs","skills":["skill1","skill2"],"score":85,"verdict":"STRONG MATCH","reasons":"10-15 word reason","apply":true}]

RULES:
- score: 0-100
- STRONG MATCH ≥75, GOOD MATCH 55-74, WEAK MATCH <55
- Vary scores realistically
- Use realistic, fake direct apply URLs starting with https://
- Return ONLY JSON array, no explanation.`;
    } else {
      prompt = `You are an AI scoring engine. I have fetched ${fetchedJobs.length} REAL jobs from live APIs. Note that they have REAL application URLs.

CANDIDATE PROFILE:
- Name: ${profile.name || 'Job Seeker'}
- Experience: ${profile.exp || 'Not specified'}
- Current Role: ${profile.role || 'Not specified'}
- Skills: ${profile.skills || 'Not specified'}
- Key Achievement: ${profile.achieve || 'Not specified'}

REAL JOBS FETCHED:
${JSON.stringify(fetchedJobs, null, 2)}

TASK: Score each of the provided real jobs against the candidate profile out of 100.
Return ONLY a valid JSON array of the top 10 best-matching jobs. MUST match this exact schema:

[{"id":1,"company":"[Keep Exact]","title":"[Keep Exact]","loc":"[Keep Exact]","portal":"[Keep Exact]","salary":"[Keep Exact]","exp":"[Extract or Estimate]","shift":"[Extract or Estimate]","url":"[KEEP EXACT ORIGINAL URL]","skills":["extracted","skills"],"score":85,"verdict":"STRONG MATCH","reasons":"10-15 word reason","apply":true}]

RULES:
- YOU MUST KEEP THE "url", "company", "title", "loc", AND "portal" EXACTLY AS PROVIDED. Do NOT alter them or hallucinate URLs.
- score 0-100 (match skills & experience)
- STRONG MATCH ≥75, GOOD MATCH 55-74, WEAK MATCH <55
- Vary scores realistically`;
    }

    const raw = await callGroq(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const jobs = JSON.parse(clean);
    jobs.sort((a, b) => b.score - a.score);
    // Increment usage after successful scan
    await incrementUsage(req.uid);
    const usage = await getUserUsage(req.uid);
    res.json({ success: true, jobs, usage: { count: usage.usageCount, limit: FREE_LIMIT, plan: usage.plan } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Cover Note ─────────────────────────────────────────────────
app.post('/api/cover', authMiddleware, checkUsageLimit, async (req, res) => {
  try {
    const { profile, company, title, jd } = req.body;
    const prompt = `Write a professional cover note.

CANDIDATE: ${profile.name || 'Job Seeker'}
Experience: ${profile.exp || 'Not specified'}
Current Role: ${profile.role || 'Not specified'}
Skills: ${profile.skills || 'Not specified'}
Achievement: ${profile.achieve || 'Not specified'}

JOB: ${title || 'Role'} at ${company || 'Company'}
JD: ${jd || 'Not provided'}

Write 160-190 word cover note: subject line, strong opening, 2-3 matching skills, one achievement with number, professional tone, call to action, sign off as ${profile.name || '[Your Name]'}`;
    const note = await callGroq(prompt);
    await incrementUsage(req.uid);
    res.json({ success: true, note });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Cold Email ─────────────────────────────────────────────────
app.post('/api/cold-email', authMiddleware, checkUsageLimit, async (req, res) => {
  try {
    const { profile, company, role } = req.body;
    const prompt = `Write a cold outreach email to HR.
SENDER: ${profile.name || 'Job Seeker'}, ${profile.exp || 'experienced'}, ${profile.role || 'professional'}
Skills: ${profile.skills || 'Not specified'}, Achievement: ${profile.achieve || 'Not specified'}
TARGET: ${company}, ROLE: ${role}
Write 140-160 word cold email with subject line, direct confident tone, specific value, ask for call, professional sign-off.`;
    const email = await callGroq(prompt);
    await incrementUsage(req.uid);
    res.json({ success: true, note: email });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Applications CRUD (scoped to user) ─────────────────────────
app.get('/api/applications', authMiddleware, async (req, res) => {
  if (!db) return res.json({ success: true, data: [] });
  try {
    const snap = await getDocs(query(collection(db, 'users', req.uid, 'applications'), orderBy('createdAt', 'desc')));
    const data = snap.docs.map(d => ({ ...d.data(), fbId: d.id }));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/applications', authMiddleware, async (req, res) => {
  if (!db) return res.json({ success: true, fbId: null });
  try {
    const entry = { ...req.body, createdAt: Timestamp.now() };
    const ref = await addDoc(collection(db, 'users', req.uid, 'applications'), entry);
    res.json({ success: true, fbId: ref.id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/applications/:id', authMiddleware, async (req, res) => {
  if (!db) return res.json({ success: true });
  try {
    await updateDoc(doc(db, 'users', req.uid, 'applications', req.params.id), req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/applications/:id', authMiddleware, async (req, res) => {
  if (!db) return res.json({ success: true });
  try {
    await deleteDoc(doc(db, 'users', req.uid, 'applications', req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/applications/by-job/:jobId', authMiddleware, async (req, res) => {
  if (!db) return res.json({ success: true });
  try {
    const snap = await getDocs(query(collection(db, 'users', req.uid, 'applications'), where('jobId', '==', parseInt(req.params.jobId))));
    for (const d of snap.docs) { await deleteDoc(d.ref); }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Cover Notes CRUD (scoped to user) ──────────────────────────
app.get('/api/cover-notes', authMiddleware, async (req, res) => {
  if (!db) return res.json({ success: true, data: [] });
  try {
    const snap = await getDocs(query(collection(db, 'users', req.uid, 'coverNotes'), orderBy('createdAt', 'desc')));
    const data = snap.docs.map(d => ({ ...d.data(), fbId: d.id }));
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/cover-notes', authMiddleware, async (req, res) => {
  if (!db) return res.json({ success: true, fbId: null });
  try {
    const entry = { ...req.body, createdAt: Timestamp.now() };
    const ref = await addDoc(collection(db, 'users', req.uid, 'coverNotes'), entry);
    res.json({ success: true, fbId: ref.id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Serve pages ────────────────────────────────────────────────
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n⚡ JobBot Pro running at http://localhost:${PORT}`);
  console.log(`   Groq AI: ${GROQ_KEY && GROQ_KEY !== 'gsk_your_key_here' ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`   Firebase: ${db ? '✅ Connected' : '⚠️  Not configured'}`);
  console.log(`   Auth:     ${fbAuth ? '✅ Ready' : '❌ Not available'}\n`);
});
