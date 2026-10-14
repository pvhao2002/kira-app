package investment

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"

	"kira-bank-desktop-v2/internal/api"
	"kira-bank-desktop-v2/internal/format"
	"kira-bank-desktop-v2/internal/i18n"
	"kira-bank-desktop-v2/internal/ui/kit"
)

type histFilter struct {
	from, to, txType, status string
	hideNoise                bool
}

func (f histFilter) count() int {
	n := 0
	for _, s := range []string{f.from, f.to, f.txType, f.status} {
		if s != "" {
			n++
		}
	}
	return n
}

type historyPage struct {
	env       *kit.Env
	root      *fyne.Container
	err       banner
	accounts  []account
	accountID int64
	applied   histFilter
	page      int
	seq       int

	// edit widgets
	from, to    *widget.DateEntry
	typ, status *widget.Select
	noise       *widget.Check
	filters     *fyne.Container
	toggle      *widget.Button
	showFilters bool
	apply       *widget.Button
	table       *kit.Table[txn]
	count       *widget.Label
	footer      *fyne.Container
	clear       *widget.Button
	loading     *widget.ProgressBarInfinite
}

var (
	txTypes    = []string{"", "DEPOSIT", "WITHDRAWAL", "BONUS"}
	txStatuses = []string{"", "PENDING", "COMPLETED", "FAILED", "CANCELLED"}
)

func canDelete(t txn) bool {
	return t.TransactionType == "BONUS" ||
		((t.TransactionType == "DEPOSIT" || t.TransactionType == "WITHDRAWAL") && strings.TrimSpace(str(t.ExternalTransactionID)) == "")
}

func typeLabel(s string) string {
	switch s {
	case "DEPOSIT", "WITHDRAWAL", "BONUS":
		return i18n.T("investmentTransactions.type." + strings.ToLower(s))
	}
	return format.Dash
}

func statusLabel(s string) string {
	switch s {
	case "PENDING", "COMPLETED", "FAILED", "CANCELLED":
		return i18n.T("investmentTransactions.status." + strings.ToLower(s))
	}
	return format.Dash
}

