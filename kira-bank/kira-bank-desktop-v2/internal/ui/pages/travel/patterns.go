package travel

import "regexp"

func timePattern() *regexp.Regexp { return regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`) }
func urlPattern() *regexp.Regexp  { return regexp.MustCompile(`(?i)^https?://.+`) }
