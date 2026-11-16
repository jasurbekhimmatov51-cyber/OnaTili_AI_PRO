import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';

const STATE = {
  auth: null,
  db: null,
  user: null,
  isAdmin: false,
  adminUnlocked: false,
  communityQuestions: [],
  contentReady: false
};

const PENDING_KEY = 'onatili_firebase_pending_records_v1';
const ADMIN_UNLOCK_KEY = 'onatili_admin_unlock_uid_v1';
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));
const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function notify(message, error = false) {
  if (typeof window.toast === 'function') {
    window.toast(message, error);
    return;
  }
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.className = `toast visible${error ? ' error' : ''}`;
  window.clearTimeout(window.__firebaseToastTimer);
  window.__firebaseToastTimer = window.setTimeout(() => {
    node.className = 'toast';
  }, 4200);
}

function dateText(value) {
  try {
    const date = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Hozirgina'
      : new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  } catch {
    return 'Hozirgina';
  }
}

function pendingRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function putPending(records) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(records.slice(-24)));
  } catch {
    // Browser storage can be disabled. The live test result still remains visible.
  }
}

function queueRecord(bucket, payload) {
  const records = pendingRecords();
  records.push({ bucket, payload, queuedAt: Date.now() });
  putPending(records);
}

function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // No action needed when storage is disabled.
  }
}

function getRequestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input?.url || '';
}

function isCurrentResultsPage() {
  return Boolean($('#page-results.active'));
}

async function updateAdminStatus() {
  STATE.isAdmin = false;
  STATE.adminUnlocked = false;
  if (!STATE.user || !STATE.db) return;
  try {
    // Firestore rules allow this aggregate only for the configured admin.
    await getCountFromServer(collection(STATE.db, 'profiles'));
    STATE.isAdmin = true;
    STATE.adminUnlocked = sessionStorage.getItem(ADMIN_UNLOCK_KEY) === STATE.user.uid;
  } catch {
    // Other signed-in users do not receive admin UI or privileges.
  }
}

function injectStyles() {
  if ($('#onatili-firebase-styles')) return;
  const style = document.createElement('style');
  style.id = 'onatili-firebase-styles';
  style.textContent = `
    /* Chap menyu ekrandan baland bo‘lsa, u barcha qurilmalarda mustaqil skroll qilinadi. */
    #sidebar.sidebar{height:100vh!important;height:100dvh!important;max-height:100vh!important;max-height:100dvh!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;box-sizing:border-box;padding-bottom:calc(22px + env(safe-area-inset-bottom))!important;scroll-padding-bottom:28px;scrollbar-width:thin;scrollbar-color:rgba(177,155,255,.55) transparent}
    #sidebar::-webkit-scrollbar{width:6px}#sidebar::-webkit-scrollbar-thumb{background:rgba(177,155,255,.55);border-radius:999px}
    #sidebar .nav,#sidebar .sidebar-bottom{flex:none!important}
    .firebase-banner{display:flex;align-items:center;gap:12px;margin:0 0 18px;padding:13px 16px;border:1px solid rgba(156,133,255,.42);background:linear-gradient(135deg,rgba(86,67,157,.28),rgba(23,33,65,.75));border-radius:16px;color:#e9e4ff}.firebase-banner b{color:#bbaaff}.firebase-banner button{margin-left:auto;border:0;background:transparent;color:#ded7ff;font-size:20px;cursor:pointer}
    .cloud-results-head,.community-hero,.admin-hero{padding:24px;border-radius:22px;background:linear-gradient(135deg,#30275d,#172348);border:1px solid rgba(180,160,255,.32);margin-bottom:18px}.cloud-results-head h2,.community-hero h2,.admin-hero h2{margin:6px 0;color:#fff}.cloud-results-head p,.community-hero p,.admin-hero p{color:#bec6df;margin:6px 0 0}.cloud-results-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
    .cloud-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}.cloud-kpi{padding:18px;border-radius:16px;background:#17203c;border:1px solid #2a3656}.cloud-kpi b{display:block;color:#fff;font-size:27px}.cloud-kpi span{color:#aeb9d5;font-size:13px}
    .cloud-record{display:flex;gap:14px;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid rgba(130,145,185,.2)}.cloud-record:last-child{border-bottom:0}.cloud-record h3{font-size:15px;margin:0 0 4px}.cloud-record p{margin:0;color:#9faccc;font-size:13px}.cloud-score{font-size:18px;font-weight:800;color:#cdbfff;white-space:nowrap}
    .community-grid,.admin-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.community-list,.admin-list{display:grid;gap:10px}.community-question{padding:16px;border-radius:16px;background:#18233f;border:1px solid #2b3b60}.community-question h3{font-size:16px;margin:0 0 12px}.community-options{display:grid;gap:8px}.community-option{padding:10px 12px;text-align:left;border-radius:10px;border:1px solid #34476f;background:#111a31;color:#d9e2f5;cursor:pointer}.community-option:hover{border-color:#a891ff}.community-option.correct{border-color:#43d39e;background:rgba(46,179,126,.18)}.community-option.wrong{border-color:#ff8793;background:rgba(207,61,83,.16)}.community-feedback{margin:10px 0 0;color:#b9c8eb;font-size:13px}
    .admin-nav-badge{margin-left:auto;background:#e9bc52;color:#202232;border-radius:7px;padding:2px 6px;font-size:10px;font-weight:800}.admin-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}.admin-card{padding:18px;border-radius:16px;background:#18233f;border:1px solid #2b3b60}.admin-card b{display:block;font-size:27px;color:#fff}.admin-card span{font-size:13px;color:#aeb9d5}.admin-form{display:grid;gap:11px}.admin-form label{display:grid;gap:6px;color:#b9c6e2;font-size:13px}.admin-form textarea{min-height:88px;resize:vertical}.admin-form .option-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.admin-row{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid rgba(130,145,185,.2)}.admin-row:last-child{border-bottom:0}.admin-row p{margin:4px 0 0;color:#9faccc;font-size:13px}.admin-delete{border:1px solid rgba(255,137,147,.55);background:transparent;color:#ffb3bb;border-radius:9px;padding:7px 10px;cursor:pointer;height:max-content}.admin-empty{padding:18px;color:#aeb9d5;text-align:center;border:1px dashed #40517a;border-radius:14px}
    .google-account-note{padding:12px;border-radius:12px;background:rgba(104,83,194,.17);color:#cfc9ff;font-size:13px;margin-top:13px}.auth-google-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#fff;color:#4285f4;font-weight:900;margin-right:8px}.google-account-actions{display:grid;gap:9px;margin-top:16px}.admin-password-status{min-height:20px;margin:0;font-size:13px;font-weight:700}.admin-password-status.error{color:#ff98a4}.admin-password-status.success{color:#72e5b4}
    @media(max-width:760px){.cloud-kpis,.admin-grid{grid-template-columns:1fr}.community-grid,.admin-layout{grid-template-columns:1fr}.admin-form .option-grid{grid-template-columns:1fr}.cloud-record{align-items:flex-start;flex-direction:column}.firebase-banner{align-items:flex-start}.firebase-banner button{margin-left:0}}
  `;
  document.head.append(style);
}

