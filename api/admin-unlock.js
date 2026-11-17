import { sameOrigin, requireAdmin, hasAdminSession, sessionCookie, clearSessionCookie, passwordMatches, rateLimit, respondError, HttpError } from '../lib/auth.js';
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  try {
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) { res.setHeader('allow', 'GET, POST, DELETE'); throw new HttpError(405, 'So‘rov usuli qo‘llanmaydi.'); }
    sameOrigin(req);
    if (req.method === 'DELETE') { res.setHeader('set-cookie', clearSessionCookie()); return res.status(200).json({ unlocked: false }); }
    const user = await requireAdmin(req, false);
    if (req.method === 'GET') return res.status(200).json({ isAdmin: true, unlocked: hasAdminSession(req, user.uid) });
    rateLimit(`admin:${user.uid}`, 5, 300000);
    const password = req.body?.password;
    if (typeof password !== 'string' || password.length > 128 || !passwordMatches(password, process.env.ADMIN_PANEL_PASSWORD || '')) throw new HttpError(401, 'Parol xato. Qayta urinib ko‘ring.');
    res.setHeader('set-cookie', sessionCookie(user.uid));
    return res.status(200).json({ unlocked: true });
  } catch (error) { respondError(res, error); }
}

