package com.db.kiragateway.travelchecklist;

import com.db.kiragateway.travelchecklist.dto.CreateTravelChecklistGroupRequest;
import com.db.kiragateway.travelchecklist.dto.CreateTravelChecklistItemRequest;
import com.db.kiragateway.travelchecklist.dto.CreateTravelChecklistPlanRequest;
import com.db.kiragateway.travelchecklist.dto.TravelChecklistGroupResponse;
import com.db.kiragateway.travelchecklist.dto.TravelChecklistItemResponse;
import com.db.kiragateway.travelchecklist.dto.TravelChecklistPlanResponse;
import com.db.kiragateway.travelchecklist.dto.UpdateTravelChecklistGroupRequest;
import com.db.kiragateway.travelchecklist.dto.UpdateTravelChecklistItemRequest;
import com.db.kiragateway.travelchecklist.dto.UpdateTravelChecklistPlanRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;

@Service
public class TravelChecklistService {
    private static final String CHECK_LIST_TITLE = "Check List";

    private final TravelChecklistRepository repo;

    public TravelChecklistService(TravelChecklistRepository repo) {
        this.repo = repo;
    }

    public List<TravelChecklistPlanResponse> list(int userId) {
        var plans = repo.findPlans(userId);
        return plans.stream()
                .map(plan -> toPlanResponse(plan, repo.findGroups(plan.planId(), userId), repo.findItems(plan.planId(), userId)))
                .toList();
    }

    public List<TravelChecklistPlanResponse> listPublished() {
        var plans = repo.findPublishedPlans();
        return plans.stream()
                .map(plan -> toPlanResponse(plan, repo.findPublishedGroups(plan.planId()), repo.findPublishedItems(plan.planId())))
                .toList();
    }

    public TravelChecklistPlanResponse createPlan(int userId, CreateTravelChecklistPlanRequest req) {
        String planName = requiredText(req.planName(), "Plan name is required");
        long planId = repo.insertPlan(userId, planName);
        repo.insertGroup(normalizeGroup(
                0L,
                planId,
                TravelChecklistScheduleType.CHECK_LIST,
                null,
                null,
                null,
                CHECK_LIST_TITLE,
                0,
                null,
                null
        ));
        return getPlan(userId, planId);
    }

    public TravelChecklistPlanResponse updatePlan(int userId, long planId, UpdateTravelChecklistPlanRequest req) {
        var existing = findPlanOrThrow(userId, planId);
        String planName = req.planName() != null ? requiredText(req.planName(), "Plan name is required") : existing.planName();
        boolean published = req.published() != null ? req.published() : existing.published();
        int n = repo.updatePlan(planId, userId, planName, published);
        if (n == 0) {
            throw notFound("Plan not found");
        }
        return getPlan(userId, planId);
    }

    public void deletePlan(int userId, long planId) {
        int n = repo.deletePlan(planId, userId);
        if (n == 0) {
            throw notFound("Plan not found");
        }
    }

    public TravelChecklistGroupResponse createGroup(int userId, long planId, CreateTravelChecklistGroupRequest req) {
        findPlanOrThrow(userId, planId);
        if (req.scheduleType() == TravelChecklistScheduleType.CHECK_LIST && hasCheckListGroup(planId, userId, null)) {
            throw badRequest("Check List group already exists");
        }
        var normalized = normalizeGroup(
                0L,
                planId,
                req.scheduleType(),
                req.scheduleDate(),
                req.startTime(),
                req.endTime(),
                req.title(),
                req.sortOrder() != null ? req.sortOrder() : 0,
                null,
                null
        );
        long groupId = repo.insertGroup(normalized);
        var group = repo.findGroup(planId, groupId, userId).orElseThrow();
        return toGroupResponse(group, List.of());
    }

    public TravelChecklistGroupResponse updateGroup(int userId, long planId, long groupId, UpdateTravelChecklistGroupRequest req) {
        findPlanOrThrow(userId, planId);
        var existing = repo.findGroup(planId, groupId, userId)
                .orElseThrow(() -> notFound("Group not found"));
        var type = req.scheduleType() != null ? req.scheduleType() : existing.scheduleType();
        if (type == TravelChecklistScheduleType.CHECK_LIST && hasCheckListGroup(planId, userId, groupId)) {
            throw badRequest("Check List group already exists");
        }
        var row = normalizeGroup(
                existing.groupId(),
                existing.planId(),
                type,
                req.scheduleDate() != null ? req.scheduleDate() : existing.scheduleDate(),
                req.startTime() != null ? req.startTime() : existing.startTime(),
                req.endTime() != null ? req.endTime() : existing.endTime(),
                req.title() != null ? req.title() : existing.title(),
                req.sortOrder() != null ? req.sortOrder() : existing.sortOrder(),
                existing.createdAt(),
                existing.updatedAt()
        );
        int n = repo.updateGroup(row);
        if (n == 0) {
            throw notFound("Group not found");
        }
        var items = repo.findItems(planId, userId).stream()
                .filter(item -> item.groupId() == groupId)
                .toList();
        return toGroupResponse(repo.findGroup(planId, groupId, userId).orElseThrow(), items);
    }

