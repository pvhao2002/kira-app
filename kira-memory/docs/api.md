# kira-memory API

All JSON. Auth is the `km_session` cookie set by login. Errors: `{status, code, message}` (message is Vietnamese).

## Public (no cookie)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | `{username, password}` → `User`, sets cookie. 401 `BAD_CREDENTIALS`, 429 after 10 failures / 15 min |
| POST | `/api/auth/logout` | clears cookie |
| GET | `/api/public/login-banner` | `{since: "2018-06-14", imageUrl: string \| null}` |
| GET | `/m/{id}/{sig}/o.{ext}` | original bytes; Range supported; immutable cache headers |
| GET | `/m/{id}/{sig}/t.jpg` | JPEG thumbnail (≤ 480 px) |

## Both accounts
| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/me` | `User {id, username, role: ADMIN\|VIEWER, displayName}` |
| GET | `/api/media?groupId=&ungrouped=true&cursor=&limit=60` | `{items: Media[], nextCursor}`; newest `takenAt` first; limit ≤ 100 |
| GET | `/api/groups` | `Group[] {id, name, pinned, count, coverUrl}`; pinned first (latest pin on top), then newest |
| GET | `/api/messages?before=&limit=50` | `Message[] {id, author, authorName, body, createdAt}`, newest first |
| POST | `/api/messages` | `{body}` (1–2000 chars) → `Message`; also pushed as SSE `message` |
| GET | `/api/events` | `text/event-stream`: `ready`, `message` (Message), `settings` ({widgetShape}); `:ping` every 25 s |
| GET | `/api/settings` | `{widgetShape}` |

`Media = {id, kind: IMAGE|VIDEO, contentType, width, height, caption, groupId, takenAt, createdAt, provider, url, thumbUrl}`

## Admin only (`/api/admin/**`)
| Method | Path | Notes |
|---|---|---|
| PUT | `/api/admin/media/{id}` | `{caption, groupId}` (both replaced; null clears) |
| POST | `/api/admin/media/move` | `{ids: number[], groupId: number \| null}` → `{moved}` |
| DELETE | `/api/admin/media/{id}` | deletes from storage first, then the row |
| POST / PUT | `/api/admin/groups`, `/api/admin/groups/{id}` | `{name, pinned}` |
| DELETE | `/api/admin/groups/{id}` | media in it becomes ungrouped |
| POST | `/api/admin/uploads` | `{contentType, size}` (≤ 2 GB) → `UploadStatus`; 507 `SERVER_DISK_FULL` when the temp disk is short |
| PUT | `/api/admin/uploads/{id}/chunks/{index}` | raw `application/octet-stream`, exactly `chunkSize` bytes (last chunk: the rest); re-sending is safe |
| POST | `/api/admin/uploads/{id}/complete` | multipart: `thumb` (JPEG ≤ 2 MB), optional `caption`, `groupId`, `width`, `height`, `takenAt` → 202 `UploadStatus`; storing runs in the background |
| GET | `/api/admin/uploads/{id}` | `UploadStatus {uploadId, state: RECEIVING\|PROCESSING\|DONE\|FAILED, size, chunkSize, totalChunks, receivedChunks, missingChunks, media, error}` |
| GET / PUT | `/api/admin/settings` | `{widgetShape, storageProvider: HUGGING_FACE\|R2, bannerMediaId, huggingFaceConfigured, r2Configured}`; PUT takes any of `widgetShape`, `storageProvider`, `bannerMediaId`, `clearBanner` |

Accepted types: jpeg/png/webp/gif/avif/heic/heif/mp4/mov/webm. Chunks exist because Cloudflare rejects request bodies over 100 MB.

Widget shapes: `heart, circle, star, flower, cloud, envelope, bubble`, or `auto` (the UI picks a different one every minute, the same on every device).
