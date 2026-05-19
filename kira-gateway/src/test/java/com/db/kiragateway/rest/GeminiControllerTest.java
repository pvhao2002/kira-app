package com.db.kiragateway.rest;

import com.db.kiragateway.dto.GenerateBlogRequest;
import com.db.kiragateway.dto.GenerateBlogResponse;
import com.db.kiragateway.dto.GeminiWebsiteCrawlRequest;
import com.db.kiragateway.dto.GeminiWebsiteCrawlResponse;
import com.db.kiragateway.service.BlogGenerationService;
import com.db.kiragateway.service.GeminiService;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GeminiControllerTest {

    @Test
    void generateBlog_shouldReturnBadRequestWhenMinWordsGreaterThanMaxWords() {
        var controller = new GeminiController(
                mock(GeminiService.class),
                mock(BlogGenerationService.class)
        );
        var jwt = mock(Jwt.class);
        var response = controller.generateBlog(jwt, new GenerateBlogRequest(
                "topic", null, null, 1200, 600, "kira", false
        ));
        assertEquals(400, response.getStatusCode().value());
    }

    @Test
    void generateBlog_shouldReturnOkWhenValidRequest() {
        var geminiService = mock(GeminiService.class);
        var blogGenerationService = mock(BlogGenerationService.class);
        var controller = new GeminiController(geminiService, blogGenerationService);
        var jwt = mock(Jwt.class);
        when(jwt.getClaim("uid")).thenReturn(123);
        var body = new GenerateBlogResponse(
                "ok",
                "gemini-3-flash-preview",
                new GenerateBlogResponse.GenerateBlogData(
                        10L,
                        "topic",
                        "topic-1",
                        "Title",
                        "Excerpt",
                        List.of("tag"),
                        "<article></article>",
                        "feature-split",
                        "draft",
                        null,
                        LocalDateTime.now()
                )
        );
        when(blogGenerationService.generateAndSave(org.mockito.ArgumentMatchers.any())).thenReturn(body);

        var response = controller.generateBlog(jwt, new GenerateBlogRequest(
                "topic", null, null, 500, 900, "kira", false
        ));

        assertEquals(200, response.getStatusCode().value());
        assertEquals("ok", response.getBody().status());
    }

    @Test
    void describeInstrument_shouldRejectMissingImage() {
        var controller = new GeminiController(
                mock(GeminiService.class),
                mock(BlogGenerationService.class)
        );
        var response = controller.describeInstrument(null);
        assertEquals(400, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        var body = (Map<String, Object>) response.getBody();
        assertEquals("error", body.get("status"));
    }

    @Test
    void crawlWebsiteEvents_shouldReturnOkWhenGeminiExtractsRows() {
        var geminiService = mock(GeminiService.class);
        var controller = new GeminiController(geminiService, mock(BlogGenerationService.class));
        var data = new GeminiWebsiteCrawlResponse.GeminiWebsiteCrawlData(
                "https://example.com/match",
                "hash",
                "{\"events\":[]}",
                List.of(new GeminiWebsiteCrawlResponse.EventRow(
                        "provider-1", "Home", "Away", null, null, "Home vs Away",
                        "2026-05-19 20:00:00", "Vietnam", "League", null,
                        "https://example.com/match", null, null, null, null,
                        null, null, null, null, "scheduled"
                )),
                List.of(),
                List.of(),
                List.of()
        );
        when(geminiService.extractWebsiteEventData(eq("https://example.com/match"), eq(null)))
                .thenReturn(new GeminiService.WebsiteCrawlResult("gemini-test", "prompt", "{\"events\":[]}", data));

        var response = controller.crawlWebsiteEvents(new GeminiWebsiteCrawlRequest("https://example.com/match", null));

        assertEquals(200, response.getStatusCode().value());
        var body = (GeminiWebsiteCrawlResponse) response.getBody();
        assertEquals("ok", body.status());
        assertEquals("gemini-test", body.model());
        assertEquals(1, body.data().events().size());
    }

    @Test
    void crawlWebsiteEvents_shouldReturnBadRequestWhenUrlInvalid() {
        var geminiService = mock(GeminiService.class);
        var controller = new GeminiController(
                geminiService,
                mock(BlogGenerationService.class)
        );
        when(geminiService.extractWebsiteEventData("", null))
                .thenThrow(new IllegalArgumentException("url is required"));

        var response = controller.crawlWebsiteEvents(new GeminiWebsiteCrawlRequest("", null));

        assertEquals(400, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        var body = (Map<String, Object>) response.getBody();
        assertEquals("error", body.get("status"));
    }
}
