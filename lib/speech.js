import { HttpError } from './auth.js';
export const VOICES = Object.freeze({
  george: { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', detail: 'Erkak ovozi', recommended: true },
  adam: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', detail: 'Erkak ovozi' },
  antoni: { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', detail: 'Erkak ovozi' },
  sarah: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', detail: 'Ayol ovozi' },
  arnold: { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', detail: 'Erkak ovozi' }
});
export const PREVIEW_TEXT = 'Assalomu alaykum. Men OnaTili AI ustoziman. Bugun ona tilini birga o‘rganamiz.';
const cache = new Map();
export function voiceFor(slug) { return typeof slug === 'string' && Object.hasOwn(VOICES, slug) ? VOICES[slug] : null; }
export async function synthesize(text, voice) {
  if (!process.env.ELEVENLABS_API_KEY) throw new HttpError(503, 'Ovoz xizmati hali sozlanmagan.');
  const result = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.id)}?output_format=mp3_44100_128`, {
    method: 'POST', signal: AbortSignal.timeout(40000),
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: 'eleven_v3', language_code: 'uz', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
  });
  if (!result.ok) {
    console.error('Speech provider rejected request', { status: result.status });
    throw new HttpError(result.status >= 500 ? 502 : 503, result.status === 402 || result.status === 429 ? 'Ovoz xizmati limiti tugagan yoki band. Matnli suhbatdan foydalaning.' : 'Ovoz xizmati vaqtincha ishlamayapti. Matnli javobdan foydalaning.');
  }
  const audio = Buffer.from(await result.arrayBuffer());
  if (!audio.length || !result.headers.get('content-type')?.startsWith('audio/')) throw new HttpError(502, 'Ovoz olinmadi.');
  return audio;
}
export async function previewAudio(slug) {
  const voice = voiceFor(slug);
  if (!voice) throw new HttpError(404, 'Bunday ovoz topilmadi.');
  if (!cache.has(slug)) cache.set(slug, synthesize(PREVIEW_TEXT, voice).catch(error => { cache.delete(slug); throw error; }));
  return cache.get(slug);
}
export function sendAudio(res, audio) { res.setHeader('content-type', 'audio/mpeg'); res.setHeader('x-content-type-options', 'nosniff'); res.status(200).send(audio); }
