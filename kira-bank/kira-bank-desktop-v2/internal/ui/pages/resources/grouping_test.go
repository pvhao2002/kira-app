package resources

import (
	"testing"

	"github.com/shopspring/decimal"
)

func TestGroupCards(t *testing.T) {
	cards := []Card{
		{ID: 1, BankID: 2, BankName: "vcb"}, {ID: 2, BankID: 1, BankName: "ACB"}, {ID: 3, BankID: 2, BankName: "vcb"},
	}
	gs := GroupCards(cards)
	if len(gs) != 2 || gs[0].BankName != "ACB" || len(gs[1].Cards) != 2 {
		t.Fatalf("groups: %+v", gs)
	}
	seq := Sequence(gs)
	if seq[2] != 1 || seq[1] != 2 || seq[3] != 3 {
		t.Fatalf("seq: %v", seq)
	}
}

func TestRemainingUsed(t *testing.T) {
	l, u := decimal.RequireFromString("1000.12345"), decimal.RequireFromString("400")
	r := Remaining(l, u)
	if r.String() != "600.1235" { // rounded to 4dp
		t.Fatal(r)
	}
	if !Used(l, r).Equal(decimal.RequireFromString("400")) {
		t.Fatal(Used(l, r))
	}
}

func TestBillingError(t *testing.T) {
	d := decimal.RequireFromString
	cases := []struct {
		b, m, want string
	}{{"100", "0", "form.minimumPaymentRequired"}, {"100", "200", "form.minimumPaymentExceedsBalance"},
		{"100", "50", ""}, {"0", "0", ""}}
	for _, c := range cases {
		if got := BillingError(d(c.b), d(c.m)); got != c.want {
			t.Errorf("%s/%s: %q", c.b, c.m, got)
		}
	}
}

func TestNotificationRoute(t *testing.T) {
	cases := []struct{ link, route, id string }{
		{"/statement-import?id=5", "/app/credit-card/statement-import", "5"},
		{"/statement-import", "", ""},
		{"/cards#x", "/app/credit-cards", ""},
		{"/ai-result?id=1", "/app/investment/ai-queue", ""},
		{"/credit-stats", "/app/credit-card/dashboard", ""},
		{"nope", "", ""}, {"/unknown", "", ""},
	}
	for _, c := range cases {
		r, p := notificationRoute(c.link)
		if r != c.route || p["importId"] != c.id {
			t.Errorf("%s: %q %v", c.link, r, p)
		}
	}
}
