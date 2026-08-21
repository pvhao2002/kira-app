package com.kira.bank.lodging.web;

import com.kira.bank.attachment.R2StorageService;
import com.kira.bank.attachment.domain.Attachment;
import com.kira.bank.lodging.application.LodgingDtos.*;
import com.kira.bank.lodging.application.LodgingService;
import com.kira.bank.shared.web.ApiTypes.PageMeta;
import com.kira.bank.shared.web.ApiTypes.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController @RequestMapping("/api/v1/lodgings") @RequiredArgsConstructor
public class LodgingController {
    private final LodgingService service;
    private final R2StorageService storage;
    @GetMapping PageResponse<ListingResponse> page(@AuthenticationPrincipal Long user, @RequestParam(defaultValue = "") String search, @PageableDefault(size = 20) Pageable pageable) { Page<ListingResponse> page = service.page(user, search, pageable); return new PageResponse<>(page.getContent(), new PageMeta(page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages())); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) ListingResponse create(@AuthenticationPrincipal Long user, @Valid @RequestBody ListingRequest request) { ListingResponse created = service.create(user, request); service.tryRecalculate(user, created.id()); return service.detail(user, created.id()); }
    @GetMapping("/{id}") ListingResponse detail(@AuthenticationPrincipal Long user, @PathVariable Long id) { return service.detail(user, id); }
    @PutMapping("/{id}") ListingResponse update(@AuthenticationPrincipal Long user, @PathVariable Long id, @Valid @RequestBody ListingRequest request) { ListingResponse updated = service.update(user, id, request); service.tryRecalculate(user, id); return service.detail(user, updated.id()); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) void delete(@AuthenticationPrincipal Long user, @PathVariable Long id) { service.delete(user, id); }
    @PostMapping("/{id}/distances/recalculate") ListingResponse recalculate(@AuthenticationPrincipal Long user, @PathVariable Long id) { service.tryRecalculate(user, id); return service.detail(user, id); }
    @PostMapping(value = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED) ImageResponse upload(@AuthenticationPrincipal Long user, @PathVariable Long id, @RequestPart("file") MultipartFile file) throws IOException { return service.uploadImage(user, id, file); }
    @DeleteMapping("/{id}/images/{attachmentId}") @ResponseStatus(HttpStatus.NO_CONTENT) void deleteImage(@AuthenticationPrincipal Long user, @PathVariable Long id, @PathVariable Long attachmentId) { service.deleteImage(user, id, attachmentId); }
    @GetMapping("/{id}/images/{attachmentId}/content") ResponseEntity<byte[]> content(@AuthenticationPrincipal Long user, @PathVariable Long id, @PathVariable Long attachmentId) { Attachment attachment = service.content(user, id, attachmentId); byte[] bytes = storage.download(attachment.getR2AccountId(), attachment.getStorageKey()); return ResponseEntity.ok().contentType(MediaType.parseMediaType(attachment.getMimeType())).header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(attachment.getOriginalName(), StandardCharsets.UTF_8).build().toString()).body(bytes); }
    @PutMapping("/{id}/reviews/me") ReviewResponse review(@AuthenticationPrincipal Long user, @PathVariable Long id, @Valid @RequestBody ReviewRequest request) { return service.review(user, id, request); }
    @GetMapping("/{id}/reviews") List<ReviewResponse> reviews(@AuthenticationPrincipal Long user, @PathVariable Long id) { return service.reviews(user, id); }
    @GetMapping("/reference-locations") List<ReferenceLocationResponse> locations(@AuthenticationPrincipal Long user) { return service.locations(user); }
    @GetMapping("/address-suggestions") List<AddressSuggestionResponse> addressSuggestions(@RequestParam String q) { return service.addressSuggestions(q); }
    @PostMapping("/reference-locations") @ResponseStatus(HttpStatus.CREATED) ReferenceLocationResponse createLocation(@AuthenticationPrincipal Long user, @Valid @RequestBody ReferenceLocationRequest request) { ReferenceLocationResponse created = service.createLocation(user, request); service.tryGeocodeLocation(user, created.id()); return service.locations(user).stream().filter(value -> value.id().equals(created.id())).findFirst().orElseThrow(); }
    @PutMapping("/reference-locations/{id}") ReferenceLocationResponse updateLocation(@AuthenticationPrincipal Long user, @PathVariable Long id, @Valid @RequestBody ReferenceLocationRequest request) { ReferenceLocationResponse updated = service.updateLocation(user, id, request); if (updated.geocodeStatus().name().equals("PENDING")) service.tryGeocodeLocation(user, id); return service.locations(user).stream().filter(value -> value.id().equals(id)).findFirst().orElseThrow(); }
    @DeleteMapping("/reference-locations/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) void deleteLocation(@AuthenticationPrincipal Long user, @PathVariable Long id) { service.deleteLocation(user, id); }
    @PostMapping("/reference-locations/{id}/geocode") ReferenceLocationResponse geocode(@AuthenticationPrincipal Long user, @PathVariable Long id) { service.tryGeocodeLocation(user, id); return service.locations(user).stream().filter(value -> value.id().equals(id)).findFirst().orElseThrow(); }
}
