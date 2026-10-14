package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"strings"
)

// File is one multipart part.
type File struct {
	Name        string
	ContentType string
	Data        []byte
}

// Upload sends multipart/form-data: text fields plus one part per file under `field`
// (e.g. "files" for imports, "file" for single uploads). out may be nil.
func (c *Client) Upload(ctx context.Context, path string, fields map[string]string, field string, files []File, out any) error {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for k, v := range fields {
		if err := mw.WriteField(k, v); err != nil {
			return err
		}
	}
	esc := strings.NewReplacer(`\`, `\\`, `"`, `\"`)
	for _, f := range files {
		h := textproto.MIMEHeader{}
		h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, esc.Replace(field), esc.Replace(f.Name)))
		ct := f.ContentType
		if ct == "" {
			ct = "application/octet-stream"
		}
		h.Set("Content-Type", ct)
		w, err := mw.CreatePart(h)
		if err != nil {
			return err
		}
		if _, err := w.Write(f.Data); err != nil {
			return err
		}
	}
	if err := mw.Close(); err != nil {
		return err
	}
	resp, err := c.do(ctx, &rawReq{method: "POST", path: path, body: buf.Bytes(), ctype: mw.FormDataContentType()})
	if err != nil {
		return err
	}
	if out != nil && len(bytes.TrimSpace(resp.body)) > 0 {
		return json.Unmarshal(resp.body, out)
	}
	return nil
}

// Bytes downloads an authenticated resource and returns body + Content-Type.
func (c *Client) Bytes(ctx context.Context, path string, q url.Values) ([]byte, string, error) {
	resp, err := c.do(ctx, &rawReq{method: "GET", path: path, query: q, maxBody: maxBinary})
	if err != nil {
		return nil, "", err
	}
	return resp.body, resp.header.Get("Content-Type"), nil
}

// FetchImage loads an image by reference. Server-relative refs ("/api/...") and
// absolute URLs on the same host as the server are sent with the bearer token;
// other absolute http(s) URLs (bank logos) are fetched anonymously.
func (c *Client) FetchImage(ctx context.Context, ref string) ([]byte, error) {
	base := c.BaseURL()
	r := &rawReq{method: "GET", maxBody: maxBinary}
	switch {
	case strings.HasPrefix(ref, "/"):
		r.url = base + ref
	case strings.HasPrefix(ref, "http://") || strings.HasPrefix(ref, "https://"):
		r.url = ref
		r.noAuth = !sameHost(base, ref)
	default:
		return nil, fmt.Errorf("unsupported image reference")
	}
	resp, err := c.do(ctx, r)
	if err != nil {
		return nil, err
	}
	if resp.status != http.StatusOK {
		return nil, fmt.Errorf("image status %d", resp.status)
	}
	return resp.body, nil
}

func sameHost(a, b string) bool {
	ua, e1 := url.Parse(a)
	ub, e2 := url.Parse(b)
	return e1 == nil && e2 == nil && origin(ua) == origin(ub)
}
