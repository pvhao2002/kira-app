package health

import (
	"context"
	"net/url"
	"strconv"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

var defaultProfile = profileData{HeightCm: 170, FormulaSex: "MALE", Goal: "MAINTAIN", ActivityFactor: 1.2, PreparationMinutes: 30}

func opt(prefix string, values ...string) []kit.Option {
	out := make([]kit.Option, len(values))
	for i, v := range values {
		out[i] = kit.Option{Value: v, Label: i18n.T(prefix + v)}
	}
	return out
}

// localTZ is the default health timezone: the OS IANA zone name.
func localTZ() string {
	if n := time.Local.String(); n != "" && n != "Local" {
		return n
	}
	return "UTC"
}

func dec(s string) decimal.Decimal { return decimal.RequireFromString(s) }

func (h *view) profileSection() fyne.CanvasObject {
	p, version := defaultProfile, int64(-1)
	p.Timezone = localTZ()
	if h.data.profile != nil {
		p, version = h.data.profile.Data, h.data.profile.Version
	}
	af := strconv.FormatFloat(p.ActivityFactor, 'f', -1, 64)
	text := func(k string, max int, v string) kit.Field {
		return kit.Field{Key: k, Label: i18n.T("health." + k), Kind: kit.KindTextArea, MaxLen: max, Initial: v}
	}
	form := kit.NewForm([]kit.Field{
		{Key: "heightCm", Label: i18n.T("health.heightCm"), Kind: kit.KindNumber, Required: true, Min: kit.Dec("80"), Max: kit.Dec("250"), Initial: decimal.NewFromFloat(p.HeightCm)},
		{Key: "birthDate", Label: i18n.T("health.birthDate"), Kind: kit.KindDate, Required: true, Initial: p.BirthDate},
		{Key: "formulaSex", Label: i18n.T("health.formulaSex"), Kind: kit.KindSelect, Required: true, Options: opt("health.", "MALE", "FEMALE"), Initial: p.FormulaSex},
		{Key: "timezone", Label: i18n.T("health.timezone"), Required: true, MaxLen: 80, Initial: p.Timezone},
		{Key: "goal", Label: i18n.T("health.goal"), Kind: kit.KindSelect, Required: true, Options: opt("health.", "MAINTAIN", "LOSE", "GAIN"), Initial: p.Goal},
		{Key: "activityFactor", Label: i18n.T("health.activityFactor"), Kind: kit.KindSelect, Required: true, Initial: af,
			Options: []kit.Option{{Value: "1.2", Label: i18n.T("health.sedentary")}, {Value: "1.375", Label: i18n.T("health.light")},
				{Value: "1.55", Label: i18n.T("health.moderate")}, {Value: "1.725", Label: i18n.T("health.veryActive")}}},
		{Key: "calorieAdjustment", Label: i18n.T("health.calorieAdjustment"), Kind: kit.KindNumber, Required: true,
			Min: kit.Dec("-1000"), Max: kit.Dec("1000"), Validate: intOnly, Hint: i18n.T("health.adjustmentHelp"), Initial: decimal.NewFromInt(int64(p.CalorieAdjustment))},
		{Key: "preparationMinutes", Label: i18n.T("health.preparationMinutes"), Kind: kit.KindNumber, Required: true,
			Min: kit.Dec("0"), Max: kit.Dec("240"), Validate: intOnly, Initial: decimal.NewFromInt(int64(p.PreparationMinutes))},
		text("foodPreferences", 2000, p.FoodPreferences), text("allergies", 1000, p.Allergies),
		text("avoidedFoods", 1000, p.AvoidedFoods), text("exerciseExperience", 1000, p.ExerciseExperience),
		text("equipment", 1000, p.Equipment), text("availability", 1000, p.Availability),
		text("movementRestrictions", 2000, p.MovementRestrictions),
	})
	save := widget.NewButton(i18n.T("health.saveProfile"), func() {
		v, ok := form.Values()
		if !ok {
			return
		}
		sv := func(k string) string { s, _ := v[k].(string); return s }
		dv := func(k string) decimal.Decimal { d, _ := v[k].(decimal.Decimal); return d }
		af, err := strconv.ParseFloat(sv("activityFactor"), 64)
		if err != nil {
			form.SetFieldError("activityFactor", i18n.T("form.invalidFormat"))
			return
		}
		body := map[string]any{"version": version, "data": profileData{
			HeightCm: dv("heightCm").InexactFloat64(), BirthDate: sv("birthDate"), FormulaSex: sv("formulaSex"),
			Goal: sv("goal"), Timezone: sv("timezone"), ActivityFactor: af,
			CalorieAdjustment: int(dv("calorieAdjustment").IntPart()), PreparationMinutes: int(dv("preparationMinutes").IntPart()),
			FoodPreferences: sv("foodPreferences"), Allergies: sv("allergies"), AvoidedFoods: sv("avoidedFoods"),
			ExerciseExperience: sv("exerciseExperience"), Equipment: sv("equipment"), Availability: sv("availability"),
			MovementRestrictions: sv("movementRestrictions")}}
		h.mutate(func(ctx context.Context) error { return h.env.API.Put(ctx, "health/profile", body, nil) }, nil)
	})
	save.Importance = widget.HighImportance
	profile := kit.Card(i18n.T("health.bodyProfile"), i18n.T("health.adultHelp"),
		container.NewVBox(form.Content(), kit.Muted(i18n.T("health.restrictionHelp")), save))
	return container.NewVBox(profile, h.weightPanel())
}

func intOnly(v any) string {
	if d, ok := v.(decimal.Decimal); ok && !d.IsInteger() {
		return i18n.T("form.invalidFormat")
	}
	return ""
}

func (h *view) weightPanel() fyne.CanvasObject {
	form := kit.NewForm([]kit.Field{
		{Key: "date", Label: i18n.T("health.date"), Kind: kit.KindDate, Required: true, Initial: time.Now().Format(day)},
		{Key: "kg", Label: i18n.T("health.weightKg"), Kind: kit.KindNumber, Required: true, Min: kit.Dec("20"), Max: kit.Dec("500")},
	})
	save := widget.NewButton(i18n.T("health.save"), func() {
		v, ok := form.Values()
		if !ok {
			return
		}
		body := map[string]any{"date": v["date"], "kg": v["kg"]}
		h.mutate(func(ctx context.Context) error { return h.env.API.Put(ctx, "health/weights", body, nil) }, nil)
	})
	if h.data.profile == nil {
		save.Disable() // a weight needs a saved profile first
	}
	list := container.NewVBox()
	for _, w := range h.data.weights {
		w := w
		del := widget.NewButtonWithIcon(i18n.T("health.delete"), theme.DeleteIcon(), func() {
			h.env.Confirm(i18n.T("health.deleteConfirm"), func() {
				h.mutate(func(ctx context.Context) error {
					return h.env.API.Delete(ctx, "health/weights/"+url.PathEscape(w.Date), nil)
				}, nil)
			})
		})
		del.Importance = widget.LowImportance
		list.Add(container.NewHBox(widget.NewLabel(format.DateOnly(w.Date, format.DateDMY)), widget.NewLabel(num(w.Kg)+" kg"), del))
	}
	return kit.Card(i18n.T("health.weightHistory"), "", container.NewVBox(form.Content(), save, list))
}
