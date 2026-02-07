# Channel Monitoring Tests

Comprehensive test suite for Phase E.3 monitoring infrastructure.

## Test Coverage

### Backend Tests (helix-runtime/)

#### 1. **ChannelMetricsCollector** (`src/channels/monitoring/__tests__/collector.test.ts`)

- **Lines:** 400+
- **Tests:** 30+
- **Coverage:**
  - ✅ Message metrics recording (received/sent/failed)
  - ✅ Latency percentile calculations (avg/p95/p99)
  - ✅ Connection event tracking with duration
  - ✅ Error recording with context
  - ✅ Health status determination (healthy/degraded/unhealthy/offline)
  - ✅ Issue aggregation and severity tracking
  - ✅ Metrics retention and cleanup (24h default)
  - ✅ Per-account metrics isolation
  - ✅ Multi-channel independence
  - ✅ Edge cases (zero latency, very high latency, missing account ID)
  - ✅ Performance (1000 messages/records <500ms)

#### 2. **ChannelSimulator** (`src/channels/testing/__tests__/simulator.test.ts`)

- **Lines:** 350+
- **Tests:** 35+
- **Coverage:**
  - ✅ Session lifecycle (start/get/end)
  - ✅ Unique session ID generation
  - ✅ Message simulation and handling
  - ✅ Session summary generation with success rates
  - ✅ Test payload templates (WhatsApp/Telegram/Discord/Slack)
  - ✅ Message type handling (text/media/custom)
  - ✅ Handler registration and invocation
  - ✅ Message ordering and tracking
  - ✅ Edge cases (empty content, long messages, rapid sending)
  - ✅ Future timestamps handling
  - ✅ Performance (100 sessions <1s, 100 messages <5s)

#### 3. **WebhookTester** (`src/channels/testing/__tests__/webhook-tester.test.ts`)

- **Lines:** 450+
- **Tests:** 40+
- **Coverage:**
  - ✅ URL validation (HTTPS/HTTP only, no localhost, no FTP)
  - ✅ Valid URL acceptance (with paths, query params, subdomains)
  - ✅ Webhook endpoint testing with timing
  - ✅ HTTP method support (GET/POST/PUT/DELETE)
  - ✅ Timeout handling (5s default)
  - ✅ Response size limiting (10KB max)
  - ✅ Status code preservation
  - ✅ Payload generation per channel
  - ✅ Batch testing with partial failures
  - ✅ Network error handling
  - ✅ SSL/TLS error handling
  - ✅ Edge cases (empty payload, large payload, special chars, punycode)
  - ✅ Performance (1000 validations <500ms, 100 payloads <100ms)

#### 4. **ChannelConfigManager** (`src/channels/config/__tests__/export.test.ts`)

- **Lines:** 520+
- **Tests:** 50+
- **Coverage:**
  - ✅ Export to JSON and base64 formats
  - ✅ Import from JSON and base64 with validation
  - ✅ Config validation and compatibility checking
  - ✅ Config comparison and diff detection
  - ✅ Checksum calculation for integrity
  - ✅ Merge strategies (replace/merge/skip)
  - ✅ Restore points creation and restoration
  - ✅ Diff summary generation
  - ✅ Complex nested data structures
  - ✅ Circular reference handling
  - ✅ Very large config handling (1000+ keys)
  - ✅ Performance (100 exports <1s, 100 imports <1s, 1000 comparisons <1s)

### Frontend Tests (helix-desktop/)

#### 1. **ChannelMonitoringDashboard** (`src/components/channels/__tests__/ChannelMonitoringDashboard.test.tsx`)

- **Lines:** 250+
- **Tests:** 25+
- **Coverage:**
  - ✅ Dashboard rendering with header and controls
  - ✅ Tab navigation (Metrics/Health/Errors/Simulator/Webhook/Config)
  - ✅ Channel selection and dropdown
  - ✅ Auto-refresh toggle
  - ✅ Refresh button functionality
  - ✅ Quick stats display
  - ✅ Error banner display and dismissal
  - ✅ Data fetching on mount
  - ✅ Refetch on button click
  - ✅ Accessibility (heading structure, form elements, labels)
  - ✅ Responsive design
  - ✅ Prop handling (selectedChannel, onChannelSelect)
  - ✅ Integration of sub-components

