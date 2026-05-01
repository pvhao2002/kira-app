package com.db.kiragateway.config.export;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.export.kira-crawl")
public class KiraCrawlExportProperties {

    /**
     * When false (default), GET /export/kira-crawl responds with 404 and does not read disk.
     */
    private boolean enabled = false;

    /**
     * Absolute path to the {@code kira-crawl} module root on the host running the gateway.
     */
    private String sourceDirectory = "";

    /**
     * When false (default), {@code .git} is excluded from the archive.
     */
    private boolean includeGit = false;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getSourceDirectory() {
        return sourceDirectory;
    }

    public void setSourceDirectory(String sourceDirectory) {
        this.sourceDirectory = sourceDirectory;
    }

    public boolean isIncludeGit() {
        return includeGit;
    }

    public void setIncludeGit(boolean includeGit) {
        this.includeGit = includeGit;
    }
}
