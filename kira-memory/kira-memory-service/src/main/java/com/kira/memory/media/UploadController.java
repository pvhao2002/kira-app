package com.kira.memory.media;

import com.kira.memory.identity.CurrentUser;
import com.kira.memory.shared.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Admin uploads: create a session, PUT raw chunks, complete with the thumbnail and details, poll the status. */
@RestController
@RequestMapping("/api/admin/uploads")
public class UploadController {
    private final UploadSessions uploads;
    private final MediaService media;

    public UploadController(UploadSessions uploads, MediaService media) {
        this.uploads = uploads;
        this.media = media;
    }

    public record CreateUpload(@NotBlank String contentType, @Positive long size) {
    }

    @PostMapping
    UploadSessions.Status create(@Valid @RequestBody CreateUpload req) {
        return uploads.create(req.contentType(), req.size());
    }

    @PutMapping(value = "/{id}/chunks/{index}", consumes = "application/octet-stream")
    UploadSessions.Status chunk(@PathVariable String id, @PathVariable int index, HttpServletRequest request) throws IOException {
        return uploads.writeChunk(id, index, request.getInputStream());
    }

    @PostMapping(value = "/{id}/complete", consumes = "multipart/form-data")
    ResponseEntity<UploadSessions.Status> complete(@AuthenticationPrincipal CurrentUser user, @PathVariable String id,
                                                   @RequestParam("thumb") MultipartFile thumb,
                                                   @RequestParam(required = false) String caption,
                                                   @RequestParam(required = false) Long groupId,
                                                   @RequestParam(required = false) Integer width,
                                                   @RequestParam(required = false) Integer height,
                                                   @RequestParam(required = false) Long takenAt) {
        MediaService.validateThumb(thumb);
        MediaService.Meta meta = media.validate(uploads.contentType(id), caption, groupId, width, height, takenAt);
        Path thumbFile;
        try {
            // Copied now: the multipart temp file is gone once this request ends, the store runs later.
            thumbFile = Files.createTempFile("km-thumb-", ".jpg");
            thumb.transferTo(thumbFile);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Không đọc được ảnh thu nhỏ");
        }
        return ResponseEntity.accepted().body(uploads.complete(id, thumbFile, meta, user.id()));
    }

    @GetMapping("/{id}")
    UploadSessions.Status status(@PathVariable String id) {
        return uploads.status(id);
    }
}
