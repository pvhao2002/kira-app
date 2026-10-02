package com.kira.farm.media.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * app.media.*: dir is a local folder (APP_UPLOAD_DIR, mount a volume there), maxBytes the largest accepted image,
 * publicBaseUrl an optional origin prepended to returned URLs (empty = same-origin relative URLs).
 * ponytail: local disk, so one instance only; move to object storage (R2) before running several replicas.
 */
@ConfigurationProperties("app.media")
public record MediaProperties(@DefaultValue("./uploads") String dir,
                              @DefaultValue("5242880") long maxBytes,
                              @DefaultValue("") String publicBaseUrl) {
}
