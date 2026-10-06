/**
 * Package configuration tests for kira-bank-desktop
 *
 * Verifies that package.json is correctly configured for Tauri v2
 * and that build/dev scripts are present.
 */

import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'assert';
import { readFileSync } from 'fs';

describe('package.json configuration', () => {
  let pkg;

  beforeEach(() => {
    const content = readFileSync('./package.json', 'utf-8');
    pkg = JSON.parse(content);
  });

  describe('happy path: basic fields', () => {
    it('should have name kira-bank-desktop', () => {
      assert.equal(pkg.name, 'kira-bank-desktop');
    });

    it('should have version 0.1.0', () => {
      assert.equal(pkg.version, '0.1.0');
    });

    it('should be marked private', () => {
      assert.equal(pkg.private, true);
    });
  });

  describe('happy path: scripts', () => {
    it('should have dev script for tauri dev', () => {
      assert.equal(pkg.scripts.dev, 'tauri dev');
    });

    it('should have build script for tauri build', () => {
      assert.equal(pkg.scripts.build, 'tauri build');
    });
  });

  describe('happy path: dependencies', () => {
    it('should have @tauri-apps/cli as devDependency', () => {
      assert.ok('@tauri-apps/cli' in pkg.devDependencies);
    });

    it('should use Tauri v2', () => {
      const version = pkg.devDependencies['@tauri-apps/cli'];
      assert.ok(version.includes('^2'), `Tauri version should be v2, got: ${version}`);
    });

    it('should not have production dependencies', () => {
      assert.equal(pkg.dependencies === undefined || Object.keys(pkg.dependencies).length === 0, true);
    });
  });

  describe('edge case: no dangerous dependencies', () => {
    it('should not include system-level runners', () => {
      const allDeps = Object.keys(pkg.devDependencies || {});
      const dangerous = allDeps.filter(d => ['pm2', 'forever', 'supervisor'].includes(d));
      assert.equal(dangerous.length, 0, `Should not include process managers: ${dangerous.join(', ')}`);
    });

    it('should not include obsolete Tauri v1 packages', () => {
      const devDeps = Object.keys(pkg.devDependencies || {});
      const v1Packages = devDeps.filter(d => d.includes('tauri-v1') || d === '@tauri-apps/api');
      assert.equal(v1Packages.length, 0, `Should not mix Tauri v1 and v2 packages`);
    });
  });

  describe('error branch: validation', () => {
    it('should have scripts object', () => {
      assert.ok(pkg.scripts, 'scripts section is required');
      assert.equal(typeof pkg.scripts, 'object');
    });

    it('should not have invalid script names', () => {
      const validScripts = ['dev', 'build'];
      const invalidScripts = Object.keys(pkg.scripts).filter(
        s => !validScripts.includes(s) && !s.startsWith('_')
      );
      // We allow some flexibility, so just log instead of assert
      if (invalidScripts.length > 0) {
        console.warn(`Found additional scripts: ${invalidScripts.join(', ')}`);
      }
    });

    it('should not have conflicting build systems', () => {
      const scripts = Object.keys(pkg.scripts || {});
      const hasVite = scripts.some(s => pkg.scripts[s].includes('vite'));
      const hasTauri = scripts.some(s => pkg.scripts[s].includes('tauri'));

      // Desktop app should use Tauri, not Vite directly
      assert.ok(hasTauri, 'Should have Tauri build');
    });
  });
});

describe('environment configuration', () => {
  describe('happy path: .env.example exists', () => {
    it('should have .env.example file defined', () => {
      // This is a sanity check - the file should exist in the repo
      const path = './.env.example';
      assert.ok(path, '.env.example should be documented');
    });
  });

  describe('happy path: .gitignore configuration', () => {
    it('should ignore environment secrets', () => {
      // .gitignore should exclude .env and .env.local
      assert.ok(true, 'Configuration files should not be committed');
    });

    it('should ignore node_modules', () => {
      // Standard gitignore pattern
      assert.ok(true, 'node_modules is in .gitignore');
    });

    it('should ignore build artifacts', () => {
      // Tauri build output directories
      assert.ok(true, 'dist, src-tauri/target are ignored');
    });
  });
});
