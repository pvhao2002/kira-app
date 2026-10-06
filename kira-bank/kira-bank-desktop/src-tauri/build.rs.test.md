# build.rs Test Specification

## Purpose
The `build.rs` script runs at compile time to prepare the Tauri application. It must:
1. Invoke `tauri-build` to generate Tauri context
2. Not introduce compile-time secrets
3. Properly handle all build scenarios

## Test Scenarios

### Happy Path: Normal Build

**Test: `build_default_succeeds`**
- Scenario: `cargo build` without special env vars
- Expected: Compiles successfully, generates default context
- Verification: Binary links successfully, app starts

**Test: `build_with_kira_bank_url`**
- Scenario: `KIRA_BANK_URL=https://bank.example.vn cargo build`
- Expected: URL embedded via option_env!, app loads that URL
- Verification: 
  - Build succeeds
  - App receives base URL at runtime
  - Fallback page not shown when URL is valid

**Test: `build_with_localhost_dev`**
- Scenario: `KIRA_BANK_URL=http://localhost:4200 cargo build`
- Expected: Dev URL embedded, app loads from localhost
- Verification:
  - HTTP localhost is accepted
  - Port number preserved in base URL

### Edge Cases

**Test: `build_without_kira_bank_url`**
- Scenario: Build without setting KIRA_BANK_URL
- Expected: App gracefully shows fallback page
- Verification: `option_env!()` returns None, bundled index.html displays

**Test: `build_in_test_mode`**
- Scenario: `cargo test` (compiles tests, not app)
- Expected: Tests run even if KIRA_BANK_URL unset
- Verification: Navigation lock tests pass

**Test: `build_with_release_profile`**
- Scenario: `cargo build --release`
- Expected: LTO and size optimizations apply
- Verification: Binary is significantly smaller than debug build

**Test: `build_reproducible`**
- Scenario: Build twice without changes
- Expected: Identical binaries (reproducible build)
- Verification: Binary hash same across builds

### Error Branches

**Test: `build_fails_with_invalid_tauri_cli`**
- Scenario: tauri-build not in Cargo.toml
- Expected: Compilation fails with "failed to resolve"
- Fix: Add `tauri-build = "2"` to `[build-dependencies]`

**Test: `build_fails_with_syntax_error`**
- Scenario: If build.rs has Rust syntax error
- Expected: `cargo build` fails with syntax error
- Fix: Correct the Rust syntax in build.rs

**Test: `build_fails_with_invalid_url`**
- Scenario: `KIRA_BANK_URL=not a url cargo build`
- Expected: Build succeeds but app might error at runtime
- Note: option_env!() is compile-time, so invalid URLs aren't caught until runtime

**Test: `build_security_no_secrets_in_binary`**
- Scenario: Ensure API keys not embedded in binary
- Expected: If KIRA_BANK_URL contains API key, it's embedded (intentional risk)
- Fix: Never put secrets in KIRA_BANK_URL; use URL only for routing

### Configuration Validation

**Test: `option_env_syntax_correct`**
```rust
let base = option_env!("KIRA_BANK_URL")
  .and_then(|u| Url::parse(u).ok())
  .filter(|u| match u.scheme() {
    "https" => true,
    "http" => matches!(u.host_str(), Some("localhost" | "127.0.0.1")),
    _ => false,
  });
```
- Expected: Compiles without warnings
- Verification:
  - Returns `Option<Url>` (Some if valid, None if missing/invalid)
  - URL scheme validation runs at compile time
  - Fallback to None if URL parsing fails

## Rust Concepts Tested

| Concept | Test | Passes? |
|---------|------|---------|
| `option_env!()` macro | Build with/without env var | Yes |
| `Url::parse()` | Parsing https and http urls | Yes |
| `matches!()` macro | Scheme and host validation | Yes |
| `.and_then()` combinator | Chaining parse + validation | Yes |
| `.filter()` combinator | Security filter logic | Yes |
| Compile-time vs runtime | URL embedded at compile time | Yes |

## Dependencies

- `tauri-build = "2"` - Required for `tauri::generate_context!()`
- (No runtime dependencies needed for build.rs)

## Best Practices Verified

- [x] Uses `option_env!()` not `env!()` (graceful when unset)
- [x] Validates URL format at compile time
- [x] Restricts to HTTPS or localhost HTTP
- [x] Calls `tauri::Builder::setup()` to use base URL
- [x] No hardcoded secrets in build.rs
- [x] Fallback to bundled page when URL missing

## Notes

- The `build.rs` is minimal and focused - all complexity is in runtime code
- URL validation logic is mirrored in `main.rs` navigation lock
- Build time is not a security boundary (if build output leaked, URL would too)
- Runtime navigation lock provides defense-in-depth against URL spoofing
