import {describe, expect, it} from 'vitest';
import {estimateTax} from './tax-rules';

const tax = (year: number, taxpayerClass: string, annualIncome: number, dependents = 0) =>
  estimateTax({year, taxpayerClass, annualIncome, dependents});

describe('estimateTax', () => {
  it('2025 salary: 7 brackets, 11m/4.4m deductions', () => {
    const r = tax(2025, 'salary', 300_000_000, 1);
    expect(r.taxableIncome).toBe(115_200_000); // 300m - 132m - 52.8m
    expect(r.taxDue).toBe(8_520_000); // 60m*5% + 55.2m*10%
  });

  it('2026 salary: 5 brackets, 15.5m/6.2m deductions', () => {
    const r = tax(2026, 'salary', 300_000_000);
    expect(r.taxableIncome).toBe(114_000_000); // 300m - 186m
    expect(r.taxDue).toBe(5_700_000); // within the first bracket (120m/year) at 5%
    expect(tax(2026, 'salary', 186_000_000).taxDue).toBe(0);
    expect(tax(2026, 'salary', 100_000_000, 2).taxableIncome).toBe(0);
  });

  it('top bracket is open-ended', () => {
    // 2025: taxable 1.2bn/year -> 9.9m*12... computed per bracket: 3+6+14.4+33.6+60+100.8+(1200-960)*0.35=84 => 301.8m
    expect(tax(2025, 'salary', 1_200_000_000 + 132_000_000).taxDue).toBe(301_800_000);
  });

  it('business up to 2025: nothing at or under 100m, then 5% VAT + 2% PIT on all revenue', () => {
    expect(tax(2025, 'business', 100_000_000).taxDue).toBe(0);
    expect(tax(2024, 'business', 200_000_000).taxDue).toBe(14_000_000);
  });

  it('business 2026: 1bn threshold, 5% PIT on the excess, VAT not computed', () => {
    expect(tax(2026, 'business', 900_000_000).taxDue).toBe(0);
    const r = tax(2026, 'business', 1_200_000_000);
    expect(r.taxDue).toBe(10_000_000);
    expect(r.lines.some(l => l.label.includes('GTGT'))).toBe(false);
    expect(r.notes.join(' ')).toContain('GTGT năm 2026 KHÔNG được tính');
  });

  it('every result says the figures are unverified; unknown year or class throws', () => {
    expect(tax(2025, 'salary', 1).notes.at(-1)).toContain('chưa đối chiếu văn bản gốc');
    expect(() => tax(2019, 'salary', 1)).toThrow();
    expect(() => tax(2025, '', 1)).toThrow();
  });
});
