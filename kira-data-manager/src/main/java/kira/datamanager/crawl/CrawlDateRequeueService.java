package kira.datamanager.crawl;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class CrawlDateRequeueService {

    private final CrawlDateRepository crawlDateRepository;
    private final RestClient kiraProducerRestClient;

    public CrawlDateRequeueService(
            CrawlDateRepository crawlDateRepository,
            @Qualifier("kiraProducerRestClient") RestClient kiraProducerRestClient) {
        this.crawlDateRepository = crawlDateRepository;
        this.kiraProducerRestClient = kiraProducerRestClient;
    }

    public CrawlDateRequeueResult requeueDate(String date) {
        final String crawlDate;
        try {
            crawlDate = CrawlDateUtil.toCrawlDateFormat(date);
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage());
        }

        try {
            enqueueDate(crawlDate);
        } catch (RestClientResponseException ex) {
            return proxyError(ex);
        } catch (RuntimeException ex) {
            return new CrawlDateRequeueResult(
                    HttpStatus.BAD_GATEWAY,
                    Map.of("status", "error", "message", "failed to enqueue date")
            );
        }

        crawlDateRepository.markPicked(crawlDate);
        return new CrawlDateRequeueResult(HttpStatus.OK, Map.of("status", "ok", "date", crawlDate));
    }

    public CrawlDateRequeueResult requeueDateRange(String fromDate, String toDate) {
        final LocalDate start;
        final LocalDate end;
        try {
            start = CrawlDateUtil.parseCrawlInputDate(fromDate);
            end = CrawlDateUtil.parseCrawlInputDate(toDate);
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage());
        }
        if (start.isAfter(end)) {
            return badRequest("fromDate must be on or before toDate");
        }

        var enqueued = new ArrayList<String>();
        var failed = new ArrayList<String>();
        for (LocalDate current = start; !current.isAfter(end); current = current.plusDays(1)) {
            String crawlDate = CrawlDateUtil.formatCrawlDate(current);
            try {
                enqueueDate(crawlDate);
                enqueued.add(crawlDate);
            } catch (RuntimeException ex) {
                failed.add(crawlDate);
            }
        }

        if (enqueued.isEmpty()) {
            var body = new LinkedHashMap<String, Object>();
            body.put("status", "error");
            body.put("message", "failed to enqueue any date");
            body.put("fromDate", CrawlDateUtil.toCrawlDateFormat(fromDate));
            body.put("toDate", CrawlDateUtil.toCrawlDateFormat(toDate));
            body.put("failed", List.copyOf(failed));
            return new CrawlDateRequeueResult(HttpStatus.BAD_GATEWAY, body);
        }

        crawlDateRepository.markPickedBatch(enqueued);

        int totalDays = (int) ChronoUnit.DAYS.between(start, end) + 1;
        var body = new LinkedHashMap<String, Object>();
        body.put("status", failed.isEmpty() ? "ok" : "partial");
        body.put("fromDate", CrawlDateUtil.formatCrawlDate(start));
        body.put("toDate", CrawlDateUtil.formatCrawlDate(end));
        body.put("total", totalDays);
        body.put("enqueued", enqueued.size());
        body.put("dates", List.copyOf(enqueued));
        if (!failed.isEmpty()) {
            body.put("failed", List.copyOf(failed));
        }
        return new CrawlDateRequeueResult(HttpStatus.OK, body);
    }

    private void enqueueDate(String crawlDate) {
        kiraProducerRestClient.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/producer/crawl-dates/{date}/requeue")
                        .build(crawlDate))
                .retrieve()
                .toBodilessEntity();
    }

    private static CrawlDateRequeueResult badRequest(String message) {
        return new CrawlDateRequeueResult(
                HttpStatus.BAD_REQUEST,
                Map.of("status", "error", "message", message)
        );
    }

    private static CrawlDateRequeueResult proxyError(RestClientResponseException ex) {
        var body = new LinkedHashMap<String, Object>();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> errBody = ex.getResponseBodyAs(Map.class);
            if (errBody != null) {
                return new CrawlDateRequeueResult(ex.getStatusCode(), errBody);
            }
        } catch (RuntimeException ignored) {
            // fall through
        }
        body.put("status", "error");
        body.put("message", ex.getMessage());
        return new CrawlDateRequeueResult(ex.getStatusCode(), body);
    }
}
