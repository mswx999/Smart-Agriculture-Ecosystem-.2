/* ═══════════════════════════════════════════
   AgriTech — app.js
   Firebase Auth + Firestore + Dashboard logic
   ═══════════════════════════════════════════ */

/* ──────────────────────────────────────────
   FIREBASE CONFIG — injected at build time
   ────────────────────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey:            "__ENV_FIREBASE_API_KEY__",
  authDomain:        "__ENV_FIREBASE_AUTH_DOMAIN__",
  projectId:         "__ENV_FIREBASE_PROJECT_ID__",
  storageBucket:     "__ENV_FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__ENV_FIREBASE_MESSAGING_SENDER_ID__",
  appId:             "__ENV_FIREBASE_APP_ID__"
};

/* ──────────────────────────────────────────
   INIT FIREBASE
   ────────────────────────────────────────── */
let auth, db, googleProvider;
let firebaseReady = false;

function initFirebase() {
  try {
    // Skip Firebase if env placeholders were not replaced (local dev without build)
    if (FIREBASE_CONFIG.apiKey.startsWith('__ENV_') || FIREBASE_CONFIG.apiKey.startsWith('YOUR_')) {
      console.warn('Firebase config has placeholders — running in Demo mode.');
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    auth           = firebase.auth();
    googleProvider = new firebase.auth.GoogleAuthProvider();
    firebaseReady  = true;

    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

    auth.onAuthStateChanged(user => {
      if (user && !currentUser) {
        currentUser = {
          name:  user.displayName || user.email.split('@')[0],
          fname: (user.displayName || user.email.split('@')[0]).split(' ')[0],
          lname: (user.displayName || '').split(' ').slice(1).join(' ') || '',
          email: user.email,
          phone: ''
        };
        loadDashboard();
        showPage('dashboard');
        loadUserProfile(user);
      }
    });
  } catch (e) {
    console.warn('Firebase init skipped (demo mode):', e.message);
  }
}

function getDB() {
  if (!db && firebaseReady) {
    db = firebase.firestore();
    db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED });
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  }
  return db;
}

/* ──────────────────────────────────────────
   STATE
   ────────────────────────────────────────── */
let currentUser = null;

const TAB_INDEX = { home: 0, govconnect: 1, equipment: 2, insurance: 3, market: 4, weather: 5, advisory: 6, settings: 7 };

let govFilter = 'all';
let equipFilter = 'all';
let govApplications = [
  { name: 'PM-KISAN Samman Nidhi', date: '12 Apr 2026', status: 'approved', icon: '🏛️' },
  { name: 'Kisan Credit Card', date: '05 Mar 2026', status: 'disbursed', icon: '💳' },
  { name: 'PM-KUSUM Solar Pump', date: '28 Apr 2026', status: 'submitted', icon: '☀️' },
  { name: 'Soil Health Card', date: '20 Apr 2026', status: 'review', icon: '🧪' }
];

const SEED_GOV = [
  { name: "PM-KISAN Samman Nidhi", category: "Income Support", desc: "₹6,000/year direct income support in 3 installments to all landholding farmer families.", status: "open", badge: "Central Govt" },
  { name: "Kisan Credit Card (KCC)", category: "Credit", desc: "Flexible credit for crop cultivation, post harvest, maintenance, allied activities. Low interest @ 4% p.a.", status: "open", badge: "NABARD" },
  { name: "PMFBY — Crop Insurance", category: "Insurance", desc: "Pradhan Mantri Fasal Bima Yojana — affordable crop insurance against natural calamities, pests & disease.", status: "open", badge: "Central Govt" },
  { name: "Soil Health Card Scheme", category: "Soil Testing", desc: "Free soil health card with crop-wise fertilizer recommendations to improve soil health & yields.", status: "open", badge: "Ministry of Agri" },
  { name: "PMKSN — Solar Pump Scheme", category: "Equipment Subsidy", desc: "Up to 60% subsidy on solar pumps for irrigation. Reduces electricity cost for farmers.", status: "open", badge: "State + Central" },
  { name: "eNAM — Electronic APMC", category: "Market Access", desc: "Online trading platform for agricultural commodities. Transparent price discovery across 1000+ mandis.", status: "open", badge: "Ministry of Agri" }
];

const SEED_EQUIPMENT = [
  { name: "Mahindra Arjun 605 Tractor", category: "Tractor", price: "₹7.5L", emi: "₹14,200/mo", desc: "60 HP, 4WD, perfect for medium farms. Available on 5-yr loan at 7% interest." },
  { name: "John Deere 5050E Tractor", category: "Tractor", price: "₹9.2L", emi: "₹17,400/mo", desc: "50 HP, ideal for wheat & paddy. Subsidised under state agricultural scheme." },
  { name: "Kubota PADDY MASTER Harvester", category: "Harvester", price: "₹12.8L", emi: "₹22,000/mo", desc: "Self-propelled paddy harvester. Rental also available at ₹1,800/hr." },
  { name: "Kirloskar Star-1 Water Pump", category: "Pump", price: "₹18,500", emi: "₹1,800/mo", desc: "5 HP diesel pump, ideal for drip & sprinkler irrigation. 60% subsidy under PM-KUSUM." },
  { name: "VST Shakti 130 Power Tiller", category: "Tiller", price: "₹1.2L", emi: "₹2,800/mo", desc: "13 HP, best for small/hilly farms. Available on 3-yr zero-interest EMI scheme." },
  { name: "Drone Sprayer (Rental)", category: "Drone", price: "₹800/acre", emi: "N/A", desc: "AI-guided pesticide drone spraying service. Book for your field — no purchase required." }
];

const SEED_INSURANCE = [
  { crop: "Wheat (Rabi 2025-26)", area: "4 acres", premium: "₹1,240", sumInsured: "₹62,000", status: "Active", statusType: "good" },
  { crop: "Tomato (Kharif 2025)", area: "2 acres", premium: "₹680", sumInsured: "₹34,000", status: "Claim Filed", statusType: "warning" },
  { crop: "Mustard (Rabi 2024-25)", area: "3 acres", premium: "₹920", sumInsured: "₹46,000", status: "Settled ₹38,000", statusType: "blue" }
];

const SEED_WEATHER = {
  current: { temp: 28, desc: "Partly Cloudy", humidity: 62, wind: "12 km/h", rain: "2mm", uv: "6" },
  forecast: [
    { day: "Mon", icon: "☀️", high: 31, low: 18, rain: "0%" },
    { day: "Tue", icon: "🌤️", high: 29, low: 17, rain: "10%" },
    { day: "Wed", icon: "🌧️", high: 25, low: 16, rain: "70%" },
    { day: "Thu", icon: "⛈️", high: 23, low: 15, rain: "85%" },
    { day: "Fri", icon: "🌤️", high: 27, low: 16, rain: "15%" }
  ]
};

const SEED_MARKET = [
  { name: "Organic Wheat Flour", category: "Grains", price: "₹2,450", qty: "25 quintals", seller: "Rajesh Kumar, Punjab" },
  { name: "Basmati Rice (Premium)", category: "Grains", price: "₹6,800", qty: "15 quintals", seller: "Arun Verma, UP" },
  { name: "Fresh Tomatoes", category: "Vegetables", price: "₹1,200", qty: "8 quintals", seller: "Priya Sharma, Maharashtra" },
  { name: "NPK Fertilizer 20-20-20", category: "Fertilizers", price: "₹850", qty: "50 bags", seller: "AgriStore Plus" },
  { name: "Drip Irrigation Kit", category: "Equipment", price: "₹12,500", qty: "1 unit", seller: "IrriTech Solutions" },
  { name: "Hybrid Tomato Seeds", category: "Seeds", price: "₹450", qty: "100 packets", seller: "SeedCorp India" }
];

