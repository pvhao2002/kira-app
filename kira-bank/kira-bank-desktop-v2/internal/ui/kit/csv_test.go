package kit

import "testing"

func TestCSVCell(t *testing.T) {
	for in, want := range map[string]string{
		"=SUM(A1)": "'=SUM(A1)", "+1+1": "'+1+1", "-x": "'-x", "@a": "'@a", "\tx": "'\tx", "\rx": "'\rx",
		"-1234.5": "-1234.5", "-1.234,5": "-1.234,5", "12": "12", "ok": "ok", "": "", "-": "'-", "-1e5+cmd": "'-1e5+cmd",
	} {
		if got := csvCell(in); got != want {
			t.Errorf("csvCell(%q)=%q want %q", in, got, want)
		}
	}
}
