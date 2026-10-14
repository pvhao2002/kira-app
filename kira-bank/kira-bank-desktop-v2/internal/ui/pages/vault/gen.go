package vault

import (
	"crypto/rand"
	"math/big"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// Charsets of the web generator (no I, O, l, 0, 1 lookalikes).
const (
	Upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ"
	Lower   = "abcdefghijkmnopqrstuvwxyz"
	Digits  = "23456789"
	Symbols = "!@#$%^&*()-_=+[]{};:,.?"
)

func randIndex(n int) int {
	v, err := rand.Int(rand.Reader, big.NewInt(int64(n))) // rejection sampling inside
	if err != nil {
		panic(err) // crypto/rand failure is unrecoverable
	}
	return int(v.Int64())
}

// Generate returns a password of length clamped to [16,64] with at least one
// char from every given set. No sets -> "".
func Generate(length int, sets ...string) string {
	if len(sets) == 0 {
		return ""
	}
	length = min(max(length, 16), 64)
	all := strings.Join(sets, "")
	out := make([]byte, 0, length)
	for _, s := range sets {
		out = append(out, s[randIndex(len(s))])
	}
	for len(out) < length {
		out = append(out, all[randIndex(len(all))])
	}
	for i := len(out) - 1; i > 0; i-- { // Fisher-Yates
		j := randIndex(i + 1)
		out[i], out[j] = out[j], out[i]
	}
	return string(out)
}

// Normalize is the web search normalisation: NFD, strip U+0300-U+036F, trim, lower-case.
func Normalize(s string) string {
	d := norm.NFD.String(s)
	var b strings.Builder
	for _, r := range d {
		if r >= 0x300 && r <= 0x36F {
			continue
		}
		b.WriteRune(unicode.ToLower(r))
	}
	return strings.TrimSpace(b.String())
}

// Match reports whether q (already normalised) is a substring of normalised s.
func Match(s, q string) bool { return q == "" || strings.Contains(Normalize(s), q) }
