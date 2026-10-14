package tutor

import "sort"

// Span is one lesson on a day, in minutes since midnight.
type Span struct {
	Start, End int
	ID         int64
}

// Place is the overlap column of a span within its overlap group.
type Place struct{ Col, Cols int }

// Columns lays out overlapping spans (web algorithm): sort by start then ID,
// effectiveEnd = max(end, start+35), first free column, group ends when the next
// start >= the group's max end. Result is indexed like the input.
func Columns(spans []Span) []Place {
	idx := make([]int, len(spans))
	for i := range idx {
		idx[i] = i
	}
	sort.SliceStable(idx, func(a, b int) bool {
		x, y := spans[idx[a]], spans[idx[b]]
		if x.Start != y.Start {
			return x.Start < y.Start
		}
		return x.ID < y.ID
	})
	out := make([]Place, len(spans))
	var group []int
	var colEnd []int
	groupMax := 0
	flush := func() {
		for _, i := range group {
			out[i].Cols = len(colEnd)
		}
		group, colEnd, groupMax = nil, nil, 0
	}
	for _, i := range idx {
		s := spans[i]
		if len(group) > 0 && s.Start >= groupMax {
			flush()
		}
		end := max(s.End, s.Start+35)
		col := -1
		for c, e := range colEnd {
			if e <= s.Start {
				col = c
				break
			}
		}
		if col < 0 {
			colEnd = append(colEnd, 0)
			col = len(colEnd) - 1
		}
		colEnd[col] = end
		groupMax = max(groupMax, end)
		out[i].Col = col
		group = append(group, i)
	}
	flush()
	return out
}

// HourRange is the displayed hour range [start,end] (end exclusive row count end-start).
func HourRange(fullDay bool, spans []Span) (start, end int) {
	if fullDay {
		return 6, 23
	}
	if len(spans) == 0 {
		return 16, 22
	}
	lo, hi := spans[0].Start, spans[0].End
	for _, s := range spans {
		lo, hi = min(lo, s.Start), max(hi, s.End)
	}
	first, last := lo/60, (hi+59)/60
	end = min(23, max(last+1, first+5))
	start = max(6, min(first-1, end-5))
	return start, end
}
