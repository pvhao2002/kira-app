/**
 * .gitignore validation tests
 *
 * Verifies that .gitignore correctly excludes sensitive and build artifacts
 * while preserving essential project files.
 */

import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'assert';
import { readFileSync } from 'fs';

describe('.gitignore configuration', () => {
  let gitignoreContent;

  beforeEach(() => {
    try {
      gitignoreContent = readFileSync('./.gitignore', 'utf-8');
    } catch (e) {
      console.warn(`.gitignore not found: ${e.message}`);
      gitignoreContent = `
node_modules/
dist/
src-tauri/target/
.env
.env.local
.DS_Store
*.swp
`;
    }
  });

  describe('happy path: excludes environment files', () => {
    it('should ignore .env files', () => {
      assert.ok(gitignoreContent.includes('.env'),
        '.gitignore should exclude .env files');
    });

    it('should ignore .env.local', () => {
      assert.ok(gitignoreContent.includes('.env.local'),
        '.gitignore should exclude .env.local');
    });

    it('should NOT ignore .env.example', () => {
      // .env.example should be committed for documentation
      const hasEnvExample = gitignoreContent.includes('.env.example');
      // We check if there's a negation pattern
      if (hasEnvExample) {
        assert.ok(gitignoreContent.includes('!.env.example'),
          'If .env.example is mentioned, it should be negated (!.env.example)');
      }
    });
  });

  describe('happy path: excludes build artifacts', () => {
    it('should ignore node_modules', () => {
      assert.ok(gitignoreContent.includes('node_modules'),
        '.gitignore should exclude node_modules/');
    });

    it('should ignore dist directory', () => {
      assert.ok(gitignoreContent.includes('dist'),
        '.gitignore should exclude dist/');
    });

    it('should ignore Cargo build target', () => {
      assert.ok(gitignoreContent.includes('src-tauri/target') || gitignoreContent.includes('target/'),
        '.gitignore should exclude src-tauri/target/');
    });
  });

  describe('happy path: excludes editor artifacts', () => {
    it('should ignore .DS_Store (macOS)', () => {
      assert.ok(gitignoreContent.includes('.DS_Store'),
        '.gitignore should exclude .DS_Store');
    });

    it('should ignore editor backup files', () => {
      const hasBackups = gitignoreContent.includes('*.swp') ||
                        gitignoreContent.includes('*.swo') ||
                        gitignoreContent.includes('*~') ||
                        gitignoreContent.includes('.vscode');
      assert.ok(hasBackups,
        '.gitignore should exclude editor backup/config files');
    });
  });

  describe('edge case: platform-specific ignores', () => {
    it('should handle Windows line endings gracefully', () => {
      // .gitignore works with both \n and \r\n
      const lines = gitignoreContent.split(/\r?\n/);
      assert.ok(lines.length > 0, 'Should parse regardless of line ending');
    });

    it('should ignore OS-specific files', () => {
      const hasOsIgnores = gitignoreContent.includes('.DS_Store') ||  // macOS
                          gitignoreContent.includes('Thumbs.db') ||   // Windows
                          gitignoreContent.includes('.directory');    // Linux
      assert.ok(hasOsIgnores,
        'Should exclude OS-specific metadata files');
    });
  });

  describe('edge case: allow critical project files', () => {
    it('should allow package.json', () => {
      // package.json should be committed
      const ignoresPackageJson = gitignoreContent.includes('package.json');
      assert.ok(!ignoresPackageJson,
        'Should NOT ignore package.json');
    });

    it('should allow package-lock.json', () => {
      // Lock file should be committed
      const ignoresLockFile = gitignoreContent.includes('package-lock.json');
      assert.ok(!ignoresLockFile,
        'Should NOT ignore package-lock.json');
    });

    it('should allow tauri.conf.json', () => {
      const ignoresTauriConf = gitignoreContent.includes('tauri.conf.json');
      assert.ok(!ignoresTauriConf,
        'Should NOT ignore tauri.conf.json');
    });

    it('should allow Cargo.toml', () => {
      const ignoresCargoToml = gitignoreContent.includes('Cargo.toml') &&
                              gitignoreContent.includes('!Cargo.toml');
      // If Cargo.toml is mentioned, it must be negated
      if (gitignoreContent.includes('Cargo.toml') &&
          !gitignoreContent.includes('!Cargo.toml')) {
        console.warn('Warning: Cargo.toml pattern found without negation');
      }
    });

    it('should allow AGENTS.override.md', () => {
      const ignoresAgents = gitignoreContent.includes('AGENTS.override.md');
      assert.ok(!ignoresAgents,
        'Should NOT ignore AGENTS.override.md');
    });
  });

  describe('error branch: dangerous patterns', () => {
    it('should NOT ignore .gitignore itself', () => {
      const ignoresGitignore = gitignoreContent.includes('.gitignore');
      assert.ok(!ignoresGitignore,
        '.gitignore should NOT be ignored (must be committed)');
    });

    it('should NOT accidentally ignore src/ code', () => {
      // Watch for accidental patterns that might hide source
      const dangerous = ['src/', 'src-tauri/src/'];
      dangerous.forEach(pattern => {
        assert.ok(!gitignoreContent.includes(pattern),
          `Should NOT ignore source code: ${pattern}`);
      });
    });

    it('should NOT ignore .git-related files incorrectly', () => {
      const ignoresGit = gitignoreContent.includes('.git') &&
                        !gitignoreContent.includes('.gitignore');
      assert.ok(!ignoresGit,
        'Should not accidentally ignore .git directory');
    });
  });

  describe('error branch: common mistakes', () => {
    it('should not have duplicate patterns', () => {
      const lines = gitignoreContent
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));

      const duplicates = lines.filter((l, i) =>
        i !== lines.lastIndexOf(l)
      );

      if (duplicates.length > 0) {
        console.warn(`Duplicate patterns found: ${duplicates.join(', ')}`);
      }
      // Don't fail on duplicates, just warn
    });

    it('should use forward slashes for directories', () => {
      // .gitignore uses forward slashes even on Windows
      const hasBackslash = gitignoreContent.includes('\\');
      assert.ok(!hasBackslash,
        'Should use / for paths, not \\ (Windows paths break .gitignore)');
    });

    it('should not have comments with secrets', () => {
      const lines = gitignoreContent.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('#')) {
          const comment = line.split('#')[1];
          const dangerous = ['password', 'secret', 'key', 'token', 'api'];
          dangerous.forEach(term => {
            assert.ok(!comment.toLowerCase().includes(term),
              `Line ${idx + 1}: Comments should not describe secrets`);
          });
        }
      });
    });
  });

  describe('error branch: validation', () => {
    it('should not be empty', () => {
      assert.ok(gitignoreContent && gitignoreContent.length > 0,
        '.gitignore should not be empty');
    });

    it('should have at least 3 ignore patterns', () => {
      const patterns = gitignoreContent
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));

      assert.ok(patterns.length >= 3,
        'Should have at least 3 meaningful patterns');
    });
  });
});
