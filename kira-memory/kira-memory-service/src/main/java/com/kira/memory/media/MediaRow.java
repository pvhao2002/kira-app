package com.kira.memory.media;

import java.time.LocalDateTime;

public record MediaRow(long id, String kind, String provider, String objectKey, String thumbKey, String contentType,
                       long sizeBytes, Integer width, Integer height, String caption, Long groupId, LocalDateTime takenAt,
                       LocalDateTime createdAt) {
}
