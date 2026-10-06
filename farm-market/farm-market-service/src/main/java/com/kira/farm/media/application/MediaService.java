package com.kira.farm.media.application;

import com.kira.farm.identity.application.LoginRateLimiter;
import com.kira.farm.order.domain.OrderStatus;
import com.kira.farm.order.infrastructure.OrderRepository;
import com.kira.farm.shared.security.CurrentUser;
import com.kira.farm.shared.web.ApiException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Stores validated images on local disk under random names. Only the leading bytes decide the type and extension;
 * the client file name and Content-Type are ignored. Files are written to a temp file and moved into place atomically
 * (stored files keep the temp file's owner-only permissions; adjust if another process must read the volume).
 * ponytail: images of rejected/abandoned forms (reviews never submitted) stay on disk; add a sweeper when it matters.
 */
@Service
@RequiredArgsConstructor
public class MediaService {
    private static final Logger log = LoggerFactory.getLogger(MediaService.class);
    /** The only names ever served or written: lower-case uuid + a known extension. */
    public static final Pattern NAME = Pattern.compile("^" + MediaUrl.FILE_NAME + "$");
    private final MediaProperties props;
    private final OrderRepository orders;
    private final LoginRateLimiter limiter;
    private Path root;
    private String base;

    @PostConstruct
    void init() {
        if (props.maxBytes() < 1 || props.maxBytes() >= Integer.MAX_VALUE)
            throw new IllegalStateException("app.media.max-bytes must be between 1 and " + (Integer.MAX_VALUE - 1));
        base = props.publicBaseUrl() == null ? "" : props.publicBaseUrl().trim().replaceAll("/+$", "");
        // DTOs only accept https origins, so any other base would make every returned URL fail validation.
        if (!base.isEmpty() && !base.matches("^https://[A-Za-z0-9.-]{1,253}(:[0-9]{1,5})?$"))
            throw new IllegalStateException("app.media.public-base-url must be empty or https://host[:port]");
        root = Path.of(props.dir()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot create the upload directory", e);
        }
    }

    /** Back-office product image (the caller is already restricted to MANAGER/ADMIN by the controller). */
    public String uploadProductImage(MultipartFile file) {
        limiter.checkUpload(CurrentUser.id());
        return store(file);
    }

    /** Review photo: only a customer with at least one DELIVERED order may upload. */
    public String uploadReviewPhoto(MultipartFile file) {
        Long userId = CurrentUser.id();
        limiter.checkUpload(userId);
        if (!orders.existsByUserIdAndStatus(userId, OrderStatus.DELIVERED))
            throw ApiException.forbidden("MEDIA_NOT_ALLOWED", "Chỉ khách đã nhận hàng mới có thể tải ảnh đánh giá");
        return store(file);
    }

    /** The stored file for a public name, or empty when the name is not one of ours or the file is gone. */
    public Optional<Path> find(String name) {
        if (name == null || !NAME.matcher(name).matches()) return Optional.empty();
        Path p = root.resolve(name).normalize();
        return p.startsWith(root) && Files.isRegularFile(p) ? Optional.of(p) : Optional.empty();
    }

    /** True when the URL is exactly one this service generates (own origin or relative) and the file still exists. */
    public boolean isStoredUrl(String url) {
        if (url == null) return false;
        String rel = url.startsWith(base + MediaUrl.PATH_PREFIX) ? url.substring(base.length()) : url;
        return rel.startsWith(MediaUrl.PATH_PREFIX) && find(rel.substring(MediaUrl.PATH_PREFIX.length())).isPresent();
    }

    public static Optional<String> contentTypeOf(String name) {
        return ImageSniffer.contentTypeOf(name.substring(name.lastIndexOf('.') + 1));
    }

    private String store(MultipartFile file) {
        if (file == null || file.isEmpty())
            throw ApiException.badRequest("FILE_REQUIRED", "Vui lòng chọn một ảnh");
        byte[] bytes;
        try (InputStream in = file.getInputStream()) {
            bytes = in.readNBytes((int) props.maxBytes() + 1);
        } catch (IOException e) {
            throw ApiException.badRequest("FILE_UNREADABLE", "Không đọc được ảnh, vui lòng thử lại");
        }
        if (bytes.length > props.maxBytes())
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE",
                "Ảnh tối đa " + props.maxBytes() / (1024 * 1024) + "MB");
        ImageSniffer.Kind kind = ImageSniffer.sniff(bytes).orElseThrow(() ->
            new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_IMAGE", "Chỉ nhận ảnh JPEG, PNG hoặc WebP"));
        String name = UUID.randomUUID() + "." + kind.extension;
        Path tmp = null;
        try {
            tmp = Files.createTempFile(root, "upload-", ".tmp");
            Files.write(tmp, bytes);
            Files.move(tmp, root.resolve(name), StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            if (tmp != null) try {
                Files.deleteIfExists(tmp);
            } catch (IOException ignored) {
                // best effort: a leftover .tmp file is harmless and never served
            }
            throw new UncheckedIOException("Cannot store the upload", e);
        }
        log.info("Image stored name={} bytes={}", name, bytes.length);
        return base + MediaUrl.PATH_PREFIX + name;
    }
}
