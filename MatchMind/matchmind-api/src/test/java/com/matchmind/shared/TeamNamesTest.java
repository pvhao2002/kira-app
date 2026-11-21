package com.matchmind.shared;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TeamNamesTest {
    @ParameterizedTest
    @ValueSource(strings = {"Atlético Madrid", "Atletico Madrid", "Atlético Madrid FC", "Atletico  Madrid", "ATLÉTICO MADRID",
        "FC Atlético Madrid", "Atlético-Madrid", "Atlético Madrid AC"})
    void spellingVariantsNormaliseToOneKey(String name) {
        assertThat(TeamNames.normalize(name)).isEqualTo("atletico madrid");
    }

    @Test
    void womenYouthAndReserveTeamsStayDistinct() {
        assertThat(TeamNames.normalize("Arsenal W")).isNotEqualTo(TeamNames.normalize("Arsenal"));
        assertThat(TeamNames.normalize("Real Madrid II")).isNotEqualTo(TeamNames.normalize("Real Madrid"));
        assertThat(TeamNames.normalize("Ajax U21")).isEqualTo("ajax u21");
    }

    @Test
    void clubTokenAloneIsKept() {
        assertThat(TeamNames.normalize("AC Milan")).isEqualTo("milan");
        assertThat(TeamNames.normalize("FC")).isEqualTo("fc");
        assertThat(TeamNames.normalize("St. Pauli")).isEqualTo("st pauli");
    }
}
