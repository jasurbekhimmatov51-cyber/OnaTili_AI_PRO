const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const MAX_TEXT_LENGTH = 1000;

function cleanText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clientError(response, status, message) {
  response.status(status).json({ error: message });
}

export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store, max-age=0');

  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    clientError(response, 405, 'Faqat POST so‘rovi qabul qilinadi.');
    return;
  }

  const text = cleanText(request.body?.text);
  if (!text) {
    clientError(response, 400, 'Ovozga aylantirish uchun matn topilmadi.');
    return;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    clientError(response, 413, 'Javob uzun. Uni qismlarga bo‘lib qayta urinib ko‘ring.');
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY || '';
  if (!apiKey) {
    clientError(response, 503, 'Ovoz xizmati hali sozlanmagan.');
    return;
  }

  const configuredVoiceId = String(process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID).trim();
  const voiceId = /^[A-Za-z0-9_-]{8,100}$/.test(configuredVoiceId)
    ? configuredVoiceId
    : DEFAULT_VOICE_ID;

  try {
    const upstream = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId) + '/stream?output_format=mp3_44100_128',
      {
        method: 'POST',
        headers: {
          accept: 'audio/mpeg',
          'content-type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
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
      console.error('ElevenLabs TTS request failed', { status: upstream.status });
      clientError(response, upstream.status >= 500 ? 502 : 503, 'Ovoz vaqtincha tayyor bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.');
      return;
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    if (!audio.length) {
      clientError(response, 502, 'Ovoz ma’lumoti olinmadi.');
      return;
    }

    response.setHeader('content-type', upstream.headers.get('content-type') || 'audio/mpeg');
    response.setHeader('content-length', String(audio.length));
    response.setHeader('content-disposition', 'inline; filename="onatili-ai-ustoz.mp3"');
    response.status(200).send(audio);
  } catch (error) {
    console.error('ElevenLabs TTS connection error', { name: error?.name || 'Error' });
    clientError(response, 502, 'Ovoz xizmati bilan ulanib bo‘lmadi. Internetni tekshirib qayta urinib ko‘ring.');
  }
}
