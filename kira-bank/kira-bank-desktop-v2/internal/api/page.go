package api

import (
	"context"
	"net/url"
	"strconv"
)

type Meta struct {
	Page          int   `json:"page"`
	Size          int   `json:"size"`
	TotalElements int64 `json:"totalElements"`
	TotalPages    int   `json:"totalPages"`
}

// Page is the backend PageResponse envelope {data, meta}.
type Page[T any] struct {
	Data []T  `json:"data"`
	Meta Meta `json:"meta"`
}

// GetPage fetches one page (0-based). q may carry extra params (search, sort, ...).
func GetPage[T any](ctx context.Context, c *Client, path string, q url.Values, page, size int) (Page[T], error) {
	qq := url.Values{}
	for k, v := range q {
		qq[k] = v
	}
	qq.Set("page", strconv.Itoa(page))
	qq.Set("size", strconv.Itoa(size))
	var p Page[T]
	err := c.Get(ctx, path, qq, &p)
	return p, err
}

// GetAll walks every page and concatenates the rows.
func GetAll[T any](ctx context.Context, c *Client, path string, q url.Values, size int) ([]T, error) {
	var all []T
	for page := 0; ; page++ {
		p, err := GetPage[T](ctx, c, path, q, page, size)
		if err != nil {
			return nil, err
		}
		all = append(all, p.Data...)
		if page+1 >= p.Meta.TotalPages || len(p.Data) == 0 {
			return all, nil
		}
	}
}
