package bank

import "testing"

func TestFilter(t *testing.T) {
	bs := []Bank{{Code: "VCB", Name: "Vietcombank"}, {Code: "TCB", ShortName: "Techcombank"}}
	if got := Filter(bs, " tech "); len(got) != 1 || got[0].Code != "TCB" {
		t.Fatal(got)
	}
	if len(Filter(bs, "")) != 2 || len(Filter(bs, "vcb")) != 1 {
		t.Fatal("filter")
	}
}
