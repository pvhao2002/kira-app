package com.kira.news.article;

public enum WorkflowAction {
    SUBMIT, REQUEST_CHANGES, PUBLISH, REJECT, UNPUBLISH;

    public com.kira.news.proto.v1.WorkflowAction toProto() {
        return com.kira.news.proto.v1.WorkflowAction.valueOf(name());
    }
}
