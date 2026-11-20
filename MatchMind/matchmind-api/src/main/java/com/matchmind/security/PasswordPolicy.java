package com.matchmind.security;

import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Beyond the length limits on the request records: no trivial passwords. Not a full strength meter, it rejects what
 * attackers try first (same character, simple sequences, a short common list, the user name).
 */
public final class PasswordPolicy {
    private static final Set<String> COMMON = Set.of("password", "passw0rd", "p@ssword", "p@ssw0rd", "qwerty", "qwertyuiop",
        "qwertyui", "asdfghjkl", "zxcvbnm", "letmein", "welcome", "admin", "administrator", "root", "changeme", "iloveyou",
        "football", "soccer", "matchmind", "monkey", "dragon", "abc", "login", "master", "secret", "default", "trustno",
        "1q2w3e4r", "1qaz2wsx", "zaq12wsx", "superman", "batman", "sunshine", "princess");
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private PasswordPolicy() {
    }

    /** What is wrong with the password, or null when it is acceptable. The text is safe to show to the user. */
    public static String problem(String password, String username) {
        String lower = password.toLowerCase(Locale.ROOT);
        if (username != null && lower.equals(username.trim().toLowerCase(Locale.ROOT))) {
            return "must not be the same as the user name";
        }
        Set<Integer> distinct = new HashSet<>();
        lower.codePoints().forEach(distinct::add);
        if (distinct.size() < 5) return "must not be a repeated character or pattern";
        if (isSequence(lower)) return "must not be a simple sequence such as 1234567890 or abcdefghij";
        String letters = lower.replaceAll("[^\\p{L}]+$", "").replaceAll("^[^\\p{L}]+", "");
        if (COMMON.contains(lower) || COMMON.contains(letters)) return "is too common, choose something less guessable";
        return null;
    }

    private static boolean isSequence(String s) {
        int[] cps = s.codePoints().toArray();
        if (cps.length < 2) return false;
        int step = step(cps[0], cps[1]);
        if (Math.abs(step) != 1) return false;
        for (int i = 2; i < cps.length; i++) if (step(cps[i - 1], cps[i]) != step) return false;
        return true;
    }

    /** Distance between neighbours; 9 to 0 counts as +1 so 1234567890 is one run. */
    private static int step(int from, int to) {
        if (from == '9' && to == '0') return 1;
        if (from == '0' && to == '9') return -1;
        return to - from;
    }

    /** 16 random characters without look-alikes (no 0 O 1 l I), at least one lower, upper and digit. */
    public static String generate() {
        while (true) {
            StringBuilder b = new StringBuilder(16);
            for (int i = 0; i < 16; i++) b.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            String p = b.toString();
            if (p.chars().anyMatch(Character::isLowerCase) && p.chars().anyMatch(Character::isUpperCase)
                && p.chars().anyMatch(Character::isDigit) && problem(p, null) == null) return p;
        }
    }
}
