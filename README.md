# OnaTili AI on Vercel

Live site: https://onatili-ai.vercel.app/

This project uses Node.js serverless handlers. The older Python placeholders in this repository are not the deployed application.

- `api/proxy.js` forwards learning endpoints and HTML from the existing OnaTili AI Sites Worker.
- `public/onatili-firebase.js` adds Google authentication, cloud result summaries, owner administration and ElevenLabs speech.
- `lib/auth.js` validates Firebase ID tokens and signs short-lived admin sessions.
- `api/admin-content.js` writes content using the authenticated owner's Firestore permissions.
- `lib/speech.js` uses Eleven v3 with Uzbek language selection.

## Required production settings

Firebase web configuration: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID.

Server-only settings: ADMIN_EMAIL (verified site owner), ADMIN_PANEL_PASSWORD, ADMIN_SESSION_SECRET (random, at least 32 characters), ELEVENLABS_API_KEY. Never expose these through public frontend variables.

Changing an environment variable requires a new deployment. Node 22.x is the deployed runtime; functions run in Frankfurt.

## Checks

Run `node --test tests/*.test.js`. No third-party runtime dependencies are required.

The Sites source is maintained separately under project appgprj_6af5e1b4f9dc8191beb3adaf18659c0d. Its Worker tests cover grading, history, input limits and local tutoring. Both sources must be kept in sync for changes to the learning frontend.

See [AUDIT.md](AUDIT.md) for fixes, verification scope and remaining service dependencies.