async function unlockAdminPanel(password) {
  if (!STATE.isAdmin || !STATE.user || !password) return { ok: false, message: 'Parolni kiriting.' };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/api/admin-unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.unlocked) {
      STATE.adminUnlocked = true;
      sessionStorage.setItem(ADMIN_UNLOCK_KEY, STATE.user.uid);
      return { ok: true, message: 'Parol to‘g‘ri. Panel ochilmoqda… ✓' };
    }
    if (response.status === 401) return { ok: false, message: 'Parol xato. Qayta urinib ko‘ring.' };
    return { ok: false, message: 'Tekshiruvda xatolik bo‘ldi. Qayta urinib ko‘ring.' };
  } catch (error) {
    return { ok: false, message: error?.name === 'AbortError' ? 'Tekshiruv vaqti tugadi. Internetni tekshirib qayta urinib ko‘ring.' : 'Internet bilan ulanib bo‘lmadi. Qayta urinib ko‘ring.' };
  } finally {
    window.clearTimeout(timeout);
  }
}

function showAdminPasswordForm() {
  if (!STATE.isAdmin) {
    notify('Bu bo‘lim faqat admin uchun.', true);
    return;
  }
  const modal = $('#authModal');
  if (!modal) return;
  openModal();
  modal.innerHTML = `<div class="modal-backdrop" id="firebaseCloseBackdrop"></div><div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="adminPasswordTitle"><button id="firebaseClose" class="modal-close" aria-label="Yopish">×</button><div class="brand modal-brand"><span class="brand-mark">O<span>✦</span></span><div><strong>OnaTili<span class="logo-ai">AI</span></strong><small>ADMIN HIMOYASI</small></div></div><h2 id="adminPasswordTitle">Admin panelni ochish</h2><p>Google akkauntingiz tasdiqlandi. Davom etish uchun admin parolini kiriting.</p><form class="google-account-actions" id="adminPasswordForm"><label class="google-account-note" for="adminPasswordInput">Admin paroli<input class="input" id="adminPasswordInput" name="password" type="password" inputmode="numeric" autocomplete="current-password" required></label><p id="adminPasswordError" class="admin-password-status" role="alert" aria-live="polite"></p><button class="btn primary wide" type="submit">Panelni ochish</button></form></div>`;
  $('#firebaseClose')?.addEventListener('click', closeModal);
  $('#firebaseCloseBackdrop')?.addEventListener('click', closeModal);
  $('#adminPasswordForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#adminPasswordInput');
    const button = $('button[type="submit"]', event.currentTarget);
    const error = $('#adminPasswordError');
    if (!input || !button) return;
    button.disabled = true;
    button.textContent = 'Tekshirilmoqda…';
    const result = await unlockAdminPanel(input.value);
    if (!result.ok) {
      if (error) {
        error.textContent = result.message;
        error.className = 'admin-password-status error';
      }
      input.value = '';
      input.focus();
      button.disabled = false;
      button.textContent = 'Panelni ochish';
      return;
    }
    if (error) {
      error.textContent = result.message;
      error.className = 'admin-password-status success';
    }
    button.textContent = 'Parol to‘g‘ri ✓';
    window.setTimeout(() => {
      closeModal();
      openAdminPage();
      notify('Admin panel ochildi. ✓');
    }, 450);
  });
}

