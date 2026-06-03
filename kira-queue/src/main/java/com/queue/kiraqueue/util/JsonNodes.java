package com.queue.kiraqueue.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

public final class JsonNodes {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private JsonNodes() {
    }

    public static ObjectNode emptyObject() {
        return MAPPER.createObjectNode();
    }
}
