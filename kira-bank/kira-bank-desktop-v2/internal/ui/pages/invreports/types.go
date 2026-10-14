package invreports

import (
	"encoding/json"

	"github.com/shopspring/decimal"
)

// D is a money/number value; D? fields are pointers (JSON null).
type D = decimal.Decimal

type envelope struct {
	Type       string `json:"type"`
	FromDate   string `json:"fromDate"`
	ToDate     string `json:"toDate"`
	TimeZone   string `json:"timeZone"`
	AccountID  *int64 `json:"accountId"`
	Currencies []struct {
		Currency string          `json:"currency"`
		Data     json.RawMessage `json:"data"`
	} `json:"currencies"`
}

type totals struct {
	Count        int `json:"count"`
	Deposits     D   `json:"deposits"`
	Withdrawals  D   `json:"withdrawals"`
	Bonuses      D   `json:"bonuses"`
	Net          D   `json:"net"`
	NetWithBonus D   `json:"netWithBonus"`
}

type periodRow struct {
	Period        string `json:"period"`
	Start         string `json:"start"`
	Totals        totals `json:"totals"`
	CumulativeNet D      `json:"cumulativeNet"`
	NetChange     *D     `json:"netChange"`
	NetChangePct  *D     `json:"netChangePct"`
}

type periodicReport struct {
	Granularity      string      `json:"granularity"`
	Totals           totals      `json:"totals"`
	AverageNet       D           `json:"averageNet"`
	Best             *periodRow  `json:"best"`
	Worst            *periodRow  `json:"worst"`
	ProfitablePeriod int         `json:"profitablePeriods"`
	LosingPeriods    int         `json:"losingPeriods"`
	Rows             []periodRow `json:"rows"`
}

type accountRow struct {
	AccountID         int64  `json:"accountId"`
	AccountName       string `json:"accountName"`
	Totals            totals `json:"totals"`
	RoiPct            *D     `json:"roiPct"`
	AverageDeposit    D      `json:"averageDeposit"`
	AverageWithdrawal D      `json:"averageWithdrawal"`
	FirstDate         string `json:"firstDate"`
	LastDate          string `json:"lastDate"`
	DaysSinceLast     int    `json:"daysSinceLast"`
	NetSharePct       *D     `json:"netSharePct"`
}

type accountsReport struct {
	Totals totals       `json:"totals"`
	Rows   []accountRow `json:"rows"`
}

type matrixRow struct {
	AccountID   int64  `json:"accountId"`
	AccountName string `json:"accountName"`
	Cells       []D    `json:"cells"`
	Cumulative  []D    `json:"cumulative"`
	Total       D      `json:"total"`
}

type matrixReport struct {
	Months           []string    `json:"months"`
	Rows             []matrixRow `json:"rows"`
	MonthTotals      []D         `json:"monthTotals"`
	CumulativeTotals []D         `json:"cumulativeTotals"`
}

type equityPoint struct {
	Date          string `json:"date"`
	Net           D      `json:"net"`
	CumulativeNet D      `json:"cumulativeNet"`
	Peak          D      `json:"peak"`
	Drawdown      D      `json:"drawdown"`
}

type dayNet struct {
	Date string `json:"date"`
	Net  D      `json:"net"`
}

type equityReport struct {
	Points           []equityPoint `json:"points"`
	FinalNet         D             `json:"finalNet"`
	PeakNet          D             `json:"peakNet"`
	MaxDrawdown      D             `json:"maxDrawdown"`
	MaxDrawdownDate  *string       `json:"maxDrawdownDate"`
	CurrentDrawdown  D             `json:"currentDrawdown"`
	BestDay          *dayNet       `json:"bestDay"`
	WorstDay         *dayNet       `json:"worstDay"`
	ActiveDays       int           `json:"activeDays"`
	WinDays          int           `json:"winDays"`
	LossDays         int           `json:"lossDays"`
	LongestWinStreak int           `json:"longestWinStreak"`
	LongestLossStrk  int           `json:"longestLossStreak"`
	CurrentStreak    int           `json:"currentStreak"`
}

