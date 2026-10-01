package com.kira.farm.branch.domain;

import com.kira.farm.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "branches")
public class Branch extends BaseEntity {
    @Column(nullable = false, unique = true, length = 8)
    private String code;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(nullable = false, length = 60)
    private String shortName;
    @Column(nullable = false)
    private String address;
    @Column(nullable = false, length = 40)
    private String hours;
    @Column(name = "open_flag", nullable = false)
    private boolean openFlag = true;
    @Column(nullable = false, length = 7, columnDefinition = "CHAR(7)")
    private String themePrimary;
    @Column(nullable = false, length = 7, columnDefinition = "CHAR(7)")
    private String themeAccent;
    @Column(length = 120)
    private String managerName;
    @Column(length = 20)
    private String phone;
}
