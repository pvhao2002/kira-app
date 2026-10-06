#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Url, WebviewUrl, WebviewWindowBuilder};

// ponytail: per-OS spawn, switch to tauri-plugin-opener (Rust-side only, no capability) if a platform misbehaves
fn open_external(url: &Url) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url.as_str()).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", url.as_str()]).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = std::process::Command::new("xdg-open").arg(url.as_str()).spawn();
}

fn main() {
    // Build-time base URL; if unset/invalid the local fallback page is shown.
    // https only; plain http just for local dev (refresh cookie is Secure in prod).
    let admin = option_env!("FARM_ADMIN_URL").and_then(|u| Url::parse(u).ok()).filter(|u| match u.scheme() {
        "https" => true,
        "http" => matches!(u.host_str(), Some("localhost" | "127.0.0.1")),
        _ => false,
    });
    tauri::Builder::default()
        .setup(move |app| {
            let target = match &admin {
                Some(u) => {
                    // Relative join keeps any base path (https://host/farm -> /farm/admin).
                    let mut base = u.clone();
                    if !base.path().ends_with('/') {
                        base.set_path(&format!("{}/", base.path()));
                    }
                    WebviewUrl::External(base.join("admin")?)
                }
                None => WebviewUrl::App("index.html".into()),
            };
            let origin = admin.clone();
            WebviewWindowBuilder::new(app, "main", target)
                .title("Kira Farm Admin")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1024.0, 700.0)
                .on_navigation(move |url| {
                    let local = matches!(url.scheme(), "tauri" | "about") || url.host_str() == Some("tauri.localhost");
                    if local || origin.as_ref().is_some_and(|o| o.origin() == url.origin()) {
                        return true;
                    }
                    if matches!(url.scheme(), "http" | "https") {
                        open_external(url);
                    }
                    false
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Kira Farm Admin");
}
