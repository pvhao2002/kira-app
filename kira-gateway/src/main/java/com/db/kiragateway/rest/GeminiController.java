package com.db.kiragateway.rest;

import com.db.kiragateway.dto.DescribeInstrumentRequest;
import com.db.kiragateway.dto.DescribeInstrumentResponse;
import com.db.kiragateway.dto.GenerateBlogRequest;
import com.db.kiragateway.dto.GenerateBlogResponse;
import com.db.kiragateway.service.BlogGenerationService;
import com.db.kiragateway.service.GeminiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Set;
import java.util.logging.Logger;

@RestController
@RequestMapping("/ai/instruments")
@RequiredArgsConstructor
public class GeminiController {

    private static final Logger log = Logger.getLogger(GeminiController.class.getName());
    private static final String DEFAULT_PROMPT = """
            You are an AI assistant specialized in extracting structured financial transaction data from images.
            
            Task:
            Analyze the provided image and extract all transaction records visible.
            
            Requirements:
            - Return the result as a JSON array only (no explanation, no extra text).
            - Each item in the array must follow this format:
              {
                "datetime": string,
                "description": string,
                "amount": number,
                "type": "deposit" | "withdrawal" | "bonus"
              }
            
            Extraction rules:
            1. datetime:
               - Extract the full date and time if available.
               - Use ISO format if possible: YYYY-MM-DD HH:mm:ss
               - If time is missing, use YYYY-MM-DD.
            
            2. description:
               - Extract the transaction content (e.g., transfer note, merchant name, game, system message).
               - Keep it concise but meaningful.
            
            3. amount:
               - Extract numeric value only (no currency symbols, no commas).
               - Always return a positive number.
            
            4. type:
               - "deposit": money going INTO the account (e.g., top-up, received money).
               - "withdrawal": money going OUT of the account (e.g., payment, transfer out, bet).
               - "bonus": promotions, cashback, rewards, free credits.
            
            5. If a field is missing in the image:
               - Use null for that field.
            
            6. Ignore unrelated UI elements (ads, buttons, navigation, etc.).
            
            7. If no transactions are found:
               - Return an empty array: []
            
            Output example:
            [
              {
                "datetime": "2026-05-01 14:32:10",
                "description": "Transfer from Nguyen Van A",
                "amount": 500000,
                "type": "deposit"
              },
              {
                "datetime": "2026-05-01 15:10:05",
                "description": "Coffee payment",
                "amount": 45000,
                "type": "withdrawal"
              }
            ]
            """;
    private static final Set<String> SUPPORTED_IMAGE_TYPES = Set.of(
            MediaType.IMAGE_JPEG_VALUE,
            MediaType.IMAGE_PNG_VALUE
    );

    private final GeminiService geminiService;
    private final BlogGenerationService blogGenerationService;

    @PostMapping(
            path = "/describe",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<?> describeInstrument(@ModelAttribute DescribeInstrumentRequest request) {
        if (request == null || request.getImage() == null || request.getImage().isEmpty()) {
            return ResponseEntity.badRequest().body(error("image is required"));
        }

        var mimeType = request.getImage().getContentType();
        if (!StringUtils.hasText(mimeType) || !SUPPORTED_IMAGE_TYPES.contains(mimeType)) {
            return ResponseEntity.badRequest().body(error("Only image/jpeg and image/png are supported"));
        }

        var prompt = StringUtils.hasText(request.getPrompt()) ? request.getPrompt().trim() : DEFAULT_PROMPT;
        try {
            var data = geminiService.describeTransactionsResult(request.getImage().getBytes(), mimeType, prompt);
            return ResponseEntity.ok(new DescribeInstrumentResponse("ok", geminiService.getModel(), data));
        } catch (GeminiService.GeminiUpstreamException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(error(ex.getResponseBody()));
        } catch (IOException ex) {
            log.warning("Failed to read image bytes: %s".formatted(ex.getMessage()));
            return ResponseEntity.badRequest().body(error("Invalid image data"));
        }
    }

    @PostMapping(
            path = "/blog/generate",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<GenerateBlogResponse> generateBlog(@AuthenticationPrincipal Jwt jwt,
                                                             @Valid @RequestBody GenerateBlogRequest request) {
        if (request.minWords() != null && request.maxWords() != null && request.minWords() > request.maxWords()) {
            return ResponseEntity.badRequest().build();
        }
        String createdBy = resolveCreatedBy(jwt);
        GenerateBlogRequest requestWithCreator = new GenerateBlogRequest(
                request.topic(),
                request.tone(),
                request.targetAudience(),
                request.minWords(),
                request.maxWords(),
                createdBy,
                request.publishNow()
        );
        return ResponseEntity.ok(blogGenerationService.generateAndSave(requestWithCreator));
    }

    private static Object error(Object message) {
        return java.util.Map.of("status", "error", "message", message);
    }

    private String resolveCreatedBy(Jwt jwt) {
        if (jwt == null) {
            return "system";
        }
        var uid = jwt.getClaim("uid");
        if (uid instanceof Number number && number.intValue() > 0) {
            return String.valueOf(number.intValue());
        }
        if (StringUtils.hasText(jwt.getSubject())) {
            return jwt.getSubject();
        }
        return "system";
    }
}
