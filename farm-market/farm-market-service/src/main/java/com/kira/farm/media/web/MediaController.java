package com.kira.farm.media.web;

import com.kira.farm.media.application.MediaService;
import com.kira.farm.shared.web.ApiException;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;

@Tag(name = "Media")
@RestController
@RequiredArgsConstructor
public class MediaController {
    private final MediaService media;

    public record UploadResponse(String url) {
    }

    @PostMapping(value = "/api/v1/admin/media/products", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public UploadResponse productImage(@RequestPart("file") MultipartFile file) {
        return new UploadResponse(media.uploadProductImage(file));
    }

    @PostMapping(value = "/api/v1/media/reviews", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(HttpStatus.CREATED)
    public UploadResponse reviewPhoto(@RequestPart("file") MultipartFile file) {
        return new UploadResponse(media.uploadReviewPhoto(file));
    }

    /** Public. Streams the file itself (no static resource handler); only names the service generated can match. */
    @GetMapping("/api/v1/files/{name:.+}")
    public ResponseEntity<Resource> file(@PathVariable String name) {
        Path path = media.find(name).orElseThrow(() -> ApiException.notFound("FILE_NOT_FOUND", "Không tìm thấy ảnh"));
        MediaType type = MediaService.contentTypeOf(name).map(MediaType::parseMediaType)
            .orElse(MediaType.APPLICATION_OCTET_STREAM);
        // nosniff comes from Spring Security's default headers (SecurityConfig).
        return ResponseEntity.ok().contentType(type)
            .body(new FileSystemResource(path));
    }
}