func newHistory(env *kit.Env) fyne.CanvasObject {
	t := i18n.T
	h := &historyPage{env: env, err: newBanner(), applied: histFilter{hideNoise: true},
		count: widget.NewLabel(""), footer: container.NewHBox(), loading: widget.NewProgressBarInfinite()}
	h.loading.Hide()
	h.from, h.to = newDate(""), newDate("")
	h.typ, h.status = widget.NewSelect(nil, nil), widget.NewSelect(nil, nil)
	h.typ.Options = []string{t("investmentTransactions.allTypes"), typeLabel("DEPOSIT"), typeLabel("WITHDRAWAL"), typeLabel("BONUS")}
	h.status.Options = []string{t("investmentTransactions.allStatuses"), statusLabel("PENDING"), statusLabel("COMPLETED"), statusLabel("FAILED"), statusLabel("CANCELLED")}
	h.typ.SetSelectedIndex(0)
	h.status.SetSelectedIndex(0)
	h.noise = widget.NewCheck(t("investmentTransactions.hideNoise"), func(v bool) {
		h.applied.hideNoise, h.page = v, 0
		h.load()
	})
	h.noise.Checked = true
	h.apply = widget.NewButton(t("investmentTransactions.filter"), h.applyFilters)
	reset := widget.NewButton(t("common.reset"), h.reset)
	invalid := kit.Muted("")
	check := func() {
		bad := dateText(h.from) != "" && dateText(h.to) != "" && dateText(h.from) > dateText(h.to)
		if bad {
			h.apply.Disable()
			invalid.SetText(t("investmentTransactions.invalidDateRange"))
		} else {
			h.apply.Enable()
			invalid.SetText("")
		}
	}
	h.from.OnChanged = func(*time.Time) { check() }
	h.to.OnChanged = func(*time.Time) { check() }
	h.filters = container.NewVBox(
		container.NewGridWithColumns(4, labeled(t("investmentTransactions.fromDate"), h.from), labeled(t("investmentTransactions.toDate"), h.to),
			labeled(t("investmentTransactions.type"), h.typ), labeled(t("field.status"), h.status)),
		container.NewHBox(h.noise, h.apply, reset, invalid))
	h.filters.Hide()
	h.toggle = widget.NewButton("", func() {
		h.showFilters = !h.showFilters
		h.syncToggle()
	})
	h.syncToggle()

	h.clear = widget.NewButton(t("investmentTransactions.clearFilters"), h.reset)
	h.clear.Hide()
	h.table = kit.NewTable([]kit.Col[txn]{
		{Title: t("investmentTransactions.dateTime"), MinWidth: 140, Text: func(x txn) string {
			return format.Timestamp(x.TransactionAt, format.DateMedium) + " " + format.Timestamp(x.TransactionAt, format.TimeShort)
		}},
		{Title: t("investmentTransactions.type"), Text: func(x txn) string {
			g := map[string]string{"DEPOSIT": "↓", "WITHDRAWAL": "↑", "BONUS": "✦"}[x.TransactionType]
			if g == "" {
				g = "•"
			}
			return g + " " + typeLabel(x.TransactionType)
		}},
		{Title: t("field.status"), Text: func(x txn) string { return statusLabel(x.TransactionStatus) }},
		{Title: t("field.amount"), Align: fyne.TextAlignTrailing, MinWidth: 120, Cell: func(x txn) fyne.CanvasObject {
			sign, c := "+", kit.ColorGreen
			if x.TransactionType == "WITHDRAWAL" {
				sign, c = "−", kit.ColorRed
			}
			return coloredText(sign+format.Num(x.Amount, 4)+" "+x.Currency, c, true)
		}},
		{Title: t("investmentTransactions.externalId"), Text: func(x txn) string { return dashIfEmpty(x.ExternalTransactionID) }},
		{Title: t("field.description"), Weight: 2, Text: func(x txn) string { return dashIfEmpty(x.Description) }},
	}, kit.RowAction[txn]{Label: t("investmentTransactions.deleteDirty"), Visible: canDelete, Do: h.delete})

	h.root = container.NewVBox(
		kit.PageHeader(t("investmentTransactions.historyEyebrow"), t("route.investmentHistory"), t("investmentTransactions.historyDescription")),
		h.err, h.toggle, h.filters, h.loading, h.count, h.table, h.clear, h.footer)
	kit.Async(func(ctx context.Context) ([]account, error) { return loadAccounts(ctx, env) }, func(accs []account, err error) {
		if err != nil {
			h.err.set(errText("investmentTransactions.errorAccountLoad", err))
			return
		}
		h.accounts = accs
		id := parseID(env.Params()["accountId"])
		if id == 0 && len(accs) > 0 {
			id = accs[0].ID
		}
		h.accountID = id
		pk := newPicker(accs, "", account.labelWithStatus, id, func(id int64) { h.accountID, h.page = id, 0; h.load() })
		pk.PlaceHolder = t("investmentTransactions.accountPlaceholder")
		h.root.Objects = append([]fyne.CanvasObject{h.root.Objects[0], labeled(t("investmentTransactions.account"), pk)}, h.root.Objects[1:]...)
		h.root.Refresh()
		h.load()
	})
	return h.root
}

func (h *historyPage) syncToggle() {
	key := "investmentTransactions.showFilters"
	if h.showFilters {
		key = "investmentTransactions.hideFilters"
		h.filters.Show()
	} else {
		h.filters.Hide()
	}
	label := i18n.T(key)
	if n := h.applied.count(); n > 0 {
		label += fmt.Sprintf(" (%d)", n)
	}
	h.toggle.SetText(label)
}

