package com.db.kiragateway.rest;

import com.db.kiragateway.dto.GenerateBlogRequest;
import com.db.kiragateway.dto.GenerateBlogResponse;
import com.db.kiragateway.service.BlogGenerationService;
import com.db.kiragateway.service.GeminiService;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GeminiControllerTest {

    @Test
    void generateBlog_shouldReturnBadRequestWhenMinWordsGreaterThanMaxWords() {
        var controller = new GeminiController(mock(GeminiService.class), mock(BlogGenerationService.class));
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
        var controller = new GeminiController(mock(GeminiService.class), mock(BlogGenerationService.class));
        var response = controller.describeInstrument(null);
        assertEquals(400, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        var body = (Map<String, Object>) response.getBody();
        assertEquals("error", body.get("status"));
    }
}
