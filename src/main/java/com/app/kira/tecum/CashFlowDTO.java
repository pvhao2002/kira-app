package com.app.kira.tecum;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CashFlowDTO {
    private JsonPayload json = new JsonPayload();
    private List<List<Object>> meta = List.of(List.of(1, "cursor", "createdAt"));

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class JsonPayload {
        private Map<?, ?> filters = new HashMap<>();
        private final String direction = "NEXT";
        private Cursor cursor = null;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Cursor {
        private String createdAt;
        private String id;
    }
}
