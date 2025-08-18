package com.app.kira.util;

import lombok.experimental.UtilityClass;

@UtilityClass
public class OddConverter {

    public static Double parse(String value) {
        try {
            return Double.parseDouble(value);
        } catch (Exception ex) {
            return 0.0;
        }
    }

    public static double convertLine(String line) {
        line = line.trim();

        // Xác định dấu (chỉ HDC mới có + hoặc - ở đầu)
        double sign = 1.0;
        if (line.startsWith("+")) {
            line = line.substring(1);
        } else if (line.startsWith("-")) {
            sign = -1.0;
            line = line.substring(1);
        }

        // Nếu có dạng phân số a/b
        if (line.contains("/")) {
            String[] parts = line.split("/");
            if (parts.length == 2) {
                double a = Double.parseDouble(parts[0]);
                double b = Double.parseDouble(parts[1]);
                return sign * (a + b) / 2.0;
            } else {
                throw new IllegalArgumentException("Sai định dạng line: " + line);
            }
        }

        // Nếu chỉ là 1 số
        return sign * Double.parseDouble(line);
    }

    public String compareOdds(Double first, Double second) {
        if (first.equals(second)) {
            return "=";
        } else if (first < second) {
            return "<";
        }
        return ">";
    }
}
