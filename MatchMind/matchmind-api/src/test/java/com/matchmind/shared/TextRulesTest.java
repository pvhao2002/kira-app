package com.matchmind.shared;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class TextRulesTest {
    @Test
    void cleanCollapsesWhitespaceControlsAndInvisibleCharacters() {
        assertEquals("A B C", TextRules.clean(" A\nB\tC "));
        assertEquals("", TextRules.clean("​​"));
        assertEquals("", TextRules.clean(" "));
        assertEquals("Real Madrid", TextRules.clean("Real   Madrid﻿"));
        assertEquals("Atlético", TextRules.clean("Atlético")); // NFC: decomposed e + accent becomes é
        assertNull(TextRules.clean(null));
    }

    @Test
    void leagueDropsStageGroupRoundAndRegionSuffixes() {
        assertEquals("UEFA Champions League", TextRules.league("UEFA Champions League - Round 5"));
        assertEquals("AFC Champions League Two", TextRules.league("AFC Champions League Two - Group 4 - Round 5"));
        assertEquals("AFC Champions League Elite", TextRules.league("AFC Champions League Elite - East Region"));
        assertEquals("UEFA Youth League", TextRules.league("UEFA Youth League - League Round"));
        assertEquals("Azerbaijan First Division", TextRules.league("Azerbaijan First Division - League"));
        assertEquals("Copa Libertadores", TextRules.league("Copa Libertadores - Quarter-finals"));
        assertEquals("Sweden Allsvenskan", TextRules.league("Sweden Allsvenskan"));
        assertEquals("Brasileirão - Série A", TextRules.league("Brasileirão - Série A"));   // part of the name: kept
        assertNull(TextRules.league(null));
    }

    @Test
    void forbiddenCharactersAreNamed() {
        assertNull(TextRules.forbiddenCharacter("Arsenal é 😀")); // accents and emoji are fine
        assertNotNull(TextRules.forbiddenCharacter("Ars\u0000enal"));
        assertNotNull(TextRules.forbiddenCharacter("‮asneT"));
        assertNotNull(TextRules.forbiddenCharacter("x⁦y"));
        assertNotNull(TextRules.forbiddenCharacter("lone \uD800 surrogate"));
        assertNotNull(TextRules.forbiddenCharacter("lone \uDC00 low"));
    }
}
