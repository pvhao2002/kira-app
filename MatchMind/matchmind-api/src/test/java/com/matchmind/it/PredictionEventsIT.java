package com.matchmind.it;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Signed-in browsers hear about each new prediction over Server-Sent Events, once, after it is stored. */
class PredictionEventsIT extends IntegrationTestBase {
    private static final String STREAM = "/api/v1/events/predictions";

    @Test
    void newPredictionIsPushedOnceToSignedInBrowsers() throws Exception {
        MvcResult stream = mvc.perform(asAdmin(get(STREAM))).andExpect(request().asyncStarted()).andReturn();
        assertThat(stream.getResponse().getContentType()).startsWith("text/event-stream");
        assertThat(stream.getResponse().getHeader("X-Accel-Buffering")).isEqualTo("no");

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String body = Payloads.livePrediction("evt-" + suffix, "live-" + suffix, "stream-model");
        String provider = newIntegration("stream-model").provider();
        MvcResult created = external(provider, "predictions", body);
        assertThat(created.getResponse().getStatus()).isEqualTo(201);
        String predictionId = read(created).get("predictionId").asText();

        String events = stream.getResponse().getContentAsString();
        assertThat(events).contains("event:prediction").contains(predictionId).contains("stream-model");

        // A retried callback is a duplicate: nothing new to announce.
        MvcResult again = external(provider, "predictions", body);
        assertThat(again.getResponse().getStatus()).isEqualTo(200);
        String after = stream.getResponse().getContentAsString();
        assertThat(after.split(predictionId, -1)).hasSize(2);
    }

    @Test
    void streamNeedsASignedInUser() throws Exception {
        mvc.perform(get(STREAM)).andExpect(status().isUnauthorized());
    }

}
