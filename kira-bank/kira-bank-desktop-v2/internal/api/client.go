// Package api is the HTTP client for kira-bank-service: JSON helpers, paging,
// single-flight token refresh and the error contract. It never logs anything.
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
)

func init() {
	// Money goes to the backend (Jackson BigDecimal) as JSON numbers, not strings.
	decimal.MarshalJSONWithoutQuotes = true
}

// ErrNoSession means there is no stored refresh token to restore from.
var ErrNoSession = errors.New("no stored session")

// ApiError is the backend error contract: {status, code, message, fieldErrors, traceId}.
type ApiError struct {
	Status      int               `json:"status"`
	Code        string            `json:"code"`
	Message     string            `json:"message"`
	FieldErrors map[string]string `json:"fieldErrors"`
	TraceID     string            `json:"traceId"`
}

func (e *ApiError) Error() string { return fmt.Sprintf("api error %d %s", e.Status, e.Code) }

// Message mirrors the web apiErrorMessage: the server message is shown only for
// well-formed, non-internal, short errors; everything else gets the fallback.
func Message(err error, fallback string) string {
	var ae *ApiError
	if errors.As(err, &ae) && ae.Code != "" && ae.Code != "INTERNAL_ERROR" {
		if m := strings.TrimSpace(ae.Message); m != "" && len(m) <= 300 {
			return m
		}
	}
	return fallback
}

// StatusOf returns the HTTP status of an ApiError, or 0.
func StatusOf(err error) int {
	var ae *ApiError
	if errors.As(err, &ae) {
		return ae.Status
	}
	return 0
}

// Profile is the authenticated user.
type Profile struct {
	ID       int64    `json:"id"`
	Email    string   `json:"email"`
	FullName string   `json:"fullName"`
	Phone    *string  `json:"phone"`
	Roles    []string `json:"roles"`
	Version  int64    `json:"version"`
}

func (p *Profile) IsAdmin() bool {
	if p == nil {
		return false
	}
	for _, r := range p.Roles {
		if r == "ROLE_ADMIN" {
			return true
		}
	}
	return false
}

type session struct {
	AccessToken  string  `json:"accessToken"`
	RefreshToken string  `json:"refreshToken"`
	User         Profile `json:"user"`
}

// Client is safe for concurrent use.
type Client struct {
	// OnSessionExpired is called (on a non-UI goroutine) after a failed refresh
	// cleared the session. Set it before use.
	OnSessionExpired func(err error)

	store     TokenStore
	hc        *http.Client
	refreshMu sync.Mutex // single-flight refresh (refresh tokens rotate)
	sessMu    sync.Mutex // serialises session state + token store writes (set vs clear)

	mu      sync.RWMutex
	base    string
	baseErr error // non-nil: base is invalid/insecure and no request may be sent
	access  string
	refresh string
	user    *Profile
}

var (
	errInvalidBase = errors.New("invalid server url")
	errTooLarge    = errors.New("response too large")
)

// NormalizeBaseURL validates a server URL: http/https only, http only for
// loopback hosts; userinfo, query, fragment and trailing slashes are dropped.
func NormalizeBaseURL(raw string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Hostname() == "" {
		return "", errInvalidBase
	}
	switch u.Scheme {
	case "https":
	case "http":
		if h := u.Hostname(); h != "localhost" && h != "127.0.0.1" && h != "::1" {
			return "", errInvalidBase
		}
	default:
		return "", errInvalidBase
	}
	u.User, u.RawQuery, u.Fragment, u.RawFragment = nil, "", "", ""
	u.Path, u.RawPath = strings.TrimRight(u.Path, "/"), ""
	return u.String(), nil
}

// origin is scheme://host:port with default ports made explicit.
func origin(u *url.URL) string {
	p := u.Port()
	if p == "" {
		p = map[string]string{"http": "80", "https": "443"}[u.Scheme]
	}
	return u.Scheme + "://" + net.JoinHostPort(strings.ToLower(u.Hostname()), p)
}

// NewClient never sends a request to an invalid/insecure base: the client keeps
// the raw value (so the login screen can show it) and fails every call until
// SetBaseURL succeeds.
func NewClient(baseURL string, store TokenStore) *Client {
	c := &Client{store: store}
	c.hc = &http.Client{Timeout: 60 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 10 {
			return errors.New("stopped after 10 redirects")
		}
		if origin(req.URL) != origin(via[0].URL) {
			req.Header.Del("Authorization") // Go only strips on host change, not scheme downgrade
		}
		return nil
	}}
	if b, err := NormalizeBaseURL(baseURL); err == nil {
		c.base = b
	} else {
		c.base, c.baseErr = strings.TrimSpace(baseURL), err
	}
	return c
}

