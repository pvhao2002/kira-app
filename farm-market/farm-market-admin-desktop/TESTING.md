# Test Cases for farm-market-admin-desktop

## Overview

Comprehensive test suite for the Tauri v2 desktop shell for Kira Farm Admin. Tests are organized into unit tests and integration tests, covering happy paths, edge cases, and error branches.

## Test Structure

Tests are located in the `src-tauri/src/` directory:
- `lib.rs` - Unit tests for URL parsing, validation, and navigation logic
- `integration_tests.rs` - Integration tests for full workflows and navigation decision flows

## Test Execution

Run tests with:
```bash
cd src-tauri
FARM_ADMIN_URL=https://farm.example.vn cargo test --lib
```

Note: Tests require a Rust compiler with MSVC toolchain (Visual Studio Build Tools with C++ workload).

---

## Unit Tests (`src-tauri/src/lib.rs`)

### URL Parsing Tests (Happy Path)

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_url_parse_valid_https` | Parse valid HTTPS URL | Validates scheme, host, and /admin path joining |
| `test_url_parse_valid_http` | Parse valid HTTP URL | Handles localhost and port numbers |

### URL Parsing Tests (Edge Cases)

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_url_parse_empty` | Empty URL string | Rejects invalid input |
| `test_url_parse_no_scheme` | URL without scheme prefix | Rejects malformed URLs |
| `test_url_parse_invalid_scheme` | FTP/unsupported scheme | Filters to http/https only |
| `test_url_parse_file_scheme` | file:// protocol | Blocks local file access |
| `test_url_parse_with_trailing_slash` | URL ending with / | Preserves path handling |
| `test_url_parse_with_port` | URL with explicit port | Parses port numbers correctly |
| `test_url_parse_with_query` | URL with query parameters | Handles query strings (lost in join) |
| `test_url_parse_localhost_ip` | 127.0.0.1 address | Accepts IP addresses |
| `test_url_parse_ipv6` | IPv6 address format | Handles [::1] notation |

### Navigation Tests (Allowed)

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_navigation_local_tauri_scheme` | tauri:// scheme | Allows framework-internal URLs |
| `test_navigation_about_scheme` | about:blank | Allows about: scheme |
| `test_navigation_same_origin` | Same origin navigation | Allows navigation within admin domain |

### Navigation Tests (Blocked)

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_navigation_different_origin` | Different origin request | Blocks cross-origin navigation |
| `test_navigation_different_port_same_domain` | Different port, same domain | Enforces strict origin check |
| `test_navigation_different_scheme_same_domain` | HTTP vs HTTPS same domain | Blocks scheme mismatch |
| `test_navigation_javascript_scheme` | javascript: URLs | Blocks XSS attack vectors |

### External Link Handling Tests

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_navigation_external_http_link` | External http/https link | Identifies links for external handler |
| `test_navigation_javascript_scheme` | javascript: (prevention) | Prevents JS injection |

### Option Filtering Tests

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_option_filter_valid` | Valid URL passes filter | Validates scheme filter chain |
| `test_option_filter_invalid_scheme` | Invalid scheme filtered | Removes non-http(s) URLs |
| `test_option_filter_none` | None stays None | Preserves None through filter |

### Window Configuration Tests

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_window_size_default` | Default size 1440x900 | Validates window dimensions |
| `test_window_size_minimum` | Min size 1024x700 | Verifies constraints |
| `test_window_size_constraints_valid` | Default >= minimum | Checks constraint ordering |

---

## Integration Tests (`src-tauri/src/integration_tests.rs`)

### Full Workflow Tests (Happy Path)

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_full_flow_with_valid_env` | Complete flow: env → URL → /admin | End-to-end URL resolution |

### Full Workflow Tests (Error Handling)

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_full_flow_with_missing_env` | No env var → fallback | Graceful degradation to index.html |
| `test_full_flow_with_invalid_scheme` | Invalid scheme in env | Falls back to local page |
| `test_full_flow_with_malformed_url` | Garbage URL string | Handles parse failure gracefully |

### Navigation Decision Flow Tests

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_navigation_decision_local_allowed` | Local tauri:// navigation | Logic chain for allowing local |
| `test_navigation_decision_same_origin_allowed` | Same-origin navigation | Permits admin domain requests |
| `test_navigation_decision_different_origin_blocked` | Cross-origin blocked | Triggers external handler |

