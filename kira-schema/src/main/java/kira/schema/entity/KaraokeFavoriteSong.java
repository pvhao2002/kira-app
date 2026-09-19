package kira.schema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "karaoke_favorite_song", indexes = {
        @Index(name = "idx_karaoke_favorite_song_user_updated", columnList = "user_id, updated_at"),
        @Index(name = "idx_karaoke_favorite_song_user_title", columnList = "user_id, title")
})
@Getter
@Setter
@NoArgsConstructor
public class KaraokeFavoriteSong {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "song_id")
    private Long songId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_karaoke_favorite_song_user"))
    private User user;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 255)
    private String artist;

    @Column(length = 100)
    private String genre;

    @Column(name = "karaoke_code", length = 100)
    private String karaokeCode;

    @Column(length = 50)
    private String tone;

    @Column(length = 1000)
    private String link;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
    private LocalDateTime updatedAt;
}
