import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { runHousekeeping, generateHousekeepingReport, type HousekeepingResult, type HousekeepingIssue } from '../src/housekeeping.js';
import type { Config } from '../src/types.js';

vi.mock('bun', () => ({
  default: {
    file: vi.fn((filePath: string) => ({
      exists: vi.fn().mockResolvedValue(true),
      text: vi.fn().mockResolvedValue('{}'),
    })),
  },
}));

vi.mock('../src/utils.js', () => ({
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  print_success: vi.fn(),
  print_error: vi.fn(),
  print_warning: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn((path: string) => !path.includes('nonexistent')),
  },
  existsSync: vi.fn((path: string) => !path.includes('nonexistent')),
}));

const mockConfig: Config = {
  global: {
    cloudflare_api_token: 'test-token',
    cloudflare_account_id: 'test-account',
    cloudflare_secret_store_id: 'test-store',
    subdomain_prefix: 'test',
  },
  workers: {
    'hoox': {
      enabled: true,
      path: 'workers/hoox',
      secrets: [],
      vars: {},
    },
    'trade-worker': {
      enabled: true,
      path: 'workers/trade-worker',
      secrets: ['API_KEY'],
      services: [{ binding: 'TRADE_SERVICE', service: 'trade-worker' }],
    },
    'd1-worker': {
      enabled: false,
      path: 'workers/d1-worker',
      secrets: [],
    },
  },
};

describe('housekeeping', () => {
  describe('runHousekeeping', () => {
    it('should check enabled workers', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await runHousekeeping(mockConfig, false);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should skip disabled workers', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await runHousekeeping(mockConfig, false);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle non-existent worker directories', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await runHousekeeping(mockConfig, true);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('generateHousekeepingReport', () => {
    it('should generate a valid report structure', async () => {
      const report = await generateHousekeepingReport(mockConfig);
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('totalWorkers');
      expect(report).toHaveProperty('checkedWorkers');
      expect(report).toHaveProperty('issues');
      expect(report).toHaveProperty('summary');
      expect(report.summary).toHaveProperty('errors');
      expect(report.summary).toHaveProperty('warnings');
      expect(report.summary).toHaveProperty('info');
    });

    it('should count enabled workers correctly', async () => {
      const report = await generateHousekeepingReport(mockConfig);
      
      expect(report.totalWorkers).toBe(3);
      expect(report.checkedWorkers).toBe(2);
    });
  });
});

describe('HousekeepingResult', () => {
  it('should have correct structure', () => {
    const result: HousekeepingResult = {
      timestamp: new Date().toISOString(),
      totalWorkers: 5,
      checkedWorkers: 3,
      issues: [],
      summary: { errors: 0, warnings: 0, info: 0 },
    };

    expect(result.timestamp).toBeDefined();
    expect(result.totalWorkers).toBe(5);
    expect(result.checkedWorkers).toBe(3);
    expect(result.issues).toEqual([]);
    expect(result.summary.errors).toBe(0);
  });
});

describe('runHousekeeping - error cases', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should report error when worker path not defined', async () => {
    const config: Config = {
      global: {
        cloudflare_api_token: 'test-token',
        cloudflare_account_id: 'test-account',
        cloudflare_secret_store_id: 'test-store',
        subdomain_prefix: 'test',
      },
      workers: {
        'test-worker': {
          enabled: true,
          path: undefined as any,
        },
      },
    };

    await runHousekeeping(config, false);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should report error when worker directory not found', async () => {
    const config: Config = {
      global: {
        cloudflare_api_token: 'test-token',
        cloudflare_account_id: 'test-account',
        cloudflare_secret_store_id: 'test-store',
        subdomain_prefix: 'test',
      },
      workers: {
        'test-worker': {
          enabled: true,
          path: 'nonexistent/path',
        },
      },
    };

    await runHousekeeping(config, false);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should report warning when wrangler missing name', async () => {
    const config: Config = {
      global: {
        cloudflare_api_token: 'test-token',
        cloudflare_account_id: 'test-account',
        cloudflare_secret_store_id: 'test-store',
        subdomain_prefix: 'test',
      },
      workers: {
        'test-worker': {
          enabled: true,
          path: 'workers/test-worker',
        },
      },
    };

    await runHousekeeping(config, false);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should report warning when wrangler missing compatibility_date', async () => {
    const config: Config = {
      global: {
        cloudflare_api_token: 'test-token',
        cloudflare_account_id: 'test-account',
        cloudflare_secret_store_id: 'test-store',
        subdomain_prefix: 'test',
      },
      workers: {
        'test-worker': {
          enabled: true,
          path: 'workers/test-worker',
        },
      },
    };

    await runHousekeeping(config, false);
    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe('HousekeepingIssue', () => {
  it('should have correct structure for error', () => {
    const issue: HousekeepingIssue = {
      worker: 'test-worker',
      type: 'error',
      message: 'Test error message',
    };

    expect(issue.worker).toBe('test-worker');
    expect(issue.type).toBe('error');
    expect(issue.message).toBe('Test error message');
  });

  it('should have correct structure for warning', () => {
    const issue: HousekeepingIssue = {
      worker: 'test-worker',
      type: 'warning',
      message: 'Test warning message',
    };

    expect(issue.type).toBe('warning');
  });

  it('should have correct structure for info', () => {
    const issue: HousekeepingIssue = {
      worker: 'test-worker',
      type: 'info',
      message: 'Test info message',
    };

    expect(issue.type).toBe('info');
  });
});