func (c *Client) BaseURL() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.base
}

// SetBaseURL validates and switches server, dropping any in-memory session.
// On error the previous base and session are kept.
func (c *Client) SetBaseURL(u string) error {
	b, err := NormalizeBaseURL(u)
	if err != nil {
		return err
	}
	c.mu.Lock()
	c.base, c.baseErr = b, nil
	c.access, c.refresh, c.user = "", "", nil
	c.mu.Unlock()
	return nil
}

func (c *Client) User() *Profile {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.user
}

// SetUser replaces the cached user (e.g. after a profile save).
func (c *Client) SetUser(p Profile) {
	c.mu.Lock()
	c.user = &p
	c.mu.Unlock()
}

func (c *Client) Authenticated() bool { return c.User() != nil }

func (c *Client) token() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.access
}

// setSession stores the session unless the base changed since the request began.
func (c *Client) setSession(base string, s session) {
	c.sessMu.Lock()
	defer c.sessMu.Unlock()
	c.mu.Lock()
	if c.base != base {
		c.mu.Unlock()
		return
	}
	c.access, c.user = s.AccessToken, &s.User
	if s.RefreshToken != "" {
		c.refresh = s.RefreshToken
	}
	rt := c.refresh
	c.mu.Unlock()
	if rt != "" && c.store != nil {
		c.store.Set(base, rt) // rotation: persist immediately
	}
}

// clear drops the session of `base`; the in-memory part is skipped if the base changed.
func (c *Client) clear(base string) {
	c.sessMu.Lock()
	defer c.sessMu.Unlock()
	c.mu.Lock()
	if c.base == base {
		c.access, c.refresh, c.user = "", "", nil
	}
	c.mu.Unlock()
	if c.store != nil {
		c.store.Delete(base)
	}
}

// Login signs in and stores the refresh token.
func (c *Client) Login(ctx context.Context, email, password string) (*Profile, error) {
	var s session
	base := c.BaseURL()
	body := map[string]any{"email": email, "password": password, "clientIp": nil}
	if err := c.Do(ctx, "POST", "auth/mobile/login", nil, body, &s, withBase(base)); err != nil {
		return nil, err
	}
	c.setSession(base, s)
	if c.BaseURL() != base {
		return nil, context.Canceled // server switched mid-login; session dropped
	}
	return c.User(), nil
}

// Restore signs in from the stored refresh token. ErrNoSession when none.
func (c *Client) Restore(ctx context.Context) error {
	var rt string
	if c.store != nil {
		rt = c.store.Get(c.BaseURL())
	}
	if rt == "" {
		return ErrNoSession
	}
	c.mu.Lock()
	c.refresh = rt
	c.mu.Unlock()
	return c.refreshAfter(ctx, "")
}

// Logout revokes the refresh token (best effort) and clears the session.
func (c *Client) Logout(ctx context.Context) {
	c.mu.RLock()
	rt, base := c.refresh, c.base
	c.mu.RUnlock()
	if rt != "" {
		_ = c.Do(ctx, "POST", "auth/mobile/logout", nil, map[string]string{"refreshToken": rt}, nil, withBase(base))
	}
	c.clear(base)
}

// refreshAfter refreshes unless another goroutine already replaced `used`.
func (c *Client) refreshAfter(ctx context.Context, used string) error {
	c.refreshMu.Lock()
	defer c.refreshMu.Unlock()
	if cur := c.token(); cur != "" && cur != used {
		return nil
	}
	c.mu.RLock()
	rt, base := c.refresh, c.base
	c.mu.RUnlock()
	if rt == "" {
		c.expired(base, ErrNoSession)
		return ErrNoSession
	}
	var s session
	err := c.Do(ctx, "POST", "auth/mobile/refresh", nil, map[string]string{"refreshToken": rt}, &s, withBase(base))
	if err != nil {
		// Only a definitive rejection ends the session; network errors keep the token.
		if st := StatusOf(err); st >= 400 && st < 500 {
			c.expired(base, err)
		}
		return err
	}
	c.setSession(base, s)
	return nil
}

func (c *Client) expired(base string, err error) {
	if c.BaseURL() != base {
		return // server switched while the request was in flight
	}
	c.clear(base)
	if c.OnSessionExpired != nil {
		c.OnSessionExpired(err)
	}
}

var authPath = regexp.MustCompile(`^auth/(mobile/)?(login|refresh|logout)$`)

type rawReq struct {
	method, path, url string
	query             url.Values
	body              []byte
	ctype             string
	header            http.Header
	noAuth            bool
	base              string // server snapshot the request belongs to ("" = current)
	maxBody           int64  // response cap; 0 = maxJSON
}