function appModalMarkup() {
  const signedIn = Boolean(STATE.user);
  const name = escapeHtml(STATE.user?.displayName || 'o‘quvchi');
  return `<div class="modal-backdrop" id="firebaseCloseBackdrop"></div><div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="firebaseModalTitle"><button id="firebaseClose" class="modal-close" aria-label="Yopish">×</button><div class="brand modal-brand"><span class="brand-mark">O<span>✦</span></span><div><strong>OnaTili<span class="logo-ai">AI</span></strong><small>GOOGLE HISOBI</small></div></div>${signedIn ? `<h2 id="firebaseModalTitle">Xush kelibsiz, ${name}!</h2><p>Test va esse natijalaringiz shu Google hisobiga xavfsiz saqlanadi.</p><div class="google-account-actions"><button class="btn primary wide" id="firebaseOpenResults">Natijalarimni ko‘rish</button>${STATE.isAdmin ? '<button class="btn secondary wide" id="firebaseOpenAdmin">Admin panel</button>' : ''}<button class="btn ghost wide" id="firebaseSignOut">Hisobdan chiqish</button></div>` : `<h2 id="firebaseModalTitle">Google bilan kiring</h2><p>Natijalaringizni boshqa qurilmada ham davom ettirish uchun Google hisobingiz bilan kiring.</p><button class="btn primary wide" id="firebaseGoogleSignIn"><span class="auth-google-icon">G</span> Google bilan kirish</button><div class="google-account-note">Parolingiz saytga yozilmaydi. Faqat ism/avatar va o‘qish natijalarining qisqa ko‘rsatkichlari saqlanadi.</div>`}</div>`;
}