    public void deleteGroup(int userId, long planId, long groupId) {
        findPlanOrThrow(userId, planId);
        var group = repo.findGroup(planId, groupId, userId).orElseThrow(() -> notFound("Group not found"));
        if (group.scheduleType() == TravelChecklistScheduleType.CHECK_LIST) {
            throw badRequest("Check List group cannot be deleted");
        }
        int n = repo.deleteGroup(planId, groupId);
        if (n == 0) {
            throw notFound("Group not found");
        }
    }

    public TravelChecklistItemResponse createItem(int userId, long planId, long groupId, CreateTravelChecklistItemRequest req) {
        findPlanOrThrow(userId, planId);
        var group = repo.findGroup(planId, groupId, userId).orElseThrow(() -> notFound("Group not found"));
        String activity = requiredText(req.activity(), "Activity is required");
        var row = new TravelChecklistItemRow(
                0L,
                groupId,
                group.scheduleType() == TravelChecklistScheduleType.CHECK_LIST ? null : req.activityTime(),
                activity,
                group.scheduleType() == TravelChecklistScheduleType.CHECK_LIST ? null : optionalText(req.address()),
                group.scheduleType() == TravelChecklistScheduleType.CHECK_LIST ? null : normalizeCost(req.cost()),
                group.scheduleType() == TravelChecklistScheduleType.CHECK_LIST ? null : optionalText(req.note()),
                req.checked() != null && req.checked(),
                req.sortOrder() != null ? req.sortOrder() : 0,
                null,
                null
        );
        long itemId = repo.insertItem(planId, row);
        return toItemResponse(repo.findItem(planId, groupId, itemId, userId).orElseThrow());
    }

    public TravelChecklistItemResponse updateItem(int userId, long planId, long groupId, long itemId, UpdateTravelChecklistItemRequest req) {
        findPlanOrThrow(userId, planId);
        var group = repo.findGroup(planId, groupId, userId).orElseThrow(() -> notFound("Group not found"));
        var existing = repo.findItem(planId, groupId, itemId, userId).orElseThrow(() -> notFound("Item not found"));
        String activity = req.activity() != null ? requiredText(req.activity(), "Activity is required") : existing.activity();
        boolean checkListGroup = group.scheduleType() == TravelChecklistScheduleType.CHECK_LIST;
        var merged = new TravelChecklistItemRow(
                existing.itemId(),
                existing.groupId(),
                checkListGroup ? null : req.activityTime() != null ? req.activityTime() : existing.activityTime(),
                activity,
                checkListGroup ? null : req.address() != null ? optionalText(req.address()) : existing.address(),
                checkListGroup ? null : req.cost() != null ? normalizeCost(req.cost()) : existing.cost(),
                checkListGroup ? null : req.note() != null ? optionalText(req.note()) : existing.note(),
                req.checked() != null ? req.checked() : existing.checked(),
                req.sortOrder() != null ? req.sortOrder() : existing.sortOrder(),
                existing.createdAt(),
                existing.updatedAt()
        );
        int n = repo.updateItem(planId, merged);
        if (n == 0) {
            throw notFound("Item not found");
        }
        return toItemResponse(repo.findItem(planId, groupId, itemId, userId).orElseThrow());
    }

    public void deleteItem(int userId, long planId, long groupId, long itemId) {
        findPlanOrThrow(userId, planId);
        repo.findGroup(planId, groupId, userId).orElseThrow(() -> notFound("Group not found"));
        repo.findItem(planId, groupId, itemId, userId).orElseThrow(() -> notFound("Item not found"));
        int n = repo.deleteItem(planId, groupId, itemId);
        if (n == 0) {
            throw notFound("Item not found");
        }
    }

    private TravelChecklistPlanResponse getPlan(int userId, long planId) {
        var plan = findPlanOrThrow(userId, planId);
        return toPlanResponse(plan, repo.findGroups(planId, userId), repo.findItems(planId, userId));
    }

