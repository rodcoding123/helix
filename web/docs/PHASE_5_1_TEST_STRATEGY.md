# Phase 5.1: Comprehensive Test Strategy & Implementation Plan

**Status:** Ready for Implementation
**Target:** 61 tests with 92% coverage
**Estimated Time:** 3-4 days of implementation

---

## Test Suite Architecture

### Component Tests (30 tests)

#### 1. TiptapEditor Component (5 tests)

- **Test 1:** Formatting state management (bold, italic, strikethrough)
- **Test 2:** Content persistence (save and restore)
- **Test 3:** Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K for links)
- **Test 4:** Undo/Redo functionality
- **Test 5:** Disabled state and readonly mode

**Implementation Notes:**

- Mock Tiptap editor with @tiptap/react
- Test toolbar button state changes
- Verify content HTML output
- Check focus management

#### 2. AttachmentUploader Component (5 tests)

- **Test 1:** Drag-drop file upload
- **Test 2:** File validation (size, type, duplicates)
- **Test 3:** Progress tracking during upload
- **Test 4:** Removal of individual files
- **Test 5:** Error handling and user feedback

**Implementation Notes:**

- Mock File API
- Test DataTransfer for drag-drop
- Verify size formatting (KB, MB)
- Check error message display

#### 3. TemplateSelector Component (5 tests)

- **Test 1:** Loading templates from database
- **Test 2:** Search filtering functionality
- **Test 3:** Category filtering
- **Test 4:** Template application to draft
- **Test 5:** Error handling and empty states

**Implementation Notes:**

- Mock useEmailComposeService
- Test async loading states
- Verify template merging
- Check search/filter logic

#### 4. EmailComposerPanel Component (10 tests)

- **Test 1:** Complete composition workflow
- **Test 2:** Multi-recipient management (To, CC, BCC)
- **Test 3:** Draft loading and persistence
- **Test 4:** Form validation before sending
- **Test 5:** Template application integration
- **Test 6:** Auto-save via useAutoSaveDraft
- **Test 7:** Scheduled send UI and validation
- **Test 8:** Error handling and display
- **Test 9:** Rich text editor integration
- **Test 10:** Attachment uploader integration

**Implementation Notes:**

- Test complete user flow from start to send
- Mock all dependent services
- Verify validation rules
- Test error boundaries

#### 5. SmartReplyPanel Component (5 tests)

- **Test 1:** Display 3 suggestions with confidence scores
- **Test 2:** Cache hit detection (blue badge)
- **Test 3:** "Use this" button applies to draft
- **Test 4:** "Copy" button puts in clipboard
- **Test 5:** Fallback suggestions on API failure

**Implementation Notes:**

- Mock useEmailSmartReplyService
- Test suggestion rendering
- Verify action button callbacks
- Check loading and error states

#### 6. EmailSearchPanel Component (5 tests)

- **Test 1:** Search input and submission
- **Test 2:** Advanced filters toggle and display
- **Test 3:** Search history dropdown
- **Test 4:** Filter combination logic
- **Test 5:** Search results callback

**Implementation Notes:**

- Mock useEmailSearchService
- Test form submission
- Verify filter state
- Check search history loading

---

### Service Tests (31 tests)

#### 7. email-compose Service (10 tests)

- **Test 1:** Create new draft
- **Test 2:** Save draft (upsert pattern)
- **Test 3:** Get draft by ID
- **Test 4:** List drafts with pagination
- **Test 5:** Delete draft
- **Test 6:** Apply template to draft
- **Test 7:** Insert signature
- **Test 8:** Schedule send with validation
- **Test 9:** Validate draft (email format, required fields)
- **Test 10:** RFC 5321 compliance

**Coverage Target:** 95%

#### 8. email-smart-reply Service (10 tests)