function closeModal() {
  const modal = $('#authModal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  // Upstream CSS can override the native hidden attribute, so force the panel closed.
  modal.style.setProperty('display', 'none', 'important');
}

function openModal() {
  const modal = $('#authModal');
  if (!modal) return;
  modal.style.removeProperty('display');
  modal.hidden = false;
  modal.removeAttribute('aria-hidden');
}

function refreshAccountUi() {
  const modal = $('#authModal');
  const button = $('#authBtn');
  const label = $('#userLabel');
  const avatar = $('#avatar');
  if (!modal || !button || !label || !avatar) return;
  modal.innerHTML = appModalMarkup();
  const displayName = STATE.user?.displayName || STATE.user?.email?.split('@')[0] || '';
  label.textContent = displayName || 'Google bilan kirish';
  avatar.textContent = (displayName || 'G').slice(0, 1).toUpperCase();
  button.onclick = () => openModal();
  $('#firebaseClose')?.addEventListener('click', closeModal);
  $('#firebaseCloseBackdrop')?.addEventListener('click', closeModal);
  $('#firebaseGoogleSignIn')?.addEventListener('click', () => void startGoogleLogin());
  $('#firebaseSignOut')?.addEventListener('click', () => void logout());
  $('#firebaseOpenResults')?.addEventListener('click', () => {
    closeModal();
    openResultsPage();
  });
  $('#firebaseOpenAdmin')?.addEventListener('click', () => {
    if (STATE.adminUnlocked) {
      closeModal();
      openAdminPage();
    } else showAdminPasswordForm();
  });
}

async function startGoogleLogin() {
  if (!STATE.auth) return;
  const trigger = $('#firebaseGoogleSignIn');
  if (trigger) {
    trigger.disabled = true;
    trigger.textContent = 'Google oynasi ochilmoqda…';
  }
  try {
    await setPersistence(STATE.auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(STATE.auth, provider);
  } catch (error) {
    const code = String(error?.code || '');
    if (code === 'auth/popup-blocked') {
      notify('Brauzer oynani to‘sdi. Google orqali yo‘naltirish bilan davom etiladi.');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithRedirect(STATE.auth, provider);
      return;
    }
    if (code !== 'auth/popup-closed-by-user') {
      notify('Google bilan kirib bo‘lmadi. Domen ruxsatini va internetni tekshiring.', true);
    }
  } finally {
    if (trigger) {
      trigger.disabled = false;
      trigger.innerHTML = '<span class="auth-google-icon">G</span> Google bilan kirish';
    }
  }
}

async function logout() {
  try {
    await signOut(STATE.auth);
    STATE.adminUnlocked = false;
    sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
    closeModal();
    notify('Google hisobidan chiqdingiz.');
    if (isCurrentResultsPage()) renderCloudResults();
  } catch {
    notify('Hisobdan chiqib bo‘lmadi.', true);
  }
}

function normalizeMockResult(result) {
  const summary = result?.summary || {};
  const categories = {};
  for (const question of result?.questions || []) {
    const category = String(question?.category || 'Boshqa');
    const item = categories[category] || { correct: 0, total: 0, points: 0, maxPoints: 0 };
    item.total += 1;
    item.correct += question?.correct ? 1 : 0;
    item.points += asNumber(question?.points);
    item.maxPoints += asNumber(question?.max_points);
    categories[category] = item;
  }
  const points = asNumber(summary.points);
  const maxPoints = asNumber(summary.max_points);
  return {
    type: 'mock',
    points,
    maxPoints,
    percentage: maxPoints ? Math.round((points / maxPoints) * 100) : asNumber(summary.percentage),
    objectiveCorrect: asNumber(summary.objective_correct),
    objectiveTotal: asNumber(summary.objective_total),
    answered: asNumber(summary.answered),
    totalQuestions: asNumber(summary.total_questions),
    categoryStats: categories,
    source: 'onatili-ai'
  };
}

function normalizeEssayResult(result) {
  return {
    type: 'essay',
    score: asNumber(result?.score),
    maxScore: 24,
    wordCount: asNumber(result?.word_count),
    source: 'onatili-ai'
  };
}

async function writeRecord(bucket, payload, quietly = false) {
  if (!STATE.user || !STATE.db) {
    queueRecord(bucket, payload);
    if (!quietly) notify('Natija bu qurilmada saqlandi. Google bilan kirgach, profilingizga o‘tadi.');
    return false;
  }
  try {
    await addDoc(collection(STATE.db, 'users', STATE.user.uid, bucket), {
      ...payload,
      createdAt: serverTimestamp()
    });
    if (!quietly) notify('Natija Google hisobingizga saqlandi. ✓');
    return true;
  } catch {
    queueRecord(bucket, payload);
    if (!quietly) notify('Natija vaqtincha qurilmada saqlandi. Google hisobiga keyin yuboriladi.', true);
    return false;
  }
}

async function flushPendingRecords() {
  if (!STATE.user || !STATE.db) return;
  const records = pendingRecords();
  if (!records.length) return;
  const failed = [];
  for (const record of records) {
    const saved = await writeRecord(record.bucket, record.payload, true);
    if (!saved) failed.push(record);
  }
  if (failed.length) putPending(failed);
  else clearPending();
}

async function touchProfile() {
  if (!STATE.user || !STATE.db) return;
  const profile = {
    displayName: STATE.user.displayName || 'O‘quvchi',
    photoURL: STATE.user.photoURL || '',
    provider: 'google',
    lastSeen: serverTimestamp()
  };
  try {
    await setDoc(doc(STATE.db, 'profiles', STATE.user.uid), profile, { merge: true });
  } catch {
    // User can continue using the site even if the profile update is retried later.
  }
}

function patchNetworkCapture() {
  if (window.__onatiliFirebaseFetchPatched) return;
  window.__onatiliFirebaseFetchPatched = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...argumentsList) => {
    const response = await nativeFetch(...argumentsList);
    const url = getRequestUrl(argumentsList[0]);
    if (response.ok && /\/api\/mocks\/[^/]+\/submit(?:\?|$)/.test(url)) {
      void response.clone().json().then((data) => {
        if (data?.result) return writeRecord('attempts', normalizeMockResult(data.result));
        return null;
      }).catch(() => {});
    }
    if (response.ok && /\/api\/essays\/analyze(?:\?|$)/.test(url)) {
      void response.clone().json().then((data) => {
        if (data && typeof data === 'object') return writeRecord('essays', normalizeEssayResult(data));
        return null;
      }).catch(() => {});
    }
    return response;
  };
}

function activateCustomPage(pageId, crumb) {
  $$('.page').forEach((page) => page.classList.toggle('active', page.id === pageId));
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.route === pageId.replace('page-', '')));
  const crumbNode = $('#pageCrumb');
  if (crumbNode) crumbNode.textContent = crumb;
  $('#sidebar')?.classList.remove('open');
  $('.mobile-shade')?.classList.remove('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openResultsPage() {
  const originalResultsLink = $('[data-route="results"]');
  originalResultsLink?.click();
  window.setTimeout(() => void renderCloudResults(), 80);
}

