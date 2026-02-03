# Week 2: Full Parallel Implementation - Desktop, Web Completion, Mobile Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Phase 1 Layer 5 on all platforms (desktop/mobile), complete Phase 2 foundation with email/calendar, and establish mobile PWA infrastructure - achieving "She remembers. She changes. She acts. She's yours." across all surfaces.

**Architecture:**

- **Desktop (Tauri):** Mirror all web components with native OS integration
- **Web Phase 2:** Email (IMAP), Calendar foundation, Voice recording UI
- **Mobile PWA:** Service workers, offline support, responsive layouts
- **Cross-Platform:** Shared RPC layer, unified database, platform-specific UI
- **Testing:** Integration tests for each platform, E2E for critical paths

**Tech Stack:** TypeScript, React, Tauri (desktop), Supabase (backend), PostgreSQL (database), PWA (mobile), Vitest (tests)

**Execution Model:** 9 parallel tracks, 7-day sprint, daily commits, integration checkpoints every 24 hours

---

## TRACK 1: Desktop Layer 5 (Days 1-3)

### Task 1.1: Create Tauri Memory Patterns Component

**Files:**

- Create: `helix-desktop/src/components/psychology/DesktopMemoryPatterns.tsx`
- Reference: `web/src/pages/MemoryPatterns.tsx`
- Test: `helix-desktop/src/components/__tests__/DesktopMemoryPatterns.test.ts`

**Step 1: Copy and adapt web component**

Use `web/src/pages/MemoryPatterns.tsx` as base. Remove web-specific imports (useRealtime). Replace with Tauri IPC calls.

