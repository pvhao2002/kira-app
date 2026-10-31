package com.kira.news.article;

import com.kira.news.article.ArticleWorkflow.Allowed;
import com.kira.news.article.ArticleWorkflow.Denied;
import com.kira.news.identity.Role;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.kira.news.article.ArticleStatus.*;
import static com.kira.news.article.WorkflowAction.*;
import static org.assertj.core.api.Assertions.assertThat;

class ArticleWorkflowTest {

    @Test
    void aiEditorSubmitsDraftAndRevisionButCannotPublish() {
        assertThat(ArticleWorkflow.decide(DRAFT, SUBMIT, Role.EDITOR)).isEqualTo(new Allowed(IN_REVIEW));
        assertThat(ArticleWorkflow.decide(CHANGES_REQUESTED, SUBMIT, Role.EDITOR)).isEqualTo(new Allowed(IN_REVIEW));
        assertThat(ArticleWorkflow.decide(IN_REVIEW, PUBLISH, Role.EDITOR)).isInstanceOf(Denied.class);
        assertThat(ArticleWorkflow.decide(IN_REVIEW, REQUEST_CHANGES, Role.EDITOR)).isInstanceOf(Denied.class);
    }

    @Test
    void adminReviewLoop() {
        assertThat(ArticleWorkflow.decide(IN_REVIEW, REQUEST_CHANGES, Role.ADMIN)).isEqualTo(new Allowed(CHANGES_REQUESTED));
        assertThat(ArticleWorkflow.decide(IN_REVIEW, PUBLISH, Role.ADMIN)).isEqualTo(new Allowed(PUBLISHED));
        assertThat(ArticleWorkflow.decide(CHANGES_REQUESTED, REJECT, Role.ADMIN)).isEqualTo(new Allowed(REJECTED));
        assertThat(ArticleWorkflow.decide(PUBLISHED, UNPUBLISH, Role.ADMIN)).isEqualTo(new Allowed(ARCHIVED));
    }

    @Test
    void invalidTransitionsAreDenied() {
        assertThat(ArticleWorkflow.decide(DRAFT, PUBLISH, Role.ADMIN)).isInstanceOf(Denied.class);
        assertThat(ArticleWorkflow.decide(PUBLISHED, SUBMIT, Role.ADMIN)).isInstanceOf(Denied.class);
        assertThat(ArticleWorkflow.decide(REJECTED, SUBMIT, Role.EDITOR)).isInstanceOf(Denied.class);
    }

    @Test
    void allowedActionsAndEditability() {
        assertThat(ArticleWorkflow.allowedActions(IN_REVIEW, Role.ADMIN)).containsExactly(REQUEST_CHANGES, PUBLISH, REJECT);
        assertThat(ArticleWorkflow.allowedActions(IN_REVIEW, Role.EDITOR)).isEqualTo(List.of());
        assertThat(ArticleWorkflow.canEdit(CHANGES_REQUESTED, Role.EDITOR)).isTrue();
        assertThat(ArticleWorkflow.canEdit(IN_REVIEW, Role.EDITOR)).isFalse();
        assertThat(ArticleWorkflow.canEdit(PUBLISHED, Role.ADMIN)).isTrue();
        assertThat(ArticleWorkflow.canEdit(PUBLISHED, Role.EDITOR)).isFalse();
    }
}
