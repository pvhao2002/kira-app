package com.kira.farm.media;

import com.kira.farm.media.application.ImageSniffer;
import com.kira.farm.media.application.ImageSniffer.Kind;
import com.kira.farm.media.application.MediaService;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class ImageSnifferTest {
    private static byte[] bytes(int... v) {
        byte[] b = new byte[Math.max(v.length, 16)];
        for (int i = 0; i < v.length; i++) b[i] = (byte) v[i];
        return b;
    }

    @Test
    void recognizesJpegPngAndWebpByMagicBytes() {
        assertEquals(Optional.of(Kind.JPEG), ImageSniffer.sniff(bytes(0xFF, 0xD8, 0xFF, 0xE0)));
        assertEquals(Optional.of(Kind.PNG), ImageSniffer.sniff(bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)));
        assertEquals(Optional.of(Kind.WEBP), ImageSniffer.sniff(bytes('R', 'I', 'F', 'F', 1, 2, 3, 4, 'W', 'E', 'B', 'P')));
        assertEquals("jpg", Kind.JPEG.extension);
        assertEquals("image/webp", Kind.WEBP.contentType);
    }

    @Test
    void rejectsSvgGifRiffWavTextAndTruncatedInput() {
        assertTrue(ImageSniffer.sniff("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>".getBytes(StandardCharsets.UTF_8)).isEmpty());
        assertTrue(ImageSniffer.sniff("GIF89a....................".getBytes(StandardCharsets.US_ASCII)).isEmpty());
        assertTrue(ImageSniffer.sniff(bytes('R', 'I', 'F', 'F', 1, 2, 3, 4, 'W', 'A', 'V', 'E')).isEmpty());
        assertTrue(ImageSniffer.sniff(new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47}).isEmpty(), "truncated PNG signature");
        assertTrue(ImageSniffer.sniff(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}).isEmpty(), "shorter than the 12-byte minimum header");
        assertTrue(ImageSniffer.sniff(bytes(0xFF, 0xD8, 0x00)).isEmpty(), "JPEG needs 0xFF as the third byte");
        assertTrue(ImageSniffer.sniff(bytes('R', 'I', 'F', 'F', 1, 2, 3, 4, 'W', 'E', 'B', 'X')).isEmpty(), "RIFF with a wrong WEBP tag");
        assertTrue(ImageSniffer.sniff(new byte[]{'R', 'I', 'F', 'F', 1, 2, 3, 4, 'W', 'E', 'B'}).isEmpty(), "RIFF header shorter than 12 bytes");
        assertTrue(ImageSniffer.sniff(new byte[12]).isEmpty(), "12 arbitrary bytes");
        assertTrue(ImageSniffer.sniff(null).isEmpty());
    }

    @Test
    void acceptsAnExactlyTwelveByteWebpHeader() {
        assertEquals(Optional.of(Kind.WEBP),
            ImageSniffer.sniff(new byte[]{'R', 'I', 'F', 'F', 1, 2, 3, 4, 'W', 'E', 'B', 'P'}));
    }

    @Test
    void contentTypeFollowsTheStoredExtensionAndStoredNamesAreStrict() {
        assertEquals(Optional.of("image/png"), ImageSniffer.contentTypeOf("png"));
        assertTrue(ImageSniffer.contentTypeOf("svg").isEmpty());
        String ok = "123e4567-e89b-12d3-a456-426614174000.png";
        assertTrue(MediaService.NAME.matcher(ok).matches());
        for (String bad : new String[]{"../123e4567-e89b-12d3-a456-426614174000.png", "a.png", ok + ".svg",
            "123E4567-E89B-12D3-A456-426614174000.png", ok.replace(".png", ".svg")})
            assertFalse(MediaService.NAME.matcher(bad).matches(), bad);
    }
}
