package com.queue.kiraqueue.util;

import lombok.experimental.UtilityClass;

@UtilityClass
public class StringUtil {
    public static String normalizeText(String text) {
        if (text == null) return "";

        return text
                .replace('\u00A0', ' ')
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase();
    }
}
