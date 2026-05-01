package com.db.kiragateway.rest;

import com.db.kiragateway.service.KiraCrawlExportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/export")
public class KiraCrawlExportController {

    private final KiraCrawlExportService exportService;
    private final ObjectMapper objectMapper;

    public KiraCrawlExportController(KiraCrawlExportService exportService, ObjectMapper objectMapper) {
        this.exportService = exportService;
        this.objectMapper = objectMapper;
    }

    /**
     * Writes the ZIP directly to the servlet output stream so Spring does not route the body through
     * {@code HttpMessageConverter}s (which fail for {@code StreamingResponseBody} + {@code application/zip}).
     */
    @GetMapping("/kira-crawl")
    public void exportKiraCrawl(HttpServletResponse response) throws IOException {
        if (!exportService.isExportEnabled()) {
            writeJsonError(response, HttpStatus.NOT_FOUND, "export disabled");
            return;
        }
        try {
            exportService.validateExportConfiguration();
        } catch (IllegalStateException ex) {
            writeJsonError(response, HttpStatus.NOT_FOUND,
                    ex.getMessage() != null ? ex.getMessage() : "invalid export configuration");
            return;
        } catch (IOException ex) {
            writeJsonError(response, HttpStatus.SERVICE_UNAVAILABLE,
                    ex.getMessage() != null ? ex.getMessage() : "could not read source directory");
            return;
        }

        response.setStatus(HttpStatus.OK.value());
        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"kira-crawl.zip\"");
        exportService.writeZipArchive(response.getOutputStream());
        response.flushBuffer();
    }

    private void writeJsonError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), Map.of(
                "status", "error",
                "message", message
        ));
    }
}
