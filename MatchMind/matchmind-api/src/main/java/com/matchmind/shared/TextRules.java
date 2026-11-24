package com.matchmind.shared;

import java.text.Normalizer;

/** Hygiene for free text that agents send and the UI displays (team, league and model names). */
public final class TextRules {
    private TextRules() {
    }

    // ponytail: English stage words only; a real name ending in " - League Two" would lose it. Add an alias if that shows up.
    // Keep in step with V40__league_without_stage.sql, which applied the same rule to stored matches.
    private static final java.util.regex.Pattern STAGE = java.util.regex.Pattern.compile(
        " - (?:round|group|matchday|match day|week|leg|stage|phase|league|regular season|play-?offs?|qualif\\w*|"
            + "preliminary|knockout|quarter\\S*|semi\\S*|finals?|(?:[a-z]+ )?region)\\b.*$", java.util.regex.Pattern.CASE_INSENSITIVE);

    /**
     * A competition name without the stage, group, round or region agents append ("UEFA Champions League - Group 4 -
     * Round 5" becomes "UEFA Champions League"), so one league is not split into several. Apply after {@link #clean}.
     */
    public static String league(String s) {
        return s == null ? null : STAGE.matcher(s).replaceFirst("");
    }

    /**
     * Unicode NFC, zero-width characters and BOM removed, every whitespace or control character (including NBSP, tab
     * and newline) turned into one space, then trimmed. A name that only had invisible characters becomes "".
     */
    public static String clean(String s) {
        if (s == null) return null;
        String nfc = Normalizer.normalize(s, Normalizer.Form.NFC);
        StringBuilder b = new StringBuilder(nfc.length());
        boolean space = false;
        for (int i = 0; i < nfc.length(); i++) {
            char c = nfc.charAt(i);
            if (c == '​' || c == '‌' || c == '‍' || c == '⁠' || c == '﻿') continue;
            if (Character.isWhitespace(c) || Character.isSpaceChar(c) || Character.isISOControl(c)) {
                space = !b.isEmpty();
                continue;
            }
            if (space) b.append(' ');
            space = false;
            b.append(c);
        }
        return b.toString();
    }

    /**
     * Why the text cannot be stored, or null when it can: NUL (PostgreSQL text and JSONB reject it), a lone UTF-16
     * surrogate (not valid Unicode), or a BiDi embedding/override/isolate control (it reverses how names display).
     */
    public static String forbiddenCharacter(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\u0000') return "must not contain the NUL character";
            if ((c >= '‪' && c <= '‮') || (c >= '⁦' && c <= '⁩')) {
                return "must not contain Unicode direction controls (U+202A-U+202E, U+2066-U+2069)";
            }
            if (Character.isHighSurrogate(c) && i + 1 < s.length() && Character.isLowSurrogate(s.charAt(i + 1))) {
                i++;
            } else if (Character.isSurrogate(c)) {
                return "must not contain an unpaired UTF-16 surrogate";
            }
        }
        return null;
    }
}
