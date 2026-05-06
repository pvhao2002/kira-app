package com.db.kiragateway.service;

import com.db.kiragateway.dto.GenerateBlogRequest;
import com.db.kiragateway.dto.GenerateBlogResponse;
import com.db.kiragateway.repository.BlogRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class BlogGenerationService {

    private final GeminiService geminiService;
    private final BlogRepository blogRepository;
    private final ObjectMapper objectMapper;

    public GenerateBlogResponse generateAndSave(GenerateBlogRequest request) {
        var topic = request.topic().trim();
        var generated = geminiService.generateBlog(
                topic,
                request.tone(),
                request.targetAudience(),
                request.minWords(),
                request.maxWords()
        );

        var title = generated.title().isBlank() ? topic : generated.title();
        var slug = buildSlug(title);
        var publishNow = Boolean.TRUE.equals(request.publishNow());
        var status = publishNow ? "published" : "draft";
        var publishedAt = publishNow ? LocalDateTime.now() : null;
        var createdBy = normalize(request.createdBy());
        var tagsJson = toJsonArray(generated.tags());

        var blogId = blogRepository.insert(new BlogRepository.BlogInsertCommand(
                topic,
                slug,
                title,
                normalize(generated.excerpt()),
                tagsJson,
                generated.htmlContent(),
                generated.layoutVariant(),
                generated.model(),
                generated.prompt(),
                generated.sourcePromptHash(),
                status,
                publishedAt,
                createdBy,
                0
        ));

        var saved = blogRepository.findById(blogId)
                .orElseThrow(() -> new IllegalStateException("saved blog not found"));

        return new GenerateBlogResponse(
                "ok",
                saved.model(),
                new GenerateBlogResponse.GenerateBlogData(
                        saved.blogId(),
                        saved.topic(),
                        saved.slug(),
                        saved.title(),
                        saved.excerpt(),
                        parseTags(saved.tagsJson()),
                        saved.htmlContent(),
                        saved.layoutVariant(),
                        saved.status(),
                        saved.publishedAt(),
                        saved.createdAt()
                )
        );
    }

    private List<String> parseTags(String tagsJson) {
        if (tagsJson == null || tagsJson.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(tagsJson, new TypeReference<List<String>>() {
            });
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String toJsonArray(List<String> tags) {
        try {
            return objectMapper.writeValueAsString(tags == null ? List.of() : tags);
        } catch (Exception ex) {
            return "[]";
        }
    }

    private static String buildSlug(String input) {
        var base = input == null ? "" : input.toLowerCase(Locale.ROOT).trim();
        base = base.replaceAll("[^a-z0-9\\s-]", "").replaceAll("\\s+", "-").replaceAll("-{2,}", "-");
        base = base.replaceAll("^-+", "").replaceAll("-+$", "");
        if (base.isBlank()) {
            base = "blog";
        }
        return base + "-" + System.currentTimeMillis();
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        var trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