const SEED_ACTIVITIES = [
  { text: "PM-KISAN installment of ₹2,000 credited to your account", type: "green", time: "2h ago" },
  { text: "Wheat (Rabi) PMFBY enrolment confirmed — ₹1,240 premium paid", type: "blue", time: "5h ago" },
  { text: "New buyer posted ₹2,600/quintal for Wheat — check Sell & Logistics", type: "amber", time: "8h ago" },
  { text: "Equipment application for Tractor loan submitted successfully", type: "green", time: "1d ago" },
  { text: "Weather alert: Hailstorm risk Thursday — consider crop protection", type: "red", time: "1d ago" },
  { text: "KCC credit limit of ₹1,50,000 approved", type: "blue", time: "2d ago" }
];

const SEED_EQUIP_SHARING = [
  { name: 'Mahindra 575 Tractor', category: 'Tractor', rate: '₹1,800/day', owner: 'Ramesh Yadav', location: 'Meerut, UP', status: 'available', emoji: '🚜' },
  { name: 'Kubota Harvester', category: 'Harvester', rate: '₹2,500/day', owner: 'Suresh Patel', location: 'Anand, Gujarat', status: 'available', emoji: '🌾' },
  { name: 'Kirloskar 5HP Pump', category: 'Pump', rate: '₹400/day', owner: 'Anil Sharma', location: 'Jaipur, Rajasthan', status: 'booked', emoji: '💧' },
  { name: 'VST Power Tiller', category: 'Tiller', rate: '₹900/day', owner: 'Mohan Das', location: 'Lucknow, UP', status: 'available', emoji: '⚙️' },
  { name: 'Agri Drone Sprayer', category: 'Drone', rate: '₹1,200/day', owner: 'TechFarm Co.', location: 'Pune, MH', status: 'available', emoji: '🛸' },
  { name: 'Sonalika 60HP Tractor', category: 'Tractor', rate: '₹2,000/day', owner: 'Vikram Singh', location: 'Karnal, Haryana', status: 'maintenance', emoji: '🚜' },
  { name: 'Mini Rotavator', category: 'Tiller', rate: '₹600/day', owner: 'Kisan FPO', location: 'Bareilly, UP', status: 'available', emoji: '⚙️' },
  { name: 'Solar Pump Set', category: 'Pump', rate: '₹500/day', owner: 'GreenAgri', location: 'Indore, MP', status: 'available', emoji: '☀️' }
];
let myEquipment = [
  { name: 'Mahindra 275 Tractor', category: 'Tractor', rate: '₹1,500/day', location: 'Your Farm', status: 'available', earnings: '₹12,000', emoji: '🚜' }
];
const SEED_MANDI = [
  { crop: 'Wheat', mandi: 'Azadpur, Delhi', price: '₹2,350', change: '+3.2%', dir: 'up' },
  { crop: 'Rice (Basmati)', mandi: 'Karnal, Haryana', price: '₹6,800', change: '+1.5%', dir: 'up' },
  { crop: 'Tomato', mandi: 'Nashik, MH', price: '₹1,800', change: '-8.4%', dir: 'down' },
  { crop: 'Onion', mandi: 'Lasalgaon, MH', price: '₹2,100', change: '+5.1%', dir: 'up' },
  { crop: 'Potato', mandi: 'Agra, UP', price: '₹950', change: '-2.3%', dir: 'down' },
  { crop: 'Mustard', mandi: 'Kota, Rajasthan', price: '₹5,200', change: '+0.8%', dir: 'up' },
  { crop: 'Sugarcane', mandi: 'Muzaffarnagar, UP', price: '₹350', change: '+0.0%', dir: 'up' },
  { crop: 'Cotton', mandi: 'Rajkot, Gujarat', price: '₹7,100', change: '-1.2%', dir: 'down' }
];
const SEED_ORDERS = [
  { id: 'AGR-20261204', product: 'Organic Wheat (25 qtl)', buyer: 'Delhi Flour Mills', amount: '₹62,500', currentStep: 4, steps: ['Listed','Buyer Matched','Pickup','In Transit','Delivered','Paid'] },
  { id: 'AGR-20261198', product: 'Basmati Rice (15 qtl)', buyer: 'RiceMart Export', amount: '₹1,02,000', currentStep: 2, steps: ['Listed','Buyer Matched','Pickup','In Transit','Delivered','Paid'] }
];
const SEED_CLAIMS = [
  { crop: 'Mustard (Rabi 2024-25)', date: 'Jan 2025', amount: '₹38,000', status: 'Settled', type: 'green', icon: '✅' },
  { crop: 'Tomato (Kharif 2025)', date: 'Sep 2025', amount: '₹45,000', status: 'Under Review', type: 'amber', icon: '⏳' },
  { crop: 'Cotton (Kharif 2024)', date: 'Nov 2024', amount: '₹22,000', status: 'Settled', type: 'green', icon: '✅' },
  { crop: 'Paddy (Kharif 2024)', date: 'Oct 2024', amount: '₹15,000', status: 'Rejected', type: 'red', icon: '❌' }
];
const SEED_ADVISORY = [
  { icon: '🌧️', title: 'Heavy Rain Alert — Thursday', text: 'Expected 40-60mm rainfall. Postpone pesticide spraying. Ensure drainage.', type: 'danger' },
  { icon: '🌡️', title: 'Heat Wave Advisory', text: 'Max temp 38-40°C. Irrigate early morning/evening. Mulch to retain moisture.', type: 'warning' },
  { icon: '🌱', title: 'Best Sowing Window — Maize', text: 'Ideal soil temp for Kharif maize. Recommended: DHM-117, HQPM-1.', type: 'info' },
  { icon: '🐛', title: 'Pest Alert — Aphids', text: 'Aphid infestation nearby on mustard. Apply Imidacloprid 17.8% SL preventively.', type: 'warning' }
];
const SEED_CALENDAR = [
  { month: 'Jun', crop: 'Paddy', activity: 'Nursery Prep' }, { month: 'Jul', crop: 'Maize', activity: 'Sowing' },
  { month: 'Aug', crop: 'Cotton', activity: 'Flowering' }, { month: 'Sep', crop: 'Soybean', activity: 'Pod Formation' },
  { month: 'Oct', crop: 'Wheat', activity: 'Land Prep' }, { month: 'Nov', crop: 'Wheat', activity: 'Sowing' },
  { month: 'Dec', crop: 'Mustard', activity: 'Flowering' }, { month: 'Jan', crop: 'Potato', activity: 'Harvesting' },
  { month: 'Feb', crop: 'Wheat', activity: 'Irrigation' }, { month: 'Mar', crop: 'Wheat', activity: 'Harvesting' },
  { month: 'Apr', crop: 'Sugarcane', activity: 'Planting' }, { month: 'May', crop: 'Vegetables', activity: 'Nursery' }
];
const SEED_PROGRESS = [
  { name: 'PM-KISAN Application', status: 'Approved — Next Jun 2026', pct: 100, color: 'green', icon: '🏛️' },
  { name: 'Kisan Credit Card', status: '₹1,50,000 sanctioned', pct: 100, color: 'green', icon: '💳' },
  { name: 'PMFBY — Wheat (Rabi)', status: 'Policy active', pct: 75, color: 'blue', icon: '🛡️' },
  { name: 'Equipment Loan — Tractor', status: 'Under bank review', pct: 40, color: 'amber', icon: '🚜' }
];
const SEED_EVENTS = [
  { day: '05', month: 'May', name: 'PMFBY Claim Window Closes', desc: 'File claims before deadline' },
  { day: '12', month: 'May', name: 'PM-KISAN Installment', desc: '₹2,000 expected credit' },
  { day: '20', month: 'May', name: 'Kharif Sowing Advisory', desc: 'Agriculture office meeting' },
  { day: '01', month: 'Jun', name: 'Monsoon Onset', desc: 'Prepare fields for Kharif' }
];
const PREMIUM_RATES = {
  'Wheat': { kharif: 280, rabi: 310, zaid: 300, sumPer: 15500 },
  'Rice (Paddy)': { kharif: 350, rabi: 320, zaid: 340, sumPer: 18000 },
  'Maize': { kharif: 260, rabi: 250, zaid: 270, sumPer: 14000 },
  'Cotton': { kharif: 420, rabi: 400, zaid: 410, sumPer: 22000 },
  'Sugarcane': { kharif: 300, rabi: 310, zaid: 300, sumPer: 16000 },
  'Mustard': { kharif: 280, rabi: 290, zaid: 280, sumPer: 15000 },
  'Tomato': { kharif: 380, rabi: 360, zaid: 370, sumPer: 20000 },
  'Potato': { kharif: 320, rabi: 300, zaid: 310, sumPer: 17000 }
};

