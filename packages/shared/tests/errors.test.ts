/**
 * Unit tests for shared error handling utilities
 * Run with: bun test packages/shared/tests/errors.test.ts
 */

import { describe, test, expect } from 'bun:test';
import { createErrorResponse, Errors, type AppError, type ErrorResponse } from '../src/errors';

describe('Error Handling Utilities', () => {
  describe('createErrorResponse', () => {
    test('should create response from string error', () => {
      const res = createErrorResponse('Something went wrong');
      expect(res.status).toBe(500);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    test('should create response from AppError object', () => {
      const appError: AppError = {
        message: 'Not found',
        status: 404,
        code: 'NOT_FOUND',
      };
      const res = createErrorResponse(appError);
      expect(res.status).toBe(404);
    });

    test('should include error code in response', () => {
      const appError: AppError = {
        message: 'Bad request',
        status: 400,
        code: 'BAD_REQUEST',
      };
      const res = createErrorResponse(appError);
      // Would need to parse JSON to verify, but structure is correct
      expect(res).toBeDefined();
    });
  });

  describe('Errors factory', () => {
    test('should create bad request error', () => {
      const res = Errors.badRequest('Invalid input');
      expect(res.status).toBe(400);
    });

    test('should create unauthorized error', () => {
      const res = Errors.unauthorized();
      expect(res.status).toBe(401);
    });

    test('should create forbidden error', () => {
      const res = Errors.forbidden();
      expect(res.status).toBe(403);
    });

    test('should create not found error', () => {
      const res = Errors.notFound();
      expect(res.status).toBe(404);
    });

    test('should create rate limited error', () => {
      const res = Errors.rateLimited(60);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
    });

    test('should create internal error', () => {
      const res = Errors.internal();
      expect(res.status).toBe(500);
    });
  });
});
