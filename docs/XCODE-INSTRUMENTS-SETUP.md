# Xcode Instruments Setup Guide

## Quick Start

### 1. System Trace Template

**Purpose**: Monitor CPU, threads, memory, I/O over time

```bash
# Launch with system trace
xcodebuild -workspace helix-runtime/apps/ios/OpenClaw.xcworkspace \
  -scheme OpenClaw \
  -destination generic/platform=iOS \
  -configuration Release \
  -allowProvisioningUpdates
```

**Configuration in Instruments**:

1. Xcode → Product → Profile (⌘I)
2. Select "System Trace" template
3. Click "Record" button
4. Interact with app for 60 seconds
5. Stop recording and analyze

**What to Look For**:

- CPU usage spikes (should be <70%)
- Thread activity (smooth vs. stuttering)
- Main thread blocking (causes UI lag)
- Memory growth (should plateau)

### 2. Time Profiler Template

**Purpose**: Identify which functions consume CPU

```swift
// Example slow function
func processLargeEmailList(_ emails: [Email]) {
    // This shows up in Time Profiler
    for email in emails {
        _ = email.subject.uppercased()  // Slow: repeated allocations
    }
}
```

**Better version**:

```swift
func processLargeEmailList(_ emails: [Email]) {
    // Use map with immutable result
    let processed = emails.map { $0.subject.uppercased() }
    return processed
}
```

**How to Use**:

1. Xcode → Product → Profile
2. Select "Time Profiler"
3. Set "Sample Rate" to 1ms (maximum precision)
4. Record 60 seconds of user interactions
5. Analyze call tree for hot spots

### 3. Allocations Template

**Purpose**: Find memory leaks and excessive allocations

```bash
# Check for memory leaks
instruments -t "Allocations" \
  -w "iPhone 16 Pro (17.5)" \
  -D results.xcresult \
  -l 60000 \
  OpenClaw.app
```

**Steps**:

1. Xcode → Product → Profile
2. Select "Allocations"
3. Use Mark Generation button to track memory growth
4. Look for:
   - Growing allocations without corresponding deallocations
   - Large single allocations
   - Fragmentation

**Common Culprits**:

- Unsubscribed Combine publishers
- Retained views in SwiftUI
- Large image caches
- Undisposed resources

### 4. Core Data Inspector

**Purpose**: Analyze Core Data performance

```bash
# Enable Core Data debugging
defaults write com.apple.CoreData DEBUG_CORE_DATA_SQL 1
defaults write com.apple.CoreData DEBUG_CORE_DATA_FORCE_ASYNC 0
```

**Use with Instruments**:

1. System Trace template
2. Look for "SQLite" in the track list
3. Monitor query execution time
4. Check for N+1 query problems

## Profiling Workflow

### Step 1: Establish Baseline

```bash
# Fresh app launch
# Xcode → Product → Profile
# Select appropriate template
# Record 5 minutes
# Export results to csv
```

### Step 2: Identify Bottlenecks

```
Look for:
- Threads: Any blocked/spinning threads
- CPU: Sustained >70% usage
- Memory: Linear growth (leak) vs. flat (OK)
- Calls: Any function called >1000x
```

### Step 3: Optimize

```swift
// Before profiling
let emails = allEmails.filter { $0.isRead == false }
let sorted = emails.sorted { $0.date > $1.date }
let limited = Array(sorted.prefix(50))

// After profiling (pre-computed, indexed)
@FetchRequest(
    entity: Email.entity(),
    sortDescriptors: [NSSortDescriptor(keyPath: \Email.receivedAt, ascending: false)],
    predicate: NSPredicate(format: "isRead == false")
)
var unreadEmails: FetchedResults<Email>
```

### Step 4: Validate

- Re-run profile
- Compare metrics
- Document results

---

## Typical Issues & Solutions

### Issue: Main Thread Blocked

**Symptom**: Jerky scrolling, unresponsive UI
**Solution**:

```swift
// Move work to background
DispatchQueue.global(qos: .userInitiated).async {
    // Heavy work here
    let result = expensiveComputation()

    // Update UI on main thread
    DispatchQueue.main.async {
        self.updateUI(with: result)
    }
}
```

### Issue: Memory Leak

**Symptom**: Memory grows without bounds
**Solution**:

```swift
// Problem: Strong reference cycle
class ViewController {
    var timer: Timer?

    func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.update()  // weak self breaks cycle
        }
    }
}
```

### Issue: Excessive Allocations

**Symptom**: Allocations template shows millions of tiny objects
**Solution**:

```swift
// Problem: Creating objects in tight loop
let images = (0..<1000).map { i in
    UIImage(named: "icon\(i)")  // 1000 allocations
}

// Solution: Reuse image
let icon = UIImage(named: "icon")
let images = Array(repeating: icon, count: 1000)  // 1 allocation
```

---

## Continuous Monitoring

### GitHub Actions Integration

```yaml
name: iOS Performance Check

on: [pull_request]

jobs:
  profile:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - name: Run Performance Tests
        run: |
          xcodebuild test -workspace helix-runtime/apps/ios/OpenClaw.xcworkspace \
            -scheme OpenClaw \
            -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
            -enableCodeCoverage YES
      - name: Upload Profiling Data
        uses: actions/upload-artifact@v4
        with:
          name: performance-report
          path: profile-results/
```

---

## References

- [Xcode Performance Tools](https://developer.apple.com/documentation/xcode/analyzing_app_runtime_performance)
- [WWDC 2023: Profiling Swift Code](https://developer.apple.com/videos/play/wwdc2023/10181/)
