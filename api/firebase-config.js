import { createHash } from 'node:crypto';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || ''
};

function normalizedAdminEmail() {
  return (process.env.FIREBASE_ADMIN_EMAIL || '').trim().toLowerCase();
}

export default function handler(request, response) {
  const configured = Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
  const adminEmail = normalizedAdminEmail();
  const adminEmailHash = adminEmail
    ? createHash('sha256').update(adminEmail).digest('hex')
    : '';

  response.setHeader('cache-control', 'no-store, max-age=0');
  response.status(200).json({
    configured,
    firebaseConfig: configured ? firebaseConfig : null,
    adminEmailHash
  });
}
