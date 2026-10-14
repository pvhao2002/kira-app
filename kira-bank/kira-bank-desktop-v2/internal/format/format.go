// Package format renders money, numbers and dates the way the web UI does
// (Intl vi-VN / en-US), driven by the current i18n language. All amounts are
// shopspring decimals; nothing here uses float64.
package format

import (
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/i18n"
)

// Dash is shown for missing values.
const Dash = "—"

func isVi() bool { return i18n.Lang() == "vi" }

// Separators returns the (group, decimal) separators of the current locale.
func Separators() (group, dec string) {
	if isVi() {
		return ".", ","
	}
	return ",", "."
}

func groupInt(s, sep string) string {
	if len(s) <= 3 {
		return s
	}
	var b strings.Builder
	pre := len(s) % 3
	if pre > 0 {
		b.WriteString(s[:pre])
	}
	for i := pre; i < len(s); i += 3 {
		if b.Len() > 0 {
			b.WriteString(sep)
		}
		b.WriteString(s[i : i+3])
	}
	return b.String()
}

// Number formats d with between minFrac and maxFrac fraction digits (half away
// from zero) and locale grouping, e.g. en 1,234.5 / vi 1.234,5.
func Number(d decimal.Decimal, minFrac, maxFrac int) string {
	r := d.Round(int32(maxFrac))
	s := r.StringFixed(int32(maxFrac))
	neg := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	ip, fp, _ := strings.Cut(s, ".")
	for len(fp) > minFrac && strings.HasSuffix(fp, "0") {
		fp = fp[:len(fp)-1]
	}
	g, dsep := Separators()
	out := groupInt(ip, g)
	if fp != "" {
		out += dsep + fp
	}
	if neg && !r.IsZero() {
		out = "-" + out
	}
	return out
}

// Num is Number with up to maxFrac digits and no forced fraction (fmtNum4 = Num(d,4)).
func Num(d decimal.Decimal, maxFrac int) string { return Number(d, 0, maxFrac) }

// Money formats a currency amount like Intl currency style: VND 0 fraction
// digits, other currencies 2. en: "₫1,234,567", "$1,234.50"; vi: "1.234.567 ₫", "1.234,50 US$".
func Money(d decimal.Decimal, cur string) string {
	cur = strings.ToUpper(strings.TrimSpace(cur))
	frac := 2
	if cur == "VND" {
		frac = 0
	}
	n := Number(d.Abs(), frac, frac)
	sign := ""
	if d.Round(int32(frac)).IsNegative() {
		sign = "-"
	}
	sym := cur
	switch cur {
	case "VND":
		sym = "₫"
	case "USD":
		sym = "$"
		if isVi() {
			sym = "US$"
		}
	}
	if isVi() {
		return sign + n + " " + sym
	}
	if len(sym) > 1 && sym != "₫" {
		sym += " "
	}
	return sign + sym + n
}

// MoneyCell is the resource-table money cell: up to 4 fraction digits then " CUR".
func MoneyCell(d decimal.Decimal, cur string) string { return Num(d, 4) + " " + cur }

// Percent formats a value that is already a percentage (37.5 -> "37.5%").
func Percent(d decimal.Decimal, maxFrac int) string { return Num(d, maxFrac) + "%" }

// Compact formats 1200 -> "1.2K" (vi: "1,2 N"), max 1 fraction digit.
func Compact(d decimal.Decimal) string {
	a := d.Abs()
	type unit struct {
		div    int64
		en, vi string
	}
	for _, u := range []unit{{1_000_000_000, "B", " T"}, {1_000_000, "M", " Tr"}, {1_000, "K", " N"}} {
		if a.GreaterThanOrEqual(decimal.NewFromInt(u.div)) {
			s := Num(d.Div(decimal.NewFromInt(u.div)), 1)
			if isVi() {
				return s + u.vi
			}
			return s + u.en
		}
	}
	return Num(d, 1)
}

// Hidden placeholders for the Overview "hide amounts" mode.
const (
	HiddenMoney   = "••••••"
	HiddenPercent = "••••"
)

// ---- input helpers for MoneyEntry ----

