package vault

import (
	"strings"
	"testing"
)

func TestGenerate(t *testing.T) {
	if Generate(20) != "" {
		t.Fatal("no sets must give empty")
	}
	for _, n := range []int{0, 16, 20, 64, 100} {
		p := Generate(n, Upper, Lower, Digits, Symbols)
		want := min(max(n, 16), 64)
		if len(p) != want {
			t.Fatalf("len %d want %d", len(p), want)
		}
		for _, s := range []string{Upper, Lower, Digits, Symbols} {
			if !strings.ContainsAny(p, s) {
				t.Fatalf("%q misses set %q", p, s)
			}
		}
		if strings.ContainsAny(p, "IOl01") {
			t.Fatalf("ambiguous char in %q", p)
		}
	}
	if p := Generate(30, Digits); strings.Trim(p, Digits) != "" {
		t.Fatal("digits only expected")
	}
}

func TestNormalize(t *testing.T) {
	if got := Normalize("  Ngân HÀNG Việt "); got != "ngan hang viet" {
		t.Fatal(got)
	}
	if !Match("Tài khoản Gmail", Normalize("tai khoan")) || Match("abc", "x") {
		t.Fatal("match")
	}
}
