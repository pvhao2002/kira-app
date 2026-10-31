package com.kira.news.category;

import com.kira.news.article.Slugs;
import com.kira.news.proto.v1.CategoryDraft;
import com.kira.news.proto.v1.CategoryList;
import com.kira.news.shared.ApiException;
import com.kira.news.shared.Protobuf;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import static com.kira.news.shared.ApiException.require;

@RestController
@RequestMapping(produces = Protobuf.CONTENT_TYPE)
public class CategoryController {
    private final CategoryRepository categories;

    public CategoryController(CategoryRepository categories) {
        this.categories = categories;
    }

    @GetMapping("/api/v1/public/categories")
    public CategoryList list() {
        return CategoryList.newBuilder()
                .addAllItems(categories.findAllByOrderBySortOrderAscNameAsc().stream().map(Category::toProto).toList())
                .build();
    }

    @PostMapping(path = "/api/v1/admin/categories", consumes = Protobuf.CONTENT_TYPE)
    @Transactional
    public com.kira.news.proto.v1.Category create(@RequestBody CategoryDraft draft) {
        var slug = validSlug(draft);
        require(!categories.existsBySlug(slug), "SLUG_TAKEN", "Slug chuyên mục đã tồn tại.");
        return categories.save(new Category(slug, draft.getName().trim(), draft.getDescription().trim(), draft.getSortOrder()))
                .toProto();
    }

    @PutMapping(path = "/api/v1/admin/categories/{id}", consumes = Protobuf.CONTENT_TYPE)
    @Transactional
    public com.kira.news.proto.v1.Category update(@PathVariable long id, @RequestBody CategoryDraft draft) {
        var category = categories.findById(id)
                .orElseThrow(() -> ApiException.notFound("CATEGORY_NOT_FOUND", "Không tìm thấy chuyên mục."));
        var slug = validSlug(draft);
        require(!categories.existsBySlugAndIdNot(slug, id), "SLUG_TAKEN", "Slug chuyên mục đã tồn tại.");
        category.update(slug, draft.getName().trim(), draft.getDescription().trim(), draft.getSortOrder());
        return category.toProto();
    }

    private static String validSlug(CategoryDraft draft) {
        var name = draft.getName().trim();
        require(!name.isEmpty() && name.length() <= 120, "INVALID_NAME", "Tên chuyên mục 1-120 ký tự.");
        require(draft.getDescription().length() <= 500, "INVALID_DESCRIPTION", "Mô tả tối đa 500 ký tự.");
        var slug = Slugs.of(draft.getSlug().isBlank() ? name : draft.getSlug());
        require(!slug.isEmpty() && slug.length() <= 80, "INVALID_SLUG", "Slug không hợp lệ.");
        return slug;
    }
}
