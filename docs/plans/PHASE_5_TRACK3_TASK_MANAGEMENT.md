# Phase 5 Track 3: Task Management Plan

> **For Claude:** Using superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build foundational task management with Kanban board, dependencies, priority scoring, and time tracking.

**Architecture:** Database-first approach with RLS policies, service layer for task operations, React components for Kanban UI, following Phase 5 Tracks 1-2 pattern.

**Tech Stack:** TypeScript, Supabase PostgreSQL, React, Tailwind CSS, drag-and-drop (dnd-kit)

---

## Task 1: Database Schema Migration

**Files:**

- Create: `web/supabase/migrations/026_task_management.sql`
- Test: Verify tables exist and RLS policies enforce user isolation

**Step 1: Write migration with task management tables**

Create `web/supabase/migrations/026_task_management.sql`:

```sql
-- Phase 5 Track 3: Task Management Infrastructure
-- Supports Kanban boards, task dependencies, time tracking, priority scoring

-- Task Boards (Kanban columns)
CREATE TABLE task_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Board Details
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'blue',

  -- Layout
  column_order TEXT[],            -- ['todo', 'in_progress', 'review', 'done']
  default_column TEXT DEFAULT 'todo',

  -- Settings
  auto_archive_enabled BOOLEAN DEFAULT TRUE,
  archive_after_days INTEGER DEFAULT 30,
  show_estimates BOOLEAN DEFAULT TRUE,
  track_time BOOLEAN DEFAULT TRUE,

  -- Metadata
  is_default BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_boards_user_id ON task_boards(user_id);
ALTER TABLE task_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_boards_user_access ON task_boards FOR ALL USING (auth.uid() = user_id);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,

  -- Task Details
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'archived')),

  -- Priority & Scoring
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  urgency_score NUMERIC(3,2) DEFAULT 0,      -- 0.0 to 1.0
  importance_score NUMERIC(3,2) DEFAULT 0,   -- 0.0 to 1.0
  effort_estimate_minutes INTEGER,

  -- Timing
  due_date TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  time_spent_minutes INTEGER DEFAULT 0,

  -- Dependencies & Relations
  parent_task_id UUID REFERENCES tasks(id),
  blocked_by_task_ids UUID[],
  blocks_task_ids UUID[],
  dependent_count INTEGER DEFAULT 0,

  -- Metadata
  tags TEXT[],
  assignee_id UUID,                          -- Can be team member
  is_archived BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_board_id ON tasks(board_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_urgency ON tasks(urgency_score);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_user_access ON tasks FOR ALL USING (auth.uid() = user_id);

-- Task Dependencies
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Dependency Link
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Type
  dependency_type TEXT DEFAULT 'blocking' CHECK (dependency_type IN ('blocking', 'related', 'duplicate')),

  -- Status
  is_satisfied BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);

ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_dependencies_user_access ON task_dependencies FOR ALL USING (auth.uid() = user_id);

-- Time Tracking
CREATE TABLE task_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Time Entry
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_minutes INTEGER,

  -- Notes
  description TEXT,
  is_billable BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_time_entries_task_id ON task_time_entries(task_id);
CREATE INDEX idx_time_entries_user_id ON task_time_entries(user_id);
CREATE INDEX idx_time_entries_date ON task_time_entries(start_time);

ALTER TABLE task_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY time_entries_user_access ON task_time_entries FOR ALL USING (auth.uid() = user_id);

-- Task Analytics
CREATE TABLE task_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Time Period
  date DATE NOT NULL,
  week TEXT,
  month TEXT,

  -- Statistics
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  in_progress_tasks INTEGER DEFAULT 0,
  overdue_tasks INTEGER DEFAULT 0,
  total_time_logged_minutes INTEGER DEFAULT 0,

  -- Velocity
  avg_completion_time_days NUMERIC(5,2),
  completion_rate NUMERIC(5,2),
  velocity_points INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_analytics_user_date ON task_analytics(user_id, date);
CREATE INDEX idx_task_analytics_month ON task_analytics(user_id, month);

ALTER TABLE task_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_analytics_user_access ON task_analytics FOR ALL USING (auth.uid() = user_id);

-- Task Settings
CREATE TABLE task_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Default Settings
  default_priority TEXT DEFAULT 'medium',
  default_estimate_minutes INTEGER DEFAULT 30,

  -- Notification Settings
  notify_due_soon BOOLEAN DEFAULT TRUE,
  due_soon_threshold_days INTEGER DEFAULT 1,

  -- Time Tracking
  auto_track_time BOOLEAN DEFAULT FALSE,
  billable_by_default BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE task_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_settings_user_access ON task_settings FOR ALL USING (auth.uid() = user_id);
```

**Step 2: Apply migration**

```bash
cd web
npx supabase db push
```

**Step 3: Verify tables exist**

Check all task management tables are created with proper indexes and RLS policies.

---

## Task 2: Task Service with Priority Scoring

**Files:**

- Create: `web/src/services/task-management.ts` (650 lines)
- Test: Basic task CRUD and priority calculations

Similar to email/calendar services with:

- getTasksForBoard()
- createTask()
- updateTask()
- deleteTask()
- calculatePriorityScore()
- checkDependencies()
- getTaskAnalytics()

---

## Task 3: Kanban Board Component

**Files:**

- Create: `web/src/components/tasks/KanbanBoard.tsx` (500 lines)
- Create: `web/src/components/tasks/TaskCard.tsx` (300 lines)

Drag-and-drop board with columns, cards, priority indicators

---

## Task 4: Time Tracking Component

**Files:**

- Create: `web/src/components/tasks/TimeTracker.tsx` (250 lines)

Start/stop timer, log time, billable toggle

---

## Task 5: Task Hub Page

**Files:**

- Create: `web/src/pages/Tasks.tsx` (400 lines)
- Modify: `web/src/App.tsx` - Add /tasks route

---

## Task 6: Integration Tests

**Files:**

- Create: `web/src/services/task-phase5.test.ts` (400+ lines)

---

## Task 7: Documentation

**Files:**

- Create: `web/docs/PHASE_5_TRACK3_COMPLETION_SUMMARY.md` (6000+ words)

---

## Success Criteria

- [ ] Database migration applied with all 6 tables
- [ ] Task service with CRUD, dependencies, priority scoring
- [ ] Kanban board component with drag-and-drop
- [ ] Time tracking integration
- [ ] Task hub page with analytics
- [ ] 50+ integration tests with 90%+ coverage
- [ ] Complete documentation
- [ ] Verified on web application

---
