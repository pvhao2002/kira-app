package com.kira.news.category;

import jakarta.persistence.*;

@Entity
@Table(name = "category")
public class Category {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String slug;
    private String name;
    private String description;
    private int sortOrder;

    protected Category() {
    }

    public Category(String slug, String name, String description, int sortOrder) {
        update(slug, name, description, sortOrder);
    }

    public void update(String slug, String name, String description, int sortOrder) {
        this.slug = slug;
        this.name = name;
        this.description = description;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public com.kira.news.proto.v1.Category toProto() {
        return com.kira.news.proto.v1.Category.newBuilder()
                .setId(id)
                .setSlug(slug)
                .setName(name)
                .setDescription(description == null ? "" : description)
                .setSortOrder(sortOrder)
                .build();
    }
}
