package com.app.kira.util;

import com.app.kira.tecum.CashFlowDTO;
import com.google.gson.*;

import java.lang.reflect.Type;

public class JsonPayloadAdapter implements JsonSerializer<CashFlowDTO> {
    @Override
    public JsonElement serialize(CashFlowDTO src, Type typeOfSrc, JsonSerializationContext context) {
        JsonObject obj = new JsonObject();
        JsonObject json = new JsonObject();

        if (src.getJson().getCursor() == null) {
            json.add("cursor", JsonNull.INSTANCE);
        } else {
            json.add("cursor", context.serialize(src.getJson().getCursor()));
        }
        json.addProperty("direction", src.getJson().getDirection());
        if (src.getJson().getFilters() != null) {
            json.add("filters", context.serialize(src.getJson().getFilters()));
        }
        obj.add("json", json);
        if (src.getMeta() != null) {
            obj.add("meta", context.serialize(src.getMeta()));
        }
        return obj;
    }
}

