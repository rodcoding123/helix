# Quick Reference: Week 1 Execution

**Print this out and pin it on your monitor.**

---

## Day 1 Tasks (9 AM - 5 PM)

### 9:00 AM - Team Standup (15 min)
- Confirm engineers present
- Review day's goals
- Assign tasks

### 9:30 AM - Database Migrations (Engineer 3)
```bash
cd web
supabase migration new conversations_tables
# Copy migration SQL (see WEEK-1-KICKOFF-PLAN.md)
supabase db push
```
**Done when**: Table appears in Supabase dashboard ✅

### 10:30 AM - TypeScript Types (Engineer 1)
```bash
# Create: web/src/lib/types/memory.ts
npm run typecheck  # Should pass
```
**Done when**: `npm run typecheck` passes ✅

### 12:00 PM - Service Skeletons (Engineer 1)
```bash
# Create:
# - web/src/services/emotion-detection.ts
# - web/src/services/embedding.ts
# - web/src/services/topic-extraction.ts
npm run typecheck  # Should pass
```
**Done when**: All three files created, typecheck passes ✅

### 1:00 PM - Memory Repository (Engineer 2)
```bash
# Create: web/src/lib/repositories/memory-repository.ts
npm run typecheck  # Should pass
```
**Done when**: Created, typecheck passes ✅

### 2:00 PM - Environment Verification (Any)
```bash
# Verify APIs work
curl -X POST https://api.deepseek.com/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}]}'

# Should return a response, not an error
```
**Done when**: Both APIs respond ✅

### 3:00 PM - Git Commit (Any)
```bash
git add .
git commit -m "feat(phase1): scaffold memory system database and types

- Add conversations table with pgvector support
- Define TypeScript interfaces
- Create service skeleton"
```
**Done when**: Commit pushed to feature branch ✅

### 4:00 PM - Review & Plan (All)
- Review what we built
- Walk through code together
- Plan Day 2 (Emotion Detection)

### 5:00 PM - Status Update (Any)
- Post in Discord: "Day 1 complete ✅"
- List what's done
- Note any blockers

---

## Day 2-5 Execution Checklist

### Day 2: Emotion Detection Service (Engineer 1)

**Start at**: 9:30 AM (after standup)
**File**: `web/src/services/emotion-detection.ts`

```typescript
// Step 1: Implement analyzeConversation()
async analyzeConversation(messages): Promise<EmotionAnalysis> {
  const response = await this.client.chat.completions.create({
    model: 'deepseek-reasoner',
    // See PHASE-1-MEMORY-IMPLEMENTATION-SPEC.md for full implementation
  });
  return parseResponse(response);
}

// Step 2: Add calculateSalience()
// Step 3: Write tests
// Step 4: Verify with real API call
```

**Done when**:
- [ ] Service fully implements EmotionAnalysis
- [ ] Test passes with real DeepSeek API
- [ ] Emotion confidence > 0.7

### Day 3: Topic Extraction & Embedding (Engineer 1)

**Files**:
- `web/src/services/topic-extraction.ts`
- `web/src/services/embedding.ts`

**Same pattern as emotion detection**

**Done when**:
- [ ] Both services implemented
- [ ] Both pass tests with real APIs
- [ ] Embeddings are 768-dimensional

### Day 4: Memory Repository (Engineer 2)

**File**: `web/src/lib/repositories/memory-repository.ts`

**Implement**:
1. `storeConversation()` - INSERT to Supabase
2. `getRecentMemories()` - Query Supabase
3. `semanticSearch()` - pgvector search
4. `updateWithEmotions()` - Store emotion analysis

**Done when**:
- [ ] All CRUD operations work
- [ ] Tests pass
- [ ] Data persists in Supabase

### Day 5: Integration & Testing (Both)

**Create**:
- React hook: `web/src/hooks/useMemory.ts`
- Integration test: `web/src/hooks/useMemory.test.ts`

**Test flow**:
1. User sends message
2. Detect emotions
3. Extract topics
4. Generate embedding
5. Store to database
6. Retrieve from database

**Done when**:
- [ ] End-to-end test passes
- [ ] Takes < 5 seconds per conversation
- [ ] Zero console errors

---

## Week 2 at a Glance

| Day | Component | Owner | Success Criteria |
|-----|-----------|-------|---|
| 6-7 | Memory Greeting | E2 | Shows on Day 2 return |
| 8 | Memory Dashboard | E2 | Loads in <500ms |
| 9-10 | Integration & Polish | Both | Ready for beta users |

---

## API Reference

### DeepSeek v3.2

**Emotion Detection** (Accurate):
```typescript
model: 'deepseek-reasoner'
temperature: 0.3
max_tokens: 2000
```

**Topic Extraction** (Fast):
```typescript
model: 'deepseek-chat'
temperature: 0.2
max_tokens: 1500
```

**Pricing**: $0.0027 input, $0.0108 output per 1K tokens

### Google Gemini

**Embeddings** (768-dimensional):
```typescript
model: 'embedding-001'
```

**Cost**: $0.0375 per 1M tokens (dirt cheap)

---

## Supabase Quick Commands

```bash
# Push migrations
supabase db push

# View database locally
supabase start

# Access admin UI
# Visit http://localhost:54323

# Reset database
supabase db reset
```

---

## Daily Standup Template

**9:00 AM - Each person answers:**

1. **Yesterday**: What did I complete?
2. **Today**: What am I working on?
3. **Blockers**: Am I stuck on anything?

**If blocked**:
- Post in Discord #development
- Don't wait for next day
- Ask for help immediately

---

## Code Review Checklist

Before merging PR:
- [ ] All tests passing
- [ ] `npm run typecheck` passes
- [ ] No console errors
- [ ] Code reviewed by teammate
- [ ] Commit message describes what+why
- [ ] Performance acceptable (< 5s for most tasks)

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/phase1-emotion-detection

# Commit frequently (every 2 hours)
git add <files>
git commit -m "feat: implement emotion detection with DeepSeek"

# Push to origin
git push origin feature/phase1-emotion-detection

# Create PR when done
# Request review from teammate
```

---

## Success = These 4 Things

1. ✅ **Day 1**: Database + Types + Skeletons → All build
2. ✅ **Days 2-5**: Services implemented → All test pass
3. ✅ **Days 6-10**: UI components built → Memory greeting working
4. ✅ **Week 2 end**: Ready for beta users → Zero bugs

---

## Emergency Contacts

**If stuck**:
1. Check WEEK-1-KICKOFF-PLAN.md for full context
2. Check PHASE-1-MEMORY-IMPLEMENTATION-SPEC.md for code examples
3. Post in Discord
4. I'm available for 15-min pairing sessions

---

## You've Got This! 🚀

**Remember**:
- One day at a time
- Each task has clear success criteria
- Tests confirm things work
- Ask for help early if stuck
- Commit frequently

**Week 1 = Foundation. Week 2 = UI. Week 3+ = Victory lap.**

---

**Print this. Keep it visible. Execute Day 1 tomorrow.**

🚀 **Let's build it.**