    private TravelChecklistPlanRow findPlanOrThrow(int userId, long planId) {
        return repo.findPlan(planId, userId).orElseThrow(() -> notFound("Plan not found"));
    }

    private TravelChecklistGroupRow normalizeGroup(
            long groupId,
            long planId,
            TravelChecklistScheduleType type,
            LocalDate scheduleDate,
            LocalTime startTime,
            LocalTime endTime,
            String title,
            int sortOrder,
            java.time.LocalDateTime createdAt,
            java.time.LocalDateTime updatedAt
    ) {
        if (type == null) {
            throw badRequest("Schedule type is required");
        }
        String normalizedTitle = requiredText(title, "Group title is required");
        if (type == TravelChecklistScheduleType.CHECK_LIST) {
            return new TravelChecklistGroupRow(groupId, planId, type, null, null, null, normalizedTitle, sortOrder, createdAt, updatedAt);
        }
        if (type == TravelChecklistScheduleType.DAY) {
            if (scheduleDate == null) {
                throw badRequest("Schedule date is required for DAY groups");
            }
            return new TravelChecklistGroupRow(groupId, planId, type, scheduleDate, null, null, normalizedTitle, sortOrder, createdAt, updatedAt);
        }
        if (startTime == null || endTime == null) {
            throw badRequest("Start time and end time are required for TIME_SLOT groups");
        }
        if (!endTime.isAfter(startTime)) {
            throw badRequest("End time must be after start time");
        }
        return new TravelChecklistGroupRow(groupId, planId, type, null, startTime, endTime, normalizedTitle, sortOrder, createdAt, updatedAt);
    }

    private TravelChecklistPlanResponse toPlanResponse(
            TravelChecklistPlanRow plan,
            List<TravelChecklistGroupRow> groups,
            List<TravelChecklistItemRow> items
    ) {
        var groupResponses = groups.stream()
                .sorted(Comparator.comparingInt(this::groupTypeRank)
                        .thenComparingInt(TravelChecklistGroupRow::sortOrder)
                        .thenComparingLong(TravelChecklistGroupRow::groupId))
                .map(group -> toGroupResponse(group, items.stream()
                        .filter(item -> item.groupId() == group.groupId())
                        .sorted(itemComparator())
                        .toList()))
                .toList();
        return new TravelChecklistPlanResponse(
                plan.planId(),
                plan.planName(),
                plan.published(),
                groupResponses,
                plan.createdAt(),
                plan.updatedAt()
        );
    }

    private TravelChecklistGroupResponse toGroupResponse(TravelChecklistGroupRow group, List<TravelChecklistItemRow> items) {
        return new TravelChecklistGroupResponse(
                group.groupId(),
                group.scheduleType(),
                group.scheduleDate(),
                group.startTime(),
                group.endTime(),
                group.title(),
                group.sortOrder(),
                items.stream().map(this::toItemResponse).toList(),
                group.createdAt(),
                group.updatedAt()
        );
    }

    private TravelChecklistItemResponse toItemResponse(TravelChecklistItemRow item) {
        return new TravelChecklistItemResponse(
                item.itemId(),
                item.activityTime(),
                item.activity(),
                item.address(),
                item.cost(),
                item.note(),
                item.checked(),
                item.sortOrder(),
                item.createdAt(),
                item.updatedAt()
        );
    }

    private boolean hasCheckListGroup(long planId, int userId, Long ignoredGroupId) {
        return repo.findGroups(planId, userId).stream()
                .anyMatch(group -> group.scheduleType() == TravelChecklistScheduleType.CHECK_LIST
                        && (ignoredGroupId == null || group.groupId() != ignoredGroupId));
    }

    private int groupTypeRank(TravelChecklistGroupRow group) {
        return group.scheduleType() == TravelChecklistScheduleType.CHECK_LIST ? 0 : 1;
    }

    private Comparator<TravelChecklistItemRow> itemComparator() {
        return Comparator
                .comparing(TravelChecklistItemRow::activityTime, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparingInt(TravelChecklistItemRow::sortOrder)
                .thenComparingLong(TravelChecklistItemRow::itemId);
    }

    private static String requiredText(String raw, String message) {
        if (raw == null || raw.isBlank()) {
            throw badRequest(message);
        }
        return raw.trim();
    }

    private static String optionalText(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }

    private static BigDecimal normalizeCost(BigDecimal cost) {
        if (cost == null) {
            return null;
        }
        if (cost.signum() < 0) {
            throw badRequest("Cost must be greater than or equal to 0");
        }
        return cost;
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
