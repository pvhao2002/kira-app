package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeServer struct {
	refreshCalls atomic.Int32
	mu           sync.Mutex
	valid        string // currently valid access token
	refreshOK    bool
}

func (f *fakeServer) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/auth/mobile/refresh", func(w http.ResponseWriter, r *http.Request) {
		f.refreshCalls.Add(1)
		var in struct{ RefreshToken string }
		_ = json.NewDecoder(r.Body).Decode(&in)
		f.mu.Lock()
		defer f.mu.Unlock()
		if !f.refreshOK || in.RefreshToken != "rt-1" {
			w.WriteHeader(401)
			_, _ = w.Write([]byte(`{"code":"INVALID_REFRESH_TOKEN","message":"bad"}`))
			return
		}
		f.valid = "fresh"
		_, _ = w.Write([]byte(`{"accessToken":"fresh","refreshToken":"rt-2","user":{"id":1,"email":"a@b.c","fullName":"A","roles":["ROLE_ADMIN"]}}`))
	})
	mux.HandleFunc("/api/v1/vault", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		_, _ = w.Write([]byte(`{"code":"VAULT_LOCKED","message":"locked"}`))
	})
	mux.HandleFunc("/api/v1/thing", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		ok := r.Header.Get("Authorization") == "Bearer "+f.valid
		f.mu.Unlock()
		if !ok {
			w.WriteHeader(401)
			return
		}
		_, _ = w.Write([]byte(`{"amount":12.3456}`))
	})
	return mux
}

func newTestClient(t *testing.T, f *fakeServer) (*Client, *MemStore) {
	srv := httptest.NewServer(f.handler())
	t.Cleanup(srv.Close)
	store := NewMemStore()
	store.Set(srv.URL, "rt-1")
	c := NewClient(srv.URL, store)
	c.access = "stale" // pretend a session exists whose access token expired
	c.refresh = "rt-1"
	c.user = &Profile{}
	return c, store
}

func TestRefreshSingleFlightAndRetry(t *testing.T) {
	f := &fakeServer{valid: "other", refreshOK: true}
	c, store := newTestClient(t, f)

	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			var out struct{ Amount string }
			errs <- c.Get(context.Background(), "thing", nil, &struct{ Amount any }{})
			_ = out
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("request failed: %v", err)
		}
	}
	if n := f.refreshCalls.Load(); n != 1 {
		t.Fatalf("refresh called %d times, want 1", n)
	}
	if got := store.Get(c.BaseURL()); got != "rt-2" {
		t.Fatalf("rotated refresh token not persisted, got %q", got)
	}
}

func TestDomain401DoesNotRefresh(t *testing.T) {
	f := &fakeServer{valid: "stale", refreshOK: true}
	c, _ := newTestClient(t, f)
	err := c.Get(context.Background(), "vault", nil, nil)
	if ae, ok := err.(*ApiError); !ok || ae.Code != "VAULT_LOCKED" {
		t.Fatalf("want VAULT_LOCKED, got %v", err)
	}
	if n := f.refreshCalls.Load(); n != 0 || !c.Authenticated() {
		t.Fatalf("domain 401 refreshed (%d) or dropped session", n)
	}
}

func TestRefreshFailureExpiresSession(t *testing.T) {
	f := &fakeServer{valid: "other", refreshOK: false}
	c, store := newTestClient(t, f)
	expired := make(chan error, 1)
	c.OnSessionExpired = func(err error) { expired <- err }

	err := c.Get(context.Background(), "thing", nil, nil)
	if StatusOf(err) != 401 {
		t.Fatalf("want 401 ApiError, got %v", err)
	}
	if len(expired) != 1 || c.Authenticated() || store.Get(c.BaseURL()) != "" {
		t.Fatal("session not cleared on refresh failure")
	}
}

func TestMessageContract(t *testing.T) {
	cases := []struct {
		err  error
		want string
	}{
		{&ApiError{Code: "FORBIDDEN", Message: " no access "}, "no access"},
		{&ApiError{Code: "INTERNAL_ERROR", Message: "boom"}, "fb"},
		{&ApiError{Message: "no code"}, "fb"},
		{&ApiError{Code: "X", Message: strings.Repeat("a", 301)}, "fb"},
		{context.Canceled, "fb"},
	}
	for _, c := range cases {
		if got := Message(c.err, "fb"); got != c.want {
			t.Errorf("Message(%v)=%q want %q", c.err, got, c.want)
		}
	}
}

