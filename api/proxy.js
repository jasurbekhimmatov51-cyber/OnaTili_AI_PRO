const UPSTREAM_ORIGIN = 'https://onatili-ai-preview-jasurbek.stunningmarmalade1.chatgpt.site';
const GOOGLE_SITE_VERIFICATION = '<meta name="google-site-verification" content="tAe0xjOHXQAKMkkyr35u-87czrq7-coUl0yhjV7_Z2U" />';
const FIREBASE_CLIENT_SCRIPT = '/onatili-firebase.js?v=voice-picker-2';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto'
]);

function publicOrigin(request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return UPSTREAM_ORIGIN;
  return `https://${host}`;
}

function upstreamUrl(request) {
  const current = new URL(request.url);
  const path = (current.searchParams.get('path') || '').replace(/^\/+/, '');
  current.searchParams.delete('path');
  const query = current.searchParams.toString();
  return `${UPSTREAM_ORIGIN}/${path}${query ? `?${query}` : ''}`;
}

function forwardedHeaders(request) {
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }
  return headers;
}

function textResponse(contentType) {
  return /^(text\/html|text\/plain|application\/xml|text\/xml)/i.test(contentType || '');
}

function injectGoogleVerification(html) {
  if (html.includes('tAe0xjOHXQAKMkkyr35u-87czrq7-coUl0yhjV7_Z2U')) return html;
  return html.replace(/<\/head>/i, `${GOOGLE_SITE_VERIFICATION}</head>`);
}

function injectFirebaseClient(html) {
  if (html.includes(FIREBASE_CLIENT_SCRIPT)) return html;
  return html.replace(/<\/body>/i, `<script type="module" src="${FIREBASE_CLIENT_SCRIPT}"></script></body>`);
}

function copiedHeaders(response, origin) {
  const headers = new Headers();
  for (const [key, value] of response.headers) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower) || lower === 'content-length' || lower === 'content-encoding') continue;
    if (lower === 'location') {
      headers.set(key, value.replaceAll(UPSTREAM_ORIGIN, origin));
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

export default {
  async fetch(request) {
    const method = request.method.toUpperCase();
    const init = {
      method,
      headers: forwardedHeaders(request),
      redirect: 'manual'
    };
    if (!['GET', 'HEAD'].includes(method)) {
      init.body = request.body;
      // Node.js fetch requires this when a streamed request body is forwarded.
      init.duplex = 'half';
    }

    let upstream;
    try {
      upstream = await fetch(upstreamUrl(request), init);
    } catch {
      return new Response('OnaTili AI serveriga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.', {
        status: 502,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }

    const origin = publicOrigin(request);
    const headers = copiedHeaders(upstream, origin);
    const contentType = upstream.headers.get('content-type') || '';

    if (textResponse(contentType)) {
      let body = (await upstream.text()).replaceAll(UPSTREAM_ORIGIN, origin);
      if (/^text\/html/i.test(contentType)) {
        body = injectGoogleVerification(body);
        body = injectFirebaseClient(body);
      }
      return new Response(body, { status: upstream.status, headers });
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  }
};
