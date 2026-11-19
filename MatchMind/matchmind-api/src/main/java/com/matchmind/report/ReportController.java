package com.matchmind.report;

import com.matchmind.shared.ApiTypes.PageResponse;
import com.matchmind.shared.Filters;
import com.matchmind.shared.TableExport;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Every endpoint accepts the shared filters: from, to (ISO instants, to exclusive), league, modelId, providerId,
 * type (PRE_MATCH|LIVE), market, matchId, search, result.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Dashboard & reports")
public class ReportController {
    private final ReportService reports;

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(Filters filters, @RequestParam(required = false) String tz) {
        return reports.dashboard(filters, tz);
    }

    @GetMapping("/reports/model-performance")
    public List<Map<String, Object>> modelPerformance(Filters filters) {
        return reports.modelPerformance(filters);
    }

    @GetMapping("/reports/breakdown")
    @Operation(summary = "Pick performance grouped by market, league, type, stage or model (use modelId to drill into one model)")
    public List<Map<String, Object>> breakdown(Filters filters, @RequestParam(defaultValue = "market") String by) {
        return reports.breakdown(filters, by);
    }

    @GetMapping("/reports/prediction-history")
    public PageResponse<Map<String, Object>> history(Filters filters, @RequestParam(required = false) Integer page,
                                                     @RequestParam(required = false) Integer size,
                                                     @RequestParam(required = false) String sort) {
        return reports.predictionHistory(filters, page, size, sort);
    }

    @GetMapping("/reports/prediction-history/export")
    @Operation(summary = "Export the filtered prediction history as CSV or XLSX (max 50,000 rows)")
    public ResponseEntity<byte[]> export(Filters filters, @RequestParam(defaultValue = "csv") String format,
                                         @RequestParam(required = false) String sort) {
        return TableExport.download(format, "matchmind-prediction-history", ReportService.EXPORT_COLUMNS,
            reports.predictionHistoryExport(filters, sort));
    }

    @GetMapping("/reports/market-performance")
    public List<Map<String, Object>> marketPerformance(Filters filters) {
        return reports.marketPerformance(filters);
    }

    @GetMapping("/reports/model-comparison")
    public PageResponse<Map<String, Object>> modelComparison(Filters filters,
                                                             @RequestParam(required = false) Integer minModels,
                                                             @RequestParam(required = false) Integer page,
                                                             @RequestParam(required = false) Integer size) {
        return reports.modelComparison(filters, minModels, page, size);
    }

    @GetMapping("/reports/monte-carlo")
    public Map<String, Object> monteCarlo(Filters filters, @RequestParam(required = false) Integer page,
                                          @RequestParam(required = false) Integer size) {
        return reports.monteCarlo(filters, page, size);
    }
}
