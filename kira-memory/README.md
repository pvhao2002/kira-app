# kira-memory

Nơi cất ảnh, video và lời nhắn của hai đứa mình. Two fixed accounts (`admin`, `love`), photos and videos on
Hugging Face (default) or Cloudflare R2, albums with pinning, captions, and a realtime message box.

- Service `kira-memory-service` → :8086 · UI `kira-memory-ui` → :4206 · MySQL → :3316 · local "R2" (S3Mock) → :9096
- Rules: `AGENTS.override.md` · API: `docs/api.md`

## Run locally
```bash
cp .env.example .env   # fill DB_PASSWORD, JWT_SECRET, MEDIA_URL_SECRET (and HF_* if you have them)
docker compose up -d
cd kira-memory-service
set -a; while IFS= read -r l; do [[ "$l" =~ ^[A-Z0-9_]+= ]] && export "$l"; done < ../.env; set +a
JAVA_HOME=$(/usr/libexec/java_home -v 25) mvn spring-boot:run
cd ../kira-memory-ui && npm install && npm start      # http://localhost:4206
```
Without `HF_TOKEN`, switch storage to R2 in Cài đặt (the local S3Mock) before uploading.

## Production notes
- Serve the built UI and proxy `/api` and `/m` to the service from the **same origin** (the cookie is SameSite=Strict).
  Set `COOKIE_SECURE=true`, and disable proxy buffering for `/api/events` (SSE).
- Hugging Face: create a **private** dataset repo; `HF_TOKEN` needs write access to it. Uploads use the Git LFS
  protocol (basic or multipart) and a commit per file, the same calls `huggingface_hub` makes.
- R2: `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `R2_REGION=auto`, an API token scoped to the bucket.
- Cloudflare cache: `/m/*` responses are cookie-free and `public, max-age=31536000, immutable`, with a file extension,
  so they are cached by default for jpg/png/gif/webp/mp4/webm. Add a Cache Rule "`/m/*` → eligible for cache,
  respect origin TTL" so heic/mov/avif are cached too. Deleting a memory does not purge Cloudflare: purge its URL
  (or wait) if a deleted photo must disappear from the edge immediately.
- Cloudflare (Free/Pro/Business) does not cache files over 512 MB: long videos stream from HF/R2 through the
  service on every view (Range requests keep each piece small). Uploads go in 32 MB chunks for the same reason
  (100 MB request limit); give `UPLOAD_TMP_DIR` enough disk for the files being uploaded at once.
- Never change `MEDIA_URL_SECRET` casually: it invalidates every cached media URL.
