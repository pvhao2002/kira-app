# Kira Bank Desktop v2

Native desktop client for Kira Bank / Kira Life written in Go with [Fyne](https://fyne.io). It covers the same
features as `kira-bank-ui` (dashboard, credit cards, investment, reports, health, lodging, travel, tutor schedule,
password manager, settings, admin) and calls `kira-bank-service` `/api/v1` directly.

## Requirements

- Go 1.27+
- CGO C compiler: MinGW-w64 (Windows), Xcode CLT (macOS), `gcc` + `libgl1-mesa-dev xorg-dev` (Linux)

## Run

```bash
KIRA_BANK_URL=http://localhost:8080 go run .
```

The server URL can also be changed on the login screen; it is saved in the app preferences.

## Build

```bash
go build -ldflags "-H windowsgui" -o kira-bank-desktop-v2.exe .   # Windows, no console window
go build -o kira-bank-desktop-v2 .                                 # macOS / Linux
```

For signed installers/app bundles use `fyne package` (`go install fyne.io/tools/cmd/fyne@latest`).

## Test

```bash
go vet ./... && go test ./...
```

## Differences from the web app

- The OpenStreetMap iframe on travel places is replaced by buttons that open OSM / Google Maps in the browser.
- Print is replaced by CSV export.
- No realtime WebSocket badge: the unread notification count refreshes on navigation.
- Uploads use a file dialog (no drag-and-drop / clipboard paste yet).
- Tutor lessons are moved with the edit dialog instead of drag-and-drop.
