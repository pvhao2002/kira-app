package com.kira.news.article;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MarkdownTest {
    @Test
    void escapesRawHtmlAndUnsafeLinks() {
        var html = Markdown.toHtml("# Tiêu đề\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1)) [ok](https://vnexpress.net)");
        assertThat(html).contains("<h1>Tiêu đề</h1>").doesNotContain("<script>").doesNotContain("javascript:");
        assertThat(html).contains("href=\"https://vnexpress.net\"").contains("rel=\"nofollow noopener\"");
    }

    @Test
    void readingMinutes() {
        assertThat(Markdown.readingMinutes("một hai ba")).isEqualTo(1);
        assertThat(Markdown.readingMinutes("từ ".repeat(661))).isEqualTo(4);
    }
}