### External Handler Tests

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_external_handler_triggered_for_http` | HTTP/HTTPS external links | Correctly identifies external links |
| `test_external_handler_not_triggered_for_javascript` | javascript: not external | Prevents handler abuse |

### Origin Comparison Tests (Fine-grained)

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_origin_comparison_with_subdomain` | admin.farm vs farm | Subdomains are different origins |
| `test_origin_comparison_implicit_port` | Port 80 implicit for HTTP | Standard port handling |
| `test_origin_comparison_implicit_https_port` | Port 443 implicit for HTTPS | Standard port handling |

### Safety & Robustness Tests

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_admin_path_join_safety` | Path traversal attempts | join() normalizes paths safely |
| `test_url_clone_and_compare` | Clone and compare URL objects | Origin capture in closures |

### Configuration Tests

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_window_title` | Window title string | Title is set and non-empty |
| `test_window_aspect_ratio` | Window dimensions ratio | Landscape aspect maintained |

### Pattern Tests

| Test | Purpose | Coverage |
|------|---------|----------|
| `test_option_env_pattern` | option_env!() simulation | Handles missing env gracefully |
| `test_origin_capture_in_closure` | Move closure origin capture | Verifies ownership/borrow patterns |

---

## Test Coverage Summary

### By Category

**URL Parsing:** 10 unit tests
- Valid URLs (2 happy path)
- Invalid/malformed URLs (8 edge cases)

**Navigation & Origin:** 13 tests
- Local/framework URLs (2)
- Same-origin (1)
- Cross-origin blocking (3)
- Subdomain/port/scheme variations (3)
- External handler logic (2)
- Scheme detection (2)

**Configuration & Window:** 4 tests
- Window size/constraints (3)
- Window title (1)

**Workflow & Integration:** 10 tests
- Full flows with valid/invalid env (4)
- Navigation decision flow (3)
- Safety/robustness (2)
- Pattern verification (1)

**Total: 37 test cases**

### By Branch Coverage

✅ **Happy Path:**
- Valid FARM_ADMIN_URL environment variable
- Window creation with /admin path
- Same-origin navigation allowed
- External links opened in system browser

✅ **Error Branches:**
- Missing FARM_ADMIN_URL → fallback to index.html
- Malformed/invalid URL → fallback
- Invalid scheme (ftp, file, etc.) → filtered out
- Cross-origin navigation → blocked (external handler triggered)
- javascript: scheme → blocked

✅ **Edge Cases:**
- Empty URL string
- URLs with port numbers
- IPv6 addresses
- Trailing slashes
- Query parameters
- Subdomain variations
- Port 80/443 implicit behavior
- Path traversal attempts

---

## Known Limitations

1. **Compilation:** Tests require Visual Studio Build Tools with C++ workload. The module includes `Cargo.lock` for reproducible builds in CI.

2. **Runtime Testing:** End-to-end manual QA (window rendering, navigation, system browser integration) requires:
   - FARM_ADMIN_URL set to a valid admin URL
   - farm-market-service and farm-market-ui running
   - System browser available

3. **Tauri Framework Limitations:**
   - Cannot unit test Tauri's `WebviewWindowBuilder` directly (requires runtime)
   - `open_external()` spawns OS commands (tested via pattern verification)
   - Navigation handler is tested via logic verification, not integration

---

## Running Tests

### Unit Tests Only
```bash
cd src-tauri
FARM_ADMIN_URL=https://farm.example.vn cargo test --lib 2>&1
```

### Specific Test
```bash
cargo test test_url_parse_valid_https -- --nocapture
```

### With Output
```bash
cargo test --lib -- --nocapture --test-threads=1
```

---

## CI Integration

The GitHub Actions workflow (`.github/workflows/farm-admin-desktop.yml`) runs:
```bash
npm install
cd src-tauri
cargo check
```

To add test execution to CI, modify the workflow:
```yaml
- name: Run tests
  env:
    FARM_ADMIN_URL: https://farm.example.vn
  run: |
    cd farm-market/farm-market-admin-desktop/src-tauri
    cargo test --lib
```

---

## Test Maintenance

When updating `main.rs`:
1. If URL handling changes, update `test_url_parse_*` tests
2. If navigation logic changes, update `test_navigation_*` tests
3. If window config changes, update `test_window_*` tests
4. If FARM_ADMIN_URL behavior changes, update integration tests

All tests should pass before merging to master.
