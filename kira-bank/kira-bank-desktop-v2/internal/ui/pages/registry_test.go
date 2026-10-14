package pages

import (
	"testing"

	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

func TestRegistry(t *testing.T) {
	seen := map[string]bool{}
	for _, p := range All(&kit.Env{}) {
		if p.ID == "" || p.Build == nil {
			t.Errorf("page %q: missing ID or Build", p.ID)
		}
		if seen[p.ID] {
			t.Errorf("duplicate page ID %q", p.ID)
		}
		seen[p.ID] = true
		for _, k := range []string{p.TitleKey, p.MenuKey, p.Group} {
			if k != "" && !i18n.Has(k) {
				t.Errorf("page %q: i18n key %q missing", p.ID, k)
			}
		}
	}
	if len(seen) < 30 {
		t.Errorf("only %d pages registered", len(seen))
	}
}