async function renderCloudResults() {
  const host = $('#resultsContent');
  if (!host) return;
  if (!STATE.user || !STATE.db) {
    host.innerHTML = `<div class="empty-state"><div class="empty-icon">G</div><h2>Natijalaringizni Google hisobingizga saqlang</h2><p>Google bilan kirsangiz, test va esse natijalari boshqa qurilmada ham yo‘qolmaydi.</p><button class="btn primary" id="cloudResultSignIn">Google bilan kirish</button></div>`;
    $('#cloudResultSignIn')?.addEventListener('click', openModal);
    return;
  }
  host.innerHTML = '<div class="panel"><p>Natijalaringiz yuklanmoqda…</p></div>';
  try {
    const [attemptsSnapshot, essaysSnapshot] = await Promise.all([
      getDocs(query(collection(STATE.db, 'users', STATE.user.uid, 'attempts'), limit(50))),
      getDocs(query(collection(STATE.db, 'users', STATE.user.uid, 'essays'), limit(50)))
    ]);
    const attempts = attemptsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .sort((left, right) => (right.createdAt?.seconds || 0) - (left.createdAt?.seconds || 0));
    const essays = essaysSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .sort((left, right) => (right.createdAt?.seconds || 0) - (left.createdAt?.seconds || 0));
    const average = attempts.length
      ? Math.round(attempts.reduce((sum, item) => sum + asNumber(item.percentage), 0) / attempts.length)
      : 0;
    const recent = attempts.slice(0, 8).map((item) => `<div class="cloud-record"><div><h3>${escapeHtml(item.type === 'mock' ? 'Mock test' : 'Mashq')}</h3><p>${dateText(item.createdAt)} · ${item.objectiveCorrect || 0}/${item.objectiveTotal || item.totalQuestions || 0} ta obyektiv javob to‘g‘ri</p></div><strong class="cloud-score">${item.points || 0}/${item.maxPoints || 0}</strong></div>`).join('') || '<p>Hozircha Google hisobingizda test natijasi yo‘q.</p>';
    const recentEssays = essays.slice(0, 6).map((item) => `<div class="cloud-record"><div><h3>Esse tahlili</h3><p>${dateText(item.createdAt)} · ${item.wordCount || 0} ta so‘z</p></div><strong class="cloud-score">${item.score || 0}/${item.maxScore || 24}</strong></div>`).join('') || '<p>Hozircha esse tahlili yo‘q.</p>';
    host.innerHTML = `<div class="cloud-results-head"><span class="eyebrow purple">GOOGLE HISOBINGIZDA</span><h2>Shaxsiy natijalar</h2><p>Bu ma’lumotlar faqat sizning Google hisobingizga bog‘langan.</p><div class="cloud-results-actions"><button class="btn secondary" id="cloudRefresh">Yangilash</button>${STATE.isAdmin ? '<button class="btn ghost" id="cloudGoAdmin">Admin panel</button>' : ''}</div></div><div class="cloud-kpis"><div class="cloud-kpi"><b>${attempts.length}</b><span>Ishlangan mocklar</span></div><div class="cloud-kpi"><b>${average}%</b><span>O‘rtacha natija</span></div><div class="cloud-kpi"><b>${essays.length}</b><span>Esse tahlillari</span></div></div><div class="dashboard-row"><div class="panel"><span class="eyebrow">TEST TARIXI</span><h2>So‘nggi natijalar</h2>${recent}</div><div class="panel"><span class="eyebrow">ESSE TARIXI</span><h2>Yozma ishlar</h2>${recentEssays}</div></div>`;
    $('#cloudRefresh')?.addEventListener('click', () => void renderCloudResults());
    $('#cloudGoAdmin')?.addEventListener('click', openAdminPage);
  } catch {
    host.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><h2>Natijalarni o‘qib bo‘lmadi</h2><p>Internetni tekshiring yoki birozdan keyin qayta urinib ko‘ring.</p><button class="btn primary" id="cloudRetry">Qayta urinish</button></div>`;
    $('#cloudRetry')?.addEventListener('click', () => void renderCloudResults());
  }
}

function ensureCommunityPage() {
  if ($('#page-community')) return;
  const nav = $('.nav');
  const main = $('.main');
  if (!nav || !main) return;
  nav.insertAdjacentHTML('beforeend', '<button data-route="community" id="communityNav" class="nav-item"><span class="nav-icon">✦</span>Yangi savollar<span class="nav-badge">YANGI</span></button>');
  main.insertAdjacentHTML('beforeend', '<section class="page" id="page-community"><div id="communityContent"></div></section>');
  $('#communityNav')?.addEventListener('click', (event) => {
    event.preventDefault();
    activateCustomPage('page-community', 'Yangi savollar');
    void renderCommunity();
  });
}

async function readPublishedContent() {
  const empty = { questions: [], topics: [], announcement: null };
  if (!STATE.db) return empty;
  try {
    const [questionsSnapshot, topicsSnapshot, announcementSnapshot] = await Promise.all([
      getDocs(query(collection(STATE.db, 'contentQuestions'), where('published', '==', true), limit(24))),
      getDocs(query(collection(STATE.db, 'contentEssayTopics'), where('published', '==', true), limit(16))),
      getDoc(doc(STATE.db, 'siteSettings', 'announcement'))
    ]);
    const questions = questionsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const topics = topicsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const announcement = announcementSnapshot.exists() ? announcementSnapshot.data() : null;
    return { questions, topics, announcement };
  } catch {
    return empty;
  }
}

async function renderCommunity() {
  const host = $('#communityContent');
  if (!host) return;
  host.innerHTML = '<div class="panel"><p>Yangi savollar yuklanmoqda…</p></div>';
  const { questions, topics, announcement } = await readPublishedContent();
  STATE.communityQuestions = questions;
  const banner = announcement?.active && announcement?.message
    ? `<div class="firebase-banner" id="communityAnnouncement"><span>✦</span><span><b>E’lon:</b> ${escapeHtml(announcement.message)}</span></div>`
    : '';
  const questionsMarkup = questions.length
    ? questions.map((item, index) => `<article class="community-question"><span class="eyebrow">${escapeHtml(item.category || 'Ona tili')} · ${index + 1}-savol</span><h3>${escapeHtml(item.question || '')}</h3><div class="community-options">${(item.options || []).map((option, optionIndex) => `<button class="community-option" data-community-question="${escapeHtml(item.id)}" data-community-option="${optionIndex}">${String.fromCharCode(65 + optionIndex)}. ${escapeHtml(option)}</button>`).join('')}</div><p class="community-feedback" id="communityFeedback-${escapeHtml(item.id)}"></p></article>`).join('')
    : '<div class="admin-empty">Yaqin kunlarda admin yangi ehtimoliy savollarni qo‘shadi.</div>';
  const topicsMarkup = topics.length
    ? topics.map((item) => `<div class="admin-row"><div><strong>${escapeHtml(item.title || 'Esse mavzusi')}</strong><p>${escapeHtml(item.prompt || '')}</p></div></div>`).join('')
    : '<p>Hozircha yangi esse mavzusi yo‘q.</p>';
  host.innerHTML = `${banner}<div class="community-hero"><span class="eyebrow purple">DOIM YANGILANADI</span><h2>Yangi ehtimoliy savollar</h2><p>Bu bo‘lim admin tomonidan qo‘shilgan mashq savollari va esse mavzularini ko‘rsatadi.</p></div><div class="community-grid"><div class="panel"><span class="eyebrow">MINI MASHQ</span><h2>Yangi savollar</h2><div class="community-list">${questionsMarkup}</div></div><div class="panel"><span class="eyebrow">ESSE MAVZULARI</span><h2>Yangi yozma topshiriqlar</h2>${topicsMarkup}</div></div>`;
  $$('[data-community-question]', host).forEach((button) => button.addEventListener('click', answerCommunityQuestion));
}

function answerCommunityQuestion(event) {
  const button = event.currentTarget;
  const question = STATE.communityQuestions.find((item) => item.id === button.dataset.communityQuestion);
  if (!question) return;
  const chosen = asNumber(button.dataset.communityOption, -1);
  const isCorrect = chosen === asNumber(question.correctIndex, -2);
  const card = button.closest('.community-question');
  $$('.community-option', card).forEach((option) => {
    option.disabled = true;
    const optionIndex = asNumber(option.dataset.communityOption, -1);
    if (optionIndex === asNumber(question.correctIndex, -2)) option.classList.add('correct');
    else if (optionIndex === chosen && !isCorrect) option.classList.add('wrong');
  });
  const feedback = $(`#communityFeedback-${CSS.escape(question.id)}`);
  if (feedback) feedback.textContent = `${isCorrect ? 'To‘g‘ri! ✅' : 'Bu safar xato. '} ${question.explanation || ''}`;
}

function ensureAdminPage() {
  if (!STATE.isAdmin || $('#page-admin')) return;
  const nav = $('.nav');
  const main = $('.main');
  if (!nav || !main) return;
  nav.insertAdjacentHTML('beforeend', '<button data-route="admin" id="adminNav" class="nav-item"><span class="nav-icon">⌘</span>Admin panel<span class="admin-nav-badge">ADMIN</span></button>');
  main.insertAdjacentHTML('beforeend', '<section class="page" id="page-admin"><div id="adminContent"></div></section>');
  $('#adminNav')?.addEventListener('click', (event) => {
    event.preventDefault();
    openAdminPage();
  });
}

function openAdminPage() {
  if (!STATE.isAdmin) {
    notify('Bu bo‘lim faqat admin uchun.', true);
    return;
  }
  if (!STATE.adminUnlocked) {
    showAdminPasswordForm();
    return;
  }
  ensureAdminPage();
  activateCustomPage('page-admin', 'Admin panel');
  void renderAdmin();
}

async function adminCounts() {
  const profiles = collection(STATE.db, 'profiles');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [users, active, questions, topics] = await Promise.all([
    getCountFromServer(profiles),
    getCountFromServer(query(profiles, where('lastSeen', '>=', since))),
    getCountFromServer(collection(STATE.db, 'contentQuestions')),
    getCountFromServer(collection(STATE.db, 'contentEssayTopics'))
  ]);
  return {
    users: users.data().count,
    active: active.data().count,
    questions: questions.data().count,
    topics: topics.data().count
  };
}

function adminFormsMarkup() {
  return `<div class="admin-layout"><div class="panel"><span class="eyebrow">YANGI TEST SAVOLI</span><h2>Savol qo‘shish</h2><form id="adminQuestionForm" class="admin-form"><label>Mavzu<input required class="input" name="category" placeholder="Masalan: Sintaksis" maxlength="80"></label><label>Savol<textarea required class="input" name="question" placeholder="Savol matni" maxlength="900"></textarea></label><div class="option-grid"><label>A javob<input required class="input" name="option0" maxlength="260"></label><label>B javob<input required class="input" name="option1" maxlength="260"></label><label>C javob<input required class="input" name="option2" maxlength="260"></label><label>D javob<input required class="input" name="option3" maxlength="260"></label></div><label>To‘g‘ri javob<select class="input" name="correctIndex"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></label><label>Izoh<textarea class="input" name="explanation" placeholder="Nega shu javob to‘g‘ri?" maxlength="700"></textarea></label><button class="btn primary" type="submit">Savolni nashr qilish</button></form></div><div class="panel"><span class="eyebrow">YANGI ESSE MAVZUSI</span><h2>Mavzu qo‘shish</h2><form id="adminEssayForm" class="admin-form"><label>Sarlavha<input required class="input" name="title" placeholder="Masalan: Imloviy savodxonlik" maxlength="130"></label><label>To‘liq topshiriq<textarea required class="input" name="prompt" placeholder="Ikki qarashni yozing…" maxlength="1200"></textarea></label><button class="btn primary" type="submit">Esse mavzusini nashr qilish</button></form><hr><span class="eyebrow">SAYT E’LONI</span><form id="adminAnnouncementForm" class="admin-form"><label>Yuqoridagi e’lon<input class="input" name="message" placeholder="Yangi mock testlar qo‘shildi" maxlength="220"></label><label><input type="checkbox" name="active"> E’lonni ko‘rsatish</label><button class="btn secondary" type="submit">E’lonni saqlash</button></form></div></div>`;
}

async function renderAdmin() {
  const host = $('#adminContent');
  if (!host) return;
  host.innerHTML = '<div class="panel"><p>Admin ma’lumotlari yuklanmoqda…</p></div>';
  try {
    const [counts, questionsSnapshot, topicsSnapshot, announcementSnapshot] = await Promise.all([
      adminCounts(),
      getDocs(query(collection(STATE.db, 'contentQuestions'), limit(12))),
      getDocs(query(collection(STATE.db, 'contentEssayTopics'), limit(12))),
      getDoc(doc(STATE.db, 'siteSettings', 'announcement'))
    ]);
    const questions = questionsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const topics = topicsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    const announcement = announcementSnapshot.exists() ? announcementSnapshot.data() : {};
    const questionList = questions.length ? questions.map((item) => `<div class="admin-row"><div><strong>${escapeHtml(item.category || 'Mavzu')} — ${escapeHtml(item.question || '')}</strong><p>${escapeHtml((item.options || [])[asNumber(item.correctIndex, 0)] || '')}</p></div><button class="admin-delete" data-admin-delete="question" data-admin-id="${escapeHtml(item.id)}">O‘chirish</button></div>`).join('') : '<div class="admin-empty">Hozircha admin savoli yo‘q.</div>';
    const topicList = topics.length ? topics.map((item) => `<div class="admin-row"><div><strong>${escapeHtml(item.title || 'Esse mavzusi')}</strong><p>${escapeHtml(item.prompt || '')}</p></div><button class="admin-delete" data-admin-delete="topic" data-admin-id="${escapeHtml(item.id)}">O‘chirish</button></div>`).join('') : '<div class="admin-empty">Hozircha esse mavzusi yo‘q.</div>';
    host.innerHTML = `<div class="admin-hero"><span class="eyebrow purple">XAVFSIZ BOSHQARUV</span><h2>OnaTili AI admin paneli</h2><p>Google bilan kirgan yagona foydalanuvchilar hisoblanadi. Faol foydalanuvchi — so‘nggi 24 soatda kirgan hisob.</p></div><div class="admin-grid"><div class="admin-card"><b>${counts.users}</b><span>Google bilan kirganlar</span></div><div class="admin-card"><b>${counts.active}</b><span>So‘nggi 24 soat faol</span></div><div class="admin-card"><b>${counts.questions + counts.topics}</b><span>Nashr qilingan materiallar</span></div></div>${adminFormsMarkup()}<div class="admin-layout"><div class="panel"><span class="eyebrow">SO‘NGGI SAVOLLAR</span><h2>Savollar banki</h2><div class="admin-list">${questionList}</div></div><div class="panel"><span class="eyebrow">ESSE BANKI</span><h2>Esse mavzulari</h2><div class="admin-list">${topicList}</div></div></div>`;
    const announcementForm = $('#adminAnnouncementForm');
    if (announcementForm) {
      announcementForm.message.value = announcement.message || '';
      announcementForm.active.checked = Boolean(announcement.active);
    }
    bindAdminForms();
  } catch {
    host.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><h2>Admin ma’lumotlarini o‘qib bo‘lmadi</h2><p>Xavfsizlik ruxsati yoki internetni tekshiring.</p><button class="btn primary" id="adminRetry">Qayta urinish</button></div>';
    $('#adminRetry')?.addEventListener('click', () => void renderAdmin());
  }
}

function formValue(form, name) {
  return String(new FormData(form).get(name) || '').trim();
}

function bindAdminForms() {
  $('#adminQuestionForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    try {
      await addDoc(collection(STATE.db, 'contentQuestions'), {
        category: formValue(form, 'category'),
        question: formValue(form, 'question'),
        options: [0, 1, 2, 3].map((index) => formValue(form, `option${index}`)),
        correctIndex: asNumber(formValue(form, 'correctIndex')),
        explanation: formValue(form, 'explanation'),
        published: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: STATE.user.uid
      });
      notify('Yangi savol nashr qilindi. ✓');
      void renderAdmin();
    } catch {
      notify('Savolni saqlab bo‘lmadi.', true);
    } finally {
      button.disabled = false;
    }
  });
  $('#adminEssayForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    try {
      await addDoc(collection(STATE.db, 'contentEssayTopics'), {
        title: formValue(form, 'title'),
        prompt: formValue(form, 'prompt'),
        published: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: STATE.user.uid
      });
      notify('Yangi esse mavzusi nashr qilindi. ✓');
      void renderAdmin();
    } catch {
      notify('Esse mavzusini saqlab bo‘lmadi.', true);
    } finally {
      button.disabled = false;
    }
  });
  $('#adminAnnouncementForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await setDoc(doc(STATE.db, 'siteSettings', 'announcement'), {
        message: formValue(form, 'message'),
        active: Boolean(new FormData(form).get('active')),
        updatedAt: serverTimestamp(),
        updatedBy: STATE.user.uid
      }, { merge: true });
      notify('E’lon saqlandi. ✓');
    } catch {
      notify('E’lonni saqlab bo‘lmadi.', true);
    }
  });
  $$('[data-admin-delete]').forEach((button) => button.addEventListener('click', async () => {
    const kind = button.dataset.adminDelete;
    const id = button.dataset.adminId;
    const name = kind === 'question' ? 'savolni' : 'esse mavzusini';
    if (!window.confirm(`Bu ${name} o‘chiriladi. Davom etasizmi?`)) return;
    try {
      await deleteDoc(doc(STATE.db, kind === 'question' ? 'contentQuestions' : 'contentEssayTopics', id));
      notify('Material o‘chirildi.');
      void renderAdmin();
    } catch {
      notify('Materialni o‘chirib bo‘lmadi.', true);
    }
  }));
}

