import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

if (process.platform === 'linux' && process.arch === 'arm64') {
  // ponytail: Patchright 1.64.3 rejects ARM64. Remove this patch once its Chrome installer supports ARM64.
  const path = 'node_modules/patchright-core/bin/reinstall_chrome_stable_linux.sh';
  const script = readFileSync(path, 'utf8');
  const guard = 'if [[ $(arch) == "aarch64" ]]; then\n  echo "ERROR: not supported on Linux Arm64"\n  exit 1\nfi\n';
  const amd64Package = 'google-chrome-stable_current_amd64.deb';
  assert.ok(script.includes(guard) && script.split(amd64Package).length === 4,
    'Patchright changed its Chrome installer. Recheck ARM64 support before rebuilding.');
  writeFileSync(path, script.replace(guard, '').replaceAll(amd64Package, 'google-chrome-stable_current_arm64.deb'));
}
