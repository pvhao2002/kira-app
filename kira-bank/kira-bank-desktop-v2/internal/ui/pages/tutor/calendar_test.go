package tutor

import "testing"

func TestColumns(t *testing.T) {
	// A 18:00-19:30, B 18:30-19:00 overlap; C 20:00-21:00 alone; D 21:00-21:10 starts after C ends.
	sp := []Span{{1080, 1170, 1}, {1110, 1140, 2}, {1200, 1260, 3}, {1260, 1270, 4}}
	got := Columns(sp)
	want := []Place{{0, 2}, {1, 2}, {0, 1}, {0, 1}}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("%d: got %v want %v", i, got[i], want[i])
		}
	}
	// short lesson counts as 35 min: 18:00-18:10 overlaps 18:30? no (18:35 > 18:30 yes)
	got = Columns([]Span{{1080, 1090, 1}, {1110, 1140, 2}})
	if got[0].Cols != 2 || got[1].Col != 1 {
		t.Fatalf("effective end: %v", got)
	}
}

func TestHourRange(t *testing.T) {
	if s, e := HourRange(true, nil); s != 6 || e != 23 {
		t.Fatal(s, e)
	}
	if s, e := HourRange(false, nil); s != 16 || e != 22 {
		t.Fatal(s, e)
	}
	// 18:00-19:30 -> first 18, last 20, end=min(23,max(21,23))=23, start=max(6,min(17,18))=17
	if s, e := HourRange(false, []Span{{1080, 1170, 1}}); s != 17 || e != 23 {
		t.Fatal(s, e)
	}
}
