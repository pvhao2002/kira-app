package kit

import (
	"regexp"
	"strings"
)

var plainNumber = regexp.MustCompile(`^-?[0-9][0-9.,]*$`)

// csvCell neutralises spreadsheet formula injection: cells starting with
// = + - @ TAB or CR get a leading apostrophe, except plain (negative) numbers.
func csvCell(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) && !plainNumber.MatchString(s) {
		return "'" + s
	}
	return s
}
