package com.kira.farm.catalog.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "categories")
public class Category {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 60)
    private String slug;
    @Column(nullable = false, length = 80)
    private String name;
    @Column(nullable = false)
    private int sortOrder;
}
