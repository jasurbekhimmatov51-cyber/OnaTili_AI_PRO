const UPSTREAM_ORIGIN = 'https://onatili-ai-preview-jasurbek.stunningmarmalade1.chatgpt.site';
const PUBLIC_ORIGIN = 'https://onatili-ai.vercel.app';
const CLIENT_SCRIPT = '/onatili-firebase.js?v=audit-20261117';
const OMIT = new Set(['content-length','content-encoding','transfer-encoding','connection','set-cookie','etag','last-modified','server']);
export function upstreamUrl(request) {
  const current = new URL(request.url);
  const path = (current.searchParams.get('path') || '').replace(/^\/+/, '');
  if (/[\\\x00-\x1f]/.test(path) || path.split('/').some(p=>p==='..')) throw new Error('Invalid path');
  current.searchParams.delete('path');
  const target = new URL('/' + path, UPSTREAM_ORIGIN);
  if (target.origin !== UPSTREAM_ORIGIN) throw new Error('Invalid origin');
  target.search = current.searchParams.toString();
  return target;
}
export function forwardedHeaders(request) {
  const headers = new Headers();
  for (const name of ['accept','content-type','x-onatili-visitor']) {
    const value = request.headers.get(name); if(value)headers.set(name,value);
  }
  return headers;
}
export function transformHtml(html) {
  html = html.replaceAll(UPSTREAM_ORIGIN, PUBLIC_ORIGIN);
  if (!html.includes('tAe0xjOHXQAKMkkyr35u-87czrq7-coUl0yhjV7_Z2U')) html=html.replace('</head>','<meta name="google-site-verification" content="tAe0xjOHXQAKMkkyr35u-87czrq7-coUl0yhjV7_Z2U"></head>');
  html=html.replace('<head>','<head><script>window.ONATILI_FIREBASE=true;</script>');
  return html.replace('</body>',`<script type="module" src="${CLIENT_SCRIPT}"></script></body>`);
}
export default {
  async fetch(request) {
    const method=request.method.toUpperCase();
    if(!['GET','HEAD','POST'].includes(method))return Response.json({error:'So‘rov usuli qo‘llanmaydi.'},{status:405,headers:{allow:'GET, HEAD, POST'}});
    try {
      const target=upstreamUrl(request);
      const headers=forwardedHeaders(request);
      const init={method:method==='HEAD'?'GET':method,headers,redirect:'manual',signal:AbortSignal.timeout(30000)};
      if(method==='POST'){init.body=request.body;init.duplex='half';}
      const upstream=await fetch(target,init);
      const resultHeaders=new Headers();
      for(const [key,value]of upstream.headers){if(!OMIT.has(key.toLowerCase()))resultHeaders.set(key,key==='location'?value.replaceAll(UPSTREAM_ORIGIN,PUBLIC_ORIGIN):value);}
      resultHeaders.set('x-content-type-options','nosniff');
      resultHeaders.set('referrer-policy','strict-origin-when-cross-origin');
      const type=upstream.headers.get('content-type')||'';
      const dynamic=target.pathname.startsWith('/api/')||type.includes('text/html');
      resultHeaders.set('cache-control',dynamic?'no-store':'public, max-age=300');
      if(method==='HEAD'){await upstream.body?.cancel();return new Response(null,{status:upstream.status,headers:resultHeaders});}
      if(/^(text\/html|text\/plain|application\/xml|text\/xml)/i.test(type)){
        let body=(await upstream.text()).replaceAll(UPSTREAM_ORIGIN,PUBLIC_ORIGIN);
        if(type.includes('text/html'))body=transformHtml(body);
        return new Response(body,{status:upstream.status,headers:resultHeaders});
      }
      return new Response(upstream.body,{status:upstream.status,headers:resultHeaders});
    } catch {
      return Response.json({error:'Server vaqtincha javob bermadi. Javoblaringizni saqlab, qayta urinib ko‘ring.'},{status:502,headers:{'cache-control':'no-store'}});
    }
  }
};

