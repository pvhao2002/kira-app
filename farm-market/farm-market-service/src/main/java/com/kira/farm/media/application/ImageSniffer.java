package com.kira.farm.media.application;

import java.util.Optional;

/**
 * Decides the image type from the leading bytes only (JPEG, PNG, WebP). The client file name and Content-Type are never
 * trusted, and SVG/GIF/anything else is rejected, so an upload can never be served back as active content.
 * This is a type check, not content validation: safety relies on the fixed Content-Type plus nosniff when serving,
 * not on parsing the image.
 */
public final class ImageSniffer {
    private ImageSniffer() {
    }

    public enum Kind {
        JPEG("jpg", "image/jpeg"), PNG("png", "image/png"), WEBP("webp", "image/webp");

        public final String extension;
        public final String contentType;

        Kind(String extension, String contentType) {
            this.extension = extension;
            this.contentType = contentType;
        }
    }

    public static Optional<Kind> sniff(byte[] b) {
        if (b == null || b.length < 12) return Optional.empty();
        if (u(b[0]) == 0xFF && u(b[1]) == 0xD8 && u(b[2]) == 0xFF) return Optional.of(Kind.JPEG);
        if (startsWith(b, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return Optional.of(Kind.PNG);
        // RIFF <4-byte size> WEBP
        if (startsWith(b, 'R', 'I', 'F', 'F') && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P')
            return Optional.of(Kind.WEBP);
        return Optional.empty();
    }

    /** Maps a stored extension (jpg, png, webp) back to its Content-Type. */
    public static Optional<String> contentTypeOf(String extension) {
        for (Kind k : Kind.values()) if (k.extension.equals(extension)) return Optional.of(k.contentType);
        return Optional.empty();
    }

    private static int u(byte v) {
        return v & 0xFF;
    }

    private static boolean startsWith(byte[] b, int... prefix) {
        for (int i = 0; i < prefix.length; i++) if (u(b[i]) != prefix[i]) return false;
        return true;
    }
}