- **Test 1:** Generate suggestions via Claude API
- **Test 2:** Cache storage and retrieval
- **Test 3:** Cache expiration (24h TTL)
- **Test 4:** Fallback suggestions on API error
- **Test 5:** Email hash generation
- **Test 6:** Confidence scoring
- **Test 7:** Token usage tracking
- **Test 8:** JSON response parsing
- **Test 9:** Multiple suggestion styles
- **Test 10:** Character count validation

**Coverage Target:** 95%

#### 9. email-search Service (10 tests)

- **Test 1:** Basic full-text search
- **Test 2:** Filter by sender (from)
- **Test 3:** Filter by date range
- **Test 4:** Filter by attachment presence
- **Test 5:** Filter by read/starred status
- **Test 6:** Pagination (limit/offset)
- **Test 7:** Save search query
- **Test 8:** Get saved searches
- **Test 9:** Delete saved search
- **Test 10:** Search history tracking

**Coverage Target:** 90%

---

### Integration Tests (6 tests)

#### 10. Email Composition Workflow

- **Test 1:** Complete email composition flow (subject → body → send)
- **Test 2:** Template application maintains existing content

#### 11. Smart Reply Integration

- **Test 3:** Smart reply suggestion applied to draft

#### 12. Search & Filtering

- **Test 4:** Complex search with multiple filters
- **Test 5:** Saved search retrieval and application

#### 13. Cross-Domain Integration

- **Test 6:** Email draft can schedule calendar event

---

## Test Data Factory

### Email Template Objects

```typescript
const mockEmailTemplate = {
  id: 'template-1',
  user_id: 'user-123',
  name: 'Professional Response',
  subject: 'Re: Original Subject',
  body_html: '<p>Thank you for your email...</p>',
  category: 'professional',
  usage_count: 5,
  created_at: new Date(),
};

const mockEmailDraft = {
  id: 'draft-1',
  user_id: 'user-123',
  account_id: 'account-123',
  subject: 'Meeting Tomorrow',
  to: ['recipient@example.com'],
  cc: ['cc@example.com'],
  body_html: '<p>Can we meet tomorrow?</p>',
  created_at: new Date(),
};

const mockSmartReplySuggestion = {
  id: 'suggestion-1',
  text: 'Thank you for your email. I will review and get back to you shortly.',
  style: 'professional',
  confidence: 0.95,
  characterCount: 85,
};

const mockSearchResult = {
  id: 'email-1',
  subject: 'Project Update',
  from: 'colleague@example.com',
  preview: 'Here is the latest update on the project...',
  date_received: new Date(),
  is_read: false,
  is_starred: false,
};
```

---

## Mock Strategy

### Supabase Mocking

```typescript
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
    update: vi.fn().mockResolvedValue({ data: {}, error: null }),
    delete: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }),
};
```

### Claude API Mocking

```typescript
const mockClaudeAPI = {
  messages: {
    create: vi.fn().mockResolvedValue({
      content: [{ text: JSON.stringify({ suggestions: [...] }) }],
      usage: { input_tokens: 100, output_tokens: 200 },
    }),
  },
};
```

### Service Mocking

```typescript
const mockEmailComposeService = {
  saveDraft: vi.fn().mockResolvedValue(mockEmailDraft),
  getDraft: vi.fn().mockResolvedValue(mockEmailDraft),
  getTemplates: vi.fn().mockResolvedValue([mockEmailTemplate]),
  applyTemplate: vi.fn().mockResolvedValue(updatedDraft),
};
```

---

## Performance Benchmarks

### Target Metrics

| Operation             | Target | Measurement         |
| --------------------- | ------ | ------------------- |
| Draft save (auto)     | <100ms | Real operation time |
| Template application  | <50ms  | Real operation time |
| Smart reply cache hit | <100ms | Real operation time |
| Search execution      | <500ms | Real operation time |
| Component render      | <200ms | React render time   |

### Profiling

```typescript
describe('Performance', () => {
  it('should save draft in <100ms', async () => {
    const start = performance.now();
    await service.saveDraft(draft);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
```

---

## Coverage Requirements

### Minimum Targets

