/**
 * Unit tests for shared middleware
 * Run with: bun test packages/shared/tests/middleware.test.ts
 */

import { describe, test, expect } from 'bun:test';
import { createLogger, withRequestLog } from '../src/middleware/logger';
import { requireAuth } from '../src/middleware/auth';
import { createRateLimiter } from '../src/middleware/rate-limit';
import { validateJson, requireField, optionalField } from '../src/middleware/validate';
import type { Result } from '../src/types';

describe('Middleware', () => {
  describe('Logger', () => {
    test('should create logger instance', () => {
      const logger = createLogger({ service: 'test', module: 'logger' });
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    test('withRequestLog should wrap handler', () => {
      const handler = async () => new Response('OK');
      const wrapped = withRequestLog(handler, { service: 'test' });
      expect(typeof wrapped).toBe('function');
    });
  });

  describe('Auth', () => {
    test('should return null for valid auth', async () => {
      const env = { INTERNAL_API_KEY: 'test-key' };
      const req = new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer test-key' },
      });
      const result = await requireAuth(req, env);
      expect(result).toBeNull();
    });

    test('should return 401 for missing auth', async () => {
      const env = { INTERNAL_API_KEY: 'test-key' };
      const req = new Request('http://localhost/test');
      const result = await requireAuth(req, env);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    test('should return 401 for invalid auth', async () => {
      const env = { INTERNAL_API_KEY: 'test-key' };
      const req = new Request('http://localhost/test', {
        headers: { Authorization: 'Bearer wrong-key' },
      });
      const result = await requireAuth(req, env);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });
  });

  describe('Validation', () => {
    test('validateJson should parse valid JSON', async () => {
      const req = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      });
      const result = await validateJson(req);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.key).toBe('value');
      }
    });

    test('requireField should return field value', () => {
      const body = { name: 'test', value: 123 };
      const result = requireField<string>(body, 'name');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('test');
      }
    });

    test('requireField should fail for missing field', () => {
      const body = { name: 'test' };
      const result = requireField<string>(body, 'missing');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Missing required field');
      }
    });

    test('optionalField should return value if present', () => {
      const body = { name: 'test', count: 5 };
      const result = optionalField<number>(body, 'count', 0);
      expect(result).toBe(5);
    });

    test('optionalField should return default if missing', () => {
      const body = { name: 'test' };
      const result = optionalField<number>(body, 'count', 10);
      expect(result).toBe(10);
    });
  });
});