type performanceReport struct {
	ActiveDays       int `json:"activeDays"`
	WinDays          int `json:"winDays"`
	LossDays         int `json:"lossDays"`
	WinRatePct       *D  `json:"winRatePct"`
	GrossWin         D   `json:"grossWin"`
	GrossLoss        D   `json:"grossLoss"`
	AverageWin       D   `json:"averageWin"`
	AverageLoss      D   `json:"averageLoss"`
	PayoffRatio      *D  `json:"payoffRatio"`
	ProfitFactor     *D  `json:"profitFactor"`
	ExpectancyPerDay D   `json:"expectancyPerDay"`
	MedianDayNet     D   `json:"medianDayNet"`
	LargestWin       D   `json:"largestWin"`
	LargestLoss      D   `json:"largestLoss"`
	TotalNet         D   `json:"totalNet"`
	MaxDrawdown      D   `json:"maxDrawdown"`
	RecoveryFactor   *D  `json:"recoveryFactor"`
}

type drawdownEpisode struct {
	PeakDate      string  `json:"peakDate"`
	StartDate     string  `json:"startDate"`
	TroughDate    string  `json:"troughDate"`
	RecoveryDate  *string `json:"recoveryDate"`
	Depth         D       `json:"depth"`
	DaysToTrough  int     `json:"daysToTrough"`
	DaysToRecover *int    `json:"daysToRecover"`
	DurationDays  int     `json:"durationDays"`
}

type drawdownReport struct {
	Episodes    []drawdownEpisode `json:"episodes"`
	Count       int               `json:"count"`
	Ongoing     bool              `json:"ongoing"`
	LongestDays int               `json:"longestDays"`
	Deepest     D                 `json:"deepest"`
}

type rollingPoint struct {
	Date      string `json:"date"`
	Net       D      `json:"net"`
	Rolling7  D      `json:"rolling7"`
	Rolling30 D      `json:"rolling30"`
}

type rollingReport struct {
	Points          []rollingPoint `json:"points"`
	Latest7         D              `json:"latest7"`
	Latest30        D              `json:"latest30"`
	Best7           *D             `json:"best7"`
	Worst7          *D             `json:"worst7"`
	AverageDailyNet D              `json:"averageDailyNet"`
	Volatility      D              `json:"volatility"`
}

type dayRow struct {
	Date   string `json:"date"`
	Totals totals `json:"totals"`
}

type dailyReport struct {
	Totals                       totals   `json:"totals"`
	Days                         []dayRow `json:"days"`
	Best                         *dayRow  `json:"best"`
	Worst                        *dayRow  `json:"worst"`
	AverageNetPerActiveDay       D        `json:"averageNetPerActiveDay"`
	AverageTransactionsPerActive D        `json:"averageTransactionsPerActiveDay"`
}

type keyTotals struct {
	Key    int    `json:"key"`
	Totals totals `json:"totals"`
}

type activityReport struct {
	ByWeekday         []keyTotals `json:"byWeekday"`
	ByHour            []keyTotals `json:"byHour"`
	ByDayOfMonth      []keyTotals `json:"byDayOfMonth"`
	Matrix            [][]D       `json:"matrix"`
	BusiestWeekday    int         `json:"busiestWeekday"`
	BusiestHour       int         `json:"busiestHour"`
	BusiestDayOfMonth int         `json:"busiestDayOfMonth"`
}

type typeStats struct {
	Type    string `json:"type"`
	Count   int    `json:"count"`
	Total   D      `json:"total"`
	Min     D      `json:"min"`
	Max     D      `json:"max"`
	Average D      `json:"average"`
	Median  D      `json:"median"`
	P90     D      `json:"p90"`
}

type bucket struct {
	From        D   `json:"from"`
	To          D   `json:"to"`
	Deposits    int `json:"deposits"`
	Withdrawals int `json:"withdrawals"`
	Bonuses     int `json:"bonuses"`
}

type largestTx struct {
	AccountName string `json:"accountName"`
	Type        string `json:"type"`
	Amount      D      `json:"amount"`
	At          string `json:"at"`
}

type distributionReport struct {
	ByType  []typeStats `json:"byType"`
	Buckets []bucket    `json:"buckets"`
	Largest []largestTx `json:"largest"`
}

type bonusRow struct {
	Key                string `json:"key"`
	Label              string `json:"label"`
	Bonuses            D      `json:"bonuses"`
	Deposits           D      `json:"deposits"`
	BonusPctOfDeposits *D     `json:"bonusPctOfDeposits"`
	BonusCount         int    `json:"bonusCount"`
}

