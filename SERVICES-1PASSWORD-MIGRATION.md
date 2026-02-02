# Services Migration to 1Password Secrets Management

## Summary

All DeepSeek-based services (EmotionDetectionService and TopicExtractionService) now load their API keys securely from 1Password instead of requiring hardcoded environment variables passed via constructor. This implements production-ready secret management with automatic fallback to .env files for development.

**Completion Date:** Week 1 Day 3 (Phase 1 Backend)

---

## Architecture

### Before: Constructor-Based API Keys

```typescript
// OLD PATTERN (INSECURE FOR PRODUCTION)
const apiKey = process.env.DEEPSEEK_API_KEY;
const service = new EmotionDetectionService(apiKey);
const result = await service.analyzeConversation(messages);
```

**Problems:**
- API keys exposed in constructor calls
- Requires explicit env var management before instantiation
- No automatic fallback mechanism
- Easy to accidentally log API keys in stack traces

### After: Lazy-Loading with 1Password

```typescript
// NEW PATTERN (PRODUCTION-READY)
const service = new EmotionDetectionService();
// API key automatically loaded from 1Password on first use
const result = await service.analyzeConversation(messages);
```

**Benefits:**
- No API keys exposed in code
- Automatic loading from 1Password CLI or .env fallback
- In-memory caching for performance
- Transparent to callers
- Production-ready security

---

## Service Changes

### EmotionDetectionService

**File:** `web/src/services/emotion-detection.ts`

**Changes:**
- Removed constructor parameter `apiKey: string`
- Added private `apiKey: string | null` property
- Added private async method `getApiKey(): Promise<string>` for lazy loading
- Updated `analyzeConversation()` to call `await this.getApiKey()` before API calls

**Implementation:**
```typescript
import { loadSecret } from '@/lib/secrets-loader';

export class EmotionDetectionService {
  private apiKey: string | null = null;

  private async getApiKey(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }
    this.apiKey = await loadSecret('DeepSeek API Key');
    return this.apiKey;
  }

  async analyzeConversation(
    messages: ConversationMessage[]
  ): Promise<EmotionAnalysis> {
    const apiKey = await this.getApiKey();

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      // ... rest of request
    });
  }
}
```

### TopicExtractionService

**File:** `web/src/services/topic-extraction.ts`

**Changes:**
- Removed constructor parameter `apiKey: string`
- Added private `apiKey: string | null` property
- Added private async method `getApiKey(): Promise<string>` for lazy loading
- Updated `extractTopics()` to call `await this.getApiKey()` before API calls

**Implementation:**
```typescript
import { loadSecret } from '@/lib/secrets-loader';

export class TopicExtractionService {
  private apiKey: string | null = null;

  private async getApiKey(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }
    this.apiKey = await loadSecret('DeepSeek API Key');
    return this.apiKey;
  }

  async extractTopics(
    messages: ConversationMessage[]
  ): Promise<ExtractedTopic[]> {
    const apiKey = await this.getApiKey();

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      // ... rest of request
    });
  }
}
```

### EmbeddingService (Already Implemented)

**File:** `web/src/services/embedding.ts`

Already follows this pattern and supports legacy constructor for backward compatibility.

---

## Test Updates

All test files have been updated to remove hardcoded API key parameters:

### Integration Tests
**File:** `web/src/services/__tests__/integration.test.ts`

```typescript
// BEFORE
const apiKey = process.env.DEEPSEEK_API_KEY;
beforeAll(() => {
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');
  emotionService = new EmotionDetectionService(apiKey);
});

// AFTER
beforeAll(() => {
  emotionService = new EmotionDetectionService();
});
```

### E2E Memory Flow Tests
**File:** `web/src/services/__tests__/e2e-memory-flow.test.ts`

```typescript
// BEFORE
emotionService = new EmotionDetectionService(process.env.DEEPSEEK_API_KEY!);
topicService = new TopicExtractionService(process.env.DEEPSEEK_API_KEY!);
embeddingService = new EmbeddingService(process.env.GEMINI_API_KEY!);

// AFTER
emotionService = new EmotionDetectionService();
topicService = new TopicExtractionService();
embeddingService = new EmbeddingService();
```

---

## Secrets Loading Mechanism

The `loadSecret()` function (from `src/lib/secrets-loader.ts`) provides:

### 1. Primary: 1Password CLI
- Requires 1Password CLI installed and authenticated (`op account add`)
- Uses `op item get` to fetch from Helix vault
- **Mapping:** `"DeepSeek API Key"` → `DEEPSEEK_API_KEY`

