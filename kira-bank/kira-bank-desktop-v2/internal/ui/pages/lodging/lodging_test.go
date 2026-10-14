package lodging

import (
	"testing"

	"github.com/shopspring/decimal"
)

func TestFeeBody(t *testing.T) {
	if feeBody(nil, "KWH") != nil {
		t.Fatal("empty amount must be null")
	}
	m, ok := feeBody(decimal.NewFromInt(3500), "KWH").(map[string]any)
	if !ok || m["unit"] != "KWH" {
		t.Fatal(m)
	}
}

func TestKmText(t *testing.T) {
	d := decimal.NewFromInt(1250)
	if got := kmText(distance{Name: "Work", Status: "READY", DistanceMeters: &d}); got != "Work: 1.25 km" {
		t.Fatal(got)
	}
}

func TestReviewError(t *testing.T) {
	if reviewError("NOT_OK", "  ") == "" || reviewError("OK", "") != "" || reviewError("NOT_OK", "bad") != "" {
		t.Fatal("review rules")
	}
}
