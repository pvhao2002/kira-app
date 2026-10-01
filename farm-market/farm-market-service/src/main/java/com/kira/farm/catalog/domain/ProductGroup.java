package com.kira.farm.catalog.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** "Similar group": the same item sold by several branches (each branch has its own product row, price, stock). */
@Getter
@Setter
@Entity
@Table(name = "product_groups")
public class ProductGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 80)
    private String code;
    @Column(nullable = false, length = 160)
    private String name;
}
