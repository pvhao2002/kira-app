package tutor

import "regexp"

func timePattern() *regexp.Regexp  { return regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`) }
func colorPattern() *regexp.Regexp { return regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`) }