/* ══════════════════════════════════════════
   PAGE NAVIGATION
══════════════════════════════════════════ */
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
  if (page === 'login' || page === 'register') resetRegSteps();
  if (page === 'dashboard') {
    loadDashboard();
    switchTab('home');
  }
}

function scrollToSection(selector) {
  const el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function toggleMobileNav() {
  const nav = document.getElementById('mobile-nav');
  nav.classList.toggle('open');
}

function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  sb.classList.toggle('open');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sb.classList.contains('open')) {
    overlay.style.display = 'block';
  } else {
    overlay.style.display = 'none';
  }
}


/* ══════════════════════════════════════════
   DASHBOARD TAB SWITCHING
══════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.style.display = 'none');
  const el = document.getElementById('tab-' + tab);
  if (el) el.style.display = 'block';

  const items = document.querySelectorAll('.nav-item');
  items.forEach(n => n.classList.remove('active'));
  const idx = TAB_INDEX[tab];
  if (idx !== undefined && items[idx]) items[idx].classList.add('active');

  if (tab === 'govconnect') renderGovConnect();
  if (tab === 'equipment')  renderEquipment();
  if (tab === 'insurance')  renderInsurance();
  if (tab === 'weather')    renderWeather();
  if (tab === 'market')     renderMarketplace();

  const sb = document.querySelector('.sidebar');
  if (sb && sb.classList.contains('open')) toggleSidebar();
}


/* ══════════════════════════════════════════
   FIREBASE AUTH
══════════════════════════════════════════ */
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  errEl.style.display = 'none';

  if (!email || !pass) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.style.display = 'block';
    return;
  }

  btn.textContent = 'Signing in...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  if (firebaseReady) {
    try {
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      currentUser = {
        name:  cred.user.displayName || email.split('@')[0],
        fname: (cred.user.displayName || email.split('@')[0]).split(' ')[0],
        lname: (cred.user.displayName || '').split(' ').slice(1).join(' ') || '',
        email: cred.user.email,
        phone: ''
      };
      loadDashboard();
      showPage('dashboard');
      setTimeout(() => loadUserProfile(cred.user), 100);
    } catch (err) {
      errEl.textContent = getAuthError(err.code);
      errEl.style.display = 'block';
      btn.textContent = 'Sign In';
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  } else {
    /* Demo mode */
    currentUser = { email, name: email.split('@')[0], fname: email.split('@')[0], lname: '', phone: '' };
    loadDashboard();
    showPage('dashboard');
    showToast('Signed in (Demo mode)');
  }

  btn.textContent = 'Sign In';
  btn.disabled = false;
  btn.style.opacity = '1';
}

async function doGoogleLogin() {
  if (!firebaseReady) {
    showToast('Google login requires Firebase configuration.');
    return;
  }
  try {
    const result = await auth.signInWithPopup(googleProvider);
    currentUser = {
      name:  result.user.displayName || result.user.email.split('@')[0],
      fname: (result.user.displayName || result.user.email.split('@')[0]).split(' ')[0],
      lname: (result.user.displayName || '').split(' ').slice(1).join(' ') || '',
      email: result.user.email,
      phone: ''
    };
    loadDashboard();
    showPage('dashboard');
    setTimeout(() => loadUserProfile(result.user), 100);
  } catch (err) {
    showToast('Google sign-in failed: ' + err.message);
  }
}

async function doRegister() {
  const fname   = document.getElementById('r-fname').value.trim();
  const lname   = document.getElementById('r-lname').value.trim();
  const email   = document.getElementById('r-email').value.trim();
  const pass    = document.getElementById('r-pass').value;

  const userData = {
    fname, lname,
    name:        fname + (lname ? ' ' + lname : ''),
    email,
    phone:       document.getElementById('r-phone').value || '',
    dob:         document.getElementById('r-dob').value || '',
    state:       document.getElementById('r-state').value || '',
    farmType:    document.getElementById('r-farmtype').value || '',
    farmSize:    document.getElementById('r-farmsize').value || '',
    irrigation:  document.getElementById('r-irrigation').value || '',
    crops:       document.getElementById('r-crops').value || '',
    goals:       document.getElementById('r-goals').value || '',
    createdAt:   new Date().toISOString()
  };

  if (firebaseReady) {
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      await getDB().collection('users').doc(cred.user.uid).set(userData);
      await cred.user.updateProfile({ displayName: userData.name });
      currentUser = userData;
      loadDashboard();
      showPage('dashboard');
      showToast('Welcome to AgriTech, ' + fname + '! 🌱');
    } catch (err) {
      showToast('Registration failed: ' + err.message);
    }
  } else {
    /* Demo mode */
    currentUser = userData;
    loadDashboard();
    showPage('dashboard');
    showToast('Welcome to AgriTech, ' + fname + '! 🌱 (Demo mode)');
  }
}

async function doSignOut() {
  if (firebaseReady) {
    await auth.signOut();
  }
  currentUser = null;
  showPage('landing');
  showToast('Signed out successfully.');
}

async function loadUserProfile(firebaseUser) {
  const database = getDB();
  if (!database) return;
  try {
    const doc = await database.collection('users').doc(firebaseUser.uid).get();
    if (doc.exists) {
      Object.assign(currentUser, doc.data());
      loadDashboard();
    }
  } catch (e) { /* offline */ }
}

function getAuthError(code) {
  const map = {
    'auth/user-not-found':        'No account found with that email.',
    'auth/wrong-password':        'Incorrect password. Please try again.',
    'auth/invalid-email':         'Please enter a valid email address.',
    'auth/too-many-requests':     'Too many attempts. Please try again later.',
    'auth/email-already-in-use':  'An account with this email already exists.',
    'auth/weak-password':         'Password should be at least 6 characters.'
  };
  return map[code] || 'Authentication failed. Please try again.';
}


