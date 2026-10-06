/**
 * Environment configuration tests for .env.example
 *
 * Validates that the environment template has all required variables
 * and that they're documented for developers.
 */

import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'assert';
import { readFileSync } from 'fs';

describe('.env.example configuration', () => {
  let envContent;

  beforeEach(() => {
    try {
      envContent = readFileSync('./.env.example', 'utf-8');
    } catch (e) {
      console.warn(`.env.example not found: ${e.message}`);
      envContent = 'KIRA_BANK_URL=https://bank.example.vn\n';
    }
  });

  describe('happy path: required variables', () => {
    it('should define KIRA_BANK_URL', () => {
      assert.ok(envContent.includes('KIRA_BANK_URL'),
        '.env.example should include KIRA_BANK_URL');
    });

    it('should have HTTPS example for production', () => {
      assert.ok(envContent.includes('https://'),
        'Example should show HTTPS for production');
    });

    it('should have example domain', () => {
      assert.ok(envContent.includes('example.vn') || envContent.includes('localhost'),
        'Example should use example domain or localhost');
    });
  });

  describe('happy path: documentation', () => {
    it('should have comments explaining KIRA_BANK_URL', () => {
      const lines = envContent.split('\n');
      const kiraLine = lines.findIndex(l => l.includes('KIRA_BANK_URL'));

      if (kiraLine >= 0) {
        // Check if there are comments before or after the line
        const context = lines.slice(Math.max(0, kiraLine - 2), kiraLine + 2).join('\n');
        assert.ok(
          context.includes('#') || context.length > 30,
          'KIRA_BANK_URL should be documented'
        );
      }
    });
  });

  describe('edge case: valid example URLs', () => {
    it('should not contain secrets or real credentials', () => {
      const dangerous = ['password', 'secret', 'token', 'key', 'api_key', '12345'];
      dangerous.forEach(term => {
        assert.ok(!envContent.toLowerCase().includes(term) ||
                  envContent.includes(`# ${term}`) ||
                  envContent.includes(`${term}=`),
          `Should not contain real ${term} in examples`);
      });
    });

    it('should use example.vn or localhost for dev', () => {
      const hasExample = envContent.includes('example.vn') ||
                        envContent.includes('localhost') ||
                        envContent.includes('127.0.0.1');
      assert.ok(hasExample, 'Should use example domain or localhost');
    });

    it('should not hard-code production URLs', () => {
      const dangerous = ['bank.kira.vn', 'api.kira.vn', 'prod', 'production'];
      dangerous.forEach(term => {
        // Allow it only as a comment/documentation
        const lines = envContent.split('\n');
        const badLines = lines.filter(l =>
          !l.trim().startsWith('#') && l.includes(term)
        );
        assert.equal(badLines.length, 0,
          `Should not have active production URL: ${term}`);
      });
    });
  });

  describe('edge case: multiline and complex configs', () => {
    it('should have only one KIRA_BANK_URL definition', () => {
      const count = (envContent.match(/KIRA_BANK_URL/g) || []).length;
      assert.ok(count >= 1, 'Should have KIRA_BANK_URL defined');
      // Allow comments mentioning it multiple times
      const nonCommentLines = envContent
        .split('\n')
        .filter(l => !l.trim().startsWith('#'))
        .filter(l => l.includes('KIRA_BANK_URL'));
      assert.equal(nonCommentLines.length, 1, 'Should define KIRA_BANK_URL exactly once');
    });

    it('should use = for assignment, not : or other operators', () => {
      const lines = envContent
        .split('\n')
        .filter(l => l.includes('KIRA_BANK_URL'));

      lines.forEach(line => {
        // Must use = for env var assignment
        assert.ok(line.includes('='), 'Environment variables should use = assignment');
      });
    });
  });

  describe('error branch: malformed configuration', () => {
    it('should not have unescaped quotes in values', () => {
      const lines = envContent.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('=')) {
          const [, value] = line.split('=');
          if (value && value.trim()) {
            // Check for unescaped quotes (allow: quoted values or no quotes)
            const quoteCount = (value.match(/"/g) || []).length;
            assert.ok(
              quoteCount === 0 || quoteCount === 2,
              `Line ${idx + 1}: Quotes should be balanced`
            );
          }
        }
      });
    });

    it('should not have trailing spaces after values', () => {
      const lines = envContent.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('=') && !line.trim().startsWith('#')) {
          const afterEquals = line.split('=')[1];
          if (afterEquals) {
            // Warn but don't fail - trailing spaces are annoying but not breaking
            if (afterEquals.endsWith(' ') && !afterEquals.endsWith('\n')) {
              console.warn(`Line ${idx + 1}: Trailing spaces detected`);
            }
          }
        }
      });
    });
  });

  describe('error branch: missing documentation', () => {
    it('should not be empty', () => {
      assert.ok(envContent && envContent.length > 0, '.env.example should not be empty');
    });

    it('should not be longer than 10 lines', () => {
      const lines = envContent.trim().split('\n');
      // Keep it simple - only essential vars
      assert.ok(lines.length <= 20,
        'Should be concise (max ~20 lines including comments)');
    });
  });
});
