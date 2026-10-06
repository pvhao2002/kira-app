#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::NewWindowResponse;
use tauri::{Url, WebviewUrl, WebviewWindowBuilder};

mod config;
mod open;

// ponytail: per-OS spawn, switch to tauri-plugin-opener (Rust-side only, no capability) if a platform misbehaves
fn open_external(url: &Url) {
    if open::is_external_http(url) || matches!(url.scheme(), "mailto" | "tel") {
        open::open_in_browser(url);
    }
}

/// Navigation lock: bundled fallback page and the configured origin stay in the webview.
/// blob: URLs carry their creator's origin (url crate), so same-origin downloads pass.
fn allowed(origin: Option<&Url>, url: &Url) -> bool {
    matches!(url.scheme(), "tauri" | "about")
        || url.host_str() == Some("tauri.localhost")
        || origin.is_some_and(|o| o.origin() == url.origin())
}

/// Build-time base URL: https only; plain http just for local dev (refresh cookie is Secure in prod).
fn base_url(raw: Option<&str>) -> Option<Url> {
    raw.filter(|u| config::Config::is_valid(u)).and_then(|u| Url::parse(u).ok())
}

fn main() {
    // If unset/invalid the local fallback page is shown.
    let base = base_url(config::Config::load().base_url.as_deref());
    tauri::Builder::default()
        .setup(move |app| {
            let target = match &base {
                Some(u) => WebviewUrl::External(u.clone()),
                None => WebviewUrl::App("index.html".into()),
            };
            let origin = base.clone();
            WebviewWindowBuilder::new(app, "main", target)
                .title("Kira Bank")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1024.0, 700.0)
                .on_navigation(move |url| {
                    if allowed(origin.as_ref(), url) {
                        return true;
                    }
                    open_external(url);
                    false
                })
                // target="_blank" / window.open bypass on_navigation; never open popup webviews.
                .on_new_window(|url, _| {
                    open_external(&url);
                    NewWindowResponse::Deny
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Kira Bank");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn navigation_lock() {
        let o = u("https://bank.example.vn");
        let ok = |s: &str| allowed(Some(&o), &u(s));
        assert!(ok("https://bank.example.vn/app?tab=x#y"));
        assert!(ok("blob:https://bank.example.vn/0f1e2d3c"));
        assert!(!ok("https://evil.bank.example.vn/"));
        assert!(!ok("https://bank.example.vn:8443/"));
        assert!(!ok("http://bank.example.vn/"));
        assert!(!ok("blob:https://evil.example.com/0f1e2d3c"));
        assert!(!ok("javascript:alert(1)"));
        assert!(ok("tauri://localhost/index.html"));
        assert!(ok("http://tauri.localhost/index.html"));
        assert!(ok("about:blank"));
        assert!(!allowed(None, &u("https://bank.example.vn")));
    }

    #[test]
    fn base_url_filter() {
        assert!(base_url(Some("https://bank.example.vn")).is_some());
        assert!(base_url(Some("http://localhost:4200")).is_some());
        assert!(base_url(Some("http://bank.example.vn")).is_none());
        assert!(base_url(Some("ftp://bank.example.vn")).is_none());
        assert!(base_url(None).is_none());
    }
}
