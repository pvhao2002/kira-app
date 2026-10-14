package lodging

import (
	"strings"

	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/pages/resources/fb"
)

func init() {
	fb.Add(map[string][2]string{
		"lodging.ok":                 {"OK", "Ổn"},
		"lodging.unit":               {"Unit", "Đơn vị"},
		"lodging.unit.KWH":           {"per kWh", "mỗi kWh"},
		"lodging.unit.MONTH":         {"per month", "mỗi tháng"},
		"lodging.unit.CUBIC_METER":   {"per m³", "mỗi m³"},
		"lodging.unit.PERSON_MONTH":  {"per person / month", "mỗi người / tháng"},
		"lodging.unit.VEHICLE_MONTH": {"per vehicle / month", "mỗi xe / tháng"},
		"lodging.facebook":           {"Facebook link", "Liên kết Facebook"},
		"lodging.video":              {"Video link", "Liên kết video"},
		"lodging.openLink":           {"Open", "Mở"},
		"lodging.removeImage":        {"Remove image", "Xóa ảnh"},
	})
}

type fee struct {
	Amount decimal.Decimal `json:"amount"`
	Unit   string          `json:"unit"`
}

type image struct {
	AttachmentID int64  `json:"attachmentId"`
	OriginalName string `json:"originalName"`
	ContentURL   string `json:"contentUrl"`
}

type distance struct {
	ReferenceLocationID int64            `json:"referenceLocationId"`
	Name                string           `json:"name"`
	DistanceMeters      *decimal.Decimal `json:"distanceMeters"`
	Status              string           `json:"status"`
}

type reviewSummary struct {
	OKCount    int    `json:"okCount"`
	NotOKCount int    `json:"notOkCount"`
	MyStatus   string `json:"myStatus"`
	MyReason   string `json:"myReason"`
}

type listing struct {
	ID               int64           `json:"id"`
	Address          string          `json:"address"`
	FormattedAddress string          `json:"formattedAddress"`
	RentPrice        decimal.Decimal `json:"rentPrice"`
	Electricity      *fee            `json:"electricity"`
	Water            *fee            `json:"water"`
	Service          *fee            `json:"service"`
	Parking          *fee            `json:"parking"`
	FacebookURL      string          `json:"facebookUrl"`
	Phone            string          `json:"phone"`
	VideoURL         string          `json:"videoUrl"`
	Note             string          `json:"note"`
	Owner            struct {
		FullName string `json:"fullName"`
	} `json:"owner"`
	CanEdit       bool          `json:"canEdit"`
	CanDelete     bool          `json:"canDelete"`
	Version       int64         `json:"version"`
	Images        []image       `json:"images"`
	Distances     []distance    `json:"distances"`
	ReviewSummary reviewSummary `json:"reviewSummary"`
}

type refLocation struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Address string `json:"address"`
}

type suggestion struct {
	Label string `json:"label"`
}

type review struct {
	FullName string `json:"fullName"`
	Status   string `json:"status"`
	Reason   string `json:"reason"`
}

func (l listing) title() string {
	if l.FormattedAddress != "" {
		return l.FormattedAddress
	}
	return l.Address
}

// kmText renders a READY distance as "name: 1.25 km"; other states show their status.
func kmText(d distance) string {
	switch {
	case d.Status == "READY" && d.DistanceMeters != nil:
		return d.Name + ": " + d.DistanceMeters.Div(decimal.NewFromInt(1000)).StringFixed(2) + " km"
	case d.Status == "FAILED":
		return d.Name + ": " + i18n.T("lodging.distanceFailed")
	}
	return d.Name + ": " + i18n.T("lodging.calculating")
}

// feeBody is the request shape for a utility fee: null when no amount was entered.
func feeBody(amount any, unit any) any {
	a, ok := amount.(decimal.Decimal)
	if !ok {
		return nil
	}
	return map[string]any{"amount": a, "unit": unit}
}

// reviewError validates a review: a reason is required for NOT_OK and capped at 1000 chars.
func reviewError(status, reason string) string {
	reason = strings.TrimSpace(reason)
	switch {
	case status == "NOT_OK" && reason == "":
		return i18n.T("lodging.reviewReasonRequired")
	case len([]rune(reason)) > 1000:
		return i18n.T("form.maxLength", i18n.P{"value": 1000})
	}
	return ""
}

var unitsFor = map[string][]string{
	"electricity": {"KWH", "MONTH"},
	"water":       {"CUBIC_METER", "PERSON_MONTH", "MONTH"},
	"service":     {"PERSON_MONTH", "MONTH"},
	"parking":     {"VEHICLE_MONTH", "MONTH"},
}
