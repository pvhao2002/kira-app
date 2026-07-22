package com.kira.bank.notification.domain;
import com.kira.bank.shared.domain.AuditedEntity;import jakarta.persistence.*;import lombok.Getter;import lombok.Setter;import java.time.Instant;
@Getter @Setter @Entity @Table(name="notifications") public class Notification extends AuditedEntity {private Long userId;private String type,module,title;@Column(columnDefinition="TEXT")private String message;private String severity;private Instant readAt;private String deepLink;}

