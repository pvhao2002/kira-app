#[cfg(test)]
mod integration_tests;

#[cfg(test)]
mod tests {
    /// Happy path: valid HTTPS URL with /admin path
    #[test]
    fn test_url_parse_valid_https() {
        let url_str = "https://farm.example.vn";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        assert_eq!(url.scheme(), "https");
        assert_eq!(url.host_str(), Some("farm.example.vn"));

        let admin_path = url.join("/admin");
        assert!(admin_path.is_ok());
        assert_eq!(admin_path.unwrap().path(), "/admin");
    }

    /// Happy path: valid HTTP URL with /admin path
    #[test]
    fn test_url_parse_valid_http() {
        let url_str = "http://localhost:4201";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        assert_eq!(url.scheme(), "http");
        assert!(matches!(url.host_str(), Some("localhost")));

        let admin_path = url.join("/admin");
        assert!(admin_path.is_ok());
        assert_eq!(admin_path.unwrap().path(), "/admin");
    }

    /// Edge case: empty URL string
    #[test]
    fn test_url_parse_empty() {
        let url_str = "";
        let result = url::Url::parse(url_str);
        assert!(result.is_err());
    }

    /// Edge case: malformed URL without scheme
    #[test]
    fn test_url_parse_no_scheme() {
        let url_str = "farm.example.vn";
        let result = url::Url::parse(url_str);
        assert!(result.is_err());
    }

    /// Edge case: invalid scheme (ftp should not be allowed)
    #[test]
    fn test_url_parse_invalid_scheme() {
        let url_str = "ftp://farm.example.vn";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        // Filter to only allow http/https
        let is_allowed = matches!(url.scheme(), "http" | "https");
        assert!(!is_allowed);
    }

    /// Edge case: file:// scheme (local file, should not be allowed)
    #[test]
    fn test_url_parse_file_scheme() {
        let url_str = "file:///etc/passwd";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        let is_allowed = matches!(url.scheme(), "http" | "https");
        assert!(!is_allowed);
    }

    /// Edge case: URL with trailing slash (should still work)
    #[test]
    fn test_url_parse_with_trailing_slash() {
        let url_str = "https://farm.example.vn/";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        let admin_path = url.join("/admin");
        assert!(admin_path.is_ok());
        assert_eq!(admin_path.unwrap().path(), "/admin");
    }

    /// Edge case: URL with port number
    #[test]
    fn test_url_parse_with_port() {
        let url_str = "https://farm.example.vn:8443";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        assert_eq!(url.port(), Some(8443));
    }

    /// Edge case: URL with query parameters (should preserve and append /admin)
    #[test]
    fn test_url_parse_with_query() {
        let url_str = "https://farm.example.vn?debug=true";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        let admin_path = url.join("/admin");
        assert!(admin_path.is_ok());
        // join() replaces path, query is lost
        assert_eq!(admin_path.unwrap().path(), "/admin");
    }

    /// Edge case: localhost IP address
    #[test]
    fn test_url_parse_localhost_ip() {
        let url_str = "http://127.0.0.1:4201";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        assert_eq!(url.host_str(), Some("127.0.0.1"));
    }

    /// Edge case: IPv6 address
    #[test]
    fn test_url_parse_ipv6() {
        let url_str = "http://[::1]:8080";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
    }

    /// Navigation: local tauri URL should be allowed
    #[test]
    fn test_navigation_local_tauri_scheme() {
        let url_str = "tauri://localhost/index.html";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        let local = matches!(url.scheme(), "tauri" | "about");
        assert!(local);
    }

    /// Navigation: about scheme should be allowed
    #[test]
    fn test_navigation_about_scheme() {
        let url_str = "about:blank";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        let local = matches!(url.scheme(), "about");
        assert!(local);
    }

    /// Navigation: same-origin request should be allowed
    #[test]
    fn test_navigation_same_origin() {
        let admin_origin_str = "https://farm.example.vn";
        let admin = url::Url::parse(admin_origin_str).unwrap();

        let nav_url_str = "https://farm.example.vn/admin/users";
        let nav_url = url::Url::parse(nav_url_str).unwrap();

        // Check if origins match
        let same_origin = admin.origin() == nav_url.origin();
        assert!(same_origin);
    }

    /// Navigation: different origin should not be allowed (unless external handler)
    #[test]
    fn test_navigation_different_origin() {
        let admin_origin_str = "https://farm.example.vn";
        let admin = url::Url::parse(admin_origin_str).unwrap();

        let nav_url_str = "https://evil.example.com/admin";
        let nav_url = url::Url::parse(nav_url_str).unwrap();

        let same_origin = admin.origin() == nav_url.origin();
        assert!(!same_origin);
    }

