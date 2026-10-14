package creditcard

import (
	"context"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"
	"github.com/shopspring/decimal"

	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

// ---- pure draft model (validated and serialised without any UI) ----

type groupDraft struct {
	ID       *int64
	Version  *int64
	Name     string
	Rate     *decimal.Decimal
	Cap      *decimal.Decimal
	MCC      []string
	MCCInput string // text typed but not yet added
}

type programDraft struct {
	ID       *int64
	Version  *int64
	Name     string
	Notes    string
	TermsURL string
	Active   bool
	Groups   []*groupDraft
}

var mccSplit = regexp.MustCompile(`[\s,;]+`)

// addMCC adds every code in input to g. Codes must be 4 digits and unique across
// all groups of the draft; on error nothing is added and the message is returned.
func addMCC(groups []*groupDraft, g *groupDraft, input string) string {
	var codes []string
	for _, c := range mccSplit.Split(strings.TrimSpace(input), -1) {
		if c != "" {
			codes = append(codes, c)
		}
	}
	taken := map[string]bool{}
	for _, o := range groups {
		for _, c := range o.MCC {
			taken[c] = true
		}
	}
	for _, c := range codes {
		if !mccRe.MatchString(c) {
			return i18n.T("creditBenefits.mccInvalid")
		}
		if taken[c] {
			return i18n.T("creditBenefits.mccDuplicate", i18n.P{"code": c})
		}
		taken[c] = true
	}
	g.MCC = append(g.MCC, codes...)
	sort.Strings(g.MCC)
	g.MCCInput = ""
	return ""
}

func validHTTPURL(s string) bool {
	u, err := url.Parse(s)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}

// validateProgram returns the first validation message ("" = valid), in spec order.
func validateProgram(p *programDraft) string {
	for _, g := range p.Groups { // flush pending MCC text
		if strings.TrimSpace(g.MCCInput) != "" {
			if m := addMCC(p.Groups, g, g.MCCInput); m != "" {
				return m
			}
		}
	}
	t := i18n.T
	if strings.TrimSpace(p.Name) == "" {
		return t("creditBenefits.nameRequired")
	}
	if len([]rune(strings.TrimSpace(p.Notes))) > 2000 {
		return t("creditBenefits.notesInvalid")
	}
	if u := strings.TrimSpace(p.TermsURL); u != "" && !validHTTPURL(u) {
		return t("creditBenefits.urlInvalid")
	}
	if len(p.Groups) == 0 {
		return t("creditBenefits.groupRequired")
	}
	names := map[string]bool{}
	seen := map[string]bool{}
	hundred := decimal.NewFromInt(100)
	for _, g := range p.Groups {
		n := strings.TrimSpace(g.Name)
		if n == "" {
			return t("creditBenefits.groupNameRequired")
		}
		if names[strings.ToLower(n)] {
			return t("creditBenefits.groupDuplicate")
		}
		names[strings.ToLower(n)] = true
		if g.Rate == nil || !g.Rate.IsPositive() || g.Rate.GreaterThan(hundred) {
			return t("creditBenefits.rateInvalid")
		}
		if g.Cap == nil || !g.Cap.IsPositive() {
			return t("creditBenefits.groupCapInvalid")
		}
		if len(g.MCC) == 0 {
			return t("creditBenefits.mccRequired")
		}
		for _, c := range g.MCC {
			if !mccRe.MatchString(c) {
				return t("creditBenefits.mccInvalid")
			}
			if seen[c] {
				return t("creditBenefits.mccDuplicate", i18n.P{"code": c})
			}
			seen[c] = true
		}
	}
	return ""
}

func nilIfEmpty(s string) any {
	if s = strings.TrimSpace(s); s == "" {
		return nil
	}
	return s
}

// request builds the POST/PUT body (CreditCardCashbackProgramRequest).
func (p *programDraft) request() map[string]any {
	groups := make([]map[string]any, 0, len(p.Groups))
	for _, g := range p.Groups {
		groups = append(groups, map[string]any{"id": g.ID, "version": g.Version, "categoryName": strings.TrimSpace(g.Name),
			"cashbackRate": g.Rate, "maxCashbackAmount": g.Cap, "mccCodes": g.MCC})
	}
	return map[string]any{"name": strings.TrimSpace(p.Name), "notes": nilIfEmpty(p.Notes), "termsUrl": nilIfEmpty(p.TermsURL),
		"active": p.Active, "version": p.Version, "groups": groups}
}

func draftOf(pr *program) *programDraft {
	d := &programDraft{Active: true}
	if pr == nil {
		d.Groups = []*groupDraft{{}}
		return d
	}
	id, ver := pr.ID, pr.Version
	d.ID, d.Version, d.Name, d.Notes, d.TermsURL, d.Active = &id, &ver, pr.Name, str(pr.Notes), str(pr.TermsURL), pr.Active
	for _, g := range pr.Groups {
		gid, gv, rate, cp := g.ID, g.Version, g.CashbackRate, g.MaxCashbackAmount
		d.Groups = append(d.Groups, &groupDraft{ID: &gid, Version: &gv, Name: g.CategoryName, Rate: &rate, Cap: &cp, MCC: append([]string(nil), g.MCCCodes...)})
	}
	return d
}

// ---- dialog ----

// programDialog creates (pr == nil) or edits a cashback program of card b. onSaved gets the updated card.
func programDialog(env *kit.Env, b benefit, pr *program, onSaved func(benefit)) {
	d := draftOf(pr)
	title := i18n.T("creditBenefits.addProgram")
	if pr != nil {
		title = i18n.T("creditBenefits.editProgram")
	}

	name := widget.NewEntry()
	name.SetText(d.Name)
	name.OnChanged = func(s string) { d.Name = s }
	notes := widget.NewMultiLineEntry()
	notes.SetText(d.Notes)
	notes.OnChanged = func(s string) { d.Notes = s }
	terms := widget.NewEntry()
	terms.SetPlaceHolder("https://")
	terms.SetText(d.TermsURL)
	terms.OnChanged = func(s string) { d.TermsURL = s }
	active := widget.NewCheck(i18n.T("creditBenefits.activeOnSave"), func(v bool) { d.Active = v })
	active.SetChecked(d.Active)

	errMsg := newErrBox()
	groupsBox := container.NewVBox()
	var render func()
	render = func() {
		groupsBox.Objects = nil
		for i, g := range d.Groups {
			groupsBox.Add(groupEditor(d, g, i, render))
		}
		groupsBox.Refresh()
	}
	render()

	var dlg *dialog.CustomDialog
	save := widget.NewButton(i18n.T("common.save"), nil)
	save.Importance = widget.HighImportance
	save.OnTapped = func() {
		if m := validateProgram(d); m != "" {
			errMsg.set(m)
			render()
			return
		}
		errMsg.set("")
		body := d.request()
		method, path := "POST", "credit-card-benefits/"+strconv.FormatInt(b.CardID, 10)+"/programs"
		if d.ID != nil {
			method, path = "PUT", path+"/"+strconv.FormatInt(*d.ID, 10)
		}
		save.Disable()
		save.SetText(i18n.T("creditBenefits.saving"))
		kit.Async(func(ctx context.Context) (benefit, error) {
			var out benefit
			return out, env.API.Do(ctx, method, path, nil, body, &out)
		}, func(out benefit, err error) {
			save.Enable()
			save.SetText(i18n.T("common.save"))
			if err != nil {
				errMsg.set(errText(err, "creditBenefits.saveFailed", "creditBenefits.stale"))
				return
			}
			dlg.Hide()
			env.Toast(kit.ToastSuccess, i18n.T("creditBenefits.programSaved"))
			onSaved(out)
		})
	}
	cancel := widget.NewButton(i18n.T("common.cancel"), func() { dlg.Hide() })
	addGroup := widget.NewButton(i18n.T("creditBenefits.addGroup"), func() { d.Groups = append(d.Groups, &groupDraft{}); render() })

	field := func(key string, w fyne.CanvasObject) fyne.CanvasObject {
		return container.NewVBox(widget.NewLabel(i18n.T(key)), w)
	}
	body := container.NewVBox(
		kit.Muted(i18n.T("creditBenefits.eyebrow")),
		field("creditBenefits.programName", name), field("creditBenefits.notes", notes), field("creditBenefits.termsUrl", terms), active,
		kit.Sep(), container.NewBorder(nil, nil, bold(i18n.T("creditBenefits.categoryGroups")), addGroup),
		kit.Muted(i18n.T("creditBenefits.categoryGroupsDescription")),
		groupsBox, errMsg, container.NewHBox(cancel, save))
	dlg = dialog.NewCustomWithoutButtons(title, container.NewVScroll(container.NewPadded(body)), env.Window)
	cs := env.Window.Canvas().Size()
	dlg.Resize(fyne.NewSize(min(640, cs.Width-40), min(720, cs.Height-60)))
	dlg.Show()
}

func groupEditor(d *programDraft, g *groupDraft, idx int, rerender func()) fyne.CanvasObject {
	name := widget.NewEntry()
	name.SetPlaceHolder(i18n.T("creditBenefits.categoryExample"))
	name.SetText(g.Name)
	name.OnChanged = func(s string) { g.Name = s }

	moneyField := func(get **decimal.Decimal) *kit.MoneyEntry {
		m := kit.NewMoneyEntry(4)
		if *get != nil {
			m.SetValue(**get)
		}
		m.OnValueChanged = func() {
			if v, ok := m.Value(); ok {
				*get = &v
			} else {
				*get = nil
			}
		}
		return m
	}
	rate := moneyField(&g.Rate)
	capEntry := moneyField(&g.Cap)

	mccErr := newErrBox()
	mcc := widget.NewEntry()
	mcc.SetPlaceHolder("5411, 5812, 5999")
	mcc.SetText(g.MCCInput)
	mcc.OnChanged = func(s string) { g.MCCInput = s }
	add := func() {
		if strings.TrimSpace(g.MCCInput) == "" {
			return
		}
		if m := addMCC(d.Groups, g, g.MCCInput); m != "" {
			mccErr.set(m)
			return
		}
		rerender()
	}
	mcc.OnSubmitted = func(string) { add() }
	chips := container.NewHBox()
	for _, c := range g.MCC {
		c := c
		chips.Add(widget.NewButton(c+" ×", func() {
			for i, x := range g.MCC {
				if x == c {
					g.MCC = append(g.MCC[:i:i], g.MCC[i+1:]...)
					break
				}
			}
			rerender()
		}))
	}
	remove := widget.NewButton("×", func() {
		d.Groups = append(d.Groups[:idx:idx], d.Groups[idx+1:]...)
		rerender()
	})
	remove.Importance = widget.LowImportance
	lbl := func(key string) fyne.CanvasObject { return widget.NewLabel(i18n.T(key)) }
	return widget.NewCard("", "", container.NewVBox(
		container.NewBorder(nil, nil, bold(i18n.T("creditBenefits.groupNumber", i18n.P{"number": idx + 1})), remove),
		lbl("creditBenefits.categoryName"), name,
		lbl("creditBenefits.cashbackRate"), container.NewBorder(nil, nil, nil, widget.NewLabel("%"), rate),
		lbl("creditBenefits.groupCap"), capEntry,
		lbl("creditBenefits.mccCodes"), container.NewBorder(nil, nil, nil, widget.NewButton(i18n.T("creditBenefits.addMcc"), add), mcc),
		kit.Muted(i18n.T("creditBenefits.mccHint")), mccErr, chips))
}

func programPath(cardID, programID int64) string {
	return "credit-card-benefits/" + strconv.FormatInt(cardID, 10) + "/programs/" + strconv.FormatInt(programID, 10)
}