| Component             | Lines | Branches | Functions |
| --------------------- | ----- | -------- | --------- |
| TiptapEditor          | 85%   | 80%      | 90%       |
| AttachmentUploader    | 90%   | 85%      | 95%       |
| TemplateSelector      | 80%   | 75%      | 85%       |
| EmailComposerPanel    | 85%   | 80%      | 90%       |
| SmartReplyPanel       | 80%   | 75%      | 85%       |
| EmailSearchPanel      | 80%   | 75%      | 85%       |
| email-compose svc     | 95%   | 90%      | 100%      |
| email-smart-reply svc | 95%   | 90%      | 100%      |
| email-search svc      | 90%   | 85%      | 95%       |

### Overall Target: 92% Coverage

---

## Test Execution Strategy

### Phase 1: Unit Tests (1 day)

1. Service unit tests (email-compose, smart-reply, search)
2. Component unit tests (isolated from parents)
3. Validation logic tests

### Phase 2: Integration Tests (1 day)

1. Component integration (EmailComposerPanel with sub-components)
2. Service integration (database interactions)
3. Cross-service workflows

### Phase 3: E2E Tests (1 day)

1. Complete user journeys (compose → send)
2. Multi-step workflows (search → compose → schedule)
3. Error recovery scenarios

### Phase 4: Performance Tests (0.5 days)

1. Benchmark critical paths
2. Memory profiling
3. Load testing

---

## CI/CD Integration

### Pre-Commit Hooks

```bash
npm run test:phase5.1
npm run coverage
npm run typecheck
```

### GitHub Actions Workflow

```yaml
- Run tests
- Generate coverage report
- Report to Codecov
- Block PR if coverage < 92%
```

---

## Testing Best Practices

### 1. Arrange-Act-Assert Pattern

```typescript
it('should apply template to draft', async () => {
  // Arrange
  const draft = createMockDraft();
  const template = createMockTemplate();

  // Act
  const result = await service.applyTemplate(draft.id, template.id);

  // Assert
  expect(result.body_html).toContain(template.body_html);
});
```

### 2. Test Data Builders

```typescript
function createMockDraft(overrides?: Partial<EmailDraft>): EmailDraft {
  return { ...defaultDraft, ...overrides };
}
```

### 3. Descriptive Test Names

```typescript
// Good
it('should apply template content to draft while preserving existing body');

// Bad
it('should apply template');
```

### 4. Error Scenarios

```typescript
it('should handle API failure gracefully', async () => {
  mockSupabase.from().insert.mockRejectedValue(new Error('DB error'));
  await expect(service.saveDraft(draft)).rejects.toThrow();
});
```

---

## Implementation Roadmap

### Day 1: Service Tests

- email-compose: 10 tests
- email-smart-reply: 10 tests
- email-search: 10 tests

### Day 2: Component Tests

- TiptapEditor: 5 tests
- AttachmentUploader: 5 tests
- TemplateSelector: 5 tests
- EmailComposerPanel: 10 tests

### Day 3: Component Tests + Integration

- SmartReplyPanel: 5 tests
- EmailSearchPanel: 5 tests
- Integration tests: 6 tests

### Day 4: Coverage & Performance

- Improve coverage to 92%
- Add performance benchmarks
- Final review and documentation

---

## Success Criteria

✅ **All 61 tests passing**
✅ **92% code coverage achieved**
✅ **All performance targets met (<500ms for major operations)**
✅ **No console errors or warnings**
✅ **All accessibility tests passing**
✅ **Type checking passes (strict mode)**
✅ **Linting passes (ESLint)**
✅ **Formatting passes (Prettier)**

---

## Notes

- Each test should be independent and repeatable
- Mock all external dependencies (Supabase, Claude API, etc.)
- Use factory functions for complex test data
- Maintain test data in separate fixtures file
- Update tests when requirements change
- Document complex test logic with comments
- Use meaningful assertion messages

---

**Next Steps:** Begin test implementation following this strategy and roadmap.
