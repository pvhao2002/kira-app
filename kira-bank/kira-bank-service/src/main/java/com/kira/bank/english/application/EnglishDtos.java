package com.kira.bank.english.application;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

public final class EnglishDtos {
    private EnglishDtos() {
    }

    public enum Kind {STANDUP, WEEKLY, BIWEEKLY, INTERVIEW}

    public enum Category {JAVA_CORE, SPRING, DATABASE, ANGULAR, SYSTEM_DESIGN, PROJECT}

    public record RewriteRequest(@NotNull Kind kind, @NotNull String notes, String question, Category category) {
    }

    public record Sentence(String section, String en, String vi) {
    }

    public record KeyPhrase(String en, String vi) {
    }

    public record RewriteResult(String title, List<Sentence> sentences, List<KeyPhrase> keyPhrases) {
    }

    public record Rewrite(String id, Kind kind, Category category, String question, String notes, String title,
                          List<Sentence> sentences, List<KeyPhrase> keyPhrases, Instant createdAt) {
    }

    public record RewriteSummary(String id, Kind kind, String title, Instant createdAt) {
    }
}
