// Run in browser console or Lighthouse
// Measure Core Web Vitals

const vitals = {
  FCP: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null,
  LCP: null,  // Measured via PerformanceObserver
  CLS: 0,     // Cumulative Layout Shift
  TTFB: performance.timing.responseStart - performance.timing.navigationStart,
};

// Get LCP
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  vitals.LCP = lastEntry.renderTime || lastEntry.loadTime;
});
lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

// Get CLS
const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) {
      vitals.CLS += entry.value;
    }
  }
});
clsObserver.observe({ type: 'layout-shift', buffered: true });

// Wait 5 seconds then log
setTimeout(() => {
  console.table(vitals);

  // Determine pass/fail status
  const metrics = {
    'First Contentful Paint (FCP)': {
      value: vitals.FCP,
      target: 1000,
      unit: 'ms'
    },
    'Largest Contentful Paint (LCP)': {
      value: vitals.LCP,
      target: 1500,
      unit: 'ms'
    },
    'Cumulative Layout Shift (CLS)': {
      value: vitals.CLS,
      target: 0.10,
      unit: 'score'
    },
    'Time to First Byte (TTFB)': {
      value: vitals.TTFB,
      target: 150,
      unit: 'ms'
    }
  };

  console.log('\n=== Core Web Vitals Performance ===\n');
  Object.entries(metrics).forEach(([name, data]) => {
    const status = data.value <= data.target ? '✅ PASS' : '⚠️ WARN';
    console.log(`${status} ${name}: ${data.value?.toFixed(1) || 'N/A'} ${data.unit} (target: ${data.target} ${data.unit})`);
  });
}, 5000);
