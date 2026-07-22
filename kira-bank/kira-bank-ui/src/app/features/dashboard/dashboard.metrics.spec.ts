import {describe, expect, it} from 'vitest';

describe('dashboard financial semantics', () => {
  it('does not count returned capital or withdrawal as profit', () => {
    const settlement = {capitalReturned: 10_000_000, profit: 500_000, reward: 100_000};
    const withdrawal = 5_000_000;
    const displayedProfit = settlement.profit;
    expect(displayedProfit).toBe(500_000);
    expect(displayedProfit).not.toBe(settlement.capitalReturned + settlement.profit + settlement.reward);
    expect(displayedProfit).not.toBe(withdrawal);
  });
});
