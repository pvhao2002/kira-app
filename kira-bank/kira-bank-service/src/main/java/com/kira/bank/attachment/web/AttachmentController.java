package com.kira.bank.attachment.web;

import com.kira.bank.attachment.application.AttachmentService;
import com.kira.bank.attachment.domain.AttachmentAiStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static com.kira.bank.attachment.application.AttachmentDtos.AttachmentResponse;
import static com.kira.bank.shared.web.ApiTypes.PageMeta;
import static com.kira.bank.shared.web.ApiTypes.PageResponse;

@RestController
@RequestMapping("/api/v1/attachments")
@RequiredArgsConstructor
public class AttachmentController {
    private final AttachmentService attachments;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    AttachmentResponse upload(
        @AuthenticationPrincipal Long user,
        @RequestParam String flow,
        @RequestParam String documentType,
        @RequestParam("file") MultipartFile file
    ) throws IOException {
        return attachments.upload(user, flow, documentType, file);
    }

    @GetMapping
    PageResponse<AttachmentResponse> listDrafts(
        @AuthenticationPrincipal Long user,
        @RequestParam(defaultValue = "PENDING,PROCESSING,READY,FAILED") List<AttachmentAiStatus> statuses,
        @PageableDefault(size = 50) Pageable pageable
    ) {
        Page<AttachmentResponse> page = attachments.listDrafts(user, statuses, pageable);
        return new PageResponse<>(page.getContent(), new PageMeta(
            page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()));
    }

    @GetMapping("/{id}/content")
    ResponseEntity<byte[]> content(@AuthenticationPrincipal Long user, @PathVariable Long id) {
        AttachmentService.AttachmentContent content = attachments.content(user, id);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(content.mimeType()))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                .filename(content.originalName(), StandardCharsets.UTF_8).build().toString())
            .body(content.bytes());
    }

    @PostMapping("/{id}/retry")
    AttachmentResponse retry(@AuthenticationPrincipal Long user, @PathVariable Long id) {
        return attachments.retry(user, id);
    }
}