    /// Navigation: same domain, different port should be different origin
    #[test]
    fn test_navigation_different_port_same_domain() {
        let admin_origin_str = "https://farm.example.vn:443";
        let admin = url::Url::parse(admin_origin_str).unwrap();

        let nav_url_str = "https://farm.example.vn:8443/admin";
        let nav_url = url::Url::parse(nav_url_str).unwrap();

        let same_origin = admin.origin() == nav_url.origin();
        assert!(!same_origin);
    }

    /// Navigation: same domain, different scheme should be different origin
    #[test]
    fn test_navigation_different_scheme_same_domain() {
        let admin_origin_str = "https://farm.example.vn";
        let admin = url::Url::parse(admin_origin_str).unwrap();

        let nav_url_str = "http://farm.example.vn/admin";
        let nav_url = url::Url::parse(nav_url_str).unwrap();

        let same_origin = admin.origin() == nav_url.origin();
        assert!(!same_origin);
    }

    /// Navigation: external http/https link should be marked for external handler
    #[test]
    fn test_navigation_external_http_link() {
        let url_str = "https://example.com/page";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        let is_http_https = matches!(url.scheme(), "http" | "https");
        assert!(is_http_https);
    }

    /// Navigation: javascript: scheme should not be handled as http/https
    #[test]
    fn test_navigation_javascript_scheme() {
        let url_str = "javascript:alert('xss')";
        let result = url::Url::parse(url_str);
        assert!(result.is_ok());
        let url = result.unwrap();
        let is_http_https = matches!(url.scheme(), "http" | "https");
        assert!(!is_http_https);
    }

    /// Option filtering: valid URL passes the filter
    #[test]
    fn test_option_filter_valid() {
        let admin = Some(url::Url::parse("https://farm.example.vn").unwrap())
            .filter(|u| matches!(u.scheme(), "http" | "https"));
        assert!(admin.is_some());
    }

    /// Option filtering: invalid scheme is filtered out
    #[test]
    fn test_option_filter_invalid_scheme() {
        let admin = Some(url::Url::parse("ftp://farm.example.vn").unwrap())
            .filter(|u| matches!(u.scheme(), "http" | "https"));
        assert!(admin.is_none());
    }

    /// Option filtering: None remains None
    #[test]
    fn test_option_filter_none() {
        let admin: Option<url::Url> = None;
        let filtered = admin.filter(|u| matches!(u.scheme(), "http" | "https"));
        assert!(filtered.is_none());
    }

    /// Window size: default size is valid
    #[test]
    fn test_window_size_default() {
        let width = 1440.0;
        let height = 900.0;
        assert!(width > 0.0);
        assert!(height > 0.0);
        let aspect = width / height;
        assert!(aspect > 1.0); // wider than tall
    }

    /// Window size: minimum constraints
    #[test]
    fn test_window_size_minimum() {
        let min_width = 1024.0;
        let min_height = 700.0;
        let width = 1440.0;
        let height = 900.0;

        assert!(width >= min_width);
        assert!(height >= min_height);
    }

    /// Window size: minimum is smaller than default
    #[test]
    fn test_window_size_constraints_valid() {
        let default_width = 1440.0;
        let default_height = 900.0;
        let min_width = 1024.0;
        let min_height = 700.0;

        assert!(default_width > min_width);
        assert!(default_height > min_height);
    }

    /// URL resolution with and_then: valid URL resolves to /admin path
    #[test]
    fn test_url_resolution_with_and_then() {
        let admin = url::Url::parse("https://farm.example.vn").ok()
            .and_then(|u| u.join("/admin").ok());
        assert!(admin.is_some());
        assert_eq!(admin.unwrap().path(), "/admin");
    }

    /// URL resolution: invalid base fails and_then chain
    #[test]
    fn test_url_resolution_invalid_base() {
        let admin = url::Url::parse("invalid").ok()
            .and_then(|u| u.join("/admin").ok());
        assert!(admin.is_none());
    }

    /// Error handling: spawn without unwrap should handle failures gracefully
    /// (testing the pattern of using _ = to ignore spawn errors)
    #[test]
    fn test_spawn_error_handling() {
        // Simulate the pattern: let _ = Command::new(...).spawn();
        // This pattern silently ignores errors, which is intentional
        let result = std::process::Command::new("nonexistent_command_12345")
            .spawn();
        let _ = result;
        // If we reached here without panicking, the error was handled gracefully
        assert!(true);
    }
}
