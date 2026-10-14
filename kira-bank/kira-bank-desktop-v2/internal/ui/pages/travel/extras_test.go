package travel

import (
	"encoding/json"
	"testing"
)

func TestExtrasSurviveRoundTrip(t *testing.T) {
	in := `{"name":"Trip","destination":"Da Nang","startDate":"2026-10-20","endDate":"2026-10-25","timezone":"Asia/Ho_Chi_Minh","currency":"VND","budget":1000,"notes":"",` +
		`"futureTop":{"a":[1,2]},` +
		`"members":[{"id":"m1","name":"An","avatar":"x.png"}],` +
		`"activities":[{"id":"a1","date":"2026-10-21","time":"","title":"Beach","location":"","notes":"","weather":"sunny"}],` +
		`"packing":[{"id":"p1","name":"Hat","category":"c","quantity":1,"packed":false,"weight":2.5}],` +
		`"expenses":[{"id":"e1","title":"Food","date":"2026-10-21","amount":12.5,"paidBy":"m1","participants":["m1"],"receipt":"r1"}],` +
		`"bookings":[{"id":"b1","title":"Flight","type":"FLIGHT","reference":"","date":"2026-10-20","notes":"","url":"","seat":"12A"}],` +
		`"places":[{"id":"l1","name":"Cafe","address":"","latitude":16.05,"longitude":108.2,"notes":"","visited":false,"rating":5}]}`
	var d data
	if err := json.Unmarshal([]byte(in), &d); err != nil {
		t.Fatal(err)
	}
	d = d.clone()
	d.Name = "Edited"
	d.Activities[0].Title = "Edited beach"
	d.Packing[0].Packed = true
	out, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]json.RawMessage
	_ = json.Unmarshal(out, &m)
	if string(m["futureTop"]) != `{"a":[1,2]}` || string(m["name"]) != `"Edited"` {
		t.Fatalf("top level: %s", out)
	}
	check := func(list, key, want string) {
		var items []map[string]json.RawMessage
		_ = json.Unmarshal(m[list], &items)
		if string(items[0][key]) != want {
			t.Fatalf("%s.%s = %s want %s", list, key, items[0][key], want)
		}
	}
	check("members", "avatar", `"x.png"`)
	check("activities", "weather", `"sunny"`)
	check("activities", "title", `"Edited beach"`)
	check("packing", "weight", `2.5`)
	check("packing", "packed", `true`)
	check("expenses", "receipt", `"r1"`)
	check("bookings", "seat", `"12A"`)
	check("places", "rating", `5`)
}