async function placeAnnouncementBanner() {
  if (!STATE.db || $('#firebaseAnnouncementBanner')) return;
  try {
    const announcement = await getDoc(doc(STATE.db, 'siteSettings', 'announcement'));
    const data = announcement.exists() ? announcement.data() : null;
    if (!data?.active || !data?.message) return;
    const workspace = $('.workspace');
    const topbar = $('.topbar');
    if (!workspace || !topbar) return;
    const banner = document.createElement('div');
    banner.id = 'firebaseAnnouncementBanner';
    banner.className = 'firebase-banner';
    banner.innerHTML = '<span>✦</span><span></span><button aria-label="E’lonni yopish">×</button>';
    $('span:nth-child(2)', banner).textContent = data.message;
    $('button', banner).addEventListener('click', () => banner.remove());
    topbar.insertAdjacentElement('afterend', banner);
  } catch {
    // Announcements are optional and should never stop the learning flow.
  }
}

function bindResultsRoute() {
  $$('[data-route="results"]').forEach((link) => {
    if (link.dataset.firebaseResultsBound) return;
    link.dataset.firebaseResultsBound = 'true';
    link.addEventListener('click', () => window.setTimeout(() => void renderCloudResults(), 100));
  });
}

async function begin() {
  injectStyles();
  ensureCommunityPage();
  bindResultsRoute();
  let settings;
  try {
    const response = await fetch('/api/firebase-config', { cache: 'no-store' });
    settings = await response.json();
  } catch {
    return;
  }
  if (!settings?.configured || !settings?.firebaseConfig) return;
  try {
    const app = initializeApp(settings.firebaseConfig);
    STATE.auth = getAuth(app);
    STATE.db = getFirestore(app);
    patchNetworkCapture();
    refreshAccountUi();
    onAuthStateChanged(STATE.auth, async (user) => {
      STATE.user = user || null;
      await updateAdminStatus();
      await touchProfile();
      await flushPendingRecords();
      refreshAccountUi();
      ensureAdminPage();
      void placeAnnouncementBanner();
      if (isCurrentResultsPage()) void renderCloudResults();
    });
    STATE.contentReady = true;
    void placeAnnouncementBanner();
  } catch {
    // The original site remains usable if Firebase cannot be initialized.
  }
}

void begin();
