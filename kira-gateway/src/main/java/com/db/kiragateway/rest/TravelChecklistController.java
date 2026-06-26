package com.db.kiragateway.rest;

import com.db.kiragateway.travelchecklist.TravelChecklistService;
import com.db.kiragateway.travelchecklist.dto.CreateTravelChecklistGroupRequest;
import com.db.kiragateway.travelchecklist.dto.CreateTravelChecklistItemRequest;
import com.db.kiragateway.travelchecklist.dto.CreateTravelChecklistPlanRequest;
import com.db.kiragateway.travelchecklist.dto.TravelChecklistGroupResponse;
import com.db.kiragateway.travelchecklist.dto.TravelChecklistItemResponse;
import com.db.kiragateway.travelchecklist.dto.TravelChecklistPlanResponse;
import com.db.kiragateway.travelchecklist.dto.UpdateTravelChecklistGroupRequest;
import com.db.kiragateway.travelchecklist.dto.UpdateTravelChecklistItemRequest;
import com.db.kiragateway.travelchecklist.dto.UpdateTravelChecklistPlanRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/travel-checklists")
public class TravelChecklistController {

    private final TravelChecklistService service;

    public TravelChecklistController(TravelChecklistService service) {
        this.service = service;
    }

    @GetMapping
    public List<TravelChecklistPlanResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(currentUserId(jwt));
    }

    @GetMapping("/public")
    public List<TravelChecklistPlanResponse> listPublished() {
        return service.listPublished();
    }

    @PostMapping
    public ResponseEntity<TravelChecklistPlanResponse> createPlan(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateTravelChecklistPlanRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createPlan(currentUserId(jwt), request));
    }

    @PatchMapping("/{planId:\\d+}")
    public TravelChecklistPlanResponse updatePlan(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long planId,
            @Valid @RequestBody UpdateTravelChecklistPlanRequest request
    ) {
        return service.updatePlan(currentUserId(jwt), planId, request);
    }

    @DeleteMapping("/{planId:\\d+}")
    public ResponseEntity<Void> deletePlan(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long planId
    ) {
        service.deletePlan(currentUserId(jwt), planId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{planId:\\d+}/groups")
    public ResponseEntity<TravelChecklistGroupResponse> createGroup(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long planId,
            @Valid @RequestBody CreateTravelChecklistGroupRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createGroup(currentUserId(jwt), planId, request));
    }

    @PatchMapping("/{planId:\\d+}/groups/{groupId:\\d+}")
    public TravelChecklistGroupResponse updateGroup(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long planId,
            @PathVariable long groupId,
            @Valid @RequestBody UpdateTravelChecklistGroupRequest request
    ) {
        return service.updateGroup(currentUserId(jwt), planId, groupId, request);
    }

    @DeleteMapping("/{planId:\\d+}/groups/{groupId:\\d+}")
    public ResponseEntity<Void> deleteGroup(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long planId,
            @PathVariable long groupId
    ) {
        service.deleteGroup(currentUserId(jwt), planId, groupId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{planId:\\d+}/groups/{groupId:\\d+}/items")
    public ResponseEntity<TravelChecklistItemResponse> createItem(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long planId,
            @PathVariable long groupId,
            @Valid @RequestBody CreateTravelChecklistItemRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createItem(currentUserId(jwt), planId, groupId, request));
    }

    @PatchMapping("/{planId:\\d+}/groups/{groupId:\\d+}/items/{itemId:\\d+}")
    public TravelChecklistItemResponse updateItem(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long planId,
            @PathVariable long groupId,
            @PathVariable long itemId,
            @Valid @RequestBody UpdateTravelChecklistItemRequest request
    ) {
        return service.updateItem(currentUserId(jwt), planId, groupId, itemId, request);
    }

    @DeleteMapping("/{planId:\\d+}/groups/{groupId:\\d+}/items/{itemId:\\d+}")
    public ResponseEntity<Void> deleteItem(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long planId,
            @PathVariable long groupId,
            @PathVariable long itemId
    ) {
        service.deleteItem(currentUserId(jwt), planId, groupId, itemId);
        return ResponseEntity.noContent().build();
    }

    private static int currentUserId(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        var uid = jwt.getClaim("uid");
        if (uid instanceof Number n && n.intValue() > 0) {
            return n.intValue();
        }
        throw new IllegalArgumentException("Missing user id in token");
    }
}
