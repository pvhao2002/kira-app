package com.kira.memory.settings;

import com.kira.memory.media.MediaUrls;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api")
public class SettingsController {
    /** The day it all started. */
    public static final LocalDate SINCE = LocalDate.of(2018, 6, 14);
    private final SettingsService settings;
    private final JdbcClient jdbc;
    private final MediaUrls urls;

    public SettingsController(SettingsService settings, JdbcClient jdbc, MediaUrls urls) {
        this.settings = settings;
        this.jdbc = jdbc;
        this.urls = urls;
    }

    public record LoginBanner(LocalDate since, String imageUrl) {
    }

    @GetMapping("/settings")
    SettingsService.PublicSettings publicSettings() {
        return settings.publicSettings();
    }

    @GetMapping("/admin/settings")
    SettingsService.AdminSettings adminSettings() {
        return settings.adminSettings();
    }

    @PutMapping("/admin/settings")
    SettingsService.AdminSettings update(@RequestBody SettingsService.UpdateSettings req) {
        return settings.update(req);
    }

    /** Shown before login, so it only exposes the one photo the admin picked as the banner. */
    @GetMapping("/public/login-banner")
    LoginBanner loginBanner() {
        String url = settings.bannerMediaId().flatMap(id -> jdbc.sql("SELECT object_key FROM media WHERE id = ?")
            .param(id).query(String.class).optional().map(key -> urls.original(id, key))).orElse(null);
        return new LoginBanner(SINCE, url);
    }
}
