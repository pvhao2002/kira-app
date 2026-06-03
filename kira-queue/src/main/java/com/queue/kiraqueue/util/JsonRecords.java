package com.queue.kiraqueue.util;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public final class JsonRecords {

    private JsonRecords() {
    }

    public static JsonNode asRecord(JsonNode value) {
        return value != null && value.isObject() ? value : JsonNodes.emptyObject();
    }

    public static List<JsonNode> asArray(JsonNode value) {
        if (value == null || value.isNull()) {
            return List.of();
        }
        if (value.isArray()) {
            var items = new ArrayList<JsonNode>();
            value.forEach(items::add);
            return items;
        }
        if (value.isObject()) {
            var items = new ArrayList<JsonNode>();
            Iterator<Map.Entry<String, JsonNode>> fields = value.fields();
            while (fields.hasNext()) {
                items.add(fields.next().getValue());
            }
            return items;
        }
        return List.of();
    }

    public static List<Integer> numberArray(JsonNode value) {
        return asArray(value).stream()
                .filter(JsonNode::isNumber)
                .map(JsonNode::asInt)
                .toList();
    }

    public static List<String> stringArray(JsonNode value) {
        return asArray(value).stream()
                .filter(JsonNode::isTextual)
                .map(JsonNode::asText)
                .toList();
    }

    public static String stringValue(JsonNode value) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isTextual()) {
            return value.asText();
        }
        if (value.isNumber() || value.isBoolean()) {
            return value.asText();
        }
        return null;
    }

    public static Integer numberValue(JsonNode value) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isNumber()) {
            return value.asInt();
        }
        if (value.isTextual()) {
            try {
                return Integer.parseInt(value.asText());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }

    public static JsonNode findById(JsonNode values, String id) {
        if (id == null) {
            return JsonNodes.emptyObject();
        }
        return asArray(values).stream()
                .filter(item -> id.equals(stringValue(asRecord(item).get("id"))))
                .findFirst()
                .orElse(JsonNodes.emptyObject());
    }

    public static String entityId(JsonNode value) {
        return stringValue(asRecord(value).get("id"));
    }

    public static boolean isEmptyObject(JsonNode value) {
        return value == null || value.isNull() || (value.isObject() && value.isEmpty());
    }
}
