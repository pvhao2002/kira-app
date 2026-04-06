package com.db.kiragateway.rest;

import com.db.kiragateway.service.EventClaimService;
import com.db.kiragateway.util.RequestLogUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.logging.Logger;

@RestController
@RequestMapping("/events")
public class EventController {

    private static final Logger log = Logger.getLogger(EventController.class.getName());
    private final EventClaimService eventClaimService;

    public EventController(EventClaimService eventClaimService) {
        this.eventClaimService = eventClaimService;
    }

    @GetMapping("/claim/next")
    public ResponseEntity<?> claimNextEvent(@RequestParam("instanceId") String instanceId,
                                            HttpServletRequest httpReq) {
        log.info("claimNextEvent: instanceId=%s, %s".formatted(instanceId, RequestLogUtil.summary(httpReq)));
        if (!StringUtils.hasText(instanceId)) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "instanceId is required"));
        }

        var claimedEvent = eventClaimService.claimNextEvent(instanceId);
        if (claimedEvent.isEmpty()) {
            log.info("claimNextEvent: no event available for instanceId=%s".formatted(instanceId));
            return ResponseEntity.noContent().build();
        }
        log.info("claimNextEvent: claimed eventId=%d for instanceId=%s".formatted(claimedEvent.get().eventId(), instanceId));
        return ResponseEntity.ok(Map.of("status", "ok", "data", claimedEvent.get()));
    }
}
