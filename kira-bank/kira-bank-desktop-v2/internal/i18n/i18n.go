// Package i18n holds the en/vi dictionaries (embedded) and the translate helper.
package i18n

import (
	"embed"
	"encoding/json"
	"strings"
	"sync"
)

//go:embed en.json vi.json
var files embed.FS

// P is the placeholder map for T: {"name": value} replaces every "{name}".
type P map[string]any

var (
	mu    sync.RWMutex
	lang  = "en"
	dicts = map[string]map[string]string{"en": load("en.json"), "vi": load("vi.json")}
	subs  []func()
)

func load(name string) map[string]string {
	b, err := files.ReadFile(name)
	if err != nil {
		panic(err)
	}
	m := map[string]string{}
	if err := json.Unmarshal(b, &m); err != nil {
		panic(err)
	}
	return m
}

// Lang returns "en" or "vi".
func Lang() string {
	mu.RLock()
	defer mu.RUnlock()
	return lang
}

// Locale returns the formatting locale: "vi-VN" or "en-US".
func Locale() string {
	if Lang() == "vi" {
		return "vi-VN"
	}
	return "en-US"
}

// SetLang switches language (unknown values are ignored) and notifies subscribers.
func SetLang(l string) {
	if l != "en" && l != "vi" {
		return
	}
	mu.Lock()
	changed := lang != l
	lang = l
	cbs := append([]func(){}, subs...)
	mu.Unlock()
	if changed {
		for _, f := range cbs {
			f()
		}
	}
}

// OnChange registers a callback invoked after the language changes.
func OnChange(f func()) {
	mu.Lock()
	subs = append(subs, f)
	mu.Unlock()
}

// Has reports whether the English dictionary has key.
func Has(key string) bool {
	_, ok := dicts["en"][key]
	return ok
}

// T translates key in the current language, falling back to English, then to the key.
func T(key string, params ...P) string {
	mu.RLock()
	s, ok := dicts[lang][key]
	mu.RUnlock()
	if !ok {
		if s, ok = dicts["en"][key]; !ok {
			return key
		}
	}
	if len(params) == 0 || !strings.Contains(s, "{") {
		return s
	}
	var kv []string
	for k, v := range params[0] {
		kv = append(kv, "{"+k+"}", toString(v))
	}
	return strings.NewReplacer(kv...).Replace(s)
}

func toString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case interface{ String() string }:
		return x.String()
	default:
		b, _ := json.Marshal(x)
		return strings.Trim(string(b), `"`)
	}
}
