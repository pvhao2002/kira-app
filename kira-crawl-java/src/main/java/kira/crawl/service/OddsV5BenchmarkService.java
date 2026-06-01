package kira.crawl.service;

import kira.crawl.dto.OddsV4BenchmarkFixture;
import kira.crawl.dto.OddsV4BenchmarkLinkResult;
import kira.crawl.dto.OddsV4BenchmarkResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@RequiredArgsConstructor
public class OddsV5BenchmarkService {

    private final MatchesService matchesService;

    public OddsV4BenchmarkResponse runParallel(List<OddsV4BenchmarkFixture> fixtures) {
        OddsV4BenchmarkService.validateFixtures(fixtures);

        var totalStart = System.nanoTime();
        var results = new ArrayList<OddsV4BenchmarkLinkResult>(fixtures.size());

        try (ExecutorService executor = Executors.newFixedThreadPool(fixtures.size(), r -> {
            var thread = new Thread(r, "odds-v5-benchmark");
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
            var result = matchesService.getOddsV5(fixture.eventLink(), fixture.hasOddsCorner());
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
}
