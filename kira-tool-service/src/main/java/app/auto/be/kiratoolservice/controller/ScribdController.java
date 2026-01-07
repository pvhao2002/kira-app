package app.auto.be.kiratoolservice.controller;

import app.auto.be.kiratoolservice.util.PdfUtil;
import app.auto.be.kiratoolservice.util.PlaywrightUtil;
import app.auto.be.kiratoolservice.util.ScribdUtil;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

@RestController
@RequestMapping("scribd")
public class ScribdController {

    @GetMapping
    public Object getAllFiles() throws IOException {
        var resourceDir = getResourceDir();
        try (var stream = Files.list(resourceDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .map(path -> path.getFileName().toString())
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
        PlaywrightUtil.withPlaywright(request, (page, req) -> {
            final var finalUrl = ScribdUtil.buildEmbedUrl(req.url());
            final var name = ScribdUtil.extractDocumentName(req.url());
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
                throw new RuntimeException(e);
            }
        });
        return Map.of();
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

    public record ScribdRequest(String url) {
    }
}