/* ══════════════════════════════════════════
   REGISTRATION STEPS
══════════════════════════════════════════ */
function regNext1() {
  const fname = document.getElementById('r-fname').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const pass  = document.getElementById('r-pass').value;
  const pass2 = document.getElementById('r-pass2').value;
  const errEl = document.getElementById('reg-error1');

  if (!fname || !email || pass.length < 8) {
    errEl.textContent = 'Please fill all required fields. Password must be at least 8 characters.';
    errEl.style.display = 'block';
    return;
  }
  if (pass !== pass2) {
    errEl.textContent = 'Passwords do not match.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
  setRegStep(2);
}

function regNext2() {
  setRegStep(3);
}

function regBack(to) {
  setRegStep(to);
}

function setRegStep(step) {
  [1, 2, 3].forEach(n => {
    document.getElementById('reg-step' + n).style.display = n === step ? 'block' : 'none';
    const dot = document.getElementById('sd' + n);
    dot.className = 'step-dot' + (n < step ? ' done' : n === step ? ' active' : '');
  });
}

function resetRegSteps() {
  setRegStep(1);
  ['reg-error1', 'reg-error2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}


/* ══════════════════════════════════════════
   DASHBOARD INIT
══════════════════════════════════════════ */
function loadDashboard() {
  if (!currentUser) return;

  const initials = (currentUser.fname ? currentUser.fname[0].toUpperCase() : '?') +
                   (currentUser.lname ? currentUser.lname[0].toUpperCase() : '');

  ['sb-avatar', 'top-avatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = initials;
  });

  const sbName = document.getElementById('sb-name');
  if (sbName) sbName.textContent = currentUser.name || currentUser.email;

  // Settings fields
  const setName = document.getElementById('set-name');
  const setEmail = document.getElementById('set-email');
  const setPhone = document.getElementById('set-phone');
  const setLoc = document.getElementById('set-location');
  if (setName) setName.value = currentUser.name || '';
  if (setEmail) setEmail.value = currentUser.email || '';
  if (setPhone) setPhone.value = currentUser.phone || '';
  if (setLoc) setLoc.value = currentUser.state || '';

  // Greeting
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17) greeting = 'Good evening';
  const greetEl = document.getElementById('dash-greeting');
  if (greetEl) greetEl.textContent = greeting + ', ' + (currentUser.fname || 'Farmer');

  // Date subtitle
  const dateSub = document.getElementById('dash-date-sub');
  if (dateSub) dateSub.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Render dynamic home metrics
  const metricsEl = document.getElementById('home-metrics');
  if (metricsEl) {
    const metrics = [
      { icon: '🏛️', val: '3', label: 'Applied Schemes', trend: '+1 this month', trendDir: 'up', cls: 'metric-green' },
      { icon: '🚜', val: '2', label: 'Equipment Items', trend: '1 rented out', trendDir: 'up', cls: 'metric-amber' },
      { icon: '🛡️', val: 'Active', label: 'Crop Insurance', trend: '2 policies', trendDir: 'up', cls: 'metric-blue' },
      { icon: '📦', val: '₹1.2L', label: 'Sales This Season', trend: '+18% vs last', trendDir: 'up', cls: 'metric-purple' }
    ];
    metricsEl.innerHTML = metrics.map(m => `
      <div class="metric-card ${m.cls}">
        <div class="metric-icon"><span style="font-size:22px">${m.icon}</span></div>
        <div class="metric-info">
          <div class="metric-val">${m.val}</div>
          <div class="metric-label">${m.label}</div>
          <div class="metric-trend ${m.trendDir}">↑ ${m.trend}</div>
        </div>
      </div>
    `).join('');
  }

  // Progress list
  const progressEl = document.getElementById('progress-list');
  if (progressEl) {
    progressEl.innerHTML = SEED_PROGRESS.map(p => `
      <div class="progress-item">
        <div class="progress-item-icon">${p.icon}</div>
        <div class="progress-item-info">
          <div class="progress-item-name">${p.name}</div>
          <div class="progress-item-status">${p.status}</div>
          <div class="progress-bar-wrap"><div class="progress-bar-fill ${p.color}" style="width:${p.pct}%"></div></div>
        </div>
      </div>
    `).join('');
  }

  // Events list
  const eventsEl = document.getElementById('events-list');
  if (eventsEl) {
    eventsEl.innerHTML = SEED_EVENTS.map(e => `
      <div class="event-item">
        <div class="event-date-badge"><div class="edb-day">${e.day}</div><div class="edb-mon">${e.month}</div></div>
        <div><div class="event-info-name">${e.name}</div><div class="event-info-desc">${e.desc}</div></div>
      </div>
    `).join('');
  }

  renderActivities();
  fetchLiveWeather();
}


/* ══════════════════════════════════════════
   RENDER ACTIVITIES
══════════════════════════════════════════ */
function renderActivities() {
  const listEl = document.getElementById('activity-list');
  if (!listEl) return;

  listEl.innerHTML = SEED_ACTIVITIES.map(a => `
    <div class="activity-item">
      <div class="activity-dot dot-${a.type}"></div>
      <div class="activity-text">${a.text}</div>
      <div class="activity-time">${a.time}</div>
    </div>
  `).join('');
}


/* ══════════════════════════════════════════
   GOV CONNECT
══════════════════════════════════════════ */
function renderGovConnect() {
  const grid = document.getElementById('govconnect-grid');
  if (!grid) return;
  const search = (document.getElementById('gov-search')?.value || '').toLowerCase();
  const filtered = SEED_GOV.filter(s => {
    const matchFilter = govFilter === 'all' || s.category === govFilter;
    const matchSearch = !search || s.name.toLowerCase().includes(search) || s.desc.toLowerCase().includes(search) || s.category.toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });
  if (!filtered.length) { grid.innerHTML = '<div class="empty-state">No schemes found matching your search.</div>'; }
  else {
    grid.innerHTML = filtered.map(s => `
      <div class="market-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div class="market-category">${s.category}</div>
          <span style="font-size:11px;font-weight:600;color:var(--primary);background:var(--primary-bg);padding:3px 10px;border-radius:999px">${s.badge}</span>
        </div>
        <div class="market-name">${s.name}</div>
        <div style="font-size:13px;color:var(--text3);margin:8px 0 16px;line-height:1.6">${s.desc}</div>
        <button class="btn-primary" style="width:100%;justify-content:center;padding:10px" onclick="applyGovScheme('${s.name}')">Apply Now</button>
      </div>
    `).join('');
  }
  // Applications
  const appEl = document.getElementById('gov-applications');
  if (appEl) {
    if (!govApplications.length) { appEl.innerHTML = '<div class="empty-state">No applications yet. Apply for a scheme above!</div>'; }
    else {
      appEl.innerHTML = govApplications.map(a => `
        <div class="app-item">
          <div class="app-item-icon">${a.icon}</div>
          <div class="app-item-info"><div class="app-item-name">${a.name}</div><div class="app-item-date">Applied: ${a.date}</div></div>
          <div class="app-status ${a.status}">${a.status.charAt(0).toUpperCase()+a.status.slice(1)}</div>
        </div>
      `).join('');
    }
  }
}

function setGovFilter(filter, btn) {
  govFilter = filter;
  document.querySelectorAll('#gov-filters .filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderGovConnect();
}

function applyGovScheme(name) {
  document.getElementById('gov-scheme-name').value = name;
  if (currentUser) {
    document.getElementById('gov-app-name').value = currentUser.name || '';
    document.getElementById('gov-app-phone').value = currentUser.phone || '';
    document.getElementById('gov-app-area').value = currentUser.farmSize || '';
  }
  document.getElementById('gov-apply-modal').classList.add('open');
}

function closeGovApplyModal() {
  document.getElementById('gov-apply-modal').classList.remove('open');
}

async function submitGovApplication() {
  const name = document.getElementById('gov-scheme-name').value;
  const appName = document.getElementById('gov-app-name').value.trim();
  const phone = document.getElementById('gov-app-phone').value.trim();
  const aadhaar = document.getElementById('gov-app-aadhaar').value.trim();
  const area = document.getElementById('gov-app-area').value.trim();

  if (!appName || !phone || !aadhaar) {
    showToast('Please fill in Name, Phone, and Aadhaar.');
    return;
  }

  const btn = document.getElementById('gov-submit-btn');
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  const appData = {
    schemeName: name,
    applicantName: appName,
    phone: phone,
    aadhaar: aadhaar,
    area: area,
    status: 'submitted',
    date: new Date().toISOString()
  };

  // Simulate network delay
  await new Promise(r => setTimeout(r, 1000));

  if (firebaseReady && auth.currentUser) {
    try {
      await getDB().collection('gov_applications').add({
        ...appData,
        userId: auth.currentUser.uid
      });
    } catch (e) {
      console.error('Firestore save failed', e);
    }
  }

  govApplications.unshift({ name, date: new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}), status: 'submitted', icon: '📋' });
  
  btn.textContent = 'Submit Application';
  btn.disabled = false;
  closeGovApplyModal();
  renderGovConnect();
  showToast('Application for ' + name + ' submitted successfully! ✓');

  document.getElementById('gov-app-aadhaar').value = '';
}

