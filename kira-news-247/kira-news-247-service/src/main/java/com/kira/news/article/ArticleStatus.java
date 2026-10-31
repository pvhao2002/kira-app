package com.kira.news.article;

public enum ArticleStatus {
    DRAFT, IN_REVIEW, CHANGES_REQUESTED, PUBLISHED, REJECTED, ARCHIVED;

    public com.kira.news.proto.v1.ArticleStatus toProto() {
        return com.kira.news.proto.v1.ArticleStatus.valueOf(name());
    }
}
