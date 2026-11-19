package com.matchmind.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The default prediction prompt must describe both match states, and its examples must pass the real API. */
class PromptTemplatesIT extends IntegrationTestBase {

    private String predictionPrompt() {
        return db.queryForObject("SELECT content FROM prompt_templates WHERE template_type = 'AI_PREDICTION'", String.class);
    }

    /** The first JSON object after {@code heading}; Jackson stops at the end of that object. */
    private ObjectNode exampleAfter(String prompt, String heading) throws Exception {
        int at = prompt.indexOf(heading);
        assertThat(at).as("prompt has a section '%s'", heading).isNotNegative();
        return (ObjectNode) json.readTree(prompt.substring(prompt.indexOf('{', at)));
    }

    private MvcResult send(ObjectNode example) throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        example.put("eventId", "prompt-example-" + suffix);
        ((ObjectNode) example.get("match")).put("externalMatchId", "prompt-match-" + suffix);
        return externalWith(Map.of("X-Api-Key", EXTERNAL_KEY, "X-Provider", "prompt-check", "X-Model-Name", "example"),
            "predictions", json.writeValueAsString(example));
    }

    @Test
    void preMatchSectionExplainsWhatIsMissingBeforeKickOff() {
        String prompt = predictionPrompt();
        assertThat(prompt).contains("QUY TẮC RIÊNG CHO LIVE", "QUY TẮC RIÊNG CHO PRE_MATCH", "\"predictionType\": \"PRE_MATCH\"",
            "Không gửi snapshot odds có stage \"LIVE\"", "\"minutesRemaining\": 90");
        // LIVE rules, then PRE_MATCH rules, then the shared settlement section.
        assertThat(prompt.indexOf("QUY TẮC RIÊNG CHO LIVE")).isLessThan(prompt.indexOf("QUY TẮC RIÊNG CHO PRE_MATCH"));
        assertThat(prompt.indexOf("QUY TẮC RIÊNG CHO PRE_MATCH")).isLessThan(prompt.indexOf("SETTLEMENT BASIS - CRITICAL"));
    }

    @Test
    void bothPromptExamplesAreAcceptedByTheApi() throws Exception {
        String prompt = predictionPrompt();
        ObjectNode live = exampleAfter(prompt, "OUTPUT JSON SCHEMA (example values)");
        assertThat(live.get("predictionType").asText()).isEqualTo("LIVE");
        MvcResult liveRes = send(live);
        assertThat(liveRes.getResponse().getStatus()).as(liveRes.getResponse().getContentAsString()).isEqualTo(201);

        ObjectNode pre = exampleAfter(prompt, "\nPRE_MATCH EXAMPLE ("); // the heading line, not the "see ..." reference
        assertThat(pre.get("predictionType").asText()).isEqualTo("PRE_MATCH");
        assertThat(pre.has("matchMinute") || pre.has("currentScore") || pre.has("stats")).isFalse();
        for (JsonNode odds : pre.get("odds")) assertThat(odds.get("stage").asText()).isIn("OPENING", "PRE_MATCH");
        MvcResult preRes = send(pre);
        assertThat(preRes.getResponse().getStatus()).as(preRes.getResponse().getContentAsString()).isEqualTo(201);
    }
}
