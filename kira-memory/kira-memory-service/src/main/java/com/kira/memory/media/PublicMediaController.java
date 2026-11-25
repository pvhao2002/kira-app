package com.kira.memory.media;

import com.kira.memory.shared.ApiException;
import com.kira.memory.storage.Blob;
import com.kira.memory.storage.BlobStores;
import com.kira.memory.storage.StorageException;
import com.kira.memory.storage.StorageNotFoundException;
import com.kira.memory.storage.StorageProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/**
 * Serves media bytes from whichever provider holds them. Responses are cookie-free and immutable, so Cloudflare
 * caches them at the edge; Range requests pass through so videos can seek.
 */
@RestController
public class PublicMediaController {
    private static final Logger log = LoggerFactory.getLogger(PublicMediaController.class);
    static final String IMMUTABLE = "public, max-age=31536000, immutable";
    private final MediaService media;
    private final MediaUrls urls;
    private final BlobStores stores;

    public PublicMediaController(MediaService media, MediaUrls urls, BlobStores stores) {
        this.media = media;
        this.urls = urls;
        this.stores = stores;
    }

    @GetMapping("/m/{id}/{sig}/{file}")
    void serve(@PathVariable long id, @PathVariable String sig, @PathVariable String file, HttpServletRequest request,
               HttpServletResponse response) throws IOException {
        String variant = file.startsWith("t.") ? "t" : file.startsWith("o.") ? "o" : null;
        if (variant == null || !urls.valid(id, variant, sig)) {
            notFound(response);
            return;
        }
        MediaRow row;
        try {
            row = media.row(id);
        } catch (ApiException e) {
            notFound(response);
            return;
        }
        boolean thumb = "t".equals(variant);
        if (!file.equals(thumb ? "t.jpg" : "o." + MediaUrls.extension(row.objectKey()))) {
            notFound(response);
            return;
        }
        String range = request.getHeader("Range");
        try (Blob blob = stores.get(StorageProvider.valueOf(row.provider())).open(thumb ? row.thumbKey() : row.objectKey(), range)) {
            response.setStatus(blob.status());
            response.setContentType(thumb ? "image/jpeg" : row.contentType());
            response.setHeader("Cache-Control", IMMUTABLE);
            response.setHeader("Accept-Ranges", "bytes");
            if (blob.length() >= 0) response.setContentLengthLong(blob.length());
            if (blob.contentRange() != null) response.setHeader("Content-Range", blob.contentRange());
            if ("HEAD".equals(request.getMethod())) return;
            try {
                blob.body().transferTo(response.getOutputStream());
            } catch (IOException clientGone) {
                // The viewer scrolled away or seeked; nothing to report.
            }
        } catch (StorageNotFoundException e) {
            notFound(response);
        } catch (StorageException e) {
            log.warn("Media read from {} failed: {}", row.provider(), e.getMessage());
            response.setHeader("Cache-Control", "no-store");
            response.sendError(502);
        }
    }

    private static void notFound(HttpServletResponse response) throws IOException {
        // Short-lived, so a just-uploaded item is never stuck behind a cached 404.
        response.setHeader("Cache-Control", "no-store");
        response.sendError(404);
    }
}
