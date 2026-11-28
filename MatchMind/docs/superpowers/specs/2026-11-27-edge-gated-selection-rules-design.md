# Edge-gated selection rules and a market-relative TRACK RECORD

Approved 2026-11-27. Small change: short design.

## Why

Prod analysis (134 settled picks, 2026-11-23..26, `meta-ai / muse-spark-1.3`): the agent's probabilities add nothing to
the bookmaker's price without margin (Brier 0.247 vs the market's 0.237; correlation of stated-minus-market with
result-minus-market −0.002). The prompt derives expected goals from the odds, so the simulation repeats the market.
Prompt v20 (V42) made it worse: "rank 1 = highest probability in the 1.66–1.90 window" plus "lower your probabilities
by the TRACK RECORD gap" forced a pick on every match; 28 of 38 v20 picks were rated below the market by the agent
itself. TRACK RECORD's FAVOUR/AVOID (6 picks, fixed 60 % / 45 %) chased noise and contradicted the rules.

## Goals

- The agent picks only when its expected return beats the market's by a margin and it can name an input the odds do
  not contain; otherwise it replies `NO_PICK_NO_EDGE`.
- Ranking and the stated probability follow the real payout of Asian quarter lines.
- TRACK RECORD and the prompt-tuning report judge every group against the market, the same way, and only call a group
  FAVOUR/AVOID when the sample proves it.

Non-goals: the dashboard win rate definition, settlement, callback contracts, the `GOALS_REPORT` sheet logic.
Anti-goal: rules that move with every day's noise.

## Approaches

1. **Chosen**: Flyway migration V45 (`replace()` on fixed anchors, `version + 1`) plus server changes to TRACK RECORD and
   the prompt-tuning report. Reproducible and covered by ITs.
2. Admin edit on the Prompt Notes page: fastest, but not in the repo or tests, and later migrations' anchors miss it.
3. Prompt only: TRACK RECORD would keep listing AVOID groups that contradict the new rules.

## Design

- **Prompt (V45)**: per candidate, the shares of the 1000 simulated finals that settle WIN, HALF_WIN, HALF_LOSS, LOSS
  give the expected return R; `probability = (1 + R) / price` (equals the win share on lines without halves or
  pushes); market q (no margin) and its return M = q × price − 1; `edge = R − M`. Keep a candidate only when
  edge ≥ 0.10, R ≥ 0.03 and a named non-odds input explains the gap; rank by R; rank 2 only if kept and in another
  market; corner markets only with both teams' corner averages; price window 1.66–1.90 kept. No probability shifts to
  fit TRACK RECORD. The LIVE/PRE_MATCH step 5 stop ranking by "WIN or HALF_WIN"; INPUT lists the optional independent
  data; the LIVE example shows live xG and dangerous attacks in `stats.extra` (a `JsonNode`, accepted as is).
- **Hit rate**: per pick `(1 + profit at stake 1) / price` over WIN, HALF_WIN, HALF_LOSS, LOSS: a win 1, a loss 0,
  halves in between. Its expectation equals the stated probability above, and the market's q when the agent has no
  edge, for every line type.
- **FAVOUR / AVOID** (one rule, `Bands.versusMarket`): at least 30 picks and hit rate above / below the average market
  probability by more than two standard errors (`2·√(q(1−q)/n)`).
- **TRACK RECORD**: hit rate instead of the half-counted win rate, each group "hit X% vs market Y%", no "lower your
  probabilities".
- **Prompt-tuning report**: rules follow V45 (keys `price`, `rank2`, `market`, `all` kept; `market` = edge ≥ 0.10
  and expected return ≥ 0.03 from the stated probability; `rank2` = another market than rank 1); every counter row
  gains `hitRate`; its text uses the shared FAVOUR/AVOID rule; web table gains a Hit column. API doc, sample JSON and
  `models.ts` change with it.

Left to the builder: exact prompt wording within the rules above, test fixtures.
Known limit: picks before V45 stated "WIN or HALF_WIN" probabilities, so TRACK RECORD's "you said" mixes definitions
until they leave the 60-day window.