type bonusReport struct {
	TotalBonuses       D          `json:"totalBonuses"`
	TotalDeposits      D          `json:"totalDeposits"`
	BonusPctOfDeposits *D         `json:"bonusPctOfDeposits"`
	BonusPctOfPositive *D         `json:"bonusPctOfPositiveNet"`
	AverageBonus       D          `json:"averageBonus"`
	LargestBonus       D          `json:"largestBonus"`
	ByMonth            []bonusRow `json:"byMonth"`
	ByAccount          []bonusRow `json:"byAccount"`
}

type ledgerRow struct {
	At          string `json:"at"`
	AccountID   int64  `json:"accountId"`
	AccountName string `json:"accountName"`
	Type        string `json:"type"`
	Amount      D      `json:"amount"`
	SignedNet   D      `json:"signedNet"`
	RunningNet  D      `json:"runningNet"`
}

type ledgerReport struct {
	Totals    totals      `json:"totals"`
	Truncated bool        `json:"truncated"`
	Limit     int         `json:"limit"`
	Rows      []ledgerRow `json:"rows"`
}

type cadenceRow struct {
	AccountID                int64   `json:"accountId"`
	AccountName              string  `json:"accountName"`
	Transactions             int     `json:"transactions"`
	AverageGapDays           *D      `json:"averageGapDays"`
	LongestGapDays           int     `json:"longestGapDays"`
	LongestGapFrom           *string `json:"longestGapFrom"`
	LongestGapTo             *string `json:"longestGapTo"`
	AvgDaysDepositToWithdraw *D      `json:"avgDaysDepositToWithdrawal"`
}

type cadenceReport struct {
	AverageGapDays           *D           `json:"averageGapDays"`
	AvgDaysDepositToWithdraw *D           `json:"avgDaysDepositToWithdrawal"`
	Rows                     []cadenceRow `json:"rows"`
}

type allocationRow struct {
	AccountID          int64  `json:"accountId"`
	AccountName        string `json:"accountName"`
	Deposits           D      `json:"deposits"`
	Withdrawals        D      `json:"withdrawals"`
	Outstanding        D      `json:"outstanding"`
	OutstandingSharePc *D     `json:"outstandingSharePct"`
	DepositSharePct    *D     `json:"depositSharePct"`
}

type allocationReport struct {
	TotalDeposits    D               `json:"totalDeposits"`
	TotalOutstanding D               `json:"totalOutstanding"`
	HHI              *D              `json:"hhi"`
	Concentration    string          `json:"concentration"`
	TopSharePct      *D              `json:"topSharePct"`
	Rows             []allocationRow `json:"rows"`
}

type lot struct {
	AccountID     int64   `json:"accountId"`
	AccountName   string  `json:"accountName"`
	DepositDate   string  `json:"depositDate"`
	Amount        D       `json:"amount"`
	Recovered     D       `json:"recovered"`
	Outstanding   D       `json:"outstanding"`
	RecoveredDate *string `json:"recoveredDate"`
	DaysToRecover *int    `json:"daysToRecover"`
	AgeDays       int     `json:"ageDays"`
}

type aging struct {
	Bucket      string `json:"bucket"`
	Lots        int    `json:"lots"`
	Outstanding D      `json:"outstanding"`
}

type lotsReport struct {
	LotCount           int     `json:"lotCount"`
	RecoveredLots      int     `json:"recoveredLots"`
	AverageDaysRecover *D      `json:"averageDaysToRecover"`
	TotalDeposited     D       `json:"totalDeposited"`
	TotalRecovered     D       `json:"totalRecovered"`
	Outstanding        D       `json:"outstanding"`
	Aging              []aging `json:"aging"`
	Truncated          bool    `json:"truncated"`
	Lots               []lot   `json:"lots"`
}

type paybackRow struct {
	AccountID       int64   `json:"accountId"`
	AccountName     string  `json:"accountName"`
	Deposits        D       `json:"deposits"`
	Withdrawals     D       `json:"withdrawals"`
	RecoveredPct    *D      `json:"recoveredPct"`
	Outstanding     D       `json:"outstanding"`
	BrokeEven       bool    `json:"brokeEven"`
	FirstDate       string  `json:"firstDate"`
	BreakEvenDate   *string `json:"breakEvenDate"`
	DaysToBreakEven *int    `json:"daysToBreakEven"`
}

