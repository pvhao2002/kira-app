package kira.crawl.app.util;

import lombok.experimental.UtilityClass;
import org.springframework.util.StringUtils;

@UtilityClass
public class OddConverter {

    public static Double parse(String value) {
        try {
            return Double.parseDouble(value);
        } catch (Exception ex) {
            return null;
        }
    }

    public static double convertLine(String line) {
        if (!StringUtils.hasText(line)) return 0;
        line = line.trim();

        double sign = 1.0;
        if (line.startsWith("+")) {
            line = line.substring(1);
        } else if (line.startsWith("-")) {
            sign = -1.0;
            line = line.substring(1);
        }

        if (line.contains("/")) {
            String[] parts = line.split("/");
            if (parts.length == 2) {
                double a = Double.parseDouble(parts[0]);
                double b = Double.parseDouble(parts[1]);
                return sign * (a + b) / 2.0;
            }
            throw new IllegalArgumentException("Invalid line format: " + line);
        }
        return sign * Double.parseDouble(line);
    }
}
