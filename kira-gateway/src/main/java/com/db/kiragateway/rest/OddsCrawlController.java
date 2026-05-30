package com.db.kiragateway.rest;

import com.db.kiragateway.dto.crawl.CrawlOddsResultRequest;
import com.db.kiragateway.service.OddsCrawlCallbackService;
import com.db.kiragateway.service.OddsCrawlClaimService;
import com.db.kiragateway.util.RequestLogUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.logging.Logger;

@RestController
@RequestMapping("/crawl/odds")
public class OddsCrawlController {

    private static final Logger log = Logger.getLogger(OddsCrawlController.class.getName());
    private final OddsCrawlClaimService claimService;
    private final OddsCrawlCallbackService callbackService;

    public OddsCrawlController(OddsCrawlClaimService claimService,
                               OddsCrawlCallbackService callbackService) {
        this.claimService = claimService;
        this.callbackService = callbackService;
    }

    @GetMapping("/claim/next")
    public ResponseEntity<?> claimNextOddsEvent(@RequestParam("instanceId") String instanceId,
                                                HttpServletRequest httpReq) {
        log.info("claimNextOddsEvent: instanceId=%s, %s".formatted(instanceId, RequestLogUtil.summary(httpReq)));
        if (!StringUtils.hasText(instanceId)) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "instanceId is required"));
        }

        var claimedEvent = claimService.claimNextOddsEvent(instanceId);
        if (claimedEvent.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(Map.of("status", "ok", "data", claimedEvent.get()));
    }

    @PostMapping("/events/{eventId}/result")
    public ResponseEntity<?> persistOddsCrawlResult(@PathVariable long eventId,
                                                      @RequestBody CrawlOddsResultRequest req,
                                                      HttpServletRequest httpReq) {
        log.info("persistOddsCrawlResult: eventId=%d, matchId=%s, %s"
                .formatted(eventId, req.matchId(), RequestLogUtil.summary(httpReq)));
        callbackService.persistOddsCrawlResult(eventId, req);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
