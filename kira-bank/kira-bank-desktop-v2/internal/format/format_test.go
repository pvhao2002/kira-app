package format

import (
	"testing"

	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/i18n"
)

func d(s string) decimal.Decimal { return decimal.RequireFromString(s) }

func TestMoney(t *testing.T) {
	t.Cleanup(func() { i18n.SetLang("en") })
	cases := []struct{ lang, amount, cur, want string }{
		{"en", "1234567", "VND", "₫1,234,567"},
		{"vi", "1234567", "VND", "1.234.567 ₫"},
		{"en", "1234.5", "USD", "$1,234.50"},
		{"vi", "1234.567", "USD", "1.234,57 US$"},
		{"en", "-1000", "VND", "-₫1,000"},
		{"vi", "-1000", "VND", "-1.000 ₫"},
		{"en", "0.4", "VND", "₫0"},
		{"en", "2.5", "VND", "₫3"}, // half away from zero, like Intl
	}
	for _, c := range cases {
		i18n.SetLang(c.lang)
		if got := Money(d(c.amount), c.cur); got != c.want {
			t.Errorf("%s Money(%s,%s)=%q want %q", c.lang, c.amount, c.cur, got, c.want)
		}
	}
}

func TestNumPercentCompact(t *testing.T) {
	t.Cleanup(func() { i18n.SetLang("en") })
	i18n.SetLang("vi")
	if got := Num(d("1500000.12345"), 4); got != "1.500.000,1235" {
		t.Errorf("got %q", got)
	}
	if got := Percent(d("37.5"), 2); got != "37,5%" {
		t.Errorf("got %q", got)
	}
	if got := Compact(d("1250")); got != "1,3 N" {
		t.Errorf("got %q", got)
	}
	i18n.SetLang("en")
	if got := Compact(d("1250")); got != "1.3K" {
		t.Errorf("got %q", got)
	}
}

func TestMoneyInput(t *testing.T) {
	t.Cleanup(func() { i18n.SetLang("en") })
	i18n.SetLang("vi")
	if got := ReformatInput("001234,56789", 4); got != "1.234,5678" {
		t.Errorf("reformat got %q", got)
	}
	if got := ReformatInput(",", 4); got != "0," {
		t.Errorf("got %q", got)
	}
	v, ok := ParseInput("1.234,5")
	if !ok || !v.Equal(d("1234.5")) {
		t.Errorf("parse got %v %v", v, ok)
	}
	if _, ok := ParseInput(""); ok {
		t.Error("empty must not parse")
	}
	i18n.SetLang("en")
	if got := ReformatInput("1234567.5", 0); got != "12,345,675" {
		// maxFrac 0 ignores the separator, digits stay in the integer part
		t.Errorf("got %q", got)
	}
}

func TestDates(t *testing.T) {
	t.Cleanup(func() { i18n.SetLang("en") })
	i18n.SetLang("en")
	ts, err := ParseTimestamp("2026-10-14T20:30:00Z") // 03:30 next day in ICT
	if err != nil {
		t.Fatal(err)
	}
	if got := DateTimeShort(ts); got != "15/10 03:30" {
		t.Errorf("got %q", got)
	}
	if got := DateMedium(ts); got != "Oct 15, 2026" {
		t.Errorf("got %q", got)
	}
	i18n.SetLang("vi")
	if got := DateMedium(ts); got != "15 thg 10, 2026" {
		t.Errorf("got %q", got)
	}
	if got := DateOnly("", DateShort); got != Dash {
		t.Errorf("got %q", got)
	}
}