const (
	maxJSON   = 8 << 20
	maxBinary = 64 << 20
)

func withBase(b string) Opt { return func(r *rawReq) { r.base = b } }

// Opt customises a request.
type Opt func(*rawReq)

// WithHeader sets a request header (e.g. Idempotency-Key).
func WithHeader(k, v string) Opt {
	return func(r *rawReq) {
		if r.header == nil {
			r.header = http.Header{}
		}
		r.header.Set(k, v)
	}
}

type response struct {
	status int
	body   []byte
	header http.Header
}

func (c *Client) send(ctx context.Context, r *rawReq, token string) (*response, error) {
	c.mu.RLock()
	base, baseErr := c.base, c.baseErr
	c.mu.RUnlock()
	if baseErr != nil {
		return nil, baseErr
	}
	if r.base != "" {
		base = r.base
	}
	u := r.url
	if u == "" {
		u = base + "/api/v1/" + strings.TrimPrefix(r.path, "/")
	}
	if len(r.query) > 0 {
		sep := "?"
		if strings.Contains(u, "?") {
			sep = "&"
		}
		u += sep + r.query.Encode()
	}
	var body io.Reader
	if r.body != nil {
		body = bytes.NewReader(r.body)
	}
	req, err := http.NewRequestWithContext(ctx, r.method, u, body)
	if err != nil {
		return nil, err
	}
	for k, v := range r.header {
		req.Header[k] = v
	}
	req.Header.Set("User-Agent", "KiraBankDesktop/2.0")
	if r.ctype != "" {
		req.Header.Set("Content-Type", r.ctype)
	}
	if token != "" && !r.noAuth {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	limit := r.maxBody
	if limit == 0 {
		limit = maxJSON
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(b)) > limit {
		return nil, errTooLarge
	}
	return &response{resp.StatusCode, b, resp.Header}, nil
}

// tokenRejected reports whether a 401 body means the access token itself was
// rejected. Domain 401s (VAULT_LOCKED, VAULT_BAD_CREDENTIALS, ...) must not
// trigger a refresh: it would rotate the refresh token for nothing.
func tokenRejected(body []byte) bool {
	var e struct {
		Code string `json:"code"`
	}
	_ = json.Unmarshal(body, &e)
	return e.Code == "" || e.Code == "UNAUTHORIZED"
}

// do sends with the bearer token; on 401 refreshes once (single-flight) and retries once.
func (c *Client) do(ctx context.Context, r *rawReq) (*response, error) {
	tok := c.token()
	resp, err := c.send(ctx, r, tok)
	if err != nil {
		return nil, err
	}
	if resp.status == http.StatusUnauthorized && tok != "" && !r.noAuth && !authPath.MatchString(r.path) && tokenRejected(resp.body) {
		if err := c.refreshAfter(ctx, tok); err != nil {
			return nil, err
		}
		if resp, err = c.send(ctx, r, c.token()); err != nil {
			return nil, err
		}
	}
	if resp.status >= 400 {
		ae := &ApiError{}
		_ = json.Unmarshal(resp.body, ae)
		ae.Status = resp.status
		return nil, ae
	}
	return resp, nil
}

// Do performs a JSON request. in/out may be nil. q may be nil.
func (c *Client) Do(ctx context.Context, method, path string, q url.Values, in, out any, opts ...Opt) error {
	r := &rawReq{method: method, path: path, query: q}
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return err
		}
		r.body, r.ctype = b, "application/json"
	}
	for _, o := range opts {
		o(r)
	}
	resp, err := c.do(ctx, r)
	if err != nil {
		return err
	}
	if out != nil && len(bytes.TrimSpace(resp.body)) > 0 {
		return json.Unmarshal(resp.body, out)
	}
	return nil
}

func (c *Client) Get(ctx context.Context, path string, q url.Values, out any) error {
	return c.Do(ctx, "GET", path, q, nil, out)
}
func (c *Client) Post(ctx context.Context, path string, in, out any, opts ...Opt) error {
	return c.Do(ctx, "POST", path, nil, in, out, opts...)
}
func (c *Client) Put(ctx context.Context, path string, in, out any) error {
	return c.Do(ctx, "PUT", path, nil, in, out)
}
func (c *Client) Patch(ctx context.Context, path string, in, out any) error {
	return c.Do(ctx, "PATCH", path, nil, in, out)
}
func (c *Client) Delete(ctx context.Context, path string, q url.Values) error {
	return c.Do(ctx, "DELETE", path, q, nil, nil)
}
