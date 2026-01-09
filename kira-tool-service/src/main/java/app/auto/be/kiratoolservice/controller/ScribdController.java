package app.auto.be.kiratoolservice.controller;

import app.auto.be.kiratoolservice.util.PdfUtil;
import app.auto.be.kiratoolservice.util.PlaywrightUtil;
import app.auto.be.kiratoolservice.util.ScribdUtil;
import lombok.extern.java.Log;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.logging.Level;

@Log
@RestController
@RequestMapping("scribd")
public class ScribdController {
    private final BlockingQueue<String> queue = new LinkedBlockingQueue<>(1000);

    @GetMapping
    public Object getAllFiles() throws IOException {
        var dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        var resourceDir = getResourceDir();
        try (var stream = Files.list(resourceDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .map(path -> {
                        var file = path.toFile();
                        return Map.of(
                                "name", file.getName(),
                                "date", Instant.ofEpochMilli(file.lastModified())
                                        .atZone(ZoneId.systemDefault())
                                        .format(dateFormatter),
                                "size", formatFileSize(file.length())
                        );
                    })
                    .toList();
        }
    }

    @GetMapping("/download/{fileName}")
    public Object download(@PathVariable String fileName) {
        try {
            Path baseDir = getResourceDir();
            Path filePath = baseDir.resolve(fileName).normalize();
            if (!filePath.startsWith(baseDir)) {
                return ResponseEntity.badRequest().build();
            }

            if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
                return ResponseEntity.notFound().build();
            }

            var resource = new UrlResource(filePath.toUri());

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(
                            HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + resource.getFilename() + "\""
                    )
                    .contentLength(Files.size(filePath))
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }


    @PostMapping
    public Object getScribd(@RequestBody ScribdRequest request) {
        queue.add(request.url());
        return Map.of("status", true);
    }

    @Scheduled(fixedDelay = 5000)
    public void processQueue() {
        while (!queue.isEmpty()) {
            String mUrl = queue.poll();
            if (mUrl != null) {
                PlaywrightUtil.withPlaywright(mUrl, (page, url) -> {
                    final var finalUrl = ScribdUtil.buildEmbedUrl(url);
                    final var name = PdfUtil.normalizeFileName(ScribdUtil.extractDocumentName(url));
                    page.navigate(finalUrl);
                    PlaywrightUtil.waitDomContentLoaded(page);
                    page.evaluate("() => document.querySelector('button.osano-cm-accept-all.osano-cm-buttons__button.osano-cm-button.osano-cm-button--type_accept').click()");
                    ScribdUtil.scrollToEnd(page);
                    ScribdUtil.removeScribdOverlays(page);
                    ScribdUtil.waitForImages(page);
                    byte[] pdfBytes = PdfUtil.printPdf(page);
                    try {
                        var resourceDir = getResourceDir();

                        var outputPath = resourceDir.resolve(name + ".pdf");
                        Files.write(outputPath, pdfBytes);
                    } catch (IOException e) {
                        log.log(Level.WARNING, "Failed to write PDF file for URL: " + url, e);
                    }
                });
            }
        }
    }

    private Path getResourceDir() throws IOException {
        var resourceDir = Paths.get(
                System.getProperty("user.dir"),
                "upload", "scribd"
        );

        if (!Files.exists(resourceDir)) {
            Files.createDirectories(resourceDir);
        }
        return resourceDir;
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";

        int unit = 1024;
        int exp = (int) (Math.log(bytes) / Math.log(unit));
        String pre = "KMGTPE".charAt(exp - 1) + "B";

        return String.format("%.2f %s", bytes / Math.pow(unit, exp), pre);
    }

    public record ScribdRequest(String url) {
    }
}
