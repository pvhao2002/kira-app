// Package fb translates keys with a per-package fallback for strings that are
// missing from the shared i18n dictionaries.
package fb

import (
	"sync"

	"kira-bank-desktop-v2/internal/i18n"
)

var (
	mu  sync.RWMutex
	set = map[string][2]string{} // key -> {en, vi}
)

// Add registers fallbacks as key -> {en, vi}.
func Add(m map[string][2]string) {
	mu.Lock()
	defer mu.Unlock()
	for k, v := range m {
		set[k] = v
	}
}

// T is i18n.T, but keys absent from the dictionaries use the registered fallback.
func T(key string, params ...i18n.P) string {
	if i18n.Has(key) {
		return i18n.T(key, params...)
	}
	mu.RLock()
	v, ok := set[key]
	mu.RUnlock()
	if !ok {
		return i18n.T(key, params...)
	}
	if i18n.Lang() == "vi" {
		return v[1]
	}
	return v[0]
}
