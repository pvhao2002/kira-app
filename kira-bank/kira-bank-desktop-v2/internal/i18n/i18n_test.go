package i18n

import (
	"strings"
	"testing"
)

func TestPlaceholdersAndFallback(t *testing.T) {
	t.Cleanup(func() { SetLang("en") })
	SetLang("en")
	if got := T("overview.greeting", P{"name": "Kira"}); !strings.Contains(got, "Kira") || strings.Contains(got, "{name}") {
		t.Fatalf("placeholder not replaced: %q", got)
	}
	if got := T("no.such.key"); got != "no.such.key" {
		t.Fatalf("missing key should echo key, got %q", got)
	}
	// Vietnamese falls back to English for keys only present in en.
	dicts["en"]["test.only.en"] = "only {x}"
	t.Cleanup(func() { delete(dicts["en"], "test.only.en") })
	SetLang("vi")
	if got := T("test.only.en", P{"x": 7, "y": 1}); got != "only 7" {
		t.Fatalf("fallback/params failed: %q", got)
	}
	if Locale() != "vi-VN" {
		t.Fatal("locale not switched")
	}
}

func TestDictionariesSameKeys(t *testing.T) {
	for k := range dicts["en"] {
		if _, ok := dicts["vi"][k]; !ok {
			t.Errorf("vi missing key %s", k)
		}
	}
}
