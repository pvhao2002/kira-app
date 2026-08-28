package com.kira.bank.tutoring.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity @Table(name = "tutoring_students") @Getter @Setter
public class TutoringStudent extends AuditedEntity {
    @Column(nullable = false) private Long userId;
    @Column(nullable = false, length = 150) private String name;
    @Column(length = 30) private String phone;
    @Column(nullable = false, length = 7) private String color;
    @Column(length = 1000) private String note;
}
