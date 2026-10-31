package com.kira.news.article;

import com.kira.news.proto.v1.ArticleDraft;
import com.kira.news.shared.ApiException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ArticleDraftsTest {
    private static ArticleDraft.Builder valid() {
        return ArticleDraft.newBuilder()
                .setTitle("  Giá vàng hôm nay tăng mạnh  ")
                .setSummary("Giá vàng SJC tăng 1 triệu đồng mỗi lượng.")
                .setBodyMarkdown("Nội dung bài viết đủ dài để vượt qua kiểm tra độ dài tối thiểu của hệ thống.")
                .setCategoryId(3)
                .addAllTags(List.of(" vàng ", "SJC", "vàng", ""))
                .setCoverImageUrl("https://images.example.com/a.jpg")
                .addSourceUrls("https://sjc.com.vn/gia-vang");
    }

    @Test
    void normalisesValidDraft() {
        var content = ArticleDrafts.validate(valid().build());
        assertThat(content.title()).isEqualTo("Giá vàng hôm nay tăng mạnh");
        assertThat(content.slug()).isEqualTo("gia-vang-hom-nay-tang-manh");
        assertThat(content.tags()).containsExactly("vàng", "SJC");
        assertThat(content.categoryId()).isEqualTo(3);
    }

    @Test
    void rejectsUnsafeOrMissingFields() {
        assertThatThrownBy(() -> ArticleDrafts.validate(valid().setTitle("").build()))
                .isInstanceOf(ApiException.class).hasMessageContaining("Tiêu đề");
        assertThatThrownBy(() -> ArticleDrafts.validate(valid().setCoverImageUrl("javascript:alert(1)").build()))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ArticleDrafts.validate(valid().addSourceUrls("ftp://x").build()))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ArticleDrafts.validate(valid().setCategoryId(0).build()))
                .isInstanceOf(ApiException.class);
    }
}
