import { requireUser, sameOrigin, rateLimit, respondError, HttpError } from '../lib/auth.js';
import { VOICES, previewAudio, voiceFor, sendAudio } from '../lib/speech.js';
export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  try {
    if (req.method !== 'GET') { res.setHeader('allow', 'GET'); throw new HttpError(405, 'Faqat GET so‘rovi qabul qilinadi.'); }
    if (req.query?.list === '1') return res.status(200).json({ voices: Object.entries(VOICES).map(([slug, { name, detail, recommended }]) => ({ slug, name, detail, recommended: !!recommended })) });
    sameOrigin(req);
    if (!voiceFor(req.query?.voice)) throw new HttpError(404, 'Bunday ovoz topilmadi.');
    const user = await requireUser(req);
    rateLimit(`preview:${user.uid}`, 10);
    sendAudio(res, await previewAudio(req.query.voice));
  } catch (error) { respondError(res, error); }
}

