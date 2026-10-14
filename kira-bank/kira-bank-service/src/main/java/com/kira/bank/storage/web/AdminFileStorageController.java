package com.kira.bank.storage.web;

import com.kira.bank.storage.application.FileStorageService;
import com.kira.bank.storage.application.FileStorageService.ProviderUsage;
import com.kira.bank.storage.application.FileStorageService.StoredFileResponse;
import com.kira.bank.storage.domain.StorageProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@RestController
@RequestMapping("/api/v1/admin/file-storage")
@RequiredArgsConstructor
public class AdminFileStorageController {
    private final FileStorageService service;

    @PostMapping(value = "/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    StoredFileResponse upload(
        @AuthenticationPrincipal Long adminId,
        @RequestParam(defaultValue = "R2") StorageProvider preferred,
        @RequestParam("file") MultipartFile file
    ) throws IOException {
        return service.upload(adminId, preferred, file);
    }

    @GetMapping("/files")
    PageResponse<StoredFileResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        Page<StoredFileResponse> page = service.list(pageable);
        return new PageResponse<>(page.getContent(), new PageMeta(
            page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    // Always served as a download with a neutral type so uploaded HTML/SVG never renders on the app origin.
    @GetMapping("/files/{id}/content")
    ResponseEntity<byte[]> content(@PathVariable Long id) {
        FileStorageService.FileContent content = service.content(id);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                .filename(content.originalName(), StandardCharsets.UTF_8).build().toString())
            .body(content.bytes());
    }

    @DeleteMapping("/files/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Long adminId, @PathVariable Long id) {
        service.delete(adminId, id);
    }

    @GetMapping("/usage")
    List<ProviderUsage> usage() {
        return service.usage();
    }
}
