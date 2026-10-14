package health

import (
	"testing"
	"time"

	"kira-bank-desktop-v2/internal/api"
)

func TestMondayOf(t *testing.T) {
	for _, c := range []struct{ in, want string }{{"2026-10-14", "2026-10-12"}, {"2026-10-18", "2026-10-12"}, {"2026-10-12", "2026-10-12"}} {
		d, _ := time.Parse(day, c.in)
		if got := mondayOf(d).Format(day); got != c.want {
			t.Errorf("%s: %s", c.in, got)
		}
	}
}

func TestInWeek(t *testing.T) {
	if !inWeek("2026-10-18", "2026-10-12") || inWeek("2026-10-19", "2026-10-12") || inWeek("2026-10-11", "2026-10-12") {
		t.Fatal("inWeek")
	}
}

func TestErrKey(t *testing.T) {
	if errKey(&api.ApiError{Status: 409}) != "health.conflict" ||
		errKey(&api.ApiError{Status: 400, Code: "HEALTH_AI_UNAVAILABLE"}) != "health.error.HEALTH_AI_UNAVAILABLE" ||
		errKey(&api.ApiError{Status: 500, Code: "NOPE"}) != "health.failed" {
		t.Fatal("errKey")
	}
}
