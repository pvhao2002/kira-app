package com.matchmind.it;

/**
 * Callback payload builders matching docs/samples. Prediction times are in the past: the API refuses a predictedAt
 * more than 5 minutes ahead of its clock.
 */
final class Payloads {
    private Payloads() {
    }

    /** LIVE prediction at 1-0 (55') with 1X2, live AH (REMAINING_MATCH), live OU (FULL_MATCH); no corner data. */
    static String livePrediction(String eventId, String matchId, String model) {
        return """
            {
              "eventId": "%s",
              "model": {"name": "%s", "version": "1.0"},
              "match": {"externalMatchId": "%s", "league": "Premier League", "homeTeam": "Arsenal",
                        "awayTeam": "Chelsea", "startTime": "2025-11-20T19:45:00Z", "status": "LIVE"},
              "predictionType": "LIVE",
              "predictedAt": "2025-11-20T20:40:00Z",
              "matchMinute": 55,
              "currentScore": {"home": 1, "away": 0},
              "odds": [
                {"ref": "1x2-open", "market": "1X2", "stage": "OPENING", "homeOdds": 2.10, "drawOdds": 3.40, "awayOdds": 3.50},
                {"ref": "ah-live", "market": "AH", "stage": "LIVE", "line": -0.5, "lineDisplay": "-0.5",
                 "homeOdds": 1.95, "awayOdds": 1.90, "settlementBasis": "REMAINING_MATCH",
                 "scoreAtCapture": {"home": 1, "away": 0}, "capturedAt": "2025-11-20T20:39:30Z"},
                {"ref": "ou-live", "market": "OU", "stage": "LIVE", "line": 2.25, "overOdds": 1.85, "underOdds": 2.00,
                 "settlementBasis": "FULL_MATCH", "scoreAtCapture": {"home": 1, "away": 0}}
              ],
              "stats": {"possession": {"home": 58.5, "away": 41.5}, "shots": {"home": 11, "away": 5}},
              "simulation": {"method": "MONTE_CARLO_POISSON", "simulationCount": 1000, "randomSeed": 42,
                             "expectedRemainingGoals": {"home": 0.8, "away": 0.4}, "algorithmVersion": "poisson-v1",
                             "probabilities": {"1X2": {"HOME": 0.7, "DRAW": 0.2, "AWAY": 0.1}},
                             "correctScoreDistribution": [{"home": 1, "away": 0, "probability": 0.27}]},
              "picks": [
                {"oddsRef": "ah-live", "market": "AH", "pick": "HOME", "probability": 0.58, "rank": 1},
                {"oddsRef": "ou-live", "market": "OU", "pick": "OVER", "probability": 0.54, "rank": 2}
              ],
              "correctScore": {"home": 2, "away": 1, "probability": 0.14},
              "metadata": {"notes": "test"}
            }
            """.formatted(eventId, model, matchId);
    }

    /** PRE_MATCH prediction with optional corner markets; two picks (1X2, corner AH), the cap the prompts promise. */
    static String preMatchWithCorners(String eventId, String matchId, String model, String homePick) {
        return """
            {
              "eventId": "%s",
              "model": {"name": "%s", "version": "1.0"},
              "match": {"externalMatchId": "%s", "league": "La Liga", "homeTeam": "Real Madrid",
                        "awayTeam": "Barcelona", "startTime": "2025-11-21T20:00:00Z"},
              "predictionType": "PRE_MATCH",
              "predictedAt": "2025-11-21T18:00:00Z",
              "odds": [
                {"ref": "1x2", "market": "1X2", "stage": "PRE_MATCH", "homeOdds": 2.40, "drawOdds": 3.30, "awayOdds": 2.90},
                {"ref": "cou", "market": "CORNER_OU", "stage": "PRE_MATCH", "line": 9.75, "overOdds": 1.90, "underOdds": 1.90},
                {"ref": "cah", "market": "CORNER_AH", "stage": "PRE_MATCH", "line": -1.5, "homeOdds": 1.95, "awayOdds": 1.85}
              ],
              "picks": [
                {"oddsRef": "1x2", "market": "1X2", "pick": "%s", "probability": 0.45, "rank": 1},
                {"oddsRef": "cah", "market": "CORNER_AH", "pick": "HOME", "probability": 0.52, "rank": 2}
              ],
              "correctScore": {"home": 2, "away": 1, "probability": 0.11}
            }
            """.formatted(eventId, model, matchId, homePick);
    }

    static String result(String matchId, String status, String finalScore, String corners, String at) {
        return """
            {"externalMatchId": "%s", "status": "%s", %s %s "resultAt": "%s"}
            """.formatted(matchId, status,
            finalScore == null ? "" : "\"finalScore\": " + finalScore + ",",
            corners == null ? "" : "\"finalCorners\": " + corners + ",", at);
    }
}