func TestNormalizeBaseURL(t *testing.T) {
	ok := map[string]string{
		"https://api.example.com/":             "https://api.example.com",
		"http://localhost:8080":                "http://localhost:8080",
		"http://127.0.0.1:1/x/?q=1#f":          "http://127.0.0.1:1/x",
		"https://u:p@api.example.com:8443/a//": "https://api.example.com:8443/a",
		"http://[::1]:8080":                    "http://[::1]:8080",
	}
	for in, want := range ok {
		if got, err := NormalizeBaseURL(in); err != nil || got != want {
			t.Errorf("NormalizeBaseURL(%q)=%q,%v want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"", "ftp://x.com", "http://example.com", "example.com", "https://", "http://localhost.evil.com"} {
		if _, err := NormalizeBaseURL(in); err == nil {
			t.Errorf("NormalizeBaseURL(%q) accepted", in)
		}
	}
}

func TestInvalidBaseSendsNothing(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits.Add(1) }))
	defer srv.Close()
	c := NewClient("http://example.com", NewMemStore())
	if err := c.Get(context.Background(), "x", nil, nil); err == nil {
		t.Fatal("request to insecure base succeeded")
	}
	if c.BaseURL() != "http://example.com" {
		t.Fatalf("raw base not kept for display: %q", c.BaseURL())
	}
	if err := c.SetBaseURL("http://example.org"); err == nil {
		t.Fatal("SetBaseURL accepted insecure host")
	}
	if err := c.SetBaseURL(srv.URL); err != nil {
		t.Fatal(err)
	}
	_ = c.Get(context.Background(), "x", nil, nil)
	if hits.Load() != 1 {
		t.Fatalf("hits=%d", hits.Load())
	}
}

func TestSameHostRequiresOrigin(t *testing.T) {
	base := "https://api.example.com"
	for ref, want := range map[string]bool{
		"https://api.example.com/a":      true,
		"https://API.example.com:443/a":  true,
		"http://api.example.com/a":       false,
		"https://api.example.com:8443/a": false,
		"https://evil.com/a":             false,
	} {
		if got := sameHost(base, ref); got != want {
			t.Errorf("sameHost(%q)=%v want %v", ref, got, want)
		}
	}
}

func TestRedirectDropsAuthOnOriginChange(t *testing.T) {
	var gotAuth atomic.Value
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth.Store(r.Header.Get("Authorization"))
	}))
	defer other.Close()
	// same host (127.0.0.1), different port => different origin
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, other.URL+"/x", http.StatusFound)
	}))
	defer srv.Close()
	c := NewClient(srv.URL, NewMemStore())
	c.access = "secret"
	if err := c.Get(context.Background(), "thing", nil, nil); err != nil {
		t.Fatal(err)
	}
	if v, _ := gotAuth.Load().(string); v != "" {
		t.Fatalf("Authorization leaked to other origin: %q", v)
	}
}

func TestResponseTooLarge(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(make([]byte, maxJSON+1))
	}))
	defer srv.Close()
	c := NewClient(srv.URL, NewMemStore())
	if err := c.Get(context.Background(), "x", nil, nil); err == nil || err.Error() != "response too large" {
		t.Fatalf("want response too large, got %v", err)
	}
	if b, _, err := c.Bytes(context.Background(), "x", nil); err != nil || len(b) != maxJSON+1 {
		t.Fatalf("binary under 64MiB must pass: %v %d", err, len(b))
	}
}

func TestLoginDroppedWhenBaseChanges(t *testing.T) {
	release := make(chan struct{})
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
		_, _ = w.Write([]byte(`{"accessToken":"a","refreshToken":"rt","user":{"id":1}}`))
	}))
	defer slow.Close()
	store := NewMemStore()
	c := NewClient(slow.URL, store)
	done := make(chan error, 1)
	go func() { _, err := c.Login(context.Background(), "a@b.c", "password1"); done <- err }()
	time.Sleep(50 * time.Millisecond)
	if err := c.SetBaseURL("http://localhost:1"); err != nil {
		t.Fatal(err)
	}
	close(release)
	if err := <-done; err == nil {
		t.Fatal("login result accepted after base change")
	}
	if c.Authenticated() || store.Get("http://localhost:1") != "" || store.Get(slow.URL) != "" {
		t.Fatal("session stored after base change")
	}
}
