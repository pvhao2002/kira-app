package com.kira.bank.notification.domain;

import com.kira.bank.shared.domain.AuditedEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** An Expo push token of a signed-in mobile device. A token belongs to the account last registered on the device. */
@Getter
@Setter
@Entity
@Table(name = "push_devices")
public class PushDevice extends AuditedEntity {
    private Long userId;
    private String token, platform;
}
