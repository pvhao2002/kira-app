package kit

import (
	"regexp"
	"testing"

	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/api"
)

func TestInitials(t *testing.T) {
	cases := map[string]string{"": "KL", "Nguyen Van An": "VA", "kira": "K"}
	for in, want := range cases {
		if got := Initials(&api.Profile{FullName: in}); got != want {
			t.Errorf("Initials(%q)=%q want %q", in, got, want)
		}
	}
}

func TestFieldError(t *testing.T) {
	f := Field{Required: true, MaxLen: 3, Pattern: regexp.MustCompile(`^\d+$`), Min: Dec("1")}
	if fieldError(f, nil, true) == "" {
		t.Error("required not enforced")
	}
	if fieldError(f, "1234", true) == "" || fieldError(f, "ab", true) == "" {
		t.Error("maxLen/pattern not enforced")
	}
	if fieldError(f, "12", true) != "" {
		t.Error("valid string rejected")
	}
	if fieldError(f, decimal.RequireFromString("0.5"), true) == "" {
		t.Error("min not enforced")
	}
	if fieldError(f, nil, false) == "" {
		t.Error("unparsable must fail")
	}
}