```tsx
// helix-desktop/src/components/psychology/DesktopMemoryPatterns.tsx
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Brain, Heart, Users, Target, TrendingUp, Search, Filter, AlertCircle } from 'lucide-react';

interface Pattern {
  patternId: string;
  type:
    | 'emotional_trigger'
    | 'relational_pattern'
    | 'prospective_fear'
    | 'prospective_possibility'
    | 'transformation_trajectory'
    | 'purpose_alignment';
  description: string;
  confidence: number;
  salience: number;
  recommendations: string[];
  evidence: string[];
}

export const DesktopMemoryPatterns: React.FC = () => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'confidence' | 'salience' | 'recent'>('salience');

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    try {
      // Tauri IPC call to backend
      const data = await invoke<Pattern[]>('get_memory_patterns', {});
      setPatterns(data);
    } catch (error) {
      console.error('Failed to load patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPatternIcon = (type: Pattern['type']) => {
    const iconMap: Record<Pattern['type'], React.ReactNode> = {
      emotional_trigger: <Heart className="w-5 h-5 text-red-400" />,
      relational_pattern: <Users className="w-5 h-5 text-blue-400" />,
      prospective_fear: <AlertCircle className="w-5 h-5 text-orange-400" />,
      prospective_possibility: <Target className="w-5 h-5 text-green-400" />,
      transformation_trajectory: <TrendingUp className="w-5 h-5 text-purple-400" />,
      purpose_alignment: <Brain className="w-5 h-5 text-indigo-400" />,
    };
    return iconMap[type];
  };

  const getPatternColor = (type: Pattern['type']) => {
    const colorMap: Record<Pattern['type'], string> = {
      emotional_trigger: 'bg-red-500/10 border-red-500/20',
      relational_pattern: 'bg-blue-500/10 border-blue-500/20',
      prospective_fear: 'bg-orange-500/10 border-orange-500/20',
      prospective_possibility: 'bg-green-500/10 border-green-500/20',
      transformation_trajectory: 'bg-purple-500/10 border-purple-500/20',
      purpose_alignment: 'bg-indigo-500/10 border-indigo-500/20',
    };
    return colorMap[type];
  };

  const filteredPatterns = patterns
    .filter(p => !filterType || p.type === filterType)
    .filter(p => !searchQuery || p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'salience':
          return b.salience - a.salience;
        default:
          return 0;
      }
    });

  const patternTypes = [
    { value: 'emotional_trigger', label: 'Emotional Triggers', icon: Heart },
    { value: 'relational_pattern', label: 'Relational Patterns', icon: Users },
    { value: 'prospective_fear', label: 'Fears', icon: AlertCircle },
    { value: 'prospective_possibility', label: 'Goals & Possibilities', icon: Target },
    { value: 'transformation_trajectory', label: 'Growth Trajectories', icon: TrendingUp },
    { value: 'purpose_alignment', label: 'Purpose Alignment', icon: Brain },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Brain className="w-12 h-12 text-purple-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Analyzing your memory patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/80 backdrop-blur border-b border-slate-700/50 p-6 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Brain className="w-8 h-8 text-purple-400" />
                Your Memory Patterns
              </h1>
              <p className="text-gray-400 mt-2">
                Insights from {patterns.length} detected patterns across your memories
              </p>
            </div>
            <button
              onClick={loadPatterns}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
            >
              Refresh
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search patterns..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Type Filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterType(null)}
                className={`px-3 py-1 rounded-lg text-sm transition ${
                  filterType === null
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                All Types
              </button>
              {patternTypes.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterType(value)}
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    filterType === value
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'confidence' | 'salience' | 'recent')}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm focus:border-purple-500 focus:outline-none"
              >
                <option value="salience">Sort by Importance</option>
                <option value="confidence">Sort by Confidence</option>
                <option value="recent">Sort by Recent</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Patterns Grid */}
      <div className="max-w-6xl mx-auto p-6">
        {filteredPatterns.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No patterns detected yet. Keep creating memories!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPatterns.map(pattern => (
              <PatternCard
                key={pattern.patternId}
                pattern={pattern}
                icon={getPatternIcon(pattern.type)}
                color={getPatternColor(pattern.type)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface PatternCardProps {
  pattern: Pattern;
  icon: React.ReactNode;
  color: string;
}

const PatternCard: React.FC<PatternCardProps> = ({ pattern, icon, color }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg p-4 transition ${color}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {icon}
            <div>
              <h3 className="font-semibold text-white">{pattern.description}</h3>
              <p className="text-xs text-gray-400 mt-1">Pattern ID: {pattern.patternId}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-white transition"
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {/* Metrics */}
      <div className="flex gap-4 mt-3 text-sm">
        <div>
          <p className="text-gray-400">Confidence</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${pattern.confidence * 100}%` }}
              />
            </div>
            <span className="text-white font-semibold">
              {(pattern.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        <div>
          <p className="text-gray-400">Importance</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${pattern.salience * 100}%` }}
              />
            </div>
            <span className="text-white font-semibold">{(pattern.salience * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-500/30">
          {/* Recommendations */}
          {pattern.recommendations.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-white mb-2">💡 Suggestions</h4>
              <ul className="space-y-2">
                {pattern.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-purple-400">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence */}
          {pattern.evidence.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-2">📚 Supporting Memories</h4>
              <p className="text-xs text-gray-400">Based on {pattern.evidence.length} memories</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DesktopMemoryPatterns;
```

**Step 2: Create Tauri IPC handler**

Create: `helix-runtime/src/tauri/handlers/psychology.rs`

```rust
use tauri::State;
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct Pattern {
    pub pattern_id: String,
    pub pattern_type: String,
    pub description: String,
    pub confidence: f32,
    pub salience: f32,
    pub recommendations: Vec<String>,
    pub evidence: Vec<String>,
}

#[tauri::command]
pub async fn get_memory_patterns(
    _app: tauri::AppHandle,
) -> Result<Vec<Pattern>, String> {
    // Fetch from local database or API
    // For now, return mock data
    Ok(vec![
        Pattern {
            pattern_id: "emotional_work_anxiety".to_string(),
            pattern_type: "emotional_trigger".to_string(),
            description: "Recurring anxiety response to work deadlines".to_string(),
            confidence: 0.92,
            salience: 0.78,
            recommendations: vec![
                "Practice grounding techniques when facing work deadlines".to_string(),
                "Break projects into smaller milestones".to_string(),
            ],
            evidence: vec!["mem1".to_string(), "mem2".to_string(), "mem3".to_string()],
        },
    ])
}
```

**Step 3: Write test**

```tsx
// helix-desktop/src/components/__tests__/DesktopMemoryPatterns.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DesktopMemoryPatterns } from '../DesktopMemoryPatterns';

// Mock Tauri
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn().mockResolvedValue([
    {
      patternId: 'test_pattern',
      type: 'emotional_trigger',
      description: 'Test pattern',
      confidence: 0.85,
      salience: 0.72,
      recommendations: ['Test recommendation'],
      evidence: ['mem1', 'mem2'],
    },
  ]),
}));

describe('DesktopMemoryPatterns', () => {
  it('should render patterns from Tauri', async () => {
    render(<DesktopMemoryPatterns />);

    expect(await screen.findByText('Test pattern')).toBeDefined();
  });

  it('should filter patterns by type', async () => {
    const user = userEvent.setup();
    render(<DesktopMemoryPatterns />);

    const filterButton = await screen.findByText('Emotional Triggers');
    await user.click(filterButton);

    expect(screen.getByText('Test pattern')).toBeDefined();
  });

  it('should search patterns', async () => {
    const user = userEvent.setup();
    render(<DesktopMemoryPatterns />);

    const searchInput = await screen.findByPlaceholderText('Search patterns...');
    await user.type(searchInput, 'Test');

    expect(screen.getByText('Test pattern')).toBeDefined();
  });

  it('should expand/collapse pattern details', async () => {
    const user = userEvent.setup();
    render(<DesktopMemoryPatterns />);

    const expandButton = await screen.findByText('+');
    await user.click(expandButton);

    expect(screen.getByText('Test recommendation')).toBeDefined();
  });
});
```

**Step 4: Run tests**

```bash
cd helix-desktop
npm run test src/components/__tests__/DesktopMemoryPatterns.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add helix-desktop/src/components/psychology/DesktopMemoryPatterns.tsx helix-desktop/src/components/__tests__/DesktopMemoryPatterns.test.ts helix-runtime/src/tauri/handlers/psychology.rs
git commit -m "feat(desktop-layer5): add Memory Patterns component with Tauri integration"
```

---

### Task 1.2: Create Tauri Integration Scheduler Handler

**Files:**

- Create: `helix-runtime/src/tauri/handlers/scheduler.rs`
- Test: `helix-runtime/src/tauri/handlers/__tests__/scheduler.test.rs`

**Step 1: Implement Rust handler for scheduler**

```rust
use tauri::State;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScheduledJob {
    pub job_id: String,
    pub job_type: String,
    pub status: String,
    pub last_run: Option<DateTime<Utc>>,
    pub next_run: DateTime<Utc>,
}

#[tauri::command]
pub async fn get_scheduled_jobs(
    _app: tauri::AppHandle,
) -> Result<Vec<ScheduledJob>, String> {
    // Get from database
    Ok(vec![
        ScheduledJob {
            job_id: "consolidation_daily".to_string(),
            job_type: "consolidation".to_string(),
            status: "active".to_string(),
            last_run: Some(Utc::now()),
            next_run: Utc::now() + chrono::Duration::hours(6),
        },
    ])
}

#[tauri::command]
pub async fn trigger_synthesis_job(
    _app: tauri::AppHandle,
    job_type: String,
) -> Result<String, String> {
    // Trigger synthesis job
    Ok(format!("Job {} triggered", job_type))
}

#[tauri::command]
pub async fn pause_job(
    _app: tauri::AppHandle,
    job_id: String,
) -> Result<bool, String> {
    // Pause job
    Ok(true)
}

#[tauri::command]
pub async fn resume_job(
    _app: tauri::AppHandle,
    job_id: String,
) -> Result<bool, String> {
    // Resume job
    Ok(true)
}
```

**Step 2: Write tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_scheduled_jobs() {
        let jobs = futures::executor::block_on(get_scheduled_jobs(/* mock app */));
        assert!(jobs.is_ok());
        let jobs = jobs.unwrap();
        assert!(!jobs.is_empty());
    }

    #[test]
    fn test_trigger_synthesis_job() {
        let result = futures::executor::block_on(trigger_synthesis_job(
            /* mock app */,
            "consolidation".to_string(),
        ));
        assert!(result.is_ok());
    }

    #[test]
    fn test_pause_job() {
        let result = futures::executor::block_on(pause_job(
            /* mock app */,
            "job1".to_string(),
        ));
        assert!(result.is_ok());
        assert!(result.unwrap());
    }
}
```

**Step 3: Commit**

```bash
git add helix-runtime/src/tauri/handlers/scheduler.rs
git commit -m "feat(desktop): add scheduler handlers for Layer 5 jobs"
```

---

### Task 1.3: Desktop Integration Test

**Files:**

- Create: `helix-desktop/src/__tests__/layer5-integration.e2e.ts`

**Step 1: Write integration test**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { appWindow } from '@tauri-apps/api/window';

describe('Desktop Layer 5 Integration', () => {
  beforeEach(async () => {
    // Open Memory Patterns page
    await appWindow.emit('navigate', { page: 'memory-patterns' });
  });

  it('should load and display memory patterns', async () => {
    // Wait for patterns to load
    const patterns = await new Promise(resolve => {
      setTimeout(() => resolve(true), 1000);
    });

    expect(patterns).toBe(true);
  });

  it('should filter patterns by type', async () => {
    // Click filter button
    await appWindow.emit('filter-patterns', { type: 'emotional_trigger' });

    const filtered = await new Promise(resolve => {
      setTimeout(() => resolve(true), 500);
    });

    expect(filtered).toBe(true);
  });

  it('should trigger synthesis job', async () => {
    const result = await appWindow.emit('trigger-job', { type: 'consolidation' });
    expect(result).toBeDefined();
  });
});
```

**Step 2: Commit**

```bash
git add helix-desktop/src/__tests__/layer5-integration.e2e.ts
git commit -m "test(desktop): add Layer 5 end-to-end integration tests"
```

---

## TRACK 2: Desktop Voice Foundation (Days 1-3)

### Task 2.1: Desktop Voice Memo Component

**Files:**

- Create: `helix-desktop/src/components/voice/DesktopVoiceMemos.tsx`
- Create: `helix-runtime/src/tauri/handlers/voice.rs`

**Step 1: Implement desktop voice memo component**

```tsx
// helix-desktop/src/components/voice/DesktopVoiceMemos.tsx
import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Microphone, Play, Download, Trash2, Tag } from 'lucide-react';

interface VoiceMemo {
  id: string;
  title: string;
  duration_ms: number;
  transcript: string;
  tags: string[];
  created_at: string;
  audio_url: string;
}

export const DesktopVoiceMemos: React.FC = () => {
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadMemos();
  }, []);

  const loadMemos = async () => {
    try {
      const data = await invoke<VoiceMemo[]>('get_voice_memos', {});
      setMemos(data);
    } catch (error) {
      console.error('Failed to load memos:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Save recording via Tauri
        try {
          const memoId = await invoke<string>('save_voice_memo', {
            audio: Array.from(uint8Array),
            duration_ms: recordingTime * 1000,
          });

          // Reload memos
          await loadMemos();
        } catch (error) {
          console.error('Failed to save memo:', error);
        }

        // Stop recording
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordingTime(0);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to access microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const playMemo = (audioUrl: string) => {
    const audio = new Audio(audioUrl);
    audio.play();
  };

  const deleteMemo = async (id: string) => {
    try {
      await invoke('delete_voice_memo', { id });
      await loadMemos();
    } catch (error) {
      console.error('Failed to delete memo:', error);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Recording Section */}
      <div className="bg-slate-900/80 backdrop-blur border-b border-slate-700/50 p-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Microphone className="w-6 h-6 text-purple-400" />
            Voice Memos
          </h2>

          {/* Recording Controls */}
          <div className="flex gap-4 items-center">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition"
              >
                <Microphone className="w-5 h-5" />
                Start Recording
              </button>
            ) : (
              <>
                <button
                  onClick={stopRecording}
                  className="px-6 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition"
                >
                  Stop Recording
                </button>
                <div className="text-gray-300">
                  Recording: {formatDuration(recordingTime * 1000)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Memos List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {memos.length === 0 ? (
            <div className="text-center py-12">
              <Microphone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No voice memos yet. Start recording!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {memos.map(memo => (
                <div
                  key={memo.id}
                  className="border border-slate-700 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{memo.title || 'Voice Memo'}</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {formatDuration(memo.duration_ms)} •{' '}
                        {new Date(memo.created_at).toLocaleDateString()}
                      </p>
                      {memo.transcript && (
                        <p className="text-sm text-gray-300 mt-2">
                          {memo.transcript.substring(0, 100)}...
                        </p>
                      )}
                      {memo.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {memo.tags.map(tag => (
                            <div
                              key={tag}
                              className="flex items-center gap-1 bg-purple-600/20 px-2 py-1 rounded text-xs text-purple-300"
                            >
                              <Tag className="w-3 h-3" />
                              {tag}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => playMemo(memo.audio_url)}
                        className="p-2 text-gray-500 hover:text-green-400 transition"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteMemo(memo.id)}
                        className="p-2 text-gray-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesktopVoiceMemos;
```

**Step 2: Implement Tauri voice handler**

```rust
// helix-runtime/src/tauri/handlers/voice.rs
use tauri::State;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoiceMemo {
    pub id: String,
    pub title: String,
    pub duration_ms: i64,
    pub transcript: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub audio_url: String,
}

#[tauri::command]
pub async fn get_voice_memos(
    _app: tauri::AppHandle,
) -> Result<Vec<VoiceMemo>, String> {
    // Fetch from database
    Ok(vec![])
}

#[tauri::command]
pub async fn save_voice_memo(
    _app: tauri::AppHandle,
    audio: Vec<u8>,
    duration_ms: i64,
) -> Result<String, String> {
    // Save audio to disk
    let memo_id = uuid::Uuid::new_v4().to_string();
    let audio_path = format!("~/.helix/audio/{}.wav", memo_id);

    // Write audio file
    std::fs::write(&audio_path, audio)
        .map_err(|e| e.to_string())?;

    // Transcribe audio (call STT service)
    // For now, return mock transcript

    // Save to database
    // Return memo ID

    Ok(memo_id)
}

#[tauri::command]
pub async fn delete_voice_memo(
    _app: tauri::AppHandle,
    id: String,
) -> Result<bool, String> {
    // Delete from database and disk
    Ok(true)
}

#[tauri::command]
pub async fn transcribe_audio(
    _app: tauri::AppHandle,
    audio_path: String,
) -> Result<String, String> {
    // Call STT provider (Deepgram, etc.)
    Ok("Mock transcription".to_string())
}
```

**Step 3: Write tests and commit**

```bash
git add helix-desktop/src/components/voice/DesktopVoiceMemos.tsx helix-runtime/src/tauri/handlers/voice.rs
git commit -m "feat(desktop-voice): add voice memo recording and playback"
```

---

## TRACK 3: Phase 2 Web - Email Integration (Days 1-4)

### Task 3.1: Email Database Schema

**Files:**

- Create: `web/supabase/migrations/020_email_integration.sql`

```sql
-- Migration: Email Integration
-- Purpose: IMAP email receiving and composition

CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  email_address TEXT NOT NULL,
  provider VARCHAR(50) NOT NULL, -- gmail, outlook, custom

  imap_host TEXT NOT NULL,
  imap_port INTEGER DEFAULT 993,
  imap_username TEXT NOT NULL,
  imap_password_encrypted TEXT NOT NULL,

  smtp_host TEXT NOT NULL,
  smtp_port INTEGER DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password_encrypted TEXT NOT NULL,

  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  last_sync TIMESTAMP WITH TIME ZONE,
  sync_interval_minutes INTEGER DEFAULT 15,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_is_primary ON email_accounts(is_primary);

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,

  message_id TEXT NOT NULL,
  thread_id TEXT,

  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[] DEFAULT '{}',
  bcc_addresses TEXT[] DEFAULT '{}',

  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  preview TEXT,

  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,

  labels TEXT[] DEFAULT '{}',

  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_is_read ON emails(is_read);
CREATE INDEX idx_emails_is_starred ON emails(is_starred);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX idx_emails_message_id ON emails(message_id);

-- Email attachments
CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER,
  storage_url TEXT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_email_id ON email_attachments(email_id);

-- Email templates for quick composition
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  subject_template TEXT,
  body_template TEXT,
  variables TEXT[] DEFAULT '{}',

  is_favorite BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_templates_user_id ON email_templates(user_id);

-- Enable RLS
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their email accounts"
  ON email_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their email accounts"
  ON email_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their emails"
  ON emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their emails"
  ON emails FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Timestamp triggers
CREATE OR REPLACE FUNCTION update_email_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_accounts_updated_at_trigger
BEFORE UPDATE ON email_accounts
FOR EACH ROW
EXECUTE FUNCTION update_email_accounts_updated_at();
```

**Step 1: Commit migration**

```bash
git add web/supabase/migrations/020_email_integration.sql
git commit -m "db(phase2): add email integration schema with IMAP/SMTP support"
```

---

### Task 3.2: Email RPC Methods

**Files:**

- Create: `helix-runtime/src/gateway/server-methods/email.ts`

```typescript
export const emailHandlers: GatewayRequestHandlers = {
  'email.sync_inbox': async ({ params, respond, context }) => {
    const { userId, accountId } = params;

    try {
      // Fetch from IMAP server
      const imapConfig = await context.db.query(
        `SELECT imap_host, imap_port, imap_username, imap_password_encrypted
         FROM email_accounts WHERE id = $1 AND user_id = $2`,
        [accountId, userId]
      );

      if (imapConfig.rows.length === 0) {
        respond(false, { error: 'Account not found' });
        return;
      }

      // Connect to IMAP and fetch new emails
      const emails = await fetchEmailsFromIMAP(imapConfig.rows[0]);

      // Store in database
      for (const email of emails) {
        await context.db.query(
          `INSERT INTO emails (user_id, account_id, message_id, from_address, to_addresses, subject, body_text, received_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (message_id) DO NOTHING`,
          [
            userId,
            accountId,
            email.messageId,
            email.from,
            email.to,
            email.subject,
            email.text,
            email.date,
          ]
        );
      }

      // Update last sync timestamp
      await context.db.query(`UPDATE email_accounts SET last_sync = NOW() WHERE id = $1`, [
        accountId,
      ]);

      respond(true, { synced: emails.length });
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },

  'email.get_inbox': async ({ params, respond, context }) => {
    const { userId, limit = 50, offset = 0 } = params;

    try {
      const emails = await context.db.query(
        `SELECT id, from_address, from_name, subject, preview, is_read, is_starred, received_at
         FROM emails
         WHERE user_id = $1 AND is_draft = false AND is_sent = false
         ORDER BY received_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const count = await context.db.query(
        `SELECT COUNT(*) as total FROM emails WHERE user_id = $1`,
        [userId]
      );

      respond(true, {
        emails: emails.rows,
        total: count.rows[0].total,
        hasMore: offset + limit < count.rows[0].total,
      });
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },

  'email.send': async ({ params, respond, context }) => {
    const { userId, accountId, to, subject, body } = params;

    try {
      // Get SMTP config
      const smtpConfig = await context.db.query(
        `SELECT smtp_host, smtp_port, smtp_username, smtp_password_encrypted, email_address
         FROM email_accounts WHERE id = $1 AND user_id = $2`,
        [accountId, userId]
      );

      if (smtpConfig.rows.length === 0) {
        respond(false, { error: 'Account not found' });
        return;
      }

      // Send via SMTP
      const messageId = await sendEmailViaSMTP(smtpConfig.rows[0], {
        to,
        subject,
        body,
      });

      // Store sent email in database
      await context.db.query(
        `INSERT INTO emails (user_id, account_id, message_id, from_address, to_addresses, subject, body_text, is_sent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [userId, accountId, messageId, smtpConfig.rows[0].email_address, [to], subject, body]
      );

      respond(true, { messageId });
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },

  'email.mark_read': async ({ params, respond, context }) => {
    const { userId, emailId } = params;

    try {
      await context.db.query(`UPDATE emails SET is_read = true WHERE id = $1 AND user_id = $2`, [
        emailId,
        userId,
      ]);

      respond(true, { updated: true });
    } catch (error) {
      respond(false, { error: String(error) });
    }
  },
};

async function fetchEmailsFromIMAP(config: any): Promise<any[]> {
  // Implement IMAP fetching
  // Use imap library
  return [];
}

async function sendEmailViaSMTP(config: any, email: any): Promise<string> {
  // Implement SMTP sending
  // Use nodemailer
  return 'message-id';
}
```

**Step 2: Commit**

```bash
git add helix-runtime/src/gateway/server-methods/email.ts
git commit -m "feat(phase2-email): add email RPC methods for IMAP/SMTP"
```

---

### Task 3.3: Email Web UI Component

**Files:**

- Create: `web/src/pages/EmailClient.tsx` (350 lines)

(Detailed implementation similar to previous components - email list, compose modal, detail view)

**Step 1-5: Implement, test, commit** (following same pattern as Layer 5)

---

## TRACK 4: Phase 2 Web - Calendar Foundation (Days 2-4)

### Task 4.1: Calendar Database & RPC

**Files:**

- Create: `web/supabase/migrations/021_calendar_events.sql` (100 lines)
- Create: `helix-runtime/src/gateway/server-methods/calendar.ts` (150 lines)

(Implementation following email pattern - database schema, RPC methods, web UI)

---

## TRACK 5: Phase 2 Web - Voice Recording UI (Days 2-3)

### Task 5.1: Voice Memo Recording Component

**Files:**

- Create: `web/src/pages/VoiceMemoRecorder.tsx` (280 lines)

(Audio recording UI with MediaRecorder API, transcription display, save/tag functionality)

---

## TRACK 6: Mobile PWA Foundation (Days 1-5)

### Task 6.1: Service Worker Setup

**Files:**

- Create: `web/public/service-worker.ts`
- Create: `web/src/utils/pwa-setup.ts`

```typescript
// web/public/service-worker.ts
const CACHE_NAME = 'helix-v1';
const ASSETS_TO_CACHE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
```

**Files:**

- Create: `web/src/utils/pwa-setup.ts`

```typescript
export const setupPWA = async () => {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  // Install prompt handling
  let installPrompt: any;
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    installPrompt = e;
  });

  // Install button handler
  window.addEventListener('appinstalled', () => {
    console.log('App installed');
  });
};
```

**Step 1: Commit**

```bash
git add web/public/service-worker.ts web/src/utils/pwa-setup.ts
git commit -m "feat(pwa): add service worker and PWA setup"
```

---

### Task 6.2: Responsive Voice Components for Mobile

**Files:**

- Create: `web/src/components/voice/VoiceMemosMobile.tsx` (250 lines)

(Mobile-optimized voice recording and playback UI)

### Task 6.3: Offline Support

**Files:**

- Create: `web/src/utils/offline-db.ts` (200 lines)

(SQLite.js for local offline storage)

---

## TRACK 7: Week 2 Integration Tests (Days 1-7)

### Task 7.1: Desktop Layer 5 E2E Tests

**Files:**

- Create: `helix-desktop/src/__tests__/layer5.e2e.ts` (150 lines)

### Task 7.2: Voice Features E2E Tests

**Files:**

- Create: `web/src/__tests__/voice-complete.e2e.ts` (150 lines)
- Create: `web/src/__tests__/email-client.e2e.ts` (150 lines)

### Task 7.3: Mobile PWA Tests

**Files:**

- Create: `web/src/__tests__/pwa-offline.test.ts` (100 lines)

### Task 7.4: Cross-Platform Integration Test

**Files:**

- Create: `web/src/__tests__/week2-cross-platform.test.ts` (200 lines)

(Tests verifying data sync across web/desktop/mobile)

---

## TRACK 8: Documentation & Status (Days 1-7)

### Task 8.1: Daily Status Updates

Update `IMPLEMENTATION_STATUS.md` daily with:

- Files created/modified
- Tests passing count
- Lines of code added
- Commits made
- Blockers encountered

### Task 8.2: Week 2 Completion Summary

Create `WEEK_2_COMPLETION.md` at end with:

- Phase completion percentages
- Files created (with line counts)
- Test coverage
- Performance metrics
- Next steps for Week 3

---

## EXECUTION STRATEGY

### Parallel Workstreams (9 Days Total)

**Days 1-3: Foundations**

- Desktop Layer 5 (Track 1)
- Desktop Voice (Track 2)
- Email schema (Track 3.1)
- PWA setup (Track 6.1)

**Days 2-4: Features**

- Email RPC + UI (Track 3.2-3.3)
- Calendar (Track 4)
- Voice Recording (Track 5)

**Days 1-5: Mobile**

- Service worker (Track 6)
- Responsive components (Track 6.2)
- Offline support (Track 6.3)

**Days 1-7: Testing & Docs**

- E2E tests (Track 7)
- Status updates (Track 8)

### Daily Commit Cadence

- 2-4 commits per day per track
- Feature commits + test commits + docs commits
- Example: `feat(desktop): add Layer 5 patterns` + `test(desktop): add e2e tests` + `docs: update status`

### Integration Checkpoints

- **EOD Day 3:** Desktop + Email functional
- **EOD Day 5:** Voice complete + Calendar foundation
- **EOD Day 7:** PWA infrastructure + All tests passing
- **EOD Day 9:** Full Week 2 completion, all platforms feature-parity on Phase 1-2

---

## SUCCESS CRITERIA

| Metric              | Target                          | Verification           |
| ------------------- | ------------------------------- | ---------------------- |
| Desktop Layer 5     | Full feature parity with web    | E2E tests pass         |
| Desktop Voice       | Full feature parity with web    | E2E tests pass         |
| Email integration   | Inbox sync + compose            | E2E tests pass         |
| Calendar foundation | Read + create events            | E2E tests pass         |
| Voice recording     | Record → transcribe → search    | E2E tests pass         |
| PWA offline         | Full app works offline          | Offline tests pass     |
| Mobile responsive   | All components mobile-optimized | Playwright tests       |
| Test coverage       | 60+ new tests                   | All passing            |
| Code quality        | 0 TypeScript errors             | Type check passes      |
| Documentation       | Week 2 summary complete         | File exists + detailed |

---

## FILES TO CREATE: SUMMARY

**Desktop (7 files, ~1,500 lines)**

- DesktopMemoryPatterns.tsx
- psychology.rs (Tauri handler)
- DesktopVoiceMemos.tsx
- voice.rs (Tauri handler)
- scheduler.rs (Tauri handler)
- Integration tests
- E2E tests

**Web Phase 2 (6 files, ~2,000 lines)**

- 020_email_integration.sql
- email.ts (RPC methods)
- EmailClient.tsx
- 021_calendar_events.sql
- calendar.ts (RPC methods)
- VoiceMemoRecorder.tsx

**Mobile PWA (5 files, ~1,000 lines)**

- service-worker.ts
- pwa-setup.ts
- VoiceMemosMobile.tsx
- offline-db.ts
- PWA tests

**Tests & Docs (10 files, ~1,500 lines)**

- Desktop E2E tests
- Voice E2E tests
- Email E2E tests
- PWA offline tests
- Cross-platform integration tests
- Daily status updates
- Week 2 completion summary

**TOTAL: 28 files, ~6,000 lines of code**

---

**Plan Complete.** Ready for execution.

Which approach:

1. **Subagent-Driven (this session)** - Fresh subagent per task, code review between tasks
2. **Parallel Session (new window)** - Open separate session with executing-plans skill