/* ══════════════════════════════════════════
   EQUIPMENT (3 sub-tabs)
══════════════════════════════════════════ */
function renderEquipment() {
  renderEquipmentRent();
  renderEquipmentBuy();
  renderMyEquipment();
}
function setEquipSubTab(tab, btn) {
  document.querySelectorAll('#tab-equipment .sub-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['rent','buy','my'].forEach(t => {
    const el = document.getElementById('equip-'+t+'-content');
    if (el) { el.classList.remove('active'); if (t === tab) el.classList.add('active'); }
  });
  if (tab === 'rent') renderEquipmentRent();
  if (tab === 'buy') renderEquipmentBuy();
  if (tab === 'my') renderMyEquipment();
}
function setEquipFilter(filter, btn) {
  equipFilter = filter;
  document.querySelectorAll('#equip-filters .filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderEquipmentRent();
}
function renderEquipmentRent() {
  const grid = document.getElementById('equip-rent-grid');
  if (!grid) return;
  const search = (document.getElementById('equip-search')?.value || '').toLowerCase();
  const filtered = SEED_EQUIP_SHARING.filter(e => {
    const matchFilter = equipFilter === 'all' || e.category === equipFilter;
    const matchSearch = !search || e.name.toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });
  grid.innerHTML = filtered.map(e => `
    <div class="market-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div class="market-category">${e.category}</div>
        <span class="equip-card-status ${e.status}">${e.status.charAt(0).toUpperCase()+e.status.slice(1)}</span>
      </div>
      <div style="font-size:28px;margin-bottom:8px">${e.emoji}</div>
      <div class="market-name">${e.name}</div>
      <div class="equip-owner">👤 ${e.owner}</div>
      <div class="equip-location">📍 ${e.location}</div>
      <div class="market-info">
        <div class="equip-rate">${e.rate}</div>
      </div>
      <button class="btn-${e.status === 'available' ? 'primary' : 'outline'}" style="width:100%;justify-content:center;margin-top:12px;padding:10px" 
        ${e.status !== 'available' ? 'disabled' : ''} onclick="openEquipBooking('${e.name}')">
        ${e.status === 'available' ? '📅 Request Rental' : e.status === 'booked' ? '⏳ Currently Booked' : '🔧 Under Maintenance'}
      </button>
    </div>
  `).join('');
}
function renderEquipmentBuy() {
  const grid = document.getElementById('equip-buy-grid');
  if (!grid) return;
  grid.innerHTML = SEED_EQUIPMENT.map(e => `
    <div class="market-card">
      <div class="market-category">${e.category}</div>
      <div class="market-name">${e.name}</div>
      <div style="font-size:13px;color:var(--text3);margin:8px 0 12px;line-height:1.6">${e.desc}</div>
      <div class="market-info">
        <div class="market-price">${e.price}</div>
        <div style="font-size:12px;color:var(--text3)">EMI: ${e.emi}</div>
      </div>
      <button class="btn-outline" style="width:100%;justify-content:center;margin-top:12px;padding:10px" onclick="showToast('Loan enquiry for ${e.name} submitted! ✓')">Apply for Loan / Rent</button>
    </div>
  `).join('');
}
function renderMyEquipment() {
  const statsEl = document.getElementById('equip-my-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="equip-earnings-card">
        <div><div class="stat-card-val">₹${myEquipment.reduce((s,e) => s + parseInt((e.earnings||'0').replace(/[^0-9]/g,'')), 0).toLocaleString('en-IN')}</div><div class="stat-card-label">Total Earnings</div></div>
        <div><div class="stat-card-val">${myEquipment.length}</div><div class="stat-card-label">Listed Items</div></div>
        <div><div class="stat-card-val">${myEquipment.filter(e=>e.status==='available').length}</div><div class="stat-card-label">Available Now</div></div>
      </div>`;
  }
  const grid = document.getElementById('equip-my-grid');
  if (!grid) return;
  if (!myEquipment.length) { grid.innerHTML = '<div class="empty-state">No equipment listed yet. Click "+ List My Equipment" to start sharing!</div>'; return; }
  grid.innerHTML = myEquipment.map(e => `
    <div class="market-card">
      <div style="display:flex;justify-content:space-between"><div class="market-category">${e.category}</div><span class="equip-card-status ${e.status}">${e.status}</span></div>
      <div style="font-size:28px;margin:8px 0">${e.emoji}</div>
      <div class="market-name">${e.name}</div>
      <div class="equip-location">📍 ${e.location}</div>
      <div class="market-info"><div class="equip-rate">${e.rate}</div><div style="font-size:13px;color:var(--primary);font-weight:600">Earned: ${e.earnings||'₹0'}</div></div>
    </div>
  `).join('');
}
let bookingEquipName = '';
function openEquipBooking(name) { bookingEquipName = name; document.getElementById('equip-booking-name').textContent = name; document.getElementById('equip-booking-modal').classList.add('open'); }
function closeEquipBookingModal() { document.getElementById('equip-booking-modal').classList.remove('open'); }
function submitEquipBooking() { closeEquipBookingModal(); showToast('Rental request for ' + bookingEquipName + ' submitted! 📅'); }
function openAddEquipmentModal() { document.getElementById('equip-add-modal').classList.add('open'); }
function closeAddEquipmentModal() { document.getElementById('equip-add-modal').classList.remove('open'); }
function addMyEquipment() {
  const name = document.getElementById('my-equip-name').value.trim();
  const rate = document.getElementById('my-equip-rate').value;
  const cat = document.getElementById('my-equip-category').value;
  const loc = document.getElementById('my-equip-location').value.trim();
  if (!name || !rate) { showToast('Please fill name and daily rate.'); return; }
  const emojis = { Tractor:'🚜', Harvester:'🌾', Pump:'💧', Tiller:'⚙️', Drone:'🛸', Other:'🔧' };
  myEquipment.push({ name, category: cat, rate: '₹'+rate+'/day', location: loc || 'Your Farm', status: 'available', earnings: '₹0', emoji: emojis[cat]||'🔧' });
  closeAddEquipmentModal();
  setEquipSubTab('my', document.querySelectorAll('#tab-equipment .sub-tab')[2]);
  showToast('Equipment listed: ' + name + ' 🚜');
  document.getElementById('my-equip-name').value = '';
  document.getElementById('my-equip-rate').value = '';
  document.getElementById('my-equip-location').value = '';
}

/* ══════════════════════════════════════════
   CROP INSURANCE
══════════════════════════════════════════ */
function renderInsurance() {
  // Stats row
  const statsEl = document.getElementById('insurance-stats');
  if (statsEl) {
    const totalCoverage = SEED_INSURANCE.reduce((s,i) => s + parseInt(i.sumInsured.replace(/[^0-9]/g,'')), 0);
    const totalPremium = SEED_INSURANCE.reduce((s,i) => s + parseInt(i.premium.replace(/[^0-9]/g,'')), 0);
    statsEl.innerHTML = `
      <div class="stat-card green"><div class="stat-card-icon">🛡️</div><div class="stat-card-val">${SEED_INSURANCE.length}</div><div class="stat-card-label">Active Policies</div></div>
      <div class="stat-card blue"><div class="stat-card-icon">💰</div><div class="stat-card-val">₹${totalCoverage.toLocaleString('en-IN')}</div><div class="stat-card-label">Total Coverage</div></div>
      <div class="stat-card amber"><div class="stat-card-icon">📋</div><div class="stat-card-val">₹${totalPremium.toLocaleString('en-IN')}</div><div class="stat-card-label">Premium Paid YTD</div></div>
    `;
  }
  // Policies
  const el = document.getElementById('insurance-content');
  if (el) {
    el.innerHTML = `<h3 class="sub-section-title">📋 Active Policies</h3><div class="reports-grid">${SEED_INSURANCE.map(ins => `
      <div class="report-card"><h3>${ins.crop}</h3>
        <div class="report-row"><span class="report-label">Area</span><span class="report-value">${ins.area}</span></div>
        <div class="report-row"><span class="report-label">Premium</span><span class="report-value">${ins.premium}</span></div>
        <div class="report-row"><span class="report-label">Sum Insured</span><span class="report-value">${ins.sumInsured}</span></div>
        <div class="report-row"><span class="report-label">Status</span><span class="crop-health health-${ins.statusType}" style="padding:3px 12px;border-radius:999px;font-size:12px">${ins.status}</span></div>
      </div>`).join('')}</div>`;
  }
  // Claims
  const claimsEl = document.getElementById('claims-timeline');
  if (claimsEl) {
    claimsEl.innerHTML = SEED_CLAIMS.map(c => `
      <div class="claim-item"><div class="claim-icon">${c.icon}</div><div class="claim-info"><div class="claim-crop">${c.crop}</div><div class="claim-detail">${c.date} · ${c.status}</div></div><div class="claim-amount ${c.type}">${c.amount}</div></div>
    `).join('');
  }
  calcPremium();
}

function autoCalcInsurancePremium() {
  const area = parseFloat(document.getElementById('ins-area')?.value || 0);
  const el = document.getElementById('ins-premium');
  if (el) el.value = area > 0 ? '₹' + Math.round(area * 310).toLocaleString('en-IN') : '';
}

function calcPremium() {
  const crop = document.getElementById('calc-crop')?.value || 'Wheat';
  const area = parseFloat(document.getElementById('calc-area')?.value || 5);
  const season = (document.getElementById('calc-season')?.value || 'Kharif').toLowerCase();
  const rates = PREMIUM_RATES[crop] || PREMIUM_RATES['Wheat'];
  const premium = Math.round(area * (rates[season] || rates.rabi));
  const sumInsured = Math.round(area * rates.sumPer);
  const govSubsidy = Math.round(premium * 0.5);
  const resultEl = document.getElementById('calc-result');
  if (resultEl) {
    resultEl.innerHTML = `
      <div class="calc-result-row"><span class="calc-result-label">Crop</span><span class="calc-result-val">${crop}</span></div>
      <div class="calc-result-row"><span class="calc-result-label">Area</span><span class="calc-result-val">${area} acres</span></div>
      <div class="calc-result-row"><span class="calc-result-label">Sum Insured</span><span class="calc-result-val">₹${sumInsured.toLocaleString('en-IN')}</span></div>
      <div class="calc-result-row"><span class="calc-result-label">Gross Premium</span><span class="calc-result-val">₹${premium.toLocaleString('en-IN')}</span></div>
      <div class="calc-result-row"><span class="calc-result-label">Govt Subsidy (50%)</span><span class="calc-result-val" style="color:var(--primary)">-₹${govSubsidy.toLocaleString('en-IN')}</span></div>
      <div class="calc-result-row" style="border-top:1px solid rgba(46,125,50,0.2);padding-top:10px;margin-top:6px"><span class="calc-result-label" style="font-weight:600">You Pay</span><span class="calc-result-val highlight">₹${(premium - govSubsidy).toLocaleString('en-IN')}</span></div>
    `;
  }
}

/* ══════════════════════════════════════════
   WEATHER (enhanced)
══════════════════════════════════════════ */
async function fetchLiveWeather(isManual = false) {
  if (isManual) showToast('Refreshing weather data... 🔄');
  try {
    const lat = 28.6139;
    const lon = 77.2090;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather API failed');
    const data = await response.json();

    const getWeatherDesc = (code) => {
        if (code === 0) return { desc: 'Clear sky', icon: '☀️' };
        if (code >= 1 && code <= 3) return { desc: 'Partly cloudy', icon: '🌤️' };
        if (code >= 45 && code <= 48) return { desc: 'Foggy', icon: '🌫️' };
        if (code >= 51 && code <= 67) return { desc: 'Rainy', icon: '🌧️' };
        if (code >= 71 && code <= 77) return { desc: 'Snowy', icon: '❄️' };
        if (code >= 80 && code <= 82) return { desc: 'Showers', icon: '🌦️' };
        if (code >= 95 && code <= 99) return { desc: 'Thunderstorm', icon: '⛈️' };
        return { desc: 'Unknown', icon: '🌤️' };
    };

    const currentDesc = getWeatherDesc(data.current.weather_code);

    SEED_WEATHER.current = {
      temp: Math.round(data.current.temperature_2m),
      desc: currentDesc.desc,
      humidity: data.current.relative_humidity_2m,
      wind: Math.round(data.current.wind_speed_10m) + " km/h",
      rain: data.current.precipitation + "mm",
      uv: "6"
    };

    SEED_WEATHER.forecast = data.daily.time.slice(0, 5).map((dateStr, i) => {
      const date = new Date(dateStr);
      const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
      const descInfo = getWeatherDesc(data.daily.weather_code[i]);
      return {
        day: dayStr,
        icon: descInfo.icon,
        high: Math.round(data.daily.temperature_2m_max[i]),
        low: Math.round(data.daily.temperature_2m_min[i]),
        rain: data.daily.precipitation_probability_max[i] + "%"
      };
    });

    const miniWeather = document.getElementById('dash-weather-mini');
    if (miniWeather) {
      miniWeather.innerHTML = `
        <span class="mini-weather-icon">${currentDesc.icon}</span>
        <span class="mini-weather-temp">${SEED_WEATHER.current.temp}°C</span>
        <span class="mini-weather-desc">${SEED_WEATHER.current.desc}</span>
      `;
    }

    const weatherTab = document.getElementById('tab-weather');
    if (weatherTab && weatherTab.style.display === 'block') {
      renderWeather();
    }
    
    if (isManual) showToast('Weather updated! 🌤️');
  } catch (err) {
    if (isManual) showToast('Failed to refresh weather. ❌');
    console.error("Failed to fetch live weather, using fallback data:", err);
  }
}

function renderWeather() {
  const w = SEED_WEATHER;
  const currentEl = document.getElementById('weather-current');
  if (currentEl) {
    currentEl.innerHTML = `
      <div><div class="weather-temp">${w.current.temp}°C</div><div class="weather-desc">${w.current.desc}</div><div class="weather-location">📍 ${currentUser?.state || 'Your Location'}</div></div>
      <div class="weather-details">
        <div class="weather-detail"><div class="weather-detail-val">${w.current.humidity}%</div><div class="weather-detail-label">Humidity</div></div>
        <div class="weather-detail"><div class="weather-detail-val">${w.current.wind}</div><div class="weather-detail-label">Wind</div></div>
        <div class="weather-detail"><div class="weather-detail-val">${w.current.rain}</div><div class="weather-detail-label">Rainfall</div></div>
        <div class="weather-detail"><div class="weather-detail-val">${w.current.uv}</div><div class="weather-detail-label">UV Index</div></div>
      </div>`;
  }
  // Advisory
  const advEl = document.getElementById('weather-advisory');
  if (advEl) {
    advEl.innerHTML = SEED_ADVISORY.map(a => `
      <div class="advisory-card ${a.type}"><div class="advisory-icon">${a.icon}</div><div class="advisory-title">${a.title}</div><div class="advisory-text">${a.text}</div></div>
    `).join('');
  }
  // Forecast
  const forecastEl = document.getElementById('weather-forecast');
  if (forecastEl) {
    forecastEl.innerHTML = w.forecast.map(f => `
      <div class="forecast-card"><div class="forecast-day">${f.day}</div><div class="forecast-icon">${f.icon}</div><div class="forecast-temp">${f.high}°C</div><div class="forecast-range">${f.low}° / ${f.high}° · Rain ${f.rain}</div></div>
    `).join('');
  }
  // Crop Calendar
  const calEl = document.getElementById('crop-calendar');
  if (calEl) {
    calEl.innerHTML = SEED_CALENDAR.map(c => `
      <div class="calendar-item"><div class="calendar-month">${c.month}</div><div class="calendar-crop">${c.crop}</div><div class="calendar-activity">${c.activity}</div></div>
    `).join('');
  }
}


function openInsuranceEnrol() { document.getElementById('insurance-modal').classList.add('open'); }
function closeInsuranceModal() { document.getElementById('insurance-modal').classList.remove('open'); }
let pendingInsuranceData = null;

function submitInsurance() {
  const crop = document.getElementById('ins-crop').value.trim();
  const area = document.getElementById('ins-area').value;
  const season = document.getElementById('ins-season').value;
  
  if (!crop || !area) { 
    showToast('Please fill in crop name and area.'); 
    return; 
  }
  
  const premium = Math.round(area * 310); 
  const sumIns = area * 15500;

  pendingInsuranceData = {
    crop: `${crop} (${season})`,
    area: `${area} acres`,
    premium: premium,
    sumInsured: sumIns,
    rawCrop: crop,
    rawArea: area,
    rawSeason: season
  };

  closeInsuranceModal();
  document.getElementById('pay-amount-display').innerText = `₹${premium.toLocaleString('en-IN')}`;
  document.getElementById('insurance-payment-modal').classList.add('open');
}

function closeInsurancePaymentModal() {
  document.getElementById('insurance-payment-modal').classList.remove('open');
}

async function processInsurancePayment() {
  if (!pendingInsuranceData) return;

  const btn = document.getElementById('process-pay-btn');
  btn.textContent = 'Processing Payment...';
  btn.disabled = true;

  // Simulate payment delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  const paymentRecord = {
    amount: pendingInsuranceData.premium,
    purpose: 'Crop Insurance PMFBY',
    status: 'Success',
    method: document.getElementById('pay-method').value,
    date: new Date().toISOString()
  };

  const insuranceRecord = {
    crop: pendingInsuranceData.crop,
    area: pendingInsuranceData.area,
    premium: `₹${pendingInsuranceData.premium.toLocaleString('en-IN')}`,
    sumInsured: `₹${pendingInsuranceData.sumInsured.toLocaleString('en-IN')}`,
    status: 'Active',
    statusType: 'good',
    paymentDate: new Date().toISOString()
  };

  if (firebaseReady && auth.currentUser) {
    try {
      const db = getDB();
      // Store payment
      await db.collection('payments').add({
        ...paymentRecord,
        userId: auth.currentUser.uid
      });
      // Store insurance policy
      await db.collection('crop_insurance').add({
        ...insuranceRecord,
        userId: auth.currentUser.uid
      });
    } catch (error) {
      console.error("Failed to save to Firestore", error);
    }
  }

  // Update local state
  SEED_INSURANCE.unshift(insuranceRecord);
  
  btn.textContent = 'Pay Now';
  btn.disabled = false;
  
  closeInsurancePaymentModal();
  renderInsurance();
  showToast(`Payment successful! Policy active for ${pendingInsuranceData.rawCrop}. ✅`);
  
  document.getElementById('ins-crop').value = ''; 
  document.getElementById('ins-area').value = '';
  pendingInsuranceData = null;
}


/* ══════════════════════════════════════════
   MARKETPLACE (enhanced with sub-tabs)
══════════════════════════════════════════ */
let marketListings = [...SEED_MARKET];

function renderMarketplace() {
  // Listings
  const grid = document.getElementById('market-listings');
  if (grid) {
    if (!marketListings.length) { grid.innerHTML = '<div class="empty-state">No listings yet. Be the first to list your produce!</div>'; }
    else {
      grid.innerHTML = marketListings.map(item => `
        <div class="market-card">
          <div class="market-category">${item.category}</div>
          <div class="market-name">${item.name}</div>
          <div class="market-seller">👤 ${item.seller}</div>
          <div class="market-info"><div class="market-price">${item.price}</div><div class="market-qty">${item.qty}</div></div>
          <button class="btn-outline" style="width:100%;justify-content:center;margin-top:12px;padding:8px" onclick="showToast('Enquiry sent to ${item.seller}! 📞')">Contact Seller</button>
        </div>
      `).join('');
    }
  }
  // Orders
  const ordersEl = document.getElementById('market-orders');
  if (ordersEl) {
    ordersEl.innerHTML = SEED_ORDERS.map(o => `
      <div class="order-card">
        <div class="order-header"><div class="order-title">${o.product}</div><div class="order-id">${o.id} · ${o.buyer} · ${o.amount}</div></div>
        <div class="order-timeline">
          ${o.steps.map((step, i) => {
            const isDone = i < o.currentStep; const isCurrent = i === o.currentStep;
            return `<div class="timeline-step"><div class="timeline-dot ${isDone ? 'done' : isCurrent ? 'current' : ''}">${isDone ? '✓' : i+1}</div><div class="timeline-label">${step}</div></div>${i < o.steps.length-1 ? '<div class="timeline-line '+(isDone?'done':'')+'"></div>' : ''}`;
          }).join('')}
        </div>
      </div>
    `).join('');
  }
  // Mandi prices
  const mandiEl = document.getElementById('mandi-prices');
  if (mandiEl) {
    mandiEl.innerHTML = `
      <table class="mandi-table">
        <thead><tr><th>Crop</th><th>Mandi</th><th>Price/Qtl</th><th>Change</th></tr></thead>
        <tbody>${SEED_MANDI.map(m => `
          <tr><td><strong>${m.crop}</strong></td><td>${m.mandi}</td><td style="font-weight:600">${m.price}</td><td class="price-${m.dir}">${m.dir === 'up' ? '↑' : '↓'} ${m.change}</td></tr>
        `).join('')}</tbody>
      </table>`;
  }
}

function setMarketSubTab(tab, btn) {
  document.querySelectorAll('#tab-market .sub-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['listings','orders','mandi'].forEach(t => {
    const el = document.getElementById('market-'+t+'-content');
    if (el) { el.classList.remove('active'); if (t === tab) el.classList.add('active'); }
  });
  renderMarketplace();
}

function openAddListing() {
  document.getElementById('listing-modal').classList.add('open');
}

function closeListingModal() {
  document.getElementById('listing-modal').classList.remove('open');
}

function addListing() {
  const name     = document.getElementById('lst-name').value.trim();
  const price    = document.getElementById('lst-price').value;
  const qty      = document.getElementById('lst-qty').value;
  const category = document.getElementById('lst-category').value;

  if (!name || !price) {
    showToast('Please fill in the product name and price.');
    return;
  }

  const listing = {
    name,
    category,
    price: '₹' + parseInt(price).toLocaleString('en-IN'),
    qty: qty + ' quintals',
    seller: currentUser ? currentUser.name : 'You'
  };

  marketListings.unshift(listing);

  /* Save to Firestore */
  if (firebaseReady && auth.currentUser) {
    try {
      getDB().collection('marketplace').add({
        ...listing,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });
    } catch (e) { /* offline */ }
  }

  renderMarketplace();
  closeListingModal();
  showToast('Listing published: ' + name + ' 🌾');

  // Clear form
  ['lst-name', 'lst-price', 'lst-qty'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}


/* ══════════════════════════════════════════
   DISEASE DETECTION (Simulated AI)
══════════════════════════════════════════ */
function handleDiseaseUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  const zone = document.getElementById('upload-zone');
  zone.innerHTML = `
    <div style="color:var(--primary);font-size:24px;margin-bottom:8px">🔬</div>
    <h3>Analyzing "${file.name}"...</h3>
    <p>AI model processing your image</p>
    <div style="width:200px;height:4px;background:var(--border);border-radius:2px;margin:16px auto 0;overflow:hidden">
      <div style="width:0%;height:100%;background:var(--primary);border-radius:2px;animation:progressBar 2s ease forwards"></div>
    </div>
    <style>@keyframes progressBar{to{width:100%}}</style>
  `;

  setTimeout(() => {
    const results = [
      { icon: "🦠", label: "Disease Detected", val: "Early Blight (Alternaria solani)", bg: "var(--red-bg)" },
      { icon: "📊", label: "Confidence", val: "94.7%", bg: "var(--primary-bg)" },
      { icon: "🌡️", label: "Severity", val: "Moderate — Stage 2 of 5", bg: "var(--amber-bg)" },
      { icon: "💊", label: "Treatment", val: "Apply Mancozeb 75% WP @ 2.5g/L, spray at 10-day intervals", bg: "var(--secondary-bg)" },
      { icon: "🛡️", label: "Prevention", val: "Use resistant varieties, crop rotation, proper spacing for air circulation", bg: "var(--teal-bg)" }
    ];

    zone.innerHTML = `
      <div style="color:var(--primary);font-size:24px;margin-bottom:8px">✅</div>
      <h3>Analysis Complete</h3>
      <p>Image: ${file.name}</p>
    `;

    const resultEl = document.getElementById('disease-result');
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <h3>Diagnosis Report</h3>
      ${results.map(r => `
        <div class="disease-finding">
          <div class="finding-icon" style="background:${r.bg}">${r.icon}</div>
          <div class="finding-text">
            <div class="finding-label">${r.label}</div>
            <div class="finding-val">${r.val}</div>
          </div>
        </div>
      `).join('')}
    `;

    showToast('Disease analysis complete — Early Blight detected.');
  }, 2500);
}


