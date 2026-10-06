//! Configuration loading and validation for Kira Bank Desktop
//!
//! Loads KIRA_BANK_URL from build-time environment and validates format.
//! Only HTTPS (production) or HTTP localhost (dev) are permitted.

pub struct Config {
    pub base_url: Option<String>,
}

impl Config {
    /// Load configuration from build-time environment variable
    pub fn load() -> Self {
        let base = option_env!("KIRA_BANK_URL").map(|s| s.to_string());
        Config { base_url: base }
    }

    /// Validate the base URL: must be HTTPS or HTTP localhost
    pub fn is_valid(url: &str) -> bool {
        match tauri::Url::parse(url) {
            Ok(u) => match u.scheme() {
                "https" => true,
                "http" => matches!(u.host_str(), Some("localhost" | "127.0.0.1")),
                _ => false,
            },
            Err(_) => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_validates_https_url() {
        assert!(Config::is_valid("https://bank.example.vn"));
        assert!(Config::is_valid("https://bank.example.vn:443"));
        assert!(Config::is_valid("https://bank.example.vn/path"));
    }

    #[test]
    fn config_validates_http_localhost() {
        assert!(Config::is_valid("http://localhost"));
        assert!(Config::is_valid("http://localhost:4200"));
        assert!(Config::is_valid("http://127.0.0.1"));
        assert!(Config::is_valid("http://127.0.0.1:8080"));
    }

    #[test]
    fn config_rejects_http_non_localhost() {
        assert!(!Config::is_valid("http://bank.example.vn"));
        assert!(!Config::is_valid("http://api.example.com:3000"));
    }

    #[test]
    fn config_rejects_invalid_schemes() {
        assert!(!Config::is_valid("ftp://bank.example.vn"));
        assert!(!Config::is_valid("file:///etc/passwd"));
        assert!(!Config::is_valid("javascript:void(0)"));
        assert!(!Config::is_valid("data:text/html,<img src=x>"));
    }

    #[test]
    fn config_rejects_malformed_urls() {
        assert!(!Config::is_valid("not a url"));
        assert!(!Config::is_valid("://"));
        assert!(!Config::is_valid(""));
    }

    #[test]
    fn config_load_returns_none_when_unset() {
        // This test runs in test mode where KIRA_BANK_URL is typically unset
        let config = Config::load();
        // We don't assert a specific value because it depends on test environment,
        // but we verify it loads without panicking
        let _ = config.base_url;
    }
}
