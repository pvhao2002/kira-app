package com.app.kira.util;

import com.app.kira.tecum.CashFlowDTO;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonSyntaxException;
import lombok.experimental.UtilityClass;
import lombok.extern.java.Log;

import java.util.logging.Level;

@Log
@UtilityClass
public class JsonUtil {

    public static final Gson gson = new GsonBuilder()
            .registerTypeAdapter(CashFlowDTO.class, new JsonPayloadAdapter())
            .create();

    public static <T> T fromJson(String json, Class<T> clazz) {
        try {
            return gson.fromJson(json, clazz);
        } catch (JsonSyntaxException e) {
            log.log(Level.WARNING, "JsonUtil >> fromJson: Invalid JSON syntax: " + json, e);
            return null;
        }
    }

    public static String toJson(Object obj) {
        try {
            return gson.toJson(obj);
        } catch (Exception e) {
            log.log(Level.WARNING, "JsonUtil >> toJson: Error converting object to JSON: " + obj, e);
            return "";
        }
    }
}