/* ══════════════════════════════════════════
   REPORTS
══════════════════════════════════════════ */
function renderReports() {
  const el = document.getElementById('reports-content');
  if (!el) return;

  el.innerHTML = `
    <div class="report-card">
      <h3>📊 Yield Summary</h3>
      <div class="report-row"><span class="report-label">Total Active Crops</span><span class="report-value">5</span></div>
      <div class="report-row"><span class="report-label">Avg Yield Forecast</span><span class="report-value">+18% vs last season</span></div>
      <div class="report-row"><span class="report-label">Best Performing</span><span class="report-value">Wheat (HD-2967)</span></div>
      <div class="report-row"><span class="report-label">Needs Attention</span><span class="report-value">Tomato (low moisture)</span></div>
    </div>
    <div class="report-card">
      <h3>💧 Water Usage</h3>
      <div class="report-row"><span class="report-label">This Month</span><span class="report-value">42,500 L</span></div>
      <div class="report-row"><span class="report-label">vs Last Month</span><span class="report-value">−12% ↓</span></div>
      <div class="report-row"><span class="report-label">Optimal Target</span><span class="report-value">38,000 L</span></div>
      <div class="report-row"><span class="report-label">Irrigation Efficiency</span><span class="report-value">87%</span></div>
    </div>
    <div class="report-card">
      <h3>🌡️ Soil Health</h3>
      <div class="report-row"><span class="report-label">pH Level</span><span class="report-value">6.8 (Optimal)</span></div>
      <div class="report-row"><span class="report-label">Nitrogen (N)</span><span class="report-value">Medium — 280 kg/ha</span></div>
      <div class="report-row"><span class="report-label">Phosphorus (P)</span><span class="report-value">High — 35 kg/ha</span></div>
      <div class="report-row"><span class="report-label">Potassium (K)</span><span class="report-value">Medium — 190 kg/ha</span></div>
    </div>
    <div class="report-card">
      <h3>💰 Financial Overview</h3>
      <div class="report-row"><span class="report-label">Input Costs (YTD)</span><span class="report-value">₹1,85,000</span></div>
      <div class="report-row"><span class="report-label">Revenue (YTD)</span><span class="report-value">₹4,20,000</span></div>
      <div class="report-row"><span class="report-label">Net Profit</span><span class="report-value">₹2,35,000</span></div>
      <div class="report-row"><span class="report-label">ROI</span><span class="report-value">127%</span></div>
    </div>
  `;
}


