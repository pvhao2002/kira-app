package com.queue.kiraqueue.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record LogoUploadMessage(String entity, int id) {

    public static final String ENTITY_LEAGUE = "league";
    public static final String ENTITY_TEAM = "team";

    public boolean isLeague() {
        return ENTITY_LEAGUE.equalsIgnoreCase(entity);
    }

    public boolean isTeam() {
        return ENTITY_TEAM.equalsIgnoreCase(entity);
    }
}
