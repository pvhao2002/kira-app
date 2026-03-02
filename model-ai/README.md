# Model AI

## Chạy

```bash
docker compose up -d
```

**Lưu ý:** Cần Ollama hoặc Docker Model Runner chạy trên host tại port 12434 trước khi start. Dùng `network_mode: host` nên Open WebUI chạy tại http://localhost:8080.

## Troubleshooting

### Models don't appear in the drop-down

1. Verify Docker Model Runner is accessible:

   ```bash
   curl http://localhost:12434/api/tags
   ```

2. Check that models are pulled:

   ```bash
   docker model list
   ```

3. Verify `OLLAMA_BASE_URL` is correct and accessible from the container.

### "Connection refused" errors

1. Ensure TCP access is enabled for Docker Model Runner.

2. On Docker Desktop, verify `host.docker.internal` resolves:

   ```bash
   docker run --rm alpine ping -c 1 host.docker.internal
   ```

3. On Docker Engine, try using `network_mode: host` or the explicit host IP.
