# OnaTili AI audit — 17 November 2026

Scope: production Vercel frontend/integration, upstream Sites Worker and D1 learning API. Existing content and records are preserved.

## Fixed

| Finding | Resolution |
| --- | --- |
| Admin password endpoint accepted anonymous requests | Firebase RS256 ID token verification, project/issuer/expiry/provider checks, owner email allowlist |
| Browser sessionStorage could claim admin unlock | Signed, UID-bound, Secure/HttpOnly/SameSite cookie with a 30-minute lifetime; server checks on content writes |
| Admin modal could remain over the page | Explicit hidden/display state, Escape/backdrop/close handling, keyboard focus containment |
| Admin content inputs trusted the browser | Server validation, authenticated Firestore REST writes using the owner's token and existing security rules |
| Removing material destroyed it | Publish flag is switched off; original record remains recoverable |
| Test had separate manual/automatic submit implementations | Single guarded submit path, recoverable error state, visible correct/wrong/skipped counts |
| Empty matching/open answers counted as answered | Recursive answer validation and regression tests |
| Concurrent submits/draft saves could overwrite results | Conditional SQL update and idempotent repeat submit |
| Last answers could be lost at page exit | Local draft plus authenticated visitor header on keepalive save |
| Result sync used random IDs and a shared queue | Stable IDs, captured account identity, per-account retry, explicit guest import, race-safe queue removal |
| Cloud results selected arbitrary 50 records | Date ordering before limit; latest 50 records shown |
| Speech cancellation never settled the playback promise | Explicit playback cleanup and cancellation; retryable stop/listen buttons |
| Speech synthesis was publicly callable | Verified Google identity and instance-local backpressure; browser audio cache |
| Uzbek was sent to Multilingual v2 | Eleven v3 with language_code=uz; explicit provider errors and request timeout |
| Microphone repeated interim words | Rebuild transcript from the recognition result set |
| Local tutor ignored quiz answers | Last-question checking; honest limitation message for unsupported general questions |
| Proxy forwarded cookies and identity headers | Small request-header allowlist, removed upstream cookies/validators, private response no-store, bounded timeout |
| Function region did not match requested Europe | Vercel functions configured for Frankfurt |

## Checks

- Worker suite: 7 tests, actual SQLite-backed D1 adapter, includes 45-question mock.
- Integration/security/client suite: 9 tests, including signed/forged Firebase tokens, admin cookie expiry, cancelled audio, queue concurrency and account isolation.
- JavaScript syntax checks for changed modules.
- Public browser smoke checks are performed after publication; authenticated Google/admin/audio checks require a signed-in account.

## Remaining service limitations

- No general-purpose AI API key was found in Vercel configuration. Existing upstream bootstrap controls whether the live AI provider is available. Local tutor and heuristic essay scoring are explicitly labelled; the essay score is not an official exam score.
- Firestore rules remain the final data-access boundary. No service-account bypass was added; requests keep the user's token. We did not obtain deployment access to Firestore rules for a rules audit.
- Rate limits in this repository are per function instance, not durable account-wide billing quotas. ElevenLabs account credit limits remain necessary.
- Search indexing and position are controlled by Google, not by deployment. robots.txt, sitemap and verification metadata are retained.
- Server-rendered content and D1 storage still depend on the existing Sites Worker. This audit does not migrate or erase its database.
- Legacy duplicate cloud records are not automatically deleted, because repeated legitimate attempts cannot be distinguished safely from duplicates.

## Verification references

- https://firebase.google.com/docs/auth/admin/verify-id-tokens
- https://elevenlabs.io/docs/overview/models
