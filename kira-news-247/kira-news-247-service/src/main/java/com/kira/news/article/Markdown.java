package com.kira.news.article;

import org.commonmark.node.Link;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;

/** Article bodies are Markdown; raw HTML is escaped so AI-written content cannot inject markup. */
public final class Markdown {
    private static final Parser PARSER = Parser.builder().build();
    private static final HtmlRenderer RENDERER = HtmlRenderer.builder()
            .escapeHtml(true)
            .sanitizeUrls(true)
            .attributeProviderFactory(_ -> (node, _, attributes) -> {
                if (node instanceof Link) {
                    attributes.put("rel", "nofollow noopener");
                    attributes.put("target", "_blank");
                }
            })
            .build();
    private static final int WORDS_PER_MINUTE = 220;

    private Markdown() {
    }

    public static String toHtml(String markdown) {
        return RENDERER.render(PARSER.parse(markdown));
    }

    public static int readingMinutes(String markdown) {
        var words = markdown.isBlank() ? 0 : markdown.trim().split("\\s+").length;
        return Math.max(1, (words + WORDS_PER_MINUTE - 1) / WORDS_PER_MINUTE);
    }
}
