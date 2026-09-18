#!/bin/sh
set -eu

APP_PID=""
MONITOR_PID=""
UI_PIDS=""
CLEANED=0

remote_display_enabled() {
    case "${KIRA_QUEUE_REMOTE_DISPLAY_ENABLED:-false}" in
        1|true|TRUE|yes|YES|on|ON) return 0 ;;
        *) return 1 ;;
    esac
}

cleanup() {
    if [ "$CLEANED" -eq 1 ]; then
        return
    fi
    CLEANED=1

    if [ -n "$MONITOR_PID" ] && kill -0 "$MONITOR_PID" 2>/dev/null; then
        kill -TERM "$MONITOR_PID" 2>/dev/null || true
    fi
    if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then
        kill -TERM "$APP_PID" 2>/dev/null || true
    fi
    for pid in $UI_PIDS; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done

    if [ -n "$MONITOR_PID" ]; then
        wait "$MONITOR_PID" 2>/dev/null || true
    fi
    if [ -n "$APP_PID" ]; then
        wait "$APP_PID" 2>/dev/null || true
    fi
    for pid in $UI_PIDS; do
        wait "$pid" 2>/dev/null || true
    done
}

trap cleanup TERM INT EXIT

start_remote_display() {
    DISPLAY="${DISPLAY:-:99}"
    export DISPLAY
    export PLAYWRIGHT_HEADLESS=false

    password_file="${KIRA_QUEUE_VNC_PASSWORD_FILE:-/run/secrets/kira_queue_vnc_password}"
    if [ ! -r "$password_file" ] || [ ! -s "$password_file" ]; then
        echo "KIRA_QUEUE_REMOTE_DISPLAY_ENABLED requires a non-empty VNC password secret file" >&2
        exit 1
    fi

    vnc_port="${KIRA_QUEUE_VNC_PORT:-5901}"
    novnc_port="${KIRA_QUEUE_NOVNC_PORT:-6081}"
    novnc_bind_address="${KIRA_QUEUE_NOVNC_BIND_ADDRESS:-127.0.0.1}"
    if [ "$novnc_bind_address" != "127.0.0.1" ]; then
        echo "KIRA_QUEUE_NOVNC_BIND_ADDRESS must remain 127.0.0.1" >&2
        exit 1
    fi

    Xvfb "$DISPLAY" -screen 0 1920x1080x24 -nolisten tcp -ac >/dev/null 2>&1 &
    UI_PIDS="$UI_PIDS $!"
    openbox --sm-disable >/dev/null 2>&1 &
    UI_PIDS="$UI_PIDS $!"
    x11vnc -display "$DISPLAY" -rfbport "$vnc_port" -localhost -forever -shared \
        -passwdfile "$password_file" -noxdamage >/dev/null 2>&1 &
    UI_PIDS="$UI_PIDS $!"
    websockify --web=/usr/share/novnc --host="$novnc_bind_address" "$novnc_port" \
        "127.0.0.1:$vnc_port" >/dev/null 2>&1 &
    UI_PIDS="$UI_PIDS $!"
}

monitor_remote_display() {
    while [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; do
        for pid in $UI_PIDS; do
            if ! kill -0 "$pid" 2>/dev/null; then
                echo "Remote browser display process stopped; stopping kira-queue" >&2
                kill -TERM "$APP_PID" 2>/dev/null || true
                return
            fi
        done
        sleep 5
    done
}

if remote_display_enabled; then
    start_remote_display
else
    export PLAYWRIGHT_HEADLESS=true
fi

java -XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError -jar app.jar &
APP_PID=$!

if [ -n "$UI_PIDS" ]; then
    monitor_remote_display &
    MONITOR_PID=$!
fi

set +e
wait "$APP_PID"
APP_STATUS=$?
set -e
APP_PID=""
exit "$APP_STATUS"
