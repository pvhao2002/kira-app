package com.queue.kiraqueue.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SettleJobMessage(long eventId) {
}
