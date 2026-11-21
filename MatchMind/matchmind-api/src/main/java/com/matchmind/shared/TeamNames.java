package com.matchmind.shared;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Cross-provider team identity for fixtures (owner decision 5): lower case, no diacritics, no punctuation, one space,
 * and one club token (fc, cf, sc, afc, ac) dropped at the start and at the end. w, u19, u21, ii and b are kept, so
 * women's, youth and reserve teams stay distinct. No stop-word list: the admin merge covers the rest.
 * Not {@code PredictionValidator.teamKey}: that key names a provider's own match ids and must not change.
 */
public final class TeamNames {
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern SEPARATORS = Pattern.compile("[^\\p{L}\\p{N}]+");
    private static final Set<String> CLUB_TOKENS = Set.of("fc", "cf", "sc", "afc", "ac");
    private static final int MAX = 160; // fixtures.norm_home / norm_away

    private TeamNames() {
    }

    public static String normalize(String team) {
        String folded = MARKS.matcher(Normalizer.normalize(TextRules.clean(team), Normalizer.Form.NFD)).replaceAll("")
            .toLowerCase(Locale.ROOT).replace(".", "").replace("'", "").replace("’", "");
        List<String> tokens = new ArrayList<>(Arrays.asList(SEPARATORS.matcher(folded).replaceAll(" ").trim().split(" ")));
        if (tokens.size() > 1 && CLUB_TOKENS.contains(tokens.getFirst())) tokens.removeFirst();
        if (tokens.size() > 1 && CLUB_TOKENS.contains(tokens.getLast())) tokens.removeLast();
        String key = String.join(" ", tokens);
        if (key.isEmpty()) key = TextRules.clean(team).toLowerCase(Locale.ROOT); // no letters or digits at all
        return key.length() > MAX ? key.substring(0, MAX) : key;
    }
}
