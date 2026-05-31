package kira.crawl.service;

import kira.crawl.dto.OddsV4BenchmarkFixture;
import kira.crawl.dto.OddsV4BenchmarkLinkResult;
import kira.crawl.dto.OddsV4BenchmarkResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class OddsV4BenchmarkService {

    private static final int MIN_FIXTURE_COUNT = 1;
    private static final int MAX_FIXTURE_COUNT = 10;

    private static final List<OddsV4BenchmarkFixture> DEFAULT_FIXTURES = List.of(
            new OddsV4BenchmarkFixture(
                    "https://www.aiscore.com/match-sk-treibach-sc-gleisdorf/527r3i4954pu47e",
                    true
            ),
            new OddsV4BenchmarkFixture(
                    "https://www.aiscore.com/match-elfsborg-mjallby-aif/g6763i5lw3jio7r",
                    true
            ),
            new OddsV4BenchmarkFixture(
                    "https://www.aiscore.com/match-ik-tord-skara-fc/edq09il49deceqx",
                    true
            ),
            new OddsV4BenchmarkFixture(
                    "https://www.aiscore.com/match-maccabi-tel-aviv-maccabi-haifa/edq09imvdooteqx",
                    false
            ),
            new OddsV4BenchmarkFixture(
                    "https://www.aiscore.com/match-western-sydney-central-coast-mariners/69759iy3x0efgk2",
                    false
            ),
            new OddsV4BenchmarkFixture(
                    "https://www.aiscore.com/match-pune-fc-mohun-bagan-super-giant/527r3i91jnwa47e",
                    false
            )
    );

    private final MatchesService matchesService;

    public OddsV4BenchmarkResponse runParallel(List<OddsV4BenchmarkFixture> fixtures) {
        validateFixtures(fixtures);

        var totalStart = System.nanoTime();
        var results = new ArrayList<OddsV4BenchmarkLinkResult>(fixtures.size());

        try (ExecutorService executor = Executors.newFixedThreadPool(fixtures.size(), r -> {
            var thread = new Thread(r, "odds-v4-benchmark");
            thread.setDaemon(true);
            return thread;
        })) {
            var futures = new ArrayList<CompletableFuture<OddsV4BenchmarkLinkResult>>();
            for (int i = 0; i < fixtures.size(); i++) {
                var index = i;
                var fixture = fixtures.get(i);
                futures.add(CompletableFuture.supplyAsync(
                        () -> runOne(index, fixture),
                        executor
                ));
            }
            CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
            for (var future : futures) {
                results.add(future.join());
            }
        }

        results.sort(Comparator.comparingInt(OddsV4BenchmarkLinkResult::index));
        var totalDurationMs = (System.nanoTime() - totalStart) / 1_000_000;

        return new OddsV4BenchmarkResponse(
                totalDurationMs,
                true,
                fixtures.size(),
                List.copyOf(results)
        );
    }

    private OddsV4BenchmarkLinkResult runOne(int index, OddsV4BenchmarkFixture fixture) {
        var start = System.nanoTime();
        try {
            var result = matchesService.getOddsV4(fixture.eventLink(), fixture.hasOddsCorner());
            return new OddsV4BenchmarkLinkResult(
                    index,
                    fixture.eventLink(),
                    fixture.hasOddsCorner(),
                    (System.nanoTime() - start) / 1_000_000,
                    result.matchId(),
                    true,
                    null
            );
        } catch (Exception ex) {
            return new OddsV4BenchmarkLinkResult(
                    index,
                    fixture.eventLink(),
                    fixture.hasOddsCorner(),
                    (System.nanoTime() - start) / 1_000_000,
                    null,
                    false,
                    ex.getMessage()
            );
        }
    }

    public static List<OddsV4BenchmarkFixture> defaultFixtures() {
        return DEFAULT_FIXTURES;
    }

    public static List<OddsV4BenchmarkFixture> parseFixturesParam(String fixturesParam) {
        if (fixturesParam == null || fixturesParam.isBlank()) {
            return List.of();
        }
        return Stream.of(fixturesParam.split("\\|"))
                .map(String::trim)
                .filter(part -> !part.isBlank())
                .map(OddsV4BenchmarkService::parseFixturePart)
                .toList();
    }

    private static OddsV4BenchmarkFixture parseFixturePart(String part) {
        var comma = part.lastIndexOf(',');
        if (comma <= 0 || comma >= part.length() - 1) {
            throw new IllegalArgumentException(
                    "Fixture must be eventLink,hasOddsCorner (comma-separated), got \"" + part + "\""
            );
        }
        var eventLink = part.substring(0, comma).trim();
        var hasOddsCornerRaw = part.substring(comma + 1).trim();
        if (!"true".equalsIgnoreCase(hasOddsCornerRaw) && !"false".equalsIgnoreCase(hasOddsCornerRaw)) {
            throw new IllegalArgumentException(
                    "hasOddsCorner must be true or false, got \"" + hasOddsCornerRaw + "\""
            );
        }
        return new OddsV4BenchmarkFixture(eventLink, Boolean.parseBoolean(hasOddsCornerRaw));
    }

    public static void validateFixtures(List<OddsV4BenchmarkFixture> fixtures) {
        if (fixtures.size() < MIN_FIXTURE_COUNT || fixtures.size() > MAX_FIXTURE_COUNT) {
            throw new IllegalArgumentException(
                    "Fixture count must be between " + MIN_FIXTURE_COUNT + " and " + MAX_FIXTURE_COUNT
                            + ", got " + fixtures.size()
            );
        }
        for (var fixture : fixtures) {
            validateAiscoreUrl(fixture.eventLink());
        }
    }

    private static void validateAiscoreUrl(String rawUrl) {
        URI url;
        try {
            url = URI.create(rawUrl);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid URL: \"" + rawUrl + "\"");
        }
        if (!"https".equalsIgnoreCase(url.getScheme())) {
            throw new IllegalArgumentException("URL must use https: \"" + rawUrl + "\"");
        }
        var host = url.getHost();
        if (!"aiscore.com".equals(host) && !"www.aiscore.com".equals(host)) {
            throw new IllegalArgumentException(
                    "URL host must be aiscore.com or www.aiscore.com, got \"" + host + "\""
            );
        }
    }
}
