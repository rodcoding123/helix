import { describe, it, expect, beforeEach } from 'vitest';
import { LogSanitizer } from './log-sanitizer.js';

describe('LogSanitizer', () => {
  let sanitizer: LogSanitizer;

  beforeEach(() => {
    sanitizer = new LogSanitizer();
  });

  describe('Stripe Keys', () => {
    it('redacts sk_live_ keys', () => {
      const secret = 'sk_live_abc123def456ghi789jkl012mno3';
      const result = sanitizer.sanitize(`Secret: ${secret}`);

      expect(result).not.toContain(secret);
      expect(result).not.toContain('sk_live_');
      expect(result).toContain('[REDACTED:');
    });

    it('redacts sk_test_ keys', () => {
      const secret = 'sk_test_xyz789uvw456rst123opq456';
      const result = sanitizer.sanitize(`Key: ${secret}`);

      expect(result).not.toContain(secret);
      expect(result).not.toContain('sk_test_');
    });

    it('redacts pk_live_ keys', () => {
      const secret = 'pk_live_abc123def456ghi789jkl012';
      const result = sanitizer.sanitize(`PK: ${secret}`);

      expect(result).not.toContain(secret);
      expect(result).not.toContain('pk_live_');
    });

    it('redacts pk_test_ keys', () => {
      const secret = 'pk_test_xyz789uvw456rst123opq456';
      const result = sanitizer.sanitize(`PK: ${secret}`);

      expect(result).not.toContain(secret);
      expect(result).not.toContain('pk_test_');
    });

    it('redacts rk_live_ keys', () => {
      const secret = 'rk_live_abc123def456ghi789jkl012';
      const result = sanitizer.sanitize(`RK: ${secret}`);

      expect(result).not.toContain(secret);
    });

    it('redacts rk_test_ keys', () => {
      const secret = 'rk_test_xyz789uvw456rst123opq456';
      const result = sanitizer.sanitize(`RK: ${secret}`);

      expect(result).not.toContain(secret);
    });
  });

  describe('Discord Webhooks', () => {
    it('redacts Discord webhook URLs', () => {
      const webhook = 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop-qrstuvwxyz';
      const result = sanitizer.sanitize(`Webhook: ${webhook}`);

      expect(result).not.toContain(webhook);
      expect(result).not.toContain('discord.com/api/webhooks');
      expect(result).not.toContain('123456789');
      expect(result).toContain('[REDACTED:');
    });

    it('redacts multiple Discord webhooks', () => {
      const webhooks = [
        'https://discord.com/api/webhooks/111/aaa',
        'https://discord.com/api/webhooks/222/bbb',
      ];
      const text = `First: ${webhooks[0]} Second: ${webhooks[1]}`;
      const result = sanitizer.sanitize(text);

      for (const webhook of webhooks) {
        expect(result).not.toContain(webhook);
      }

      const redactCount = (result.match(/\[REDACTED:/g) || []).length;
      expect(redactCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('JWT Tokens', () => {
    it('redacts JWT tokens', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = sanitizer.sanitize(`Token: ${jwt}`);

      expect(result).not.toContain('eyJhbGciOi');
      expect(result).toContain('[REDACTED:');
    });

    it('redacts JWT in error message', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      const error = new Error(`Invalid token: ${jwt}`);
      const result = sanitizer.sanitizeError(error);

      expect(result).not.toContain(jwt);
      expect(result).not.toContain('eyJhbGciOi');
    });
  });

  describe('Bearer Tokens', () => {
    it('redacts Bearer tokens', () => {
      const token = 'Bearer abc123def456ghi789jkl012mno34567890';
      const result = sanitizer.sanitize(`Auth: ${token}`);

      expect(result).not.toContain('Bearer abc123');
      expect(result).not.toContain('abc123def456ghi789jkl012mno34567890');
    });

    it('redacts Authorization Bearer headers', () => {
      const header = 'Authorization: Bearer xyz789uvw456rst123opq456rst789abc';
      const result = sanitizer.sanitize(header);

      expect(result).not.toContain('Bearer xyz789');
      expect(result).not.toContain('xyz789uvw456rst123opq456rst789abc');
    });
  });

  describe('Generic API Keys', () => {
    it('redacts api_key assignments', () => {
      const key = 'abcdef123456ghijkl789mnopqrstuv12';
      const text = `api_key=${key}`;
      const result = sanitizer.sanitize(text);

      expect(result).not.toContain(key);
      expect(result).not.toContain('api_key=');
    });

    it('redacts apikey assignments', () => {
      const key = 'test_key_1234567890abcdefghijk';
      const text = `apikey: ${key}`;
      const result = sanitizer.sanitize(text);

      expect(result).not.toContain(key);
    });
  });

  describe('AWS Credentials', () => {
    it('redacts AWS access keys', () => {
      const accessKey = 'AKIAIOSFODNN7EXAMPLE';
      const result = sanitizer.sanitize(`AWS Key: ${accessKey}`);

      expect(result).not.toContain(accessKey);
      expect(result).not.toContain('AKIA');
    });

    it('redacts AWS secret keys', () => {
      const secretKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      const text = `aws_secret_access_key=${secretKey}`;
      const result = sanitizer.sanitize(text);

      expect(result).not.toContain(secretKey);
    });
  });

  describe('GitHub Tokens', () => {
    it('redacts ghp_ tokens', () => {
      const token = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890';
      const result = sanitizer.sanitize(`Token: ${token}`);

      expect(result).not.toContain(token);
      expect(result).not.toContain('ghp_');
    });

    it('redacts ghs_ tokens', () => {
      const token = 'ghs_abcdefghijklmnopqrstuvwxyz1234567890';
      const result = sanitizer.sanitize(`Token: ${token}`);

      expect(result).not.toContain(token);
    });
  });

  describe('Supabase Credentials', () => {
    it('redacts Supabase URLs', () => {
      const url = 'https://xyz.supabase.co';
      const text = `supabase_url=${url}`;
      const result = sanitizer.sanitize(text);

      expect(result).not.toContain('xyz.supabase.co');
    });

    it('redacts Supabase keys', () => {
      const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      const text = `supabase_key=${key}`;
      const result = sanitizer.sanitize(text);

      expect(result).not.toContain(key);
    });
  });

  describe('DeepSeek API Key', () => {
    it('redacts DeepSeek keys', () => {
      const key = 'sk-abc123def456ghi789jkl012mno34567890';
      const result = sanitizer.sanitize(`Key: ${key}`);

      expect(result).not.toContain('sk-abc123');
      expect(result).not.toContain('abc123def456ghi789jkl012mno34567890');
    });
  });

  describe('Gemini API Key', () => {
    it('redacts Gemini keys', () => {
      const key = 'AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567';
      const result = sanitizer.sanitize(`Key: ${key}`);

      expect(result).not.toContain('AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz');
    });
  });

  describe('SSH Private Keys', () => {
    it('redacts SSH private keys', () => {
      const sshKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3s7k8/7N8+X4lJF9HwzI5bNuVFgJ7...
-----END RSA PRIVATE KEY-----`;
      const result = sanitizer.sanitize(sshKey);

      expect(result).not.toContain('BEGIN RSA PRIVATE KEY');
      expect(result).not.toContain('MIIEpAIBAAKCAQEA');
    });
  });

  describe('Input Type Handling', () => {
    it('sanitizes string input', () => {
      const key = 'sk_live_test123abc456def789';
      const result = sanitizer.sanitize(`Key: ${key}`);

      expect(typeof result).toBe('string');
      expect(result).not.toContain(key);
    });

    it('sanitizes object input', () => {
      const obj = { secret: 'sk_live_test123abc456def789', name: 'test' };
      const result = sanitizer.sanitize(obj);

      expect(typeof result).toBe('string');
      expect(result).not.toContain('sk_live_test123abc456def789');
      expect(result).toContain('name');
    });

    it('sanitizes array input', () => {
      const arr = ['sk_live_test123abc456def789', 'normal_value'];
      const result = sanitizer.sanitize(arr);

      expect(typeof result).toBe('string');
      expect(result).not.toContain('sk_live_test123abc456def789');
      expect(result).toContain('normal_value');
    });

    it('sanitizes Error input', () => {
      const error = new Error('Failed with sk_live_test123abc456def789');
      const result = sanitizer.sanitize(error);

      expect(typeof result).toBe('string');
      expect(result).not.toContain('sk_live_test123abc456def789');
      expect(result).toContain('Failed');
    });

    it('sanitizes null and undefined', () => {
      expect(sanitizer.sanitize(null)).toBe('null');
      expect(sanitizer.sanitize(undefined)).toBe('undefined');
    });

    it('sanitizes number input', () => {
      const result = sanitizer.sanitize(12345);

      expect(typeof result).toBe('string');
      expect(result).toBe('12345');
    });
  });

  describe('Error Sanitization', () => {
    it('sanitizes error message and stack', () => {
      const error = new Error('Failed to load sk_live_test123abc456');
      error.stack =
        'Error: Failed to load sk_live_test123abc456\n    at ...sk_live_secretkey123...';

      const result = sanitizer.sanitizeError(error);

      expect(result).not.toContain('sk_live_test123abc456');
      expect(result).not.toContain('sk_live_secretkey123');
      expect(result).toContain('Error');
      expect(result).toContain('[REDACTED:');
    });

    it('preserves error name in sanitization', () => {
      const error = new TypeError('Invalid sk_live_test123abc456');
      const result = sanitizer.sanitizeError(error);

      expect(result).toContain('TypeError');
      expect(result).not.toContain('sk_live_test123abc456');
    });
  });

  describe('Detection and Counting', () => {
    it('detects secrets in text', () => {
      const text = 'Key: sk_live_test123abc456';
      expect(sanitizer.hasSecrets(text)).toBe(true);
    });

    it('detects absence of secrets', () => {
      const text = 'This is a normal log message with no secrets';
      expect(sanitizer.hasSecrets(text)).toBe(false);
    });

    it('counts multiple secrets', () => {
      const text = 'sk_live_test1abc sk_live_test2def sk_test_test3ghi';
      const count = sanitizer.countSecrets(text);

      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('detects secret categories', () => {
      const text =
        'sk_live_test123abc456 https://discord.com/api/webhooks/123/abc eyJhbGciOiJIUzI1NiI...';
      const detected = sanitizer.detectSecrets(text);

      expect(detected.length).toBeGreaterThan(0);
      const categories = detected.map(d => d.category);
      expect(categories).toContain('stripe_sk_live');
      expect(categories).toContain('discord_webhook');
    });
  });

  describe('Consistent Hashing', () => {
    it('produces same hash for same secret category', () => {
      const text1 = 'sk_live_test123abc456def789';
      const text2 = 'Different context sk_live_test123abc456def789 more text';

      const result1 = sanitizer.sanitize(text1);
      const result2 = sanitizer.sanitize(text2);

      // Both should produce consistent redaction format
      expect(result1).toContain('[REDACTED:STRIPE_SK_LIVE');
      expect(result2).toContain('[REDACTED:STRIPE_SK_LIVE');
    });

    it('produces different hashes for different secret types', () => {
      const stripeText = 'sk_live_test123abc456def789';
      const webhookText = 'https://discord.com/api/webhooks/123/abc';

      const stripeResult = sanitizer.sanitize(stripeText);
      const webhookResult = sanitizer.sanitize(webhookText);

      expect(stripeResult).toContain('STRIPE_SK_LIVE');
      expect(webhookResult).toContain('DISCORD_WEBHOOK');
    });
  });

  describe('Real-World Scenarios', () => {
    it('sanitizes complete credential configuration', () => {
      const configStr = `stripe_key: sk_live_abc123def456ghi789jklmn
discord_webhook: https://discord.com/api/webhooks/123/abc
supabase_url: https://xyz.supabase.co
supabase_key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
api_key: generic_api_key_1234567890abcdefgh`;

      const result = sanitizer.sanitize(configStr);

      expect(result).not.toContain('sk_live_abc123');
      expect(result).not.toContain('discord.com/api/webhooks');
      expect(result).not.toContain('https://xyz.supabase.co');
      expect(result).not.toContain('eyJhbGciOi');
      expect(result).not.toContain('generic_api_key_1234567890');

      // Should still contain recognizable labels
      expect(result).toContain('stripe_key');
      expect(result).toContain('discord_webhook');
    });

    it('sanitizes error stack trace with multiple secrets', () => {
      const error = new Error('Failed to initialize');
      error.stack = `Error: Failed to initialize sk_live_test123abc456
at loadSecrets (index.ts:123:456)
Authorization: Bearer xyz789testtoken12345678
Webhook: https://discord.com/api/webhooks/123/abc`;

      const result = sanitizer.sanitizeError(error);

      expect(result).not.toContain('sk_live_test123abc456');
      expect(result).not.toContain('Bearer xyz789testtoken12345678');
      expect(result).not.toContain('discord.com/api/webhooks');
      expect(result).toContain('Failed to initialize');
      expect(result).toContain('[REDACTED:');
    });

    it('sanitizes API error responses', () => {
      const apiError = {
        status: 401,
        body: {
          error: 'Invalid API key: sk_live_test123abc456def789',
          hint: 'Check your Discord webhook: https://discord.com/api/webhooks/456/def',
        },
      };

      const result = sanitizer.sanitize(apiError);

      expect(result).not.toContain('sk_live_test123abc456def789');
      expect(result).not.toContain('discord.com/api/webhooks');
      expect(result).toContain('[REDACTED:');
    });
  });

  describe('Performance', () => {
    it('sanitizes text in <1ms', () => {
      const text = 'Normal log message without secrets';
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        sanitizer.sanitize(text);
      }

      const elapsed = performance.now() - start;
      const avgPerOperation = elapsed / 1000;

      expect(avgPerOperation).toBeLessThan(1);
    });

    it('sanitizes with secrets in <2ms', () => {
      const text = 'Error: sk_live_test123 https://discord.com/api/webhooks/123/abc';
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        sanitizer.sanitize(text);
      }

      const elapsed = performance.now() - start;
      const avgPerOperation = elapsed / 1000;

      expect(avgPerOperation).toBeLessThan(2);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty strings', () => {
      const result = sanitizer.sanitize('');

      expect(result).toBe('');
    });

    it('handles very long strings', () => {
      const longSecret = 'sk_live_verylongsecretkey123456789abcdef';
      const longText = longSecret + ' '.repeat(10000);
      const result = sanitizer.sanitize(longText);

      expect(result).not.toContain('sk_live_verylongsecretkey');
      expect(result.length).toBeGreaterThan(100);
    });

    it('handles strings with normal secret patterns', () => {
      const text = 'Error: (test) secret: sk_live_test123 {secret}';
      const result = sanitizer.sanitize(text);

      expect(result).not.toContain('sk_live_test123');
      expect(result).toContain('[REDACTED:');
    });

    it('handles multiple instances of same secret', () => {
      const secret = 'sk_live_test123abc456def789';
      const text = `First: ${secret} Second: ${secret} Third: ${secret}`;
      const result = sanitizer.sanitize(text);

      const matches = result.match(/\[REDACTED:/g);
      expect(matches?.length).toBe(3);
    });
  });
});
