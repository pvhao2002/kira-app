package com.kira.news.article;

import com.kira.news.identity.Role;

import java.util.Arrays;
import java.util.List;

import static com.kira.news.article.ArticleStatus.*;

/** The review state machine: the AI editor writes and submits, only the admin decides. */
public final class ArticleWorkflow {
    private ArticleWorkflow() {
    }

    public sealed interface Decision permits Allowed, Denied {
    }

    public record Allowed(ArticleStatus next) implements Decision {
    }

    public record Denied(String reason) implements Decision {
    }

    public static Decision decide(ArticleStatus from, WorkflowAction action, Role role) {
        if (action != WorkflowAction.SUBMIT && role != Role.ADMIN) {
            return new Denied("Chỉ quản trị viên được thực hiện " + action);
        }
        return switch (action) {
            case SUBMIT -> from == DRAFT || from == CHANGES_REQUESTED ? new Allowed(IN_REVIEW) : denied(from, action);
            case REQUEST_CHANGES -> from == IN_REVIEW ? new Allowed(CHANGES_REQUESTED) : denied(from, action);
            case PUBLISH -> from == IN_REVIEW ? new Allowed(PUBLISHED) : denied(from, action);
            case REJECT -> from == IN_REVIEW || from == CHANGES_REQUESTED ? new Allowed(REJECTED) : denied(from, action);
            case UNPUBLISH -> from == PUBLISHED ? new Allowed(ARCHIVED) : denied(from, action);
        };
    }

    public static List<WorkflowAction> allowedActions(ArticleStatus from, Role role) {
        return Arrays.stream(WorkflowAction.values())
                .filter(action -> decide(from, action, role) instanceof Allowed)
                .toList();
    }

    public static boolean canEdit(ArticleStatus status, Role role) {
        return switch (status) {
            case DRAFT, CHANGES_REQUESTED -> true;
            case IN_REVIEW, PUBLISHED -> role == Role.ADMIN;
            case REJECTED, ARCHIVED -> false;
        };
    }

    private static Denied denied(ArticleStatus from, WorkflowAction action) {
        return new Denied("Không thể " + action + " khi bài đang ở trạng thái " + from);
    }
}