func (h *historyPage) applyFilters() {
	f := histFilter{from: dateText(h.from), to: dateText(h.to), hideNoise: h.noise.Checked}
	f.txType, f.status = txTypes[max(h.typ.SelectedIndex(), 0)], txStatuses[max(h.status.SelectedIndex(), 0)]
	h.applied, h.page = f, 0
	h.syncToggle()
	h.load()
}

func (h *historyPage) reset() {
	h.from.SetDate(nil)
	h.to.SetDate(nil)
	h.typ.SetSelectedIndex(0)
	h.status.SetSelectedIndex(0)
	h.noise.Checked = true
	h.noise.Refresh()
	h.applied, h.page = histFilter{hideNoise: true}, 0
	h.syncToggle()
	h.load()
}

func (h *historyPage) load() {
	if h.accountID == 0 {
		return
	}
	h.seq++
	seq, id, page, f := h.seq, h.accountID, h.page, h.applied
	v := url.Values{"sort": {"transactionAt,desc"}}
	for k, s := range map[string]string{"fromDate": f.from, "toDate": f.to, "type": f.txType, "status": f.status} {
		if s != "" {
			v.Set(k, s)
		}
	}
	if f.hideNoise {
		v.Set("hideNoise", "true")
	}
	h.loading.Show()
	h.err.set("")
	kit.Async(func(ctx context.Context) (api.Page[txn], error) {
		return api.GetPage[txn](ctx, h.env.API, fmt.Sprintf("investment/accounts/%d/transactions", id), v, page, 20)
	}, func(res api.Page[txn], err error) {
		if seq != h.seq {
			return
		}
		h.loading.Hide()
		if err != nil {
			h.err.set(errText("investmentTransactions.errorHistoryLoad", err))
			return
		}
		t := i18n.T
		h.count.SetText(t("investmentTransactions.historyResults", i18n.P{"count": res.Meta.TotalElements}))
		if f.count() > 0 {
			h.table.SetEmpty(t("investmentTransactions.emptyFilteredTitle") + "\n" + t("investmentTransactions.emptyFilteredDescription"))
		} else {
			h.table.SetEmpty(t("investmentTransactions.emptyHistoryTitle") + "\n" + t("investmentTransactions.emptyHistoryDescription"))
		}
		h.table.SetRows(res.Data)
		if len(res.Data) == 0 && f.count() > 0 {
			h.clear.Show()
		} else {
			h.clear.Hide()
		}
		h.footer.Objects = nil
		if m := res.Meta; m.TotalElements > 0 {
			start := m.Page*m.Size + 1
			end := min(int64((m.Page+1)*m.Size), m.TotalElements)
			caption := t("investmentTransactions.paginationRange", i18n.P{"start": start, "end": end, "total": m.TotalElements}) + " · " +
				t("investmentTransactions.paginationPage", i18n.P{"current": m.Page + 1, "total": max(m.TotalPages, 1)})
			h.footer.Objects = []fyne.CanvasObject{pager(caption, m.Page, m.TotalPages, func(n int) { h.page = n; h.load() })}
		}
		h.footer.Refresh()
	})
}

func (h *historyPage) delete(x txn) {
	id := h.accountID
	h.env.Confirm(i18n.T("investmentTransactions.deleteConfirmTitle")+"\n"+i18n.T("investmentTransactions.deleteConfirmDescription"), func() {
		kit.Async(func(ctx context.Context) (struct{}, error) {
			return struct{}{}, h.env.API.Delete(ctx, fmt.Sprintf("investment/accounts/%d/transactions/%s", id, strconv.FormatInt(x.ID, 10)), nil)
		}, func(_ struct{}, err error) {
			if err != nil {
				h.err.set(errText("investmentTransactions.errorDelete", err))
				return
			}
			h.env.Toast(kit.ToastSuccess, i18n.T("investmentTransactions.deletedToast"))
			h.load()
		})
	})
}
