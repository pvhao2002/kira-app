//! External link handling for each platform
//!
//! When a navigation is blocked by the security policy, external http(s) links
//! are opened in the system's default browser using platform-specific commands.

use tauri::Url;

/// Attempt to open a URL in the system browser
///
/// - macOS: uses `open` command
/// - Windows: uses `rundll32 url.dll,FileProtocolHandler`
/// - Linux: uses `xdg-open`
pub fn open_in_browser(url: &Url) {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(url.as_str()).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url.as_str()])
            .spawn();
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = std::process::Command::new("xdg-open").arg(url.as_str()).spawn();
    }
}

/// Check if a URL should be opened externally (not blocked by policy)
pub fn is_external_http(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    // === External link classification ===

    #[test]
    fn external_link_classifies_https() {
        assert!(is_external_http(&u("https://example.com")));
    }

    #[test]
    fn external_link_classifies_http() {
        assert!(is_external_http(&u("http://example.com")));
    }

    #[test]
    fn external_link_ignores_tauri_scheme() {
        assert!(!is_external_http(&u("tauri://localhost")));
    }

    #[test]
    fn external_link_ignores_about_scheme() {
        assert!(!is_external_http(&u("about:blank")));
    }

    #[test]
    fn external_link_ignores_javascript_scheme() {
        assert!(!is_external_http(&u("javascript:void(0)")));
    }

    #[test]
    fn external_link_ignores_data_scheme() {
        assert!(!is_external_http(&u("data:text/html,<h1>test</h1>")));
    }

    // === URL scheme parsing (happy path) ===

    #[test]
    fn url_parse_http_with_port() {
        let url = u("http://example.com:8080/path");
        assert_eq!(url.scheme(), "http");
        assert_eq!(url.port(), Some(8080));
    }

    #[test]
    fn url_parse_https_implicit_port() {
        let url = u("https://example.com/path");
        assert_eq!(url.scheme(), "https");
        // HTTPS default port 443 is implicit
        assert_eq!(url.port(), None);
    }

    #[test]
    fn url_parse_with_query() {
        let url = u("https://example.com/path?key=value&foo=bar");
        assert_eq!(url.scheme(), "https");
        assert_eq!(url.query(), Some("key=value&foo=bar"));
    }

    #[test]
    fn url_parse_with_fragment() {
        let url = u("https://example.com/path#section");
        assert_eq!(url.scheme(), "https");
        assert_eq!(url.fragment(), Some("section"));
    }

    // === Error handling: open_in_browser doesn't panic ===

    #[test]
    fn open_browser_http_no_panic() {
        // Should not panic regardless of platform
        open_in_browser(&u("http://example.com"));
    }

    #[test]
    fn open_browser_https_no_panic() {
        // Should not panic regardless of platform
        open_in_browser(&u("https://bank.example.vn/oauth"));
    }

    #[test]
    fn open_browser_with_query_params() {
        // URLs with query params should also not panic
        open_in_browser(&u("https://example.com/auth?code=abc123&state=xyz"));
    }
}
