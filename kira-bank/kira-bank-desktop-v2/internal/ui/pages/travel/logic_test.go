package travel

import (
	"testing"
	"time"
)

func TestCountdown(t *testing.T) {
	cases := []struct {
		start, end, today string
		kind, days        int
	}{
		{"2026-10-20", "2026-10-25", "2026-10-14", cdDays, 6},
		{"2026-10-14", "2026-10-25", "2026-10-14", cdToday, 0},
		{"2026-10-10", "2026-10-25", "2026-10-14", cdOngoing, 0},
		{"2026-10-10", "2026-10-14", "2026-10-14", cdOngoing, 0},
		{"2026-10-10", "2026-10-13", "2026-10-14", cdFinished, 0},
	}
	for _, c := range cases {
		k, d := countdown(c.start, c.end, c.today)
		if k != c.kind || d != c.days {
			t.Errorf("%+v: got %d,%d", c, k, d)
		}
	}
}

func TestTodayInZone(t *testing.T) {
	now := time.Date(2026, 10, 14, 20, 0, 0, 0, time.UTC) // 03:00 next day in Ho Chi Minh
	if got := todayIn("Asia/Ho_Chi_Minh", now); got != "2026-10-15" {
		t.Fatal(got)
	}
	if got := todayIn("bogus", now); got != "2026-10-14" {
		t.Fatal(got)
	}
	if n := dayCount("2026-10-14", "2026-10-16"); n != 3 {
		t.Fatal(n)
	}
	if len(newID()) != 36 {
		t.Fatal("uuid")
	}
}