/* ══════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════ */
function saveSettings() {
  const name  = document.getElementById('set-name').value;
  const phone = document.getElementById('set-phone').value;
  const loc   = document.getElementById('set-location').value;

  if (currentUser) {
    currentUser.name  = name;
    currentUser.phone = phone;
    currentUser.state = loc;
  }

  if (firebaseReady && auth.currentUser) {
    getDB().collection('users').doc(auth.currentUser.uid).update({ name, phone, state: loc })
      .then(() => showToast('Settings saved successfully. ✓'))
      .catch(() => showToast('Settings saved locally.'));
  } else {
    showToast('Settings saved. ✓');
  }

  loadDashboard();
}


/* ══════════════════════════════════════════
   TOAST NOTIFICATION
══════════════════════════════════════════ */
function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  msgEl.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}


/* ══════════════════════════════════════════
   MODALS
══════════════════════════════════════════ */
function closeModal() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}


/* ══════════════════════════════════════════
   SCROLL REVEAL
══════════════════════════════════════════ */
function initScrollReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}


/* ══════════════════════════════════════════
   AI CROP ADVISORY
══════════════════════════════════════════ */
async function generateAdvisory() {
  const n = document.getElementById('adv-n').value;
  const p = document.getElementById('adv-p').value;
  const k = document.getElementById('adv-k').value;
  const temp = document.getElementById('adv-temp').value;
  const hum = document.getElementById('adv-hum').value;
  const rain = document.getElementById('adv-rain').value;
  const ph = document.getElementById('adv-ph').value;

  if (!n || !p || !k || !temp || !hum || !rain || !ph) {
    showToast('Please fill all environmental parameters.');
    return;
  }

  const btn = document.getElementById('btn-generate-advisory');
  btn.textContent = 'Normalizing Data...';
  btn.disabled = true;
  document.getElementById('advisory-result').style.display = 'none';

  // Step 2: Data Preprocessing Simulation
  await new Promise(r => setTimeout(r, 800));
  btn.textContent = 'Running Random Forest Model...';

  // Step 3 & 4: Model Training & Prediction Simulation
  await new Promise(r => setTimeout(r, 1200));

  // Simple Decision Tree rules to mimic a Random Forest
  let crop = "Maize 🌽";
  let yieldPred = "18 q/acre";
  let irrigation = "Moderate watering, 1-2 times a week depending on soil moisture.";

  if (rain > 150 && hum > 70) {
    crop = "Rice 🌾";
    yieldPred = "22 q/acre";
    irrigation = "Flood irrigation required. Maintain 2-3 inches of water level.";
  } else if (n > 60 && p > 40 && temp < 26) {
    crop = "Wheat 🌾";
    yieldPred = "15 q/acre";
    irrigation = "Requires 4-6 irrigations at critical growth stages (CRI, tillering, etc.).";
  } else if (rain < 100 && temp > 28) {
    crop = "Millet 🌾";
    yieldPred = "8 q/acre";
    irrigation = "Highly drought tolerant. Needs life-saving irrigation only during dry spells.";
  } else if (ph < 6.0 && temp > 20 && temp < 30) {
    crop = "Tea 🍃";
    yieldPred = "1200 kg/acre";
    irrigation = "Sprinkler irrigation recommended during dry periods.";
  } else if (k > 40 && rain > 100) {
    crop = "Sugarcane 🎋";
    yieldPred = "35 tons/acre";
    irrigation = "Frequent irrigation needed. Drip irrigation can save 40% water.";
  }

  // Step 5: Output
  document.getElementById('out-crop').innerHTML = crop;
  document.getElementById('out-yield').textContent = yieldPred;
  document.getElementById('out-irrigation').textContent = irrigation;

  document.getElementById('advisory-result').style.display = 'block';
  btn.textContent = 'Generate Advisory (Random Forest Engine)';
  btn.disabled = false;
  
  showToast('Advisory generated successfully! ✅');
}

function initNavScroll() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      nav.style.background = 'rgba(255,255,255,0.96)';
      nav.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
    } else {
      nav.style.background = 'rgba(255,255,255,0.92)';
      nav.style.boxShadow = 'none';
    }
  }, { passive: true });
}


/* ══════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════ */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const active = document.activeElement;
      if (active && active.id === 'login-pass') doLogin();
    }
    if (e.key === 'Escape') {
      closeModal();
      closeListingModal();
      document.getElementById('mobile-nav')?.classList.remove('open');
    }
  });
}


/* ══════════════════════════════════════════
   BOOT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  initScrollReveal();
  initNavScroll();
  initKeyboard();
});

// Fallback init
if (document.readyState === 'complete') {
  initApp();
} else {
  window.addEventListener('load', initApp);
}
