package com.kira.news.identity;

/** ADMIN = the owner who reviews and publishes; EDITOR = the AI agent account that writes drafts. */
public enum Role {
    ADMIN, EDITOR;

    public com.kira.news.proto.v1.Role toProto() {
        return com.kira.news.proto.v1.Role.valueOf("ROLE_" + name());
    }
}
