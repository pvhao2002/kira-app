package com.kira.affiliate.link.web;

import com.kira.affiliate.link.application.CampaignService;
import com.kira.affiliate.link.application.CampaignService.Campaign;
import com.kira.affiliate.link.application.CampaignService.CampaignRequest;
import com.kira.affiliate.link.application.LinkService;
import com.kira.affiliate.link.application.LinkService.ConvertRequest;
import com.kira.affiliate.link.application.LinkService.ConvertResult;
import com.kira.affiliate.link.application.LinkService.Filter;
import com.kira.affiliate.link.application.LinkService.Link;
import com.kira.affiliate.shared.web.ApiTypes.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class LinkController {
    private final LinkService links;
    private final CampaignService campaigns;

    public record ConvertResponse(List<ConvertResult> results) {
    }

    @PostMapping("/links/convert")
    public ConvertResponse convert(@AuthenticationPrincipal Long userId, @Valid @RequestBody ConvertRequest request) {
        return new ConvertResponse(links.convert(userId, request));
    }

    @GetMapping("/links")
    public PageResponse<Link> list(@AuthenticationPrincipal Long userId,
                                   @RequestParam(required = false) @Size(max = 200) String search,
                                   @RequestParam(required = false) @Pattern(regexp = "OK|FAILED|") String status,
                                   @RequestParam(required = false) Long campaignId,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                   @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                   @RequestParam(defaultValue = "createdAt,desc") @Pattern(regexp = "createdAt,(asc|desc)") String sort) {
        return links.list(userId, new Filter(search, status, campaignId, from, to), page, size, sort.endsWith(",asc"));
    }

    @GetMapping("/links/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal Long userId,
                                         @RequestParam(required = false) @Size(max = 200) String search,
                                         @RequestParam(required = false) @Pattern(regexp = "OK|FAILED|") String status,
                                         @RequestParam(required = false) Long campaignId,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return links.export(userId, new Filter(search, status, campaignId, from, to)).download("lien-ket-affiliate.csv");
    }

    @DeleteMapping("/links/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Long userId, @PathVariable long id) {
        links.delete(userId, id);
    }

    @GetMapping("/campaigns")
    public List<Campaign> campaigns(@AuthenticationPrincipal Long userId) {
        return campaigns.list(userId);
    }

    @PostMapping("/campaigns")
    @ResponseStatus(HttpStatus.CREATED)
    public Campaign createCampaign(@AuthenticationPrincipal Long userId, @Valid @RequestBody CampaignRequest request) {
        return campaigns.create(userId, request);
    }

    @PutMapping("/campaigns/{id}")
    public Campaign updateCampaign(@AuthenticationPrincipal Long userId, @PathVariable long id,
                                   @Valid @RequestBody CampaignRequest request) {
        return campaigns.update(userId, id, request);
    }

    @DeleteMapping("/campaigns/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCampaign(@AuthenticationPrincipal Long userId, @PathVariable long id) {
        campaigns.delete(userId, id);
    }
}
