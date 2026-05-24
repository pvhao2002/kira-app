package com.queue.kiraqueue.r2;

import lombok.experimental.UtilityClass;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;

@UtilityClass
public class LogoImageDownloader {

    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final Duration TIMEOUT = Duration.ofSeconds(15);

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public record DownloadedImage(byte[] bytes, String contentType, String extension) {
    }

    public static DownloadedImage download(String logoUrl) throws IOException, InterruptedException {
        var request = HttpRequest.newBuilder()
                .uri(URI.create(logoUrl))
                .timeout(TIMEOUT)
                .header("User-Agent", "KiraQueue/1.0")
                .GET()
                .build();
        var response = CLIENT.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("HTTP " + response.statusCode() + " for " + logoUrl);
        }
        var body = response.body();
        if (body.length > MAX_BYTES) {
            throw new IOException("Logo exceeds max size " + MAX_BYTES + " bytes");
        }
        var contentType = response.headers().firstValue("Content-Type").orElse("image/png");
        var extension = extensionFrom(contentType, logoUrl);
        return new DownloadedImage(body, contentType, extension);
    }

    private static String extensionFrom(String contentType, String logoUrl) {
        if (contentType.contains("jpeg") || contentType.contains("jpg")) {
            return "jpg";
        }
        if (contentType.contains("webp")) {
            return "webp";
        }
        if (contentType.contains("gif")) {
            return "gif";
        }
        if (contentType.contains("svg")) {
            return "svg";
        }
        if (contentType.contains("png")) {
            return "png";
        }
        return extensionFromUrl(logoUrl).orElse("png");
    }

    private static Optional<String> extensionFromUrl(String url) {
        var path = URI.create(url).getPath();
        var dot = path.lastIndexOf('.');
        if (dot < 0 || dot == path.length() - 1) {
            return Optional.empty();
        }
        var ext = path.substring(dot + 1).toLowerCase();
        if (ext.length() > 5) {
            return Optional.empty();
        }
        return Optional.of(ext);
    }
}
