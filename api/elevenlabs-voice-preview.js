const PREVIEW_TEXT = 'Assalomu alaykum. Men OnaTili AI ustoziman. Savollaringizga tushunarli va ravon javob beraman.';

const VOICES = {
  caleb: 'AaOhDHYJ1XLZk74lXhdE',
  eddie: 'l7kNoIfnJKPg7779LI2t',
  finley: 'fnYMz3F5gMEDGMWcH1ex',
  eldrin: '6WwXjDDEMyNmFG95zycZ',
  talia: 'OZ0L6eISlOejga3XjDFt',
  jade: 'g7LVvkPWALzPxOQbF6OE',
  alicia: 'BFd5oBc2DDna33pSi4Gf',
  maisie: 'QtY3JBOUKEB5xzrRfOKc'
};

function sendError(response, status, error) {
  response.status(status).json({ error });
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('allow', 'GET');
    sendError(response, 405, 'Faqat GET so‘rovi qabul qilinadi.');
    return;
  }

  const requested = Array.isArray(request.query?.voice) ? request.query.voice[0] : request.query?.voice;
  const key = String(requested || '').toLowerCase();
  const voiceId = VOICES[key];
  if (!voiceId) {
    sendError(response, 404, 'Bunday ovoz topilmadi.');
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY || '';
  if (!apiKey) {
    sendError(response, 503, 'Ovoz xizmati hali sozlanmagan.');
    return;
  }

  try {
    const upstream = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '/stream?output_format=mp3_44100_128',
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
