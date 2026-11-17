const PREVIEW_TEXT = 'Assalomu alaykum. Men OnaTili AI ustoziman. Savollaringizga tushunarli va ravon javob beraman.';

const VOICES = {
  george: { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', detail: 'Erkak · sokin va tushunarli ustoz', recommended: true },
  adam: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', detail: 'Erkak · ravon va tabiiy' },
  antoni: { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', detail: 'Erkak · chuqurroq va xotirjam' },
  sarah: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', detail: 'Ayol · aniq va samimiy' },
  arnold: { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', detail: 'Erkak · qat’iy va kuchli' }
};

function sendError(response, status, error) {
  response.status(status).json({ error });
}

function publicVoice(voice, slug) {
  return {
    slug,
    name: voice.name,
    detail: voice.detail,
    recommended: Boolean(voice.recommended)
  };
}

export default async function handler(request, response) {
  const apiKey = process.env.ELEVENLABS_API_KEY || '';
  if (!apiKey) {
    sendError(response, 503, 'Ovoz xizmati hali sozlanmagan.');
    return;
  }

  const listMode = String(request.query?.list || '') === '1';
  if (request.method === 'GET' && listMode) {
    const voices = Object.entries(VOICES).map(([slug, voice]) => publicVoice(voice, slug));
    response.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    response.status(200).json({ voices });
    return;
  }

  if (request.method !== 'GET') {
    response.setHeader('allow', 'GET');
    sendError(response, 405, 'Faqat GET so‘rovi qabul qilinadi.');
    return;
  }

  const requested = Array.isArray(request.query?.voice) ? request.query.voice[0] : request.query?.voice;
  const key = String(requested || '').toLowerCase();
  const voice = VOICES[key];
  if (!voice) {
    sendError(response, 404, 'Bunday ovoz topilmadi.');
    return;
  }

  try {
    const upstream = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voice.id + '/stream?output_format=mp3_44100_128',
      {
        method: 'POST',
        headers: {
          accept: 'audio/mpeg',
          'content-type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: PREVIEW_TEXT,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.52,
            similarity_boost: 0.75,
            style: 0.08,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!upstream.ok) {
      console.error('ElevenLabs preview request failed', { status: upstream.status, voice: key });
      sendError(response, upstream.status >= 500 ? 502 : 503, 'Ovoz namunasi vaqtincha tayyor bo‘lmadi.');
      return;
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    if (!audio.length) {
      sendError(response, 502, 'Ovoz namunasi olinmadi.');
      return;
    }

    response.setHeader('cache-control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    response.setHeader('content-type', upstream.headers.get('content-type') || 'audio/mpeg');
    response.setHeader('content-length', String(audio.length));
    response.setHeader('content-disposition', 'inline; filename="onatili-ai-voice-preview-' + key + '.mp3"');
    response.status(200).send(audio);
  } catch (error) {
    console.error('ElevenLabs preview connection error', { name: error?.name || 'Error', voice: key });
    sendError(response, 502, 'Ovoz xizmati bilan ulanib bo‘lmadi.');
  }
}
