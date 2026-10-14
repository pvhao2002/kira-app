package health

import (
	"errors"
	"time"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"

	"github.com/shopspring/decimal"
)

// Health numbers are not money (calories, kg, cm), so float64 is fine here.

type profileData struct {
	HeightCm             float64 `json:"heightCm"`
	BirthDate            string  `json:"birthDate"`
	FormulaSex           string  `json:"formulaSex"`
	Goal                 string  `json:"goal"`
	Timezone             string  `json:"timezone"`
	ActivityFactor       float64 `json:"activityFactor"`
	CalorieAdjustment    int     `json:"calorieAdjustment"`
	FoodPreferences      string  `json:"foodPreferences"`
	Allergies            string  `json:"allergies"`
	AvoidedFoods         string  `json:"avoidedFoods"`
	PreparationMinutes   int     `json:"preparationMinutes"`
	ExerciseExperience   string  `json:"exerciseExperience"`
	Equipment            string  `json:"equipment"`
	Availability         string  `json:"availability"`
	MovementRestrictions string  `json:"movementRestrictions"`
}

type profileResp struct {
	Data    profileData `json:"data"`
	Version int64       `json:"version"`
}

type weight struct {
	Date string  `json:"date"`
	Kg   float64 `json:"kg"`
}

type workout struct {
	Start    string   `json:"start"`
	Type     string   `json:"type"`
	Calories *float64 `json:"calories"`
	Source   string   `json:"source"`
}

type summary struct {
	Date            string    `json:"date"`
	BMI             *float64  `json:"bmi"`
	RestingEstimate *float64  `json:"restingEstimate"`
	EatenCalories   float64   `json:"eatenCalories"`
	TargetCalories  *float64  `json:"targetCalories"`
	ActiveCalories  *float64  `json:"activeCalories"`
	RestingCalories *float64  `json:"restingCalories"`
	TotalBurned     *float64  `json:"totalBurned"`
	NetCalories     *float64  `json:"netCalories"`
	TargetSource    string    `json:"targetSource"`
	Steps           *int64    `json:"steps"`
	Workouts        []workout `json:"workouts"`
}

type planItem struct {
	Date      string `json:"date"`
	Kind      string `json:"kind"`
	Title     string `json:"title"`
	Portion   string `json:"portion"`
	Calories  int    `json:"calories"`
	Minutes   int    `json:"minutes"`
	Notes     string `json:"notes"`
	Completed bool   `json:"completed"`
}

type planData struct {
	Title    string     `json:"title"`
	Items    []planItem `json:"items"`
	Warnings []string   `json:"warnings"`
}

type plan struct {
	ID        string   `json:"id"`
	WeekStart string   `json:"weekStart"`
	Status    string   `json:"status"`
	Data      planData `json:"data"`
	Version   int64    `json:"version"`
}

type journalData struct {
	Kind     string `json:"kind"`
	Title    string `json:"title"`
	Calories int    `json:"calories"`
	Minutes  int    `json:"minutes"`
	Notes    string `json:"notes"`
}

type journal struct {
	ID      string      `json:"id"`
	Date    string      `json:"date"`
	Data    journalData `json:"data"`
	Version int64       `json:"version"`
}

type connection struct {
	Timezone     string  `json:"timezone"`
	LastSyncedAt *string `json:"lastSyncedAt"`
}

type aiJob struct {
	Status    string  `json:"status"`
	ErrorCode *string `json:"errorCode"`
}

const day = "2006-01-02"

// mondayOf returns the Monday of t's week.
func mondayOf(t time.Time) time.Time {
	off := (int(t.Weekday()) + 6) % 7
	return time.Date(t.Year(), t.Month(), t.Day()-off, 0, 0, 0, 0, t.Location())
}

// errKey maps an API error to the i18n key shown to the user: 409 -> conflict,
// a known health.error.<code> -> that, else the generic failure.
func errKey(err error) string {
	var ae *api.ApiError
	if errors.As(err, &ae) {
		if ae.Status == 409 {
			return "health.conflict"
		}
		if k := "health.error." + ae.Code; ae.Code != "" && i18n.Has(k) {
			return k
		}
	}
	return "health.failed"
}

// val formats an optional number with at most one fraction digit.
func val(v *float64) string {
	if v == nil {
		return format.Dash
	}
	return num(*v)
}

func num(v float64) string { return format.Num(decimal.NewFromFloat(v), 1) }
