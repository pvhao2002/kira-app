// Tax rules as data, keyed by tax year. Every figure cites its document. NONE of these were checked against the
// primary gazette text while building (official sites were unreachable) — they come from concurring secondary
// sources (EY, KPMG, MOF Q&A portal, provincial portals), so every result carries the "chưa đối chiếu" note.
// Do not add a year or a rate from memory: add the document and its source to tax.ts first.

export interface TaxpayerClassOption {
  value: string;
  label: string;
}

export const TAXPAYER_CLASSES: TaxpayerClassOption[] = [
  {value: 'salary', label: 'Cá nhân không đăng ký kinh doanh (quyết toán theo biểu lũy tiến)'},
  {value: 'business', label: 'Cá nhân kinh doanh (thuế theo tỷ lệ trên doanh thu)'}
];

export interface TaxInput {
  year: number;
  taxpayerClass: string;
  /** VND for the whole year. */
  annualIncome: number;
  dependents: number;
}

export interface TaxResult {
  taxableIncome: number;
  taxDue: number;
  lines: {label: string; amount: number}[];
  notes: string[];
}

interface YearRule {
  /** [monthly taxable income upper bound in VND, rate]; last bound is Infinity. */
  brackets: [number, number][];
  bracketSource: string;
  personalMonthly: number;
  dependentMonthly: number;
  deductionSource: string;
  withholdingNote: string;
  business: {
    /** Annual revenue at or below which no VAT/PIT is due. */
    threshold: number;
    pitRate: number;
    /** null = rate not established well enough to compute. */
    vatRate: number | null;
    /** true: tax on revenue above the threshold only; false: on the whole revenue once over it. */
    onExcessOnly: boolean;
    source: string;
    caveats: string[];
  };
}

const M = 1_000_000;
const SEVEN: [number, number][] = [[5 * M, 0.05], [10 * M, 0.10], [18 * M, 0.15], [32 * M, 0.20], [52 * M, 0.25], [80 * M, 0.30], [Infinity, 0.35]];
const FIVE: [number, number][] = [[10 * M, 0.05], [30 * M, 0.10], [60 * M, 0.20], [100 * M, 0.30], [Infinity, 0.35]];

const OLD_BUSINESS: YearRule['business'] = {
  threshold: 100 * M, pitRate: 0.02, vatRate: 0.05, onExcessOnly: false,
  source: 'Thông tư 40/2021/TT-BTC, Phụ lục I (dịch vụ môi giới, hoa hồng đại lý: GTGT 5% + TNCN 2%; ngưỡng 100 triệu đồng/năm)',
  caveats: []
};

const RULES: Record<number, YearRule> = {
  2024: {
    brackets: SEVEN, bracketSource: 'Luật Thuế TNCN 2007, Điều 22 (biểu 7 bậc)',
    personalMonthly: 11 * M, dependentMonthly: 4.4 * M, deductionSource: 'Nghị quyết 954/2020/UBTVQH14',
    withholdingNote: 'Bên chi trả khấu trừ 10% với mỗi lần chi từ 2.000.000 đồng (Thông tư 111/2013/TT-BTC, Điều 25).',
    business: OLD_BUSINESS
  },
  2025: {
    brackets: SEVEN, bracketSource: 'Luật Thuế TNCN 2007, Điều 22 (biểu 7 bậc)',
    personalMonthly: 11 * M, dependentMonthly: 4.4 * M, deductionSource: 'Nghị quyết 954/2020/UBTVQH14',
    withholdingNote: 'Bên chi trả khấu trừ 10% với mỗi lần chi từ 2.000.000 đồng (Thông tư 111/2013/TT-BTC, Điều 25).',
    business: {
      ...OLD_BUSINESS,
      caveats: ['Từ 01/7/2025 ngưỡng doanh thu không chịu thuế GTGT là 200 triệu đồng/năm (Luật 48/2024/QH15); cách áp dụng cho cả năm 2025 chưa rõ, phần GTGT ở mức doanh thu 100–200 triệu có thể thấp hơn con số này.']
    }
  },
  2026: {
    brackets: FIVE, bracketSource: 'Luật Thuế TNCN số 109/2025/QH15 (biểu 5 bậc, áp dụng từ kỳ tính thuế 2026)',
    personalMonthly: 15.5 * M, dependentMonthly: 6.2 * M, deductionSource: 'Nghị quyết 110/2025/UBTVQH15',
    withholdingNote: 'Khấu trừ 10% với mỗi lần chi từ 2.000.000 đồng đến hết 30/6/2026 và từ 5.000.000 đồng kể từ 01/7/2026 (Nghị định 253/2026/NĐ-CP, Điều 50).',
    business: {
      threshold: 1000 * M, pitRate: 0.05, vatRate: null, onExcessOnly: true,
      source: 'Luật 109/2025/QH15 Điều 7 (nội dung số, quảng cáo số: TNCN 5%); Nghị định 68/2026/NĐ-CP sửa bởi Nghị định 141/2026/NĐ-CP (ngưỡng 1 tỷ đồng/năm); Công văn 7403/CT-TMĐT ngày 06/10/2026',
      caveats: [
        'Thuế GTGT năm 2026 KHÔNG được tính ở đây: thuế suất trên doanh thu áp dụng cho tiếp thị liên kết chưa xác minh được.',
        'Cách tính "phần doanh thu vượt ngưỡng × thuế suất" và việc được chọn phương pháp (doanh thu − chi phí) × 15% chưa đối chiếu văn bản gốc.',
        'Có phản ánh Shopee khấu trừ 5% GTGT + 5% TNCN trên hoa hồng từ 01/10/2026; khoản đã khấu trừ có được hoàn/bù trừ khi doanh thu dưới ngưỡng hay không thì chưa có hướng dẫn rõ.'
      ]
    }
  }
};

