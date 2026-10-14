package travel

import (
	"crypto/rand"
	"fmt"
	"net/url"
	"strconv"
	"time"
	_ "time/tzdata" // IANA zones on hosts without a zoneinfo database
)

// newID returns a random UUID v4.
func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// zone loads an IANA zone; ok=false when invalid.
func zone(tz string) (*time.Location, bool) {
	if tz == "" {
		return nil, false
	}
	l, err := time.LoadLocation(tz)
	return l, err == nil
}

// todayIn is the calendar date (yyyy-MM-dd) of now in the trip timezone (UTC when invalid).
func todayIn(tz string, now time.Time) string {
	l, ok := zone(tz)
	if !ok {
		l = time.UTC
	}
	return now.In(l).Format("2006-01-02")
}

const (
	cdDays = iota
	cdToday
	cdOngoing
	cdFinished
)

func parseDay(s string) (time.Time, bool) {
	t, err := time.Parse("2006-01-02", s)
	return t, err == nil
}

// countdown mirrors the web badge: days to start (>0), today, ongoing or finished.
func countdown(start, end, today string) (kind, days int) {
	s, ok1 := parseDay(start)
	t, ok2 := parseDay(today)
	if !ok1 || !ok2 {
		return cdFinished, 0
	}
	days = int(s.Sub(t).Hours() / 24)
	switch {
	case days > 0:
		return cdDays, days
	case days == 0:
		return cdToday, 0
	}
	if e, ok := parseDay(end); ok && !t.After(e) {
		return cdOngoing, 0
	}
	return cdFinished, 0
}

// dayCount is the inclusive number of days between two yyyy-MM-dd dates (0 when invalid).
func dayCount(start, end string) int {
	s, ok1 := parseDay(start)
	e, ok2 := parseDay(end)
	if !ok1 || !ok2 || e.Before(s) {
		return 0
	}
	return int(e.Sub(s).Hours()/24) + 1
}

func osmURL(lat, lon float64) string {
	la, lo := strconv.FormatFloat(lat, 'f', -1, 64), strconv.FormatFloat(lon, 'f', -1, 64)
	return "https://www.openstreetmap.org/?mlat=" + la + "&mlon=" + lo + "#map=15/" + la + "/" + lo
}

func googleMapsURL(lat, lon float64) string {
	return "https://www.google.com/maps/search/?api=1&query=" + url.QueryEscape(fmt.Sprintf("%v,%v", lat, lon))
}

func directionsURL(lat, lon float64) string {
	return "https://www.google.com/maps/dir/?api=1&destination=" + url.QueryEscape(fmt.Sprintf("%v,%v", lat, lon))
}
