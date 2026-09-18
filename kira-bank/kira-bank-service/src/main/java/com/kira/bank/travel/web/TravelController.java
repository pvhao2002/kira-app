package com.kira.bank.travel.web;

import com.kira.bank.travel.application.TravelService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static com.kira.bank.travel.application.TravelDtos.*;

@RestController
@RequestMapping("/api/v1/travel/trips")
@RequiredArgsConstructor
public class TravelController {
    private final TravelService service;

    @GetMapping
    public List<TripView> list(@AuthenticationPrincipal Long user) {
        return service.list(user);
    }

    @GetMapping("/{id}")
    public TripView get(@AuthenticationPrincipal Long user, @PathVariable String id) {
        return service.get(user, id);
    }

    @PostMapping
    public TripView create(@AuthenticationPrincipal Long user, @Valid @RequestBody TripWrite write) {
        return service.save(user, null, write);
    }

    @PutMapping("/{id}")
    public TripView update(@AuthenticationPrincipal Long user, @PathVariable String id, @Valid @RequestBody TripWrite write) {
        return service.save(user, id, write);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal Long user, @PathVariable String id, @RequestParam long version) {
        service.delete(user, id, version);
    }

    @GetMapping("/{id}/files")
    public List<FileView> files(@AuthenticationPrincipal Long user, @PathVariable String id) {
        return service.files(user, id);
    }

    @PostMapping(value = "/{id}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FileView upload(@AuthenticationPrincipal Long user, @PathVariable String id, @RequestPart MultipartFile file) {
        return service.upload(user, id, file);
    }

    @GetMapping("/{id}/files/{fileId}")
    public ResponseEntity<byte[]> download(@AuthenticationPrincipal Long user, @PathVariable String id, @PathVariable String fileId) {
        var file = service.download(user, id, fileId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.metadata().contentType()))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(file.metadata().name(), StandardCharsets.UTF_8).build().toString())
            .header("X-Content-Type-Options", "nosniff").cacheControl(CacheControl.noStore())
            .body(file.content());
    }

    @DeleteMapping("/{id}/files/{fileId}")
    public void deleteFile(@AuthenticationPrincipal Long user, @PathVariable String id, @PathVariable String fileId) {
        service.deleteFile(user, id, fileId);
    }
}
