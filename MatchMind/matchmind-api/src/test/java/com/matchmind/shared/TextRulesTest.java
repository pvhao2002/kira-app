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
    void forbiddenCharactersAreNamed() {
        assertNull(TextRules.forbiddenCharacter("Arsenal é 😀")); // accents and emoji are fine
        assertNotNull(TextRules.forbiddenCharacter("Ars\u0000enal"));
        assertNotNull(TextRules.forbiddenCharacter("‮asneT"));
        assertNotNull(TextRules.forbiddenCharacter("x⁦y"));
        assertNotNull(TextRules.forbiddenCharacter("lone \uD800 surrogate"));
        assertNotNull(TextRules.forbiddenCharacter("lone \uDC00 low"));
    }
}
