package com.kira.bank.attachment.web;

import com.kira.bank.ai.*;
import com.kira.bank.shared.web.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/attachments")
public class AttachmentController {
    private static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/webp", "application/pdf");
    private final Path root;
    private final AiDocumentService ai;

    AttachmentController(@Value("${app.upload-dir:${java.io.tmpdir}/kira-bank-uploads}") String dir, AiDocumentService ai) throws IOException {
        this.root = Paths.get(dir).toAbsolutePath().normalize();
        Files.createDirectories(root);
        this.ai = ai;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    Object upload(@AuthenticationPrincipal Long user, @RequestParam String flow, @RequestParam String documentType, @RequestPart MultipartFile file) throws Exception {
        if (file.isEmpty() || file.getSize() > 10 * 1024 * 1024)
            throw bad("INVALID_FILE_SIZE", "File phải có dung lượng từ 1 byte đến 10 MB");
        if (!ALLOWED.contains(file.getContentType()))
            throw bad("INVALID_FILE_TYPE", "Chỉ hỗ trợ JPEG, PNG, WebP hoặc PDF");
        String ext = switch (file.getContentType()) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".pdf";
        };
        String key = user + "/" + UUID.randomUUID() + ext;
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root)) throw bad("INVALID_PATH", "Đường dẫn lưu trữ không hợp lệ");
        Files.createDirectories(target.getParent());
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
        return Map.of("storageKey", key, "originalName", Optional.ofNullable(file.getOriginalFilename()).orElse("document"), "mimeType", file.getContentType(), "size", file.getSize(), "sha256", sha256(target), "flow", flow, "documentType", documentType, "ai", ai.analyze(key, documentType));
    }

    private String sha256(Path p) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(p)));
    }

    private ApiException bad(String c, String m) {
        return new ApiException(HttpStatus.BAD_REQUEST, c, m);
    }
}

