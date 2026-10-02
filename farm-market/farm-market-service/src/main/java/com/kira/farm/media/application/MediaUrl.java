package com.kira.farm.media.application;

/** Shape of the image URLs this system generates; DTOs accept nothing else for review photos and product images. */
public final class MediaUrl {
    private MediaUrl() {
    }

    public static final String PATH_PREFIX = "/api/v1/files/";
    /** Stored file name: lower-case uuid + known extension (single source for the extension set and uuid shape). */
    public static final String FILE_NAME =
        "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)";
    /** Empty, or {@code [https://host[:port]]/api/v1/files/<uuid>.<jpg|png|webp>}. */
    public static final String REGEX_OR_EMPTY =
        "^$|^(https://[A-Za-z0-9.-]{1,253}(:[0-9]{1,5})?)?" + PATH_PREFIX + FILE_NAME + "$";
    public static final String MESSAGE = "Ảnh không hợp lệ, vui lòng tải ảnh lên từ máy";
}
