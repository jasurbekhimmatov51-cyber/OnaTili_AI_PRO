import { requireUser, sameOrigin, rateLimit, respondError, HttpError } from '../lib/auth.js';
import { synthesize, voiceFor, VOICES, sendAudio } from '../lib/speech.js';
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  try {
    if (req.method !== 'POST') { res.setHeader('allow', 'POST'); throw new HttpError(405, 'Faqat POST so‘rovi qabul qilinadi.'); }
    sameOrigin(req);
    const user = await requireUser(req);
    const value = req.body?.text;
    if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, 'Ovoz uchun matn kiriting.');
    if (value.length > 1000) throw new HttpError(413, 'Matn juda uzun.');
    rateLimit(`tts:${user.uid}`, 12);
    rateLimit(`tts-hour:${user.uid}`, 80, 3600000);
    const selected = req.body?.voice, voice = selected ? voiceFor(selected) : VOICES.george;
    if (!voice) throw new HttpError(400, 'Ovoz tanlovi noto‘g‘ri.');
    sendAudio(res, await synthesize(value.replace(/\u0000/g, '').trim(), voice));
  } catch (error) { respondError(res, error); }
}

