import { timingSafeEqual } from 'node:crypto';

function passwordsMatch(received, expected) {
  const receivedBuffer = Buffer.from(String(received || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  return receivedBuffer.length === expectedBuffer.length &&
    receivedBuffer.length > 0 &&
    timingSafeEqual(receivedBuffer, expectedBuffer);
}

export default function handler(request, response) {
  response.setHeader('cache-control', 'no-store, max-age=0');
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    response.status(405).json({ unlocked: false });
    return;
  }

  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  const expectedPassword = process.env.ADMIN_PANEL_PASSWORD || '';
  const unlocked = passwordsMatch(password, expectedPassword);
  response.status(unlocked ? 200 : 401).json({ unlocked });
}