export const TAX_YEARS = Object.keys(RULES).map(Number);
const UNVERIFIED = 'Số liệu lấy từ nguồn thứ cấp, chưa đối chiếu văn bản gốc. Chỉ dùng để tham khảo.';

function progressive(annualTaxable: number, brackets: [number, number][]): number {
  let tax = 0, lower = 0;
  for (const [monthlyUpper, rate] of brackets) {
    const upper = monthlyUpper * 12;
    if (annualTaxable > lower) tax += (Math.min(annualTaxable, upper) - lower) * rate;
    lower = upper;
  }
  return Math.round(tax);
}

export function estimateTax(input: TaxInput): TaxResult {
  const rule = RULES[input.year];
  if (!rule) throw new Error(`Chưa có quy tắc thuế cho năm ${input.year}`);
  const income = input.annualIncome;

  if (input.taxpayerClass === 'salary') {
    const personal = rule.personalMonthly * 12, dependents = rule.dependentMonthly * 12 * input.dependents;
    const taxable = Math.max(0, income - personal - dependents);
    return {
      taxableIncome: taxable,
      taxDue: progressive(taxable, rule.brackets),
      lines: [
        {label: 'Thu nhập cả năm', amount: income},
        {label: 'Giảm trừ bản thân (12 tháng)', amount: -personal},
        {label: `Giảm trừ ${input.dependents} người phụ thuộc`, amount: -dependents}
      ],
      notes: [
        `Biểu thuế: ${rule.bracketSource}. Giảm trừ gia cảnh: ${rule.deductionSource}.`,
        rule.withholdingNote + ' Số đã bị khấu trừ trong năm được trừ vào thuế phải nộp khi quyết toán; nếu lớn hơn thì được hoàn.',
        'Giả định đây là toàn bộ thu nhập chịu thuế trong năm và chưa trừ bảo hiểm bắt buộc hay khoản giảm trừ khác.',
        ...(input.year >= 2026 ? ['Từ 2026 cơ quan thuế có hướng dẫn coi thu nhập tiếp thị liên kết là thu nhập kinh doanh (Công văn 7403/CT-TMĐT); hãy xem cả kết quả của nhóm "Cá nhân kinh doanh".'] : []),
        UNVERIFIED
      ]
    };
  }

  if (input.taxpayerClass === 'business') {
    const b = rule.business;
    const base = income <= b.threshold ? 0 : b.onExcessOnly ? income - b.threshold : income;
    const pit = Math.round(base * b.pitRate), vat = b.vatRate == null ? 0 : Math.round(base * b.vatRate);
    const lines = [
      {label: 'Doanh thu cả năm', amount: income},
      {label: 'Ngưỡng doanh thu không phải nộp thuế', amount: b.threshold},
      {label: `Thuế TNCN (${b.pitRate * 100}%)`, amount: pit}
    ];
    if (b.vatRate != null) lines.push({label: `Thuế GTGT (${b.vatRate * 100}%)`, amount: vat});
    return {
      taxableIncome: base,
      taxDue: pit + vat,
      lines,
      notes: [`Căn cứ: ${b.source}.`, ...b.caveats, 'Không áp dụng giảm trừ gia cảnh cho thu nhập kinh doanh tính theo doanh thu.', UNVERIFIED]
    };
  }

  throw new Error('Chưa chọn đối tượng nộp thuế');
}
