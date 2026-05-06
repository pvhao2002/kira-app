package com.db.kiragateway.service;

import com.db.kiragateway.dto.GenerateBlogRequest;
import com.db.kiragateway.repository.BlogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BlogGenerationServiceTest {

    @Mock
    private GeminiService geminiService;
    @Mock
    private BlogRepository blogRepository;

    private BlogGenerationService blogGenerationService;

    @BeforeEach
    void setUp() {
        blogGenerationService = new BlogGenerationService(geminiService, blogRepository, new ObjectMapper());
    }

    @Test
    void generateAndSave_shouldReturnSavedBlogResponse() {
        when(geminiService.generateBlog(any(), any(), any(), any(), any()))
                .thenReturn(new GeminiService.BlogGenerationResult(
                        "gemini-3-flash-preview",
                        "prompt",
                        "{\"x\":1}",
                        "Title test",
                        "excerpt",
                        List.of("a", "b"),
                        "<article><h1>Title test</h1></article>",
                        "feature-split",
                        "hash"
                ));
        when(blogRepository.insert(any())).thenReturn(99L);
        when(blogRepository.findById(99L)).thenReturn(java.util.Optional.of(
                new BlogRepository.BlogRow(
                        99L,
                        "AI topic",
                        "title-test-1",
                        "Title test",
                        "excerpt",
                        "[\"a\",\"b\"]",
                        "<article><h1>Title test</h1></article>",
                        "feature-split",
                        "gemini-3-flash-preview",
                        "prompt",
                        "hash",
                        "draft",
                        null,
                        "kira",
                        0,
                        LocalDateTime.now(),
                        LocalDateTime.now()
                )
        ));

        var response = blogGenerationService.generateAndSave(new GenerateBlogRequest(
                "AI topic",
                null,
                null,
                500,
                1000,
                "kira",
                false
        ));

        assertEquals("ok", response.status());
        assertEquals(99L, response.data().blogId());
        assertEquals("Title test", response.data().title());
        assertEquals(2, response.data().tags().size());
        assertTrue(response.data().slug().contains("title-test"));
        assertNotNull(response.model());
    }
}