### 2. Fallback: Environment Variables
- Checked if 1Password unavailable
- Searches `.env.local`, `.env` files
- **Mapping:** `"DeepSeek API Key"` → `DEEPSEEK_API_KEY`

### 3. Caching
- In-memory cache prevents repeated loads
- Cleared only on application restart
- Performance: ~0ms for cached secrets vs ~100-500ms for 1Password

---

## Setup Instructions

### For Development

1. **Option A: Use 1Password CLI (Recommended)**
   ```bash
   # Install 1Password CLI (if not already installed)
   brew install 1password-cli  # macOS
   # or download from https://1password.com/downloads/command-line/

   # Authenticate
   op account add

   # Verify
   op whoami
   ```

2. **Option B: Use .env Fallback**
   ```bash
   # Create .env in project root or web/ directory
   echo "DEEPSEEK_API_KEY=sk-..." >> .env.local
   ```

### For Production

1. Install 1Password CLI in container/deployment environment
2. Authenticate with service account token: `OP_SERVICE_ACCOUNT_TOKEN=...`
3. Services automatically load secrets on first use
4. All 13 secrets available (see src/lib/secrets-loader.ts)

---

## List of Services Updated

### Primary Services
- [x] EmotionDetectionService
- [x] TopicExtractionService

### Already Using Pattern
- [x] EmbeddingService
- [ ] Other services to follow in subsequent phases

---

## Performance Impact

### Latency
- **First call:** +100-500ms (1Password CLI roundtrip)
- **Subsequent calls:** ~0ms (in-memory cache)

### Network
- No network calls (uses local 1Password CLI)
- Cache size: negligible (single API key string)

### Reliability
- Automatic .env fallback if 1Password unavailable
- Error messages provide guidance on setup

---

## Migration Path for Other Services

To migrate additional services to this pattern:

1. **Remove constructor parameter:**
   ```typescript
   // OLD
   constructor(apiKey: string) { this.apiKey = apiKey; }

   // NEW
   constructor() { }
   ```

2. **Add lazy-loading method:**
   ```typescript
   private async getApiKey(): Promise<string> {
     if (this.apiKey) return this.apiKey;
     this.apiKey = await loadSecret('Secret Name');
     return this.apiKey;
   }
   ```

3. **Update all API calls:**
   ```typescript
   const apiKey = await this.getApiKey();
   // Use apiKey in fetch/request headers
   ```

4. **Update tests:**
   - Remove API key parameters from constructors
   - Ensure .env has required secrets for test runs

---

## Verification Checklist

- [x] EmotionDetectionService uses loadSecret()
- [x] TopicExtractionService uses loadSecret()
- [x] Both services cache apiKey for performance
- [x] Constructor calls updated in all tests
- [x] No TypeScript compilation errors
- [x] No circular dependency issues
- [x] EmbeddingService follows same pattern
- [x] Migration guide documented
- [x] All imports correct and resolvable

---

## Running Tests

```bash
# Test with 1Password
op account add  # If not already authenticated
npm run test web/src/services/__tests__/integration.test.ts

# Test with .env fallback
export HELIX_SECRETS_SOURCE=env
npm run test web/src/services/__tests__/integration.test.ts

# Full test suite
npm run test

# Watch mode (dev)
npm run test:watch
```

---

## Troubleshooting

### Error: "1Password CLI not authenticated"
```bash
op account add  # Authenticate with 1Password account
op whoami       # Verify connection
```

### Error: "Secret 'DeepSeek API Key' not found"
1. Verify secret exists in 1Password Helix vault
2. Check .env file has `DEEPSEEK_API_KEY=...` as fallback
3. Ensure .env is in correct location (project root or web/)

### Slow Tests
- First test call: ~500ms (normal, 1Password roundtrip)
- Subsequent calls: <1ms (cached)
- Cache persists for test suite duration

---

## Related Files

- **Secrets Loader:** `src/lib/secrets-loader.ts`
- **Environment Setup:** `.env.example` (provides template)
- **GitHub Actions:** `.github/workflows/*.yml` (uses `OP_SERVICE_ACCOUNT_TOKEN`)

---

## Future Work

Phase 2-3 services to migrate:
- EmbeddingService (already done, optional legacy support removed)
- DatabaseService
- StripeService
- DiscordService (webhooks)
- Any additional API-consuming services

---

## Contact

For questions about 1Password integration:
- See CLAUDE.md for full tech stack overview
- Review src/lib/secrets-loader.ts for implementation details
- Check .env.example for configuration template