type paybackReport struct {
	Deposits          D            `json:"deposits"`
	Withdrawals       D            `json:"withdrawals"`
	RecoveredPct      *D           `json:"recoveredPct"`
	Outstanding       D            `json:"outstanding"`
	AccountsBrokeEven int          `json:"accountsBrokeEven"`
	AccountsOutstand  int          `json:"accountsOutstanding"`
	Rows              []paybackRow `json:"rows"`
}

type seasonMonth struct {
	Month              int `json:"month"`
	Occurrences        int `json:"occurrences"`
	WinningOccurrences int `json:"winningOccurrences"`
	Count              int `json:"count"`
	TotalNet           D   `json:"totalNet"`
	AverageNet         D   `json:"averageNet"`
}

type seasonalityReport struct {
	Months []seasonMonth `json:"months"`
	Best   *seasonMonth  `json:"best"`
	Worst  *seasonMonth  `json:"worst"`
}

type projectionReport struct {
	AsOf              string `json:"asOf"`
	MonthToDateNet    D      `json:"monthToDateNet"`
	DaysElapsed       int    `json:"daysElapsed"`
	DaysRemaining     int    `json:"daysRemaining"`
	DailyRunRate30    D      `json:"dailyRunRate30"`
	ProjectedMonthEnd D      `json:"projectedMonthEnd"`
	ProjectedNext30   D      `json:"projectedNext30"`
	ProjectedYear     D      `json:"projectedYear"`
	Trailing30        D      `json:"trailing30"`
	Trailing90        D      `json:"trailing90"`
	ObservedDays      int    `json:"observedDays"`
}

type delta struct {
	Metric    string `json:"metric"`
	Current   D      `json:"current"`
	Previous  D      `json:"previous"`
	Change    D      `json:"change"`
	ChangePct *D     `json:"changePct"`
}

type comparisonReport struct {
	PreviousFrom string  `json:"previousFrom"`
	PreviousTo   string  `json:"previousTo"`
	Current      totals  `json:"current"`
	Previous     totals  `json:"previous"`
	Deltas       []delta `json:"deltas"`
}

type accountNet struct {
	AccountID   int64  `json:"accountId"`
	AccountName string `json:"accountName"`
	Net         D      `json:"net"`
}

type overviewReport struct {
	Totals                 totals      `json:"totals"`
	ActiveAccounts         int         `json:"activeAccounts"`
	ActiveDays             int         `json:"activeDays"`
	FirstDate              *string     `json:"firstDate"`
	LastDate               *string     `json:"lastDate"`
	LastAt                 *string     `json:"lastAt"`
	AverageTransaction     D           `json:"averageTransaction"`
	WithdrawalToDepositPct *D          `json:"withdrawalToDepositPct"`
	BestAccount            *accountNet `json:"bestAccount"`
	WorstAccount           *accountNet `json:"worstAccount"`
	CurrentMonth           string      `json:"currentMonth"`
	CurrentMonthNet        D           `json:"currentMonthNet"`
	PreviousMonthNet       D           `json:"previousMonthNet"`
	MonthNetChange         D           `json:"monthNetChange"`
}

type goal struct {
	ID            int64  `json:"id"`
	Period        string `json:"period"`
	Target        D      `json:"target"`
	Achieved      D      `json:"achieved"`
	Remaining     D      `json:"remaining"`
	Pct           D      `json:"pct"`
	ElapsedPct    D      `json:"elapsedPct"`
	OnTrack       bool   `json:"onTrack"`
	Reached       bool   `json:"reached"`
	RequiredDaily D      `json:"requiredDaily"`
	DaysRemaining int    `json:"daysRemaining"`
}

type goalsReport struct {
	AsOf  string `json:"asOf"`
	Goals []goal `json:"goals"`
}

type insight struct {
	Code        string  `json:"code"`
	Severity    string  `json:"severity"`
	AccountID   *int64  `json:"accountId"`
	AccountName *string `json:"accountName"`
	Value       *D      `json:"value"`
	Date        *string `json:"date"`
}

type insightsReport struct {
	AsOf     string    `json:"asOf"`
	Insights []insight `json:"insights"`
}

type invAccount struct {
	ID          int64  `json:"id"`
	AccountName string `json:"accountName"`
	Currency    string `json:"currency"`
}
