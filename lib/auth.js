import { createHmac, timingSafeEqual, verify } from 'node:crypto';
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
let certificates = { expires: 0, keys: {} }, certificateRequest;
const windows = new Map(), COOKIE = '__Host-onatili-admin';
export function sameOrigin(req) {
  const origin = req.headers?.origin, host = req.headers?.host;
  if (req.headers?.['sec-fetch-site'] === 'cross-site' || (origin && origin !== `https://${host}` && origin !== `http://${host}`)) throw new HttpError(403, 'So‘rov saytning o‘zidan yuborilishi kerak.');
}
// Instance-local backpressure, not a billing quota. Provider account limits remain authoritative.
export function rateLimit(key, maximum, period = 60000) {
  const now = Date.now();
  if (windows.size > 2000) for (const [id, value] of windows) if (value.until <= now) windows.delete(id);
  const value = windows.get(key);
  if (!value || value.until <= now) { windows.set(key, { count: 1, until: now + period }); return; }
  if (value.count >= maximum) throw new HttpError(429, 'So‘rovlar ko‘paydi. Bir oz kutib qayta urinib ko‘ring.');
  value.count++;
}
async function getCertificates() {
  if (certificates.expires > Date.now()) return certificates.keys;
  if (!certificateRequest) certificateRequest = (async () => {
    const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new HttpError(503, 'Google hisobini tekshirish vaqtincha ishlamayapti.');
    const keys = await response.json();
    certificates = { keys, expires: Date.now() + Math.min(3600, Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300)) * 1000 };
    return keys;
  })().finally(() => { certificateRequest = null; });
  return certificateRequest;
}
export function validateClaims(claims, project, now = Date.now() / 1000) {
  if (!project || claims.aud !== project || claims.iss !== `https://securetoken.google.com/${project}` ||
      !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 30 ||
      !Number.isFinite(claims.auth_time) || claims.auth_time > now + 30 ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
      claims.email_verified !== true || claims.firebase?.sign_in_provider !== 'google.com') throw new HttpError(401, 'Google hisobingizga qayta kiring.');
  return claims;
}
export async function requireUser(req) {
  const token = String(req.headers?.authorization || '').match(/^Bearer ([\w.-]+)$/)?.[1];
  if (!token || token.length > 8192) throw new HttpError(401, 'Davom etish uchun Google bilan kiring.');
  let header, claims;
  const parts = token.split('.');
  try { if (parts.length !== 3) throw Error(); header = JSON.parse(Buffer.from(parts[0], 'base64url')); claims = JSON.parse(Buffer.from(parts[1], 'base64url')); }
  catch { throw new HttpError(401, 'Google hisobingizga qayta kiring.'); }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new HttpError(401, 'Kirish tasdiqlanmadi.');
  const keys = await getCertificates(), key = Object.hasOwn(keys, header.kid) ? keys[header.kid] : null;
  if (!key || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'))) throw new HttpError(401, 'Kirish tasdiqlanmadi.');
  validateClaims(claims, process.env.FIREBASE_PROJECT_ID);
  return { ...claims, uid: claims.sub, token };
}
export function isAdmin(user) {
  const allowed = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return !!allowed && String(user.email || '').toLowerCase() === allowed;
}
export function passwordMatches(a, b) {
  const one = Buffer.from(String(a)), two = Buffer.from(String(b));
  return !!two.length && one.length === two.length && timingSafeEqual(one, two);
}
function signature(value) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new HttpError(503, 'Admin himoyasi hali sozlanmagan.');
  return createHmac('sha256', secret).update(value).digest('base64url');
}
export function sessionCookie(uid, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ uid, exp: now + 30 * 60000 })).toString('base64url');
  return `${COOKIE}=${payload}.${signature(payload)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=1800`;
}
export function clearSessionCookie() { return `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`; }
export function hasAdminSession(req, uid, now = Date.now()) {
  const value = String(req.headers?.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [payload, mac, extra] = value.split('.');
  if (!payload || !mac || extra || !passwordMatches(mac, signature(payload))) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url')); return data.uid === uid && Number.isFinite(data.exp) && data.exp > now; } catch { return false; }
}
export async function requireAdmin(req, unlocked = true) {
  const user = await requireUser(req);
  if (!isAdmin(user)) throw new HttpError(403, 'Bu bo‘lim faqat sayt egasi uchun.');
  if (unlocked && !hasAdminSession(req, user.uid)) throw new HttpError(403, 'Admin parolini qayta kiriting.');
  return user;
}
export function respondError(res, error) {
  res.setHeader('cache-control', 'no-store');
  if (error.status === 429) res.setHeader('retry-after', '60');
  res.status(error.status || 503).json({ error: error.status ? error.message : 'Xizmat vaqtincha javob bermadi. Qayta urinib ko‘ring.' });
}
