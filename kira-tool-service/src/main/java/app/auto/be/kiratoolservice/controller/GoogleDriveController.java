package app.auto.be.kiratoolservice.controller;

import app.auto.be.kiratoolservice.util.GoogleDriveUtil;
import app.auto.be.kiratoolservice.util.PdfUtil;
import app.auto.be.kiratoolservice.util.PlaywrightUtil;
import com.microsoft.playwright.Page;
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
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.logging.Level;

@Log
@RestController
@RequestMapping("google-drive")
public class GoogleDriveController {
    private static final DateTimeFormatter FILE_NAME_TS_FORMATTER = DateTimeFormatter.ofPattern("ddMMyyyy_HH-mm-ss");

    private final BlockingQueue<DriveJob> queue = new LinkedBlockingQueue<>(1000);

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
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + resource.getFilename() + "\"")
                    .contentLength(Files.size(filePath))
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{fileName}")
    public Object deleteFile(@PathVariable String fileName) {
        try {
            Path baseDir = getResourceDir();
            Path filePath = baseDir.resolve(fileName).normalize();
            if (!filePath.startsWith(baseDir)) {
                return ResponseEntity.badRequest().build();
            }
            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }
            Files.delete(filePath);
            return Map.of("status", true);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping
    public Object exportPdf(@RequestBody DriveRequest request) {
        var fileName = buildOutputFileName(extractTitleFromUrl(request.url()));
        queue.add(new DriveJob(request.url(), fileName));
        return Map.of("status", true, "fileName", fileName);
    }

    @Scheduled(fixedDelay = 5000)
    public void processQueue() {
        while (!queue.isEmpty()) {
            DriveJob job = queue.poll();
            if (job != null) processUrl(job);
        }
    }

    private void processUrl(DriveJob job) {
        PlaywrightUtil.withPlaywright(job.url(), (page, driveUrl) -> {
            page.navigate(driveUrl, new Page.NavigateOptions().setTimeout(60_000));
            PlaywrightUtil.waitDomContentLoaded(page);
            page.waitForTimeout(3000);

            log.info("Processing Google Drive PDF: " + job.fileName());

            GoogleDriveUtil.scrollToLoadAllPages(page);

            List<String> images = GoogleDriveUtil.fetchBlobImagesAsBase64(page);

            if (images.isEmpty()) {
                // Log all blob URLs actually present in DOM for debugging.
                Object allBlobs = page.evaluate(
                        "() => Array.from(document.querySelectorAll('img[src^=\"blob:\"]')).map(i => i.src)"
                );
                log.warning("No Drive blob images found for: " + driveUrl + " | blobs in DOM: " + allBlobs);
                writeFailedMarker(job.fileName());
                return;
            }
            log.info("Fetched " + images.size() + " pages from: " + job.fileName());

            try {
                byte[] pdfBytes = GoogleDriveUtil.buildPdfFromImages(page, images);
                var outputPath = getResourceDir().resolve(job.fileName());
                Files.write(outputPath, pdfBytes);
                log.info("PDF saved: " + outputPath);
            } catch (IOException e) {
                log.log(Level.WARNING, "Failed to write PDF for: " + driveUrl, e);
                writeFailedMarker(job.fileName());
            }
        });
    }

    private void writeFailedMarker(String fileName) {
        try {
            Files.writeString(getResourceDir().resolve(fileName + ".failed"), "");
        } catch (IOException ex) {
            log.log(Level.WARNING, "Failed to write error marker for: " + fileName, ex);
        }
    }

    private Path getResourceDir() throws IOException {
        var resourceDir = Paths.get(System.getProperty("user.dir"), "upload", "google-drive");
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

    private String extractTitleFromUrl(String url) {
        if (url == null || url.isBlank()) {
            return "drive_document";
        }

        String[] parts = url.split("/");
        for (int i = parts.length - 1; i >= 0; i--) {
            String part = parts[i];
            if (!part.isBlank() && !"view".equalsIgnoreCase(part) && !"edit".equalsIgnoreCase(part)) {
                return part;
            }
        }
        return "drive_document";
    }

    private String buildOutputFileName(String rawTitle) {
        String title = PdfUtil.normalizeFileName(rawTitle);
        String timestamp = LocalDateTime.now().format(FILE_NAME_TS_FORMATTER);
        return title + "_" + timestamp + ".pdf";
    }

    public record DriveRequest(String url) {}

    private record DriveJob(String url, String fileName) {}
}