// ReformatInput normalises text typed into a money field: keeps digits and the
// first locale decimal separator, trims leading zeros, limits fraction digits
// and regroups the integer part. "1234,5" (vi) -> "1.234,5".
func ReformatInput(s string, maxFrac int) string {
	g, dsep := Separators()
	_ = g
	var ip, fp strings.Builder
	seenDec := false
	for _, r := range s {
		switch {
		case r >= '0' && r <= '9':
			if seenDec {
				if fp.Len() < maxFrac {
					fp.WriteRune(r)
				}
			} else {
				ip.WriteRune(r)
			}
		case string(r) == dsep && maxFrac > 0 && !seenDec:
			seenDec = true
		}
	}
	i := strings.TrimLeft(ip.String(), "0")
	if i == "" && (ip.Len() > 0 || seenDec) {
		i = "0"
	}
	out := groupInt(i, g)
	if seenDec {
		out += dsep + fp.String()
	}
	return out
}

// ParseInput parses locale-formatted text ("1.234,5") into a decimal.
func ParseInput(s string) (decimal.Decimal, bool) {
	g, dsep := Separators()
	s = strings.ReplaceAll(strings.TrimSpace(s), g, "")
	s = strings.Replace(s, dsep, ".", 1)
	if s == "" || s == "." {
		return decimal.Zero, false
	}
	d, err := decimal.NewFromString(strings.TrimSuffix(s, "."))
	return d, err == nil
}

// ---- dates (Vietnam time, like the web app) ----

// ICT is Asia/Ho_Chi_Minh (UTC+7, no DST); avoids needing tzdata on the host.
var ICT = time.FixedZone("ICT", 7*3600)

// ParseDate parses "yyyy-MM-dd" as midnight Vietnam time.
func ParseDate(s string) (time.Time, error) { return time.ParseInLocation("2006-01-02", s, ICT) }

// ParseTimestamp parses an ISO-8601 instant (zone optional, assumed ICT).
func ParseTimestamp(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t.In(ICT), nil
	}
	return time.ParseInLocation("2006-01-02T15:04:05", s, ICT)
}

// Today returns the local date as yyyy-MM-dd.
func Today() string { return time.Now().Format("2006-01-02") }

// DateShort -> "14/10" (ICT).
func DateShort(t time.Time) string { return t.In(ICT).Format("02/01") }

// DateDMY -> "14/10/2026" (ICT).
func DateDMY(t time.Time) string { return t.In(ICT).Format("02/01/2006") }

// DateTimeShort -> "14/10 15:04" (ICT).
func DateTimeShort(t time.Time) string { return t.In(ICT).Format("02/01 15:04") }

// TimeShort -> en "3:04 PM", vi "15:04".
func TimeShort(t time.Time) string {
	if isVi() {
		return t.Format("15:04")
	}
	return t.Format("3:04 PM")
}

var enMonths = []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}

// DateMedium -> en "Oct 14, 2026", vi "14 thg 10, 2026".
func DateMedium(t time.Time) string {
	if isVi() {
		return t.Format("2") + " thg " + t.Format("1") + ", " + t.Format("2006")
	}
	return enMonths[t.Month()-1] + " " + t.Format("2") + ", " + t.Format("2006")
}

var viWeekdays = []string{"Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"}

// LongDate -> en "Wednesday, 14 October 2026", vi "Thứ Tư, 14 tháng 10, 2026" (ICT).
func LongDate(t time.Time) string {
	t = t.In(ICT)
	if isVi() {
		return viWeekdays[t.Weekday()] + ", " + t.Format("2") + " tháng " + t.Format("1") + ", " + t.Format("2006")
	}
	return t.Format("Monday, 2 January 2006")
}

// HHmm trims "HH:mm:ss" to "HH:mm".
func HHmm(s string) string {
	if len(s) >= 5 {
		return s[:5]
	}
	return s
}

// DateOnly formats a "yyyy-MM-dd" API string with layout fn; Dash when empty/invalid.
func DateOnly(s string, fn func(time.Time) string) string {
	if t, err := ParseDate(s); err == nil {
		return fn(t)
	}
	return Dash
}

// Timestamp formats an ISO instant with layout fn; Dash when empty/invalid.
func Timestamp(s string, fn func(time.Time) string) string {
	if t, err := ParseTimestamp(s); err == nil {
		return fn(t)
	}
	return Dash
}
