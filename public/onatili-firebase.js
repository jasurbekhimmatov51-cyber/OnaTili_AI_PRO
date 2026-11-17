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
  orderBy,
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
let authRevision = 0, pendingFlush = false, modalReturnFocus = null;
async function authHeaders() {
  if (!STATE.user) { openModal(); throw new Error('Ovoz va shaxsiy xizmatlar uchun Google bilan kiring.'); }
  return { authorization: 'Bearer ' + await STATE.user.getIdToken() };
}
async function secureFetch(url, options = {}) {
  return fetch(url, { ...options, headers: { ...options.headers, ...await authHeaders() }, signal: options.signal || AbortSignal.timeout(45000) });
}
async function adminMutation(action, data) {
  const response = await secureFetch('/api/admin-content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...data }) });
  const value = await response.json();
  if (!response.ok) { if(response.status===403){STATE.adminUnlocked=false;showAdminPasswordForm();} throw new Error(value.error || 'Saqlash bajarilmadi.'); }
  return value;
}
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
    return Array.isArray(records) ? records.filter(r => ['attempts','essays'].includes(r.bucket) && r.payload).map((r,index) => ({ ...r, id: r.id || 'legacy_' + (r.queuedAt || 0) + '_' + index, owner: r.owner || null })) : [];
  } catch { return []; }
}
function putPending(records) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(records.slice(-100))); } catch {}
}
function queueRecord(record) {
  const records = pendingRecords();
  if (!records.some(r => r.id === record.id && r.bucket === record.bucket && r.owner === record.owner)) records.push(record);
  putPending(records);
}
function forgetRecord(record) {
  putPending(pendingRecords().filter(r => !(r.id === record.id && r.bucket === record.bucket && r.owner === record.owner)));
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
  STATE.isAdmin = false; STATE.adminUnlocked = false;
  const uid = STATE.user?.uid;
  if (!uid) return;
  try {
    const response = await secureFetch('/api/admin-unlock');
    const data = await response.json();
    if (STATE.user?.uid !== uid) return;
    STATE.isAdmin = response.ok && data.isAdmin === true;
    STATE.adminUnlocked = STATE.isAdmin && data.unlocked === true;
  } catch {}
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
    [hidden]{display:none!important}.voice-actions{display:flex;gap:6px;flex-wrap:wrap}.auth-modal{max-height:calc(100dvh - 32px);overflow-y:auto}.modal-close{min-width:44px;min-height:44px}.modal-backdrop{touch-action:none}
    .firebase-banner{display:flex;align-items:center;gap:12px;margin:0 0 18px;padding:13px 16px;border:1px solid rgba(156,133,255,.42);background:linear-gradient(135deg,rgba(86,67,157,.28),rgba(23,33,65,.75));border-radius:16px;color:#e9e4ff}.firebase-banner b{color:#bbaaff}.firebase-banner button{margin-left:auto;border:0;background:transparent;color:#ded7ff;font-size:20px;cursor:pointer}
    .cloud-results-head,.community-hero,.admin-hero{padding:24px;border-radius:22px;background:linear-gradient(135deg,#30275d,#172348);border:1px solid rgba(180,160,255,.32);margin-bottom:18px}.cloud-results-head h2,.community-hero h2,.admin-hero h2{margin:6px 0;color:#fff}.cloud-results-head p,.community-hero p,.admin-hero p{color:#bec6df;margin:6px 0 0}.cloud-results-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
    .cloud-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}.cloud-kpi{padding:18px;border-radius:16px;background:#17203c;border:1px solid #2a3656}.cloud-kpi b{display:block;color:#fff;font-size:27px}.cloud-kpi span{color:#aeb9d5;font-size:13px}
    .cloud-record{display:flex;gap:14px;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid rgba(130,145,185,.2)}.cloud-record:last-child{border-bottom:0}.cloud-record h3{font-size:15px;margin:0 0 4px}.cloud-record p{margin:0;color:#9faccc;font-size:13px}.cloud-score{font-size:18px;font-weight:800;color:#cdbfff;white-space:nowrap}
    .community-grid,.admin-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.community-list,.admin-list{display:grid;gap:10px}.community-question{padding:16px;border-radius:16px;background:#18233f;border:1px solid #2b3b60}.community-question h3{font-size:16px;margin:0 0 12px}.community-options{display:grid;gap:8px}.community-option{padding:10px 12px;text-align:left;border-radius:10px;border:1px solid #34476f;background:#111a31;color:#d9e2f5;cursor:pointer}.community-option:hover{border-color:#a891ff}.community-option.correct{border-color:#43d39e;background:rgba(46,179,126,.18)}.community-option.wrong{border-color:#ff8793;background:rgba(207,61,83,.16)}.community-feedback{margin:10px 0 0;color:#b9c8eb;font-size:13px}
    .admin-nav-badge{margin-left:auto;background:#e9bc52;color:#202232;border-radius:7px;padding:2px 6px;font-size:10px;font-weight:800}.admin-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}.admin-card{padding:18px;border-radius:16px;background:#18233f;border:1px solid #2b3b60}.admin-card b{display:block;font-size:27px;color:#fff}.admin-card span{font-size:13px;color:#aeb9d5}.admin-form{display:grid;gap:11px}.admin-form label{display:grid;gap:6px;color:#b9c6e2;font-size:13px}.admin-form textarea{min-height:88px;resize:vertical}.admin-form .option-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.admin-row{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid rgba(130,145,185,.2)}.admin-row:last-child{border-bottom:0}.admin-row p{margin:4px 0 0;color:#9faccc;font-size:13px}.admin-delete{border:1px solid rgba(255,137,147,.55);background:transparent;color:#ffb3bb;border-radius:9px;padding:7px 10px;cursor:pointer;height:max-content}.admin-empty{padding:18px;color:#aeb9d5;text-align:center;border:1px dashed #40517a;border-radius:14px}
    .google-account-note{padding:12px;border-radius:12px;background:rgba(104,83,194,.17);color:#cfc9ff;font-size:13px;margin-top:13px}.auth-google-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#fff;color:#4285f4;font-weight:900;margin-right:8px}.google-account-actions{display:grid;gap:9px;margin-top:16px}.admin-password-status{min-height:20px;margin:0;font-size:13px;font-weight:700}.admin-password-status.error{color:#ff98a4}.admin-password-status.success{color:#72e5b4}
    .elevenlabs-play{display:inline-flex;align-items:center;gap:7px;margin:12px 0 0;padding:7px 10px;border:1px solid rgba(177,155,255,.72);border-radius:10px;background:rgba(94,72,170,.24);color:#eeeaff;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.elevenlabs-play:hover{background:rgba(131,101,224,.37)}.elevenlabs-play:disabled{opacity:.65;cursor:wait}.elevenlabs-play:focus-visible{outline:2px solid #b8a6ff;outline-offset:2px}.elevenlabs-picker{margin-top:18px}.elevenlabs-picker h3{margin:7px 0 4px;color:#fff}.elevenlabs-picker p{margin:0 0 13px;color:#aeb9d5;font-size:13px;line-height:1.5}.voice-preview-list{display:grid;gap:9px}.voice-preview-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:11px 12px;border:1px solid rgba(132,151,199,.22);border-radius:13px;background:rgba(12,21,42,.48)}.voice-preview-row strong{display:block;color:#f4f1ff;font-size:14px}.voice-preview-row small{display:block;margin-top:3px;color:#aeb9d5;font-size:12px}.voice-preview-button{border:1px solid rgba(177,155,255,.72);border-radius:9px;background:rgba(94,72,170,.27);color:#f3efff;padding:7px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}.voice-preview-button:hover,.voice-preview-button.selected{background:rgba(131,101,224,.48);border-color:#c1b1ff}.voice-preview-button:disabled{opacity:.68;cursor:wait}.voice-choice-badge{display:inline-block;margin-left:6px;padding:2px 5px;border-radius:5px;background:#4b3a9a;color:#e9e2ff;font-size:9px;font-weight:800;letter-spacing:.06em}@media(max-width:420px){.voice-preview-row{grid-template-columns:1fr}.voice-preview-button{width:100%}}
    @media(max-width:760px){.cloud-kpis,.admin-grid{grid-template-columns:1fr}.community-grid,.admin-layout{grid-template-columns:1fr}.admin-form .option-grid{grid-template-columns:1fr}.cloud-record{align-items:flex-start;flex-direction:column}.firebase-banner{align-items:flex-start}.firebase-banner button{margin-left:0}}
  `;
  document.head.append(style);
}

async function unlockAdminPanel(password) {
  if (!STATE.isAdmin || !STATE.user || !password) return { ok: false, message: 'Parolni kiriting.' };
  const uid = STATE.user.uid;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await secureFetch('/api/admin-unlock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (STATE.user?.uid !== uid) return { ok: false, message: 'Hisob almashdi. Qayta kiring.' };
    if (response.ok && data?.unlocked) {
      STATE.adminUnlocked = true;

      return { ok: true, message: 'Parol to‘g‘ri. Panel ochilmoqda… ✓' };
    }
    if (data.error) return { ok: false, message: data.error };
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
  modal.innerHTML = `<div class="modal-backdrop" id="firebaseCloseBackdrop"></div><div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="adminPasswordTitle"><button id="firebaseClose" class="modal-close" aria-label="Yopish">×</button><div class="brand modal-brand"><span class="brand-mark">O<span>✦</span></span><div><strong>OnaTili<span class="logo-ai">AI</span></strong><small>ADMIN HIMOYASI</small></div></div><h2 id="adminPasswordTitle">Admin panelni ochish</h2><p>Google akkauntingiz tasdiqlandi. Davom etish uchun admin parolini kiriting.</p><form class="google-account-actions" id="adminPasswordForm"><label class="google-account-note" for="adminPasswordInput">Admin paroli<input class="input" id="adminPasswordInput" name="password" type="password" autocomplete="current-password" maxlength="128" required></label><p id="adminPasswordError" class="admin-password-status" role="alert" aria-live="polite"></p><button class="btn primary wide" type="submit">Panelni ochish</button></form></div>`;
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
      if (!modal.hidden) input.focus();
      button.disabled = false;
      button.textContent = 'Panelni ochish';
      return;
    }
    if (error) {
      error.textContent = result.message;
      error.className = 'admin-password-status success';
    }
    button.textContent = 'Parol to‘g‘ri ✓';
    const wasOpen = !modal.hidden;
    closeModal();
    if (wasOpen) openAdminPage();
    notify('Parol to‘g‘ri. Admin panel ochildi. ✓');
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
  if (modalReturnFocus?.isConnected && !modal.contains(modalReturnFocus)) modalReturnFocus.focus();
}

function openModal() {
  const modal = $('#authModal');
  if (!modal) return;
  modalReturnFocus = document.activeElement;
  modal.style.removeProperty('display');
  modal.hidden = false;
  modal.removeAttribute('aria-hidden');
  requestAnimationFrame(() => modal.querySelector('input,button,a')?.focus());
}

function refreshAccountUi() {
  const modal = $('#authModal');
  const button = $('#authBtn');
  const label = $('#userLabel');
  const avatar = $('#avatar');
  if (!modal || !button || !label || !avatar) return;
  if ($('#adminPasswordForm') && !modal.hidden) return;
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
    await fetch('/api/admin-unlock', { method: 'DELETE', signal: AbortSignal.timeout(8000) }).catch(() => {});
    stopTutorVoice();
    await signOut(STATE.auth);
    STATE.adminUnlocked = false;
    try { sessionStorage.removeItem(ADMIN_UNLOCK_KEY); } catch {}
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
    objectiveWrong: asNumber(summary.objective_wrong),
    objectiveSkipped: asNumber(summary.objective_skipped),
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

async function saveQueuedRecord(record) {
  const uid = STATE.user?.uid;
  if (!uid || !STATE.db || (record.owner && record.owner !== uid)) return false;
  try {
    const reference = doc(STATE.db, 'users', uid, record.bucket, record.id);
    const existing = await getDoc(reference);
    if (STATE.user?.uid !== uid) return false;
    if (!existing.exists()) await setDoc(reference, { ...record.payload, createdAt: serverTimestamp() });
    forgetRecord(record);
    return true;
  } catch { return false; }
}
async function writeRecord(bucket, payload, owner, id) {
  const record = { id: id || crypto.randomUUID(), bucket, payload, owner: owner || null, queuedAt: Date.now() };
  queueRecord(record);
  if (owner && STATE.user?.uid === owner && await saveQueuedRecord(record)) {
    notify('Natija Google hisobingizga saqlandi. ✓'); return true;
  }
  notify(owner ? 'Natija qurilmada saqlandi. Shu hisob bilan qayta kirganda yuboriladi.' : 'Natija bu qurilmada saqlandi. Uni “Natijalarim” bo‘limida ko‘rasiz.');
  return false;
}
async function flushPendingRecords(includeGuest = false) {
  const uid = STATE.user?.uid;
  if (!uid || !STATE.db || pendingFlush) return;
  pendingFlush = true;
  try {
    for (const record of pendingRecords()) {
      if (STATE.user?.uid !== uid) break;
      if (record.owner === uid || (includeGuest && !record.owner)) await saveQueuedRecord(record);
    }
  } finally { pendingFlush = false; }
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
    const owner = STATE.user?.uid || null;
    const response = await nativeFetch(...argumentsList);
    const url = getRequestUrl(argumentsList[0]);
    if (response.ok && /\/api\/mocks\/[^/]+\/submit(?:\?|$)/.test(url)) {
      void response.clone().json().then((data) => {
        if (data?.result) return writeRecord('attempts', normalizeMockResult(data.result), owner, 'mock_' + url.match(/\/mocks\/([^/]+)\/submit/)?.[1]);
        return null;
      }).catch(() => {});
    }
    if (response.ok && /\/api\/essays\/analyze(?:\?|$)/.test(url)) {
      void response.clone().json().then((data) => {
        if (data && typeof data === 'object') return writeRecord('essays', normalizeEssayResult(data), owner, data.id ? 'essay_' + data.id : undefined);
        return null;
      }).catch(() => {});
    }
    return response;
  };
}


const TUTOR_TTS = {
  context: null,
  source: null,
  controller: null,
  requestId: 0,
  armed: false,
  armedUntil: 0,
  observer: null,
  resolvePlayback: null,
  activeButton: null,
  cache: new Map()
};
let selectedVoice = 'george';
try { selectedVoice = localStorage.getItem('onatili_voice_v1') || 'george'; } catch {}

function setTutorVoiceStatus(message) {
  const status = $('#voiceSupport');
  if (status) status.textContent = message;
}

function tutorVoiceText(value) {
  return String(value || '')
    .replace(/ONA\s*TILI\s*AI/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTutorVoiceText(value, maximum = 820) {
  let remaining = tutorVoiceText(value);
  const chunks = [];
  while (remaining) {
    if (remaining.length <= maximum) {
      chunks.push(remaining);
      break;
    }
    let cut = Math.max(
      remaining.lastIndexOf('. ', maximum),
      remaining.lastIndexOf('? ', maximum),
      remaining.lastIndexOf('! ', maximum),
      remaining.lastIndexOf('; ', maximum),
      remaining.lastIndexOf(', ', maximum)
    );
    if (cut < Math.floor(maximum * 0.45)) cut = remaining.lastIndexOf(' ', maximum);
    if (cut < 1) cut = maximum;
    else cut += 1;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  return chunks.filter(Boolean);
}

function getTutorAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!TUTOR_TTS.context) TUTOR_TTS.context = new AudioContextClass();
  return TUTOR_TTS.context;
}

async function unlockTutorVoice() {
  const context = getTutorAudioContext();
  if (context?.state === 'suspended') await context.resume();
  return context;
}

function stopTutorVoice() {
  TUTOR_TTS.requestId += 1;
  TUTOR_TTS.controller?.abort();
  TUTOR_TTS.controller = null;
  if (TUTOR_TTS.source) {
    try {
      TUTOR_TTS.source.onended = null;
      TUTOR_TTS.source.stop(0);
    } catch {
      // The source may have ended already.
    }
  }
  TUTOR_TTS.source = null;
  TUTOR_TTS.resolvePlayback?.();
  TUTOR_TTS.resolvePlayback = null;
}

async function requestTutorAudio(text, signal) {
  const key = selectedVoice + ':' + text;
  if (TUTOR_TTS.cache.has(key)) return TUTOR_TTS.cache.get(key).slice(0);
  const response = await secureFetch('/api/elevenlabs-tts', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, voice: selectedVoice }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(45000)])
  });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Ovoz tayyorlab bo‘lmadi.'); }
  const buffer = await response.arrayBuffer();
  if (TUTOR_TTS.cache.size >= 12) TUTOR_TTS.cache.delete(TUTOR_TTS.cache.keys().next().value);
  TUTOR_TTS.cache.set(key, buffer);
  return buffer.slice(0);
}

async function playTutorAudio(buffer, requestId) {
  const context = await unlockTutorVoice();
  if (!context) throw new Error('Bu brauzerda audio ijrosi qo‘llanmaydi.');
  const decoded = await context.decodeAudioData(buffer.slice(0));
  if (requestId !== TUTOR_TTS.requestId) return;
  await new Promise((resolve) => {
    TUTOR_TTS.resolvePlayback = resolve;
    const source = context.createBufferSource();
    source.buffer = decoded;
    source.connect(context.destination);
    source.onended = () => {
      if (TUTOR_TTS.source === source) TUTOR_TTS.source = null;
      TUTOR_TTS.resolvePlayback = null;
      source.disconnect();
      resolve();
    };
    TUTOR_TTS.source = source;
    source.start(0);
  });
}

async function speakTutorWithElevenLabs(value, button = null) {
  const text = tutorVoiceText(value);
  if (!text) return;
  stopTutorVoice();
  const requestId = TUTOR_TTS.requestId;
  const chunks = splitTutorVoiceText(text);
  if (button) {
    TUTOR_TTS.activeButton = button;
    button.textContent = '■ To‘xtatish';
    button.setAttribute('aria-label','Ovozni to‘xtatish');
  }
  try {
    await unlockTutorVoice();
    for (let index = 0; index < chunks.length; index += 1) {
      if (requestId !== TUTOR_TTS.requestId) return;
      const controller = new AbortController();
      TUTOR_TTS.controller = controller;
      setTutorVoiceStatus('Ovoz tayyorlanmoqda… (' + (index + 1) + '/' + chunks.length + ')');
      const audio = await requestTutorAudio(chunks[index], controller.signal);
      if (requestId !== TUTOR_TTS.requestId) return;
      setTutorVoiceStatus('🔊 Ovoz eshittirilmoqda…');
      await playTutorAudio(audio, requestId);
    }
    if (requestId === TUTOR_TTS.requestId) {
      setTutorVoiceStatus('🔊 ElevenLabs o‘zbekcha ovozi tayyor');
    }
  } catch (error) {
    if (requestId === TUTOR_TTS.requestId && error?.name !== 'AbortError') {
      setTutorVoiceStatus('🔊 Ovoz vaqtincha tayyor bo‘lmadi');
      notify(error?.message || 'Ovoz tayyorlab bo‘lmadi.', true);
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '🔊 Eshitish';
      button.setAttribute('aria-label','Javobni eshitish');
      if (TUTOR_TTS.activeButton === button) TUTOR_TTS.activeButton = null;
    }
  }
}

function tutorBubbleText(bubble) {
  const copy = bubble.cloneNode(true);
  Array.from(copy.querySelectorAll('.bubble-name, .elevenlabs-play')).forEach((node) => node.remove());
  return tutorVoiceText(copy.textContent);
}

function attachTutorVoiceButton(bubble) {
  if (!bubble || bubble.dataset.elevenlabsReady === 'true') return;
  const text = tutorBubbleText(bubble);
  if (!text || /^Javob tayyorlanmoqda/i.test(text)) return;
  bubble.dataset.elevenlabsReady = 'true';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'elevenlabs-play';
  button.textContent = '🔊 Eshitish';
  button.setAttribute('aria-label', 'Ona Tili AI javobini ElevenLabs ovozida eshitish');
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (TUTOR_TTS.activeButton === button) { stopTutorVoice(); setTutorVoiceStatus('Ovoz to‘xtatildi'); return; }
    void unlockTutorVoice().catch(() => {});
    void speakTutorWithElevenLabs(tutorBubbleText(bubble), button);
  });
  bubble.append(button);
  return { text, button };
}

function armTutorVoice() {
  TUTOR_TTS.armed = true;
  TUTOR_TTS.armedUntil = Date.now() + 45000;
  void unlockTutorVoice().catch(() => {});
}

function muteBrowserTutorSpeech() {
  window.speechSynthesis?.cancel();
}

function setupElevenLabsVoice() {
  if (window.__onatiliElevenLabsReady) return;
  const messages = $('#chatMessages');
  if (!messages) {
    window.setTimeout(setupElevenLabsVoice, 120);
    return;
  }
  window.__onatiliElevenLabsReady = true;
  muteBrowserTutorSpeech();
  Array.from(messages.querySelectorAll('.chat-bubble.tutor')).forEach((bubble) => attachTutorVoiceButton(bubble));
  TUTOR_TTS.observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element) || !node.matches('.chat-bubble.tutor')) continue;
        const prepared = attachTutorVoiceButton(node);
        if (!prepared || !TUTOR_TTS.armed || Date.now() > TUTOR_TTS.armedUntil) continue;
        if (!$('#readAloud')?.checked) continue;
        if (!STATE.user) { setTutorVoiceStatus('Ovozni eshitish uchun Google bilan kiring.'); continue; }
        TUTOR_TTS.armed = false;
        void speakTutorWithElevenLabs(prepared.text, prepared.button);
      }
    }
  });
  TUTOR_TTS.observer.observe(messages, { childList: true });
  document.addEventListener('click', (event) => {
    if (event.target.closest('#sendChat, #quickQuiz, #quickExample, .prompt-btn, #voiceBtn')) armTutorVoice();
  }, true);
  $('#chatInput')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) armTutorVoice();
  }, true);
  $('#readAloud')?.addEventListener('change', (event) => {
    if (!event.currentTarget.checked) {
      stopTutorVoice();
      setTutorVoiceStatus('🔇 Ovoz o‘chirildi');
    } else {
      setTutorVoiceStatus('🔊 ElevenLabs o‘zbekcha ovozi yoqildi');
    }
  });
  const note = $('#aiNote');
  if (note) note.textContent = 'AI Ustoz javoblari ElevenLabs o‘zbekcha ovozi bilan eshittiriladi. “Eshitish” tugmasi bilan istalgan javobni qayta tinglang.';
  setTutorVoiceStatus('🔊 ElevenLabs o‘zbekcha ovozi tayyor');
  ensureTutorVoicePicker();
}

let TUTOR_VOICE_PREVIEWS = [];

async function previewTutorVoice(slug, button) {
  stopTutorVoice();
  const requestId = TUTOR_TTS.requestId;
  const originalText = button.textContent;
  const controller = new AbortController();
  TUTOR_TTS.controller = controller;
  button.disabled = true;
  button.textContent = 'Tayyorlanmoqda…';
  try {
    await unlockTutorVoice();
    setTutorVoiceStatus('🔊 ' + (button.dataset.voiceName || 'Ovoz') + ' namunasi eshittirilmoqda…');
    const response = await secureFetch('/api/elevenlabs-voice-preview?voice=' + encodeURIComponent(slug), {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]),
      headers: { accept: 'audio/mpeg' }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || 'Ovoz namunasi tayyor bo‘lmadi.');
    }
    const audio = await response.arrayBuffer();
    if (requestId !== TUTOR_TTS.requestId) return;
    await playTutorAudio(audio, requestId);
    if (requestId === TUTOR_TTS.requestId) {
      setTutorVoiceStatus('🔊 ' + (button.dataset.voiceName || 'Tanlangan ovoz') + ' namunasi tinglandi');
      Array.from(document.querySelectorAll('.voice-preview-button')).forEach((node) => node.classList.toggle('selected', node === button));
    }
  } catch (error) {
    if (requestId === TUTOR_TTS.requestId && error?.name !== 'AbortError') {
      setTutorVoiceStatus('🔊 Namuna vaqtincha tayyor bo‘lmadi');
      notify(error?.message || 'Ovoz namunasi tayyor bo‘lmadi.', true);
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderTutorVoiceOptions(voices) {
  const list = $('#elevenLabsVoicePicker .voice-preview-list');
  if (!list) return;
  if (!voices.length) {
    list.innerHTML = '<p>Hozircha tinglash uchun ochiq ovoz topilmadi. ElevenLabs hisobidagi ovozlarni tekshirib qayta urinib ko‘ring.</p>';
    return;
  }
  list.innerHTML = '';
  for (const voice of voices) {
    const row = document.createElement('div');
    row.className = 'voice-preview-row';
    const info = document.createElement('div');
    info.innerHTML = '<strong>' + escapeHtml(voice.name) + (voice.recommended ? '<span class="voice-choice-badge">TAVSIYA</span>' : '') + '</strong><small>' + escapeHtml(voice.detail) + '</small>';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'voice-preview-button';
    button.dataset.voicePreview = voice.slug;
    button.dataset.voiceName = voice.name;
    button.textContent = '🔊 Eshitish';
    button.addEventListener('click', () => {
      void unlockTutorVoice().catch(() => {});
      void previewTutorVoice(voice.slug, button);
    });
    const choose = document.createElement('button');
    choose.type = 'button'; choose.className = 'voice-preview-button';
    choose.textContent = selectedVoice === voice.slug ? '✓ Tanlangan' : 'Tanlash';
    choose.addEventListener('click', () => {
      stopTutorVoice(); selectedVoice = voice.slug;
      try { localStorage.setItem('onatili_voice_v1', selectedVoice); } catch {}
      renderTutorVoiceOptions(TUTOR_VOICE_PREVIEWS);
      notify(voice.name + ' ovozi tanlandi.');
    });
    const actions = document.createElement('div'); actions.className = 'voice-actions'; actions.append(button, choose);
    row.append(info, actions);
    list.append(row);
  }
}

async function loadTutorVoiceOptions() {
  const list = $('#elevenLabsVoicePicker .voice-preview-list');
  if (!list) return;
  list.innerHTML = '<p>Ochiq ovozlar tekshirilmoqda…</p>';
  try {
    const response = await fetch('/api/elevenlabs-voice-preview?list=1', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Ovozlar ro‘yxatini olib bo‘lmadi.');
    TUTOR_VOICE_PREVIEWS = Array.isArray(data?.voices) ? data.voices : [];
    renderTutorVoiceOptions(TUTOR_VOICE_PREVIEWS);
  } catch (error) {
    list.innerHTML = '<p>Ovozlar ro‘yxati vaqtincha yuklanmadi. Sahifani yangilab qayta urinib ko‘ring.</p>';
  }
}

function ensureTutorVoicePicker() {
  if ($('#elevenLabsVoicePicker')) return;
  const side = $('.tutor-side');
  if (!side) return;
  const panel = document.createElement('section');
  panel.id = 'elevenLabsVoicePicker';
  panel.className = 'panel elevenlabs-picker';
  panel.innerHTML = '<span class="eyebrow">ELEVENLABS OVOZLARI</span><h3>Ovozni tinglab tanlang</h3><p>Google bilan kiring, ovozlarni tinglang va yoqqanini tanlang. Tanlov shu brauzerda saqlanadi.</p><div class="voice-preview-list"><p>Ochiq ovozlar tekshirilmoqda…</p></div>';
  side.append(panel);
  void loadTutorVoiceOptions();
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
    if (typeof window.renderResults === 'function') await window.renderResults();
    host.insertAdjacentHTML('afterbegin','<div class="google-account-note">Bu qurilmadagi natijalar. Google bilan kirib, natijalarni hisobingizga ham saqlashingiz mumkin.</div>');
    return;
  }
  const resultsUid = STATE.user.uid;

  host.innerHTML = '<div class="panel"><p>Natijalaringiz yuklanmoqda…</p></div>';
  try {
    const [attemptsSnapshot, essaysSnapshot] = await Promise.all([
      getDocs(query(collection(STATE.db, 'users', resultsUid, 'attempts'), orderBy('createdAt','desc'), limit(50))),
      getDocs(query(collection(STATE.db, 'users', resultsUid, 'essays'), orderBy('createdAt','desc'), limit(50)))
    ]);
    if (STATE.user?.uid !== resultsUid) return;
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
    const guests = pendingRecords().filter(r => !r.owner).length;
    if (guests) {
      const importButton = document.createElement('button'); importButton.className = 'btn secondary';
      importButton.textContent = guests + ' ta qurilma natijasini shu hisobga saqlash';
      importButton.onclick = async () => { importButton.disabled = true; await flushPendingRecords(true); await renderCloudResults(); };
      $('.cloud-results-actions',host)?.append(importButton);
    }
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
  if (!STATE.db) return { ...empty, error: true };
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
    return { ...empty, error: true };
  }
}

async function renderCommunity() {
  const host = $('#communityContent');
  if (!host) return;
  host.innerHTML = '<div class="panel"><p>Yangi savollar yuklanmoqda…</p></div>';
  const { questions, topics, announcement, error } = await readPublishedContent();
  if (error) {
    host.innerHTML='<div class="panel"><p>Yangi materiallar yuklanmadi. Internetni tekshirib qayta urinib ko‘ring.</p><button class="btn secondary" id="communityRetry">Qayta urinish</button></div>';
    $('#communityRetry')?.addEventListener('click', () => void renderCommunity());
    return;
  }
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
  $('[data-community-question]', host).forEach((button) => button.addEventListener('click', answerCommunityQuestion));
  const topicRows = $('.community-grid > .panel:nth-child(2) .admin-row', host);
  topicRows.forEach((row,index) => {
    const topic=topics[index]; if (!topic) return;
    const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent='Esse yozish';
    button.onclick=()=>{
      const select=$('#essayTopic'); if (!select) return;
      let option=[...select.options].find(o=>o.value==='community-'+topic.id);
      if (!option){option=document.createElement('option');option.value='community-'+topic.id;select.append(option);}
      option.textContent=topic.title;option.dataset.prompt=topic.prompt;select.value=option.value;
      window.setRoute?.('essay');$('#essayBody')?.focus();
    };
    row.append(button);
  });
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
  closeModal();
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
    getCountFromServer(query(collection(STATE.db, 'contentQuestions'), where('published', '==', true))),
    getCountFromServer(query(collection(STATE.db, 'contentEssayTopics'), where('published', '==', true)))
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
  const adminUid = STATE.user?.uid;
  host.innerHTML = '<div class="panel"><p>Admin ma’lumotlari yuklanmoqda…</p></div>';
  try {
    const [counts, questionsSnapshot, topicsSnapshot, announcementSnapshot] = await Promise.all([
      adminCounts(),
      getDocs(query(collection(STATE.db, 'contentQuestions'), where('published', '==', true), limit(100))),
      getDocs(query(collection(STATE.db, 'contentEssayTopics'), where('published', '==', true), limit(100))),
      getDoc(doc(STATE.db, 'siteSettings', 'announcement'))
    ]);
    if (STATE.user?.uid !== adminUid || !STATE.isAdmin || !STATE.adminUnlocked) return;
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
      await adminMutation('question', {
        category: formValue(form, 'category'),
        question: formValue(form, 'question'),
        options: [0, 1, 2, 3].map((index) => formValue(form, `option${index}`)),
        correctIndex: asNumber(formValue(form, 'correctIndex')),
        explanation: formValue(form, 'explanation'),
        published: true,
        createdBy: STATE.user.uid
      });
      notify('Yangi savol nashr qilindi. ✓');
      void renderAdmin();
    } catch (error) {
      notify(error.message || 'Savolni saqlab bo‘lmadi.', true);
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
      await adminMutation('essay', {
        title: formValue(form, 'title'),
        prompt: formValue(form, 'prompt'),
        published: true,
        createdBy: STATE.user.uid
      });
      notify('Yangi esse mavzusi nashr qilindi. ✓');
      void renderAdmin();
    } catch (error) {
      notify(error.message || 'Esse mavzusini saqlab bo‘lmadi.', true);
    } finally {
      button.disabled = false;
    }
  });
  $('#adminAnnouncementForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await adminMutation('announcement', {
        message: formValue(form, 'message'),
        active: Boolean(new FormData(form).get('active')),
        updatedBy: STATE.user.uid
      });
      $('#firebaseAnnouncementBanner')?.remove();
      void placeAnnouncementBanner();
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
      await adminMutation('hide', { kind, id });
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
  window.addEventListener('onatili:login', openModal);
  window.addEventListener('onatili:close-modal', closeModal);
  window.addEventListener('online', () => void flushPendingRecords());
  document.addEventListener('onatili:ready', () => refreshAccountUi());
  document.addEventListener('keydown', event => {
    const modal = $('#authModal');
    if (!modal || modal.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
    if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
      const first=controls[0], last=controls[controls.length-1];
      if (event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
    }
  });
  setupElevenLabsVoice();
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
      const revision = ++authRevision;
      STATE.user = user || null;
      STATE.isAdmin = false; STATE.adminUnlocked = false;
      $('#adminNav')?.remove(); $('#page-admin')?.remove();
      if ($('#pageCrumb')?.textContent === 'Admin panel') window.setRoute?.('home');
      closeModal(); refreshAccountUi();
      await updateAdminStatus();
      if (revision !== authRevision) return;
      refreshAccountUi();
      ensureAdminPage();
      void touchProfile();
      void flushPendingRecords();
      void placeAnnouncementBanner();
      if (isCurrentResultsPage()) void renderCloudResults();
    });
    STATE.contentReady = true;
    void placeAnnouncementBanner();
  } catch {
    notify('Google xizmatini yuklab bo‘lmadi. Sahifani yangilab qayta urinib ko‘ring.', true);
  }
}

void begin();

