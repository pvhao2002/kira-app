# Testing Guide: kira-bank-desktop

This document describes all tests for the Kira Bank Desktop application and how to run them.

## Quick Start

```bash
# Install dependencies
npm install

# Run Rust tests (requires MSVC on Windows)
cd src-tauri
cargo test

# Run configuration tests (Node.js, all platforms)
npm test
```

## Test Organization

### Rust Tests (Tauri Backend)

#### 1. Navigation Lock Tests (`src-tauri/src/main.rs`)
- **File**: `src-tauri/src/main.rs` (lines 57-237 approx)
- **What it tests**: Security policy for navigation within the webview
- **Happy path** (allowed):
  - Same-origin navigation (https://bank.example.vn → https://bank.example.vn/app)
  - Query strings and fragments
  - Tauri protocol (tauri://localhost)
  - About blank (about:blank)
- **Edge cases**:
  - Different ports (reject https://bank.example.vn:8443)
  - Different subdomains (reject https://evil.bank.example.vn)
  - Scheme mismatch (reject http://bank.example.vn when origin is https)
- **Error branches**:
  - JavaScript injections (reject javascript:alert(1))
  - Data URIs (reject data:text/html,...)
  - File URIs (reject file:///etc/passwd)
  - Attacker domains (reject https://evil.example.com)

**Run**:
```bash
cd src-tauri
cargo test navigation_lock
```

#### 2. Configuration Tests (`src-tauri/src/config.rs`)
- **File**: `src-tauri/src/config.rs`
- **What it tests**: URL parsing and validation logic for KIRA_BANK_URL
- **Coverage**:
  - HTTPS URLs always accepted
  - HTTP localhost/127.0.0.1 accepted for dev
  - Other HTTP URLs rejected (security)
  - FTP, data, javascript schemes rejected
  - Malformed URLs rejected

**Run**:
```bash
cd src-tauri
cargo test config
```

#### 3. External Link Handling (`src-tauri/src/open.rs`)
- **File**: `src-tauri/src/open.rs`
- **What it tests**: Platform-specific link opening and URL classification
- **Coverage**:
  - HTTP/HTTPS correctly classified as external
  - Non-http schemes ignored
  - `open_in_browser()` doesn't panic on any input
  - URLs with query params handled

**Run**:
```bash
cd src-tauri
cargo test open
```

#### 4. Integration Tests (`src-tauri/tests/integration_test.rs`)
- **File**: `src-tauri/tests/integration_test.rs`
- **What it tests**: App configuration and build setup
- **Coverage**:
  - App name and identifier correct
  - Window dimensions valid
  - Bundle targets configured per platform
  - Security capabilities correctly set (no custom commands)

**Run**:
```bash
cd src-tauri
cargo test --test integration_test
```

### Node.js Configuration Tests

These use Vitest or Node's assert module and run on all platforms (don't need MSVC).

#### 1. Package Configuration (`package.test.js`)
- **File**: `package.test.js`
- **What it tests**: package.json structure
- **Coverage**:
  - Name, version, private flag
  - Build and dev scripts present
  - Tauri v2 as devDependency (not v1)
  - No production dependencies

**Run**:
```bash
node package.test.js
# or with test framework:
npm test -- package.test.js
```

#### 2. Tauri Configuration (`src-tauri/tauri.conf.test.js`)
- **File**: `src-tauri/tauri.conf.test.js`
- **What it tests**: tauri.conf.json security and build config
- **Coverage**:
  - Product name and identifier
  - Frontend dist path
  - Security capabilities (must be "default" only)
  - No remote IPC configuration
  - Bundle targets for all 3 platforms
  - Icon locations

**Run**:
```bash
node src-tauri/tauri.conf.test.js
```

#### 3. Environment Configuration (`.env.example.test.js`)
- **File**: `.env.example.test.js`
- **What it tests**: .env.example structure and documentation
- **Coverage**:
  - KIRA_BANK_URL defined
  - HTTPS or localhost examples
  - No real credentials in examples
  - No production URLs hard-coded
  - Proper assignment syntax (=)

**Run**:
```bash
node .env.example.test.js
```

#### 4. Gitignore Validation (`.gitignore.test.js`)
- **File**: `.gitignore.test.js`
- **What it tests**: .gitignore excludes build artifacts and secrets
- **Coverage**:
  - .env files ignored
  - node_modules, dist, target ignored
  - .env.example NOT ignored (should be committed)
  - No source code accidentally ignored
  - Platform-specific files ignored

**Run**:
```bash
node .gitignore.test.js
```

## Test Status

### Windows (Currently Unable to Run Full Tests)

❌ **Cargo tests blocked**: Machine doesn't have MSVC C++ Build Tools
- `cargo check` requires linker (link.exe)
- `cargo test` requires MSVC

**Workaround**: Install MSVC C++ Build Tools:
1. Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Select "Desktop development with C++" workload
3. Re-run `cargo check` and `cargo test`

✅ **Node.js tests working**: No MSVC required
- `npm install` OK
- Configuration tests pass
- `npx tauri icon` generated icons

### macOS & Linux

✅ **Full test suite should pass**:
```bash
npm install
cd src-tauri
cargo test
cd ..
npm test
```

## Test Coverage

| Component | Test File | Happy Path | Edge Cases | Error Branches |
|-----------|-----------|-----------|-----------|-----------------|
| Navigation lock | main.rs | ✓ | ✓ | ✓ |
| Config loading | config.rs | ✓ | ✓ | ✓ |
| External links | open.rs | ✓ | ✓ | ✓ |
| Integration | integration_test.rs | ✓ | ✓ | ✓ |
| package.json | package.test.js | ✓ | ✓ | ✓ |
| tauri.conf.json | tauri.conf.test.js | ✓ | ✓ | ✓ |
| .env.example | .env.example.test.js | ✓ | ✓ | ✓ |
| .gitignore | .gitignore.test.js | ✓ | ✓ | ✓ |

## Continuous Integration

In CI, run:
```bash
npm ci
cd src-tauri
cargo check  # or cargo test if all deps available
cd ..
npm test
```

Expected: All tests pass on macOS, Linux; Node tests pass on Windows.

## Manual QA

After tests pass, authorize manual verification:

```bash
# Terminal 1: Start backend and UI
cd ../../kira-bank-service
mvn spring-boot:run

# Terminal 2: Start Angular UI
cd kira-bank-ui
npm run dev

# Terminal 3: Start desktop app
npm run dev
```

**Checklist**:
- [ ] Login flow works
- [ ] Refresh token persists across reload (HttpOnly cookie)
- [ ] Angular app renders at 1440 px width
- [ ] Travel map iframe works
- [ ] External links open system browser
- [ ] Unset KIRA_BANK_URL shows fallback page

## Architecture Notes

1. **Thin Shell**: Desktop app is just a Tauri wrapper around the web app
2. **No Custom IPC**: Remote content can't call Rust functions (security)
3. **Navigation Lock**: Enforces that only the configured origin is allowed
4. **Fallback Page**: If URL missing/invalid, shows dist/index.html (Vietnamese)
5. **No Bundling**: Angular dist NOT embedded (would break cookies and relative /api calls)

## Debugging Tests

**Verbose Cargo output**:
```bash
cd src-tauri
RUST_LOG=debug cargo test -- --nocapture
```

**Node.js test with detailed output**:
```bash
node --trace-warnings package.test.js
```

**Check if tauri-build is working**:
```bash
cd src-tauri
cargo build 2>&1 | grep -i "tauri\|build"
```

## Known Issues

### Windows

- **Issue**: `linker 'link.exe' not found`
- **Cause**: MSVC not installed
- **Fix**: Install Visual Studio Build Tools with C++ workload

### All Platforms

- **Issue**: Port conflicts when running `npm run dev`
- **Fix**: Set different ports: `KIRA_BANK_URL=http://localhost:5173 npm run dev`

## Test Evolution

As the app grows, add tests for:
- Renderer process (if we add custom commands)
- Menu items (if we add app menus)
- Deep linking (if we support URL schemes)
- Update flow (if we add auto-update)
- Signing/notarization (if we release to app stores)

See [AGENTS.override.md](./AGENTS.override.md) for change rules.