#### 2. **MetricsCharts** (`src/components/channels/monitoring/__tests__/MetricsCharts.test.tsx`)

- **Lines:** 280+
- **Tests:** 28+
- **Coverage:**
  - ✅ Empty state rendering
  - ✅ Data rendering with metrics
  - ✅ Chart sections (Message Volume, Latency Trends)
  - ✅ Statistics calculation (totals, success rate)
  - ✅ Legend rendering
  - ✅ Large dataset handling (1000 points <5s)
  - ✅ Edge cases (single data point, zero failures, high latency)
  - ✅ Accessibility features
  - ✅ Visual warning indicators

## Test Execution

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
# Backend
npx vitest run helix-runtime/src/channels/monitoring/__tests__/collector.test.ts

# Frontend
npx vitest run helix-desktop/src/components/channels/__tests__/ChannelMonitoringDashboard.test.tsx
```

### Run with Coverage

```bash
npm test -- --coverage
```

### Watch Mode

```bash
npm test -- --watch
```

## Test Metrics

| Component                  | Test Count | Lines     | Coverage Target |
| -------------------------- | ---------- | --------- | --------------- |
| ChannelMetricsCollector    | 30+        | 400       | 85%+            |
| ChannelSimulator           | 35+        | 350       | 80%+            |
| WebhookTester              | 40+        | 450       | 85%+            |
| ChannelConfigManager       | 50+        | 520       | 90%+            |
| ChannelMonitoringDashboard | 25+        | 250       | 75%+            |
| MetricsCharts              | 28+        | 280       | 80%+            |
| **TOTAL**                  | **208+**   | **2,250** | **80%+**        |

## Test Categories

### Unit Tests

- Individual component functionality
- Pure function behavior
- Edge case handling
- Error handling and recovery

### Integration Tests

- Component interaction
- Data flow between components
- Gateway method integration
- Event handling

### Performance Tests

- Large dataset handling
- Query efficiency
- Render performance
- Memory usage

### Accessibility Tests

- ARIA labels and roles
- Keyboard navigation
- Screen reader compatibility
- Color contrast

## Key Testing Patterns

### Backend (Vitest + Node)

```typescript
describe('ComponentName', () => {
  let instance: ComponentClass;

  beforeEach(() => {
    instance = new ComponentClass(config);
  });

  afterEach(() => {
    instance.cleanup();
  });

  it('should do something', () => {
    const result = instance.method();
    expect(result).toBeDefined();
  });
});
```

### Frontend (Vitest + React Testing Library)

```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render', () => {
    render(<Component />);
    expect(screen.getByText('text')).toBeInTheDocument();
  });

  it('should handle interaction', async () => {
    render(<Component />);
    fireEvent.click(screen.getByText('button'));
    await waitFor(() => {
      expect(screen.getByText('result')).toBeInTheDocument();
    });
  });
});
```

## Coverage Goals

- **Statements:** 85%+
- **Branches:** 80%+
- **Functions:** 90%+
- **Lines:** 85%+

## Continuous Integration

All tests run automatically on:

- Pull request creation
- Push to main branch
- Pre-commit (via husky hook)

Failed tests block PR merge and deployment.

## Future Test Additions

- [ ] Visual regression tests (Playwright screenshots)
- [ ] E2E tests for full dashboard workflows
- [ ] Load testing (concurrent channel monitoring)
- [ ] Security tests (XSS prevention, input sanitization)
- [ ] Accessibility audit (axe-core integration)

## Troubleshooting

### Test Timeouts

- Increase timeout for network-dependent tests
- Mock slow dependencies

### Flaky Tests

- Use deterministic data in setup
- Avoid hard-coded timeouts
- Use waitFor with proper conditions

### Coverage Gaps

```bash
npm test -- --coverage
# Review coverage/index.html for uncovered lines
```

## Contributing

When adding new monitoring features:

1. Write tests first (TDD approach)
2. Implement feature
3. Run full test suite
4. Verify coverage goals met
5. Update this README

## Related Documentation

- [Monitoring Backend Implementation](../README.md)
- [Frontend Components](../../README.md)
- [Gateway Protocol](../../../../gateway/README.md)
