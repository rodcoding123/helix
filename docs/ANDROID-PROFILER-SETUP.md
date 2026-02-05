# Android Profiler Setup Guide

## Android Studio Profiler

### CPU Profiler

```bash
# 1. Build and run release build
cd helix-runtime/apps/android
./gradlew installRelease

# 2. Open Android Studio
# Run → Profile App (Shift+Ctrl+D)

# 3. Select app: com.helix.openeclaw
```

**Profiling Modes**:

1. **Sample Method Traces** (default)
   - Lower overhead
   - Sample every 1μs
   - Good for finding hot paths

2. **Method Tracing** (high precision)
   - More overhead
   - Every method call recorded
   - Use for specific functions

3. **Frame Profiler**
   - Monitors frame rendering
   - Finds 60 FPS violations
   - Essential for scroll performance

**Workflow**:

```
1. Click "Record" button
2. Interact with app (scroll email, open calendar)
3. Click "Stop" (after 30 seconds)
4. Analyze call stack
5. Click functions to see code
```

### Memory Profiler

```bash
# Enable LeakCanary for automatic detection
# In build.gradle.kts
dependencies {
    debugImplementation("com.squareup.leakcanary:leakcanary-android:2.13")
}
```

**Manual Memory Profiling**:

```
Android Studio → Profiler
1. Select "Memory" tab
2. Watch for:
   - Native heap
   - Java heap
   - Memory-mapped files

3. Trigger Garbage Collection (trash icon)
4. Take heap dump
5. Analyze in HPROF Analyzer
```

### Network Profiler

```bash
# Monitor RPC calls
Android Studio → Profiler → Network

# Inspect:
1. HTTP/HTTPS requests
2. Request/response headers
3. Payload size
4. Duration

# Look for:
- Slow RPC calls (>500ms)
- Large payloads (>1MB)
- Excessive requests for same data
```

---

## Systrace / Perfetto

### Installation

```bash
# Download systrace
python3 -m pip install perfetto

# Or download from Google
curl -o systrace.py https://android.googlesource.com/platform/tools/base/+/master/profiler/systrace/systrace.py
chmod +x systrace.py
```

### Recording Trace

```bash
# Record system-wide trace
python3 systrace.py \
  -a com.helix.openeclaw \
  -b 16000 \
  -t 60 \
  -o trace.html

# View in browser
open trace.html
# Or https://ui.perfetto.dev
```

### Analyzing Trace

**Keyboard Shortcuts**:

- `W` - Zoom in
- `S` - Zoom out
- `A` / `D` - Pan left/right
- `M` - Mark current time
- `1` - Show/hide counters

**What to Look For**:

1. **Main Thread**: Should have clear gaps (idle time)
2. **RenderThread**: Should be <16ms per frame (60 FPS)
3. **Binder**: Communication between processes
4. **cpuset**: CPU affinity (important for performance)

**Common Issues**:

- Continuous main thread activity → UI lag
- Long frames (>16ms) → Jank
- High kernel time → I/O bottleneck

---

## Gradle Profiler

### Build Performance Analysis

```bash
# Profile build times
cd helix-runtime/apps/android
./gradlew assembleRelease --profile --build-cache

# Find report
# build/reports/profile/profile-*.html
open build/reports/profile/profile-*.html
```

**Metrics**:

- Task execution time
- Plugin evaluation time
- Configuration time

---

## Memory Leak Detection

### LeakCanary Workflow

```kotlin
// Automatically detects leaks when app backgrounded
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // LeakCanary monitors from here
        setContentView(R.layout.activity_main)
    }
}
```

**Workflow**:

1. Interact with app
2. Background app (Cmd+Shift+M on emulator)
3. Wait 5 seconds
4. LeakCanary analyzes heap
5. Notification appears with results
6. Click to see leak stack trace

---

## Performance Testing (Automated)

### Create Performance Test

```kotlin
// helix-runtime/apps/android/app/src/androidTest/.../PerformanceTest.kt

@RunWith(AndroidJUnit4::class)
class EmailListPerformanceTest {

    @get:Rule
    val benchmarkRule = BenchmarkRule()

    @Test
    fun measureEmailListScroll() {
        benchmarkRule.measureRepeated {
            val scenario = ActivityScenarioRule(MainActivity::class.java)
            val activity = scenario.scenario.result.resultData as? MainActivity

            // Navigate to email list
            activity?.navigateToEmail()

            // Measure scroll performance
            Thread.sleep(500)  // Wait for load

            val listView = activity?.findViewById<RecyclerView>(R.id.email_list)
            listView?.scrollBy(0, 1000)
        }
    }
}
```

### Run Microbenchmark

```bash
./gradlew connectedBenchmarkAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.helix.PerformanceTest
```

---

## CI/CD Integration

### GitHub Actions Setup

```yaml
name: Android Performance

on:
  schedule:
    - cron: '0 3 * * 0' # Weekly

jobs:
  measure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: android-actions/setup-android@v3

      - name: Build Release APK
        run: |
          cd helix-runtime/apps/android
          ./gradlew assembleRelease

      - name: Run Performance Tests
        run: |
          cd helix-runtime/apps/android
          ./gradlew connectedAndroidTest

      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: android-perf-results
          path: build/reports/
```

---

## Tips & Tricks

### Enable Developer Options

```bash
adb shell settings put global show_touches 1
adb shell setprop persist.sys.profiler_ms 1000
```

### Monitor FPS

```bash
# Real-time FPS counter
adb shell dumpsys gfxinfo com.helix.openeclaw
```

### Check Frame Times

```bash
adb shell dumpsys framestats com.helix.openeclaw reset
# Interact with app
adb shell dumpsys framestats com.helix.openeclaw
```

### Inspect Network Calls

```bash
# Log all network traffic
adb shell setprop log.tag.BAsyncHttpClient DEBUG
adb logcat | grep "BAsyncHttpClient"
```

---

## References

- [Android Performance Best Practices](https://developer.android.com/topic/performance)
- [Perfetto Tracing](https://perfetto.dev/)
- [LeakCanary](https://square.github.io/leakcanary/)
- [Android Studio Profiler](https://developer.android.com/studio/profile)
