# Kira Life English Speaking

Vietnamese notes in, spoken-English reports or interview answers out, saved as per-user history. Web route is under `/app/english-speaking`.

## Ownership, storage and quota

All `/api/v1/english` requests require a bearer access token. The authenticated principal supplies the owner; callers never supply `userId`. Every query filters by owner, so another user's id returns `404 ENGLISH_REWRITE_NOT_FOUND`.

New migration: `V43__english_speaking_rewrites.sql` (table `english_rewrites`; `result_json` holds `{sentences, keyPhrases}`). No applied migration is modified.

Each successful generation consumes 1 unit of the daily AI quota. The unit is consumed after input validation and refunded when the provider fails or returns a non-conforming response. An exhausted quota returns `429 AI_DAILY_LIMIT_EXCEEDED`. Only `kind`, `category`, `question` and `notes` are sent to the provider; notes, AI output and provider errors are never logged.

## APIs

All paths are relative to `/api/v1/english`.

| Method | Path | Request / response |
|---|---|---|
| POST | `/rewrites` | Body `{kind, notes, question?, category?}`; returns `Rewrite` (200) |
| GET | `/rewrites?kind=` | Up to 50 newest first: `[{id, kind, title, createdAt}]`; `kind` optional |
| GET | `/rewrites/{id}` | `Rewrite` |
| DELETE | `/rewrites/{id}` | 204 |

`kind`: `STANDUP | WEEKLY | BIWEEKLY | INTERVIEW`. `category`: `JAVA_CORE | SPRING | DATABASE | ANGULAR | SYSTEM_DESIGN | PROJECT`.

Limits: `notes` trimmed 1-4000 chars; `question` at most 500 and required for `INTERVIEW`.

```json
{
  "id": "uuid", "kind": "STANDUP", "category": null, "question": null, "notes": "...",
  "title": "Daily update",
  "sentences": [{"section": "Yesterday", "en": "I fixed the currency bug.", "vi": "..."}],
  "keyPhrases": [{"en": "fix a bug", "vi": "..."}],
  "createdAt": "2026-10-21T08:00:00Z"
}
```

AI output is validated before it is stored: `sentences` 1-40, `en` 1-400, `vi` 0-400, `section` 0-40, `keyPhrases` 0-8, `title` 1-80 (longer titles are truncated).

## Errors

| Status | Code | Meaning |
|---|---|---|
| 400 | `ENGLISH_NOTES_INVALID` | Notes blank or over 4000 chars (or question over 500) |
| 400 | `ENGLISH_QUESTION_REQUIRED` | `INTERVIEW` without a question |
| 429 | `AI_DAILY_LIMIT_EXCEEDED` | Daily AI quota used |
| 503 | `ENGLISH_AI_NOT_CONFIGURED` | No AI provider account configured (quota refunded) |
| 503 | `ENGLISH_AI_UNAVAILABLE` | Provider failed (quota refunded) |
| 502 | `ENGLISH_AI_INVALID_RESPONSE` | AI output failed validation (quota refunded) |
| 404 | `ENGLISH_REWRITE_NOT_FOUND` | Missing or not owned |
