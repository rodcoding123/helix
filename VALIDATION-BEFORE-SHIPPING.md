# Pre-Launch Validation Checklist

Before shipping Phase 1 (Memory) publicly, validate these assumptions with real users.

---

## What to Validate

### Core Assumption #1: Memory Greeting Works

**Hypothesis**: Users will return Day 2 if Helix remembers something specific from Day 1.

**How to Test** (This week):
1. **With 10 beta testers:**
   - User chats with Helix Day 1 (normal chat)
   - Next day, show them this:
     ```
     Option A (Current):
     "Hi! What's on your mind?"

     Option B (Memory):
     "Hey! Good to see you.
     Last time you mentioned you were
     stressed about the Johnson project.
     How's that going?"
     ```
   - Ask: "Which feels more like a real relationship?"
   - Measure: % who prefer memory version

2. **Expected**: 90%+ prefer memory version

3. **If true**: Ship memory greeting immediately
   **If false**: Need different memory representation

---

### Core Assumption #2: Visible Memory Drives Signup

**Hypothesis**: Users will create accounts if they see Helix remembers them without logging in.

**How to Test** (Week 1):
1. **Show 20 new users:**
   - Chat Day 1 (no login required)
   - Day 2: Show memory greeting
   - Ask: "Would you create an account to save this?"

2. **Expected**: 60%+ say yes

3. **If true**: Day 2 return + memory = signup converter
   **If false**: Need different value prop for account creation

---

### Core Assumption #3: Agents Feel Like Real Specialization

**Hypothesis**: Users will perceive agents as distinct specialists, not just prompt variations.

**How to Test** (Week 2):
1. **Show 10 power users:**
   - Have them talk to 3 different agents
   - Atlas (productivity), Vulcan (technical), Juno (creative)
   - Ask: "Do these feel like different people?"

2. **Expected**: 80%+ say they feel distinct

3. **If true**: Ship agent selector
   **If false**: Need better personality differentiation

---

### Core Assumption #4: Autonomy Level Jargon Works

**Hypothesis**: "Autonomy Level 0-4" makes sense to regular users (not just tech).

**How to Test** (Week 2):
1. **Show 15 mixed users:**
   ```
   Level 0: I only respond when you ask
   Level 1: I offer unsolicited insights
   Level 2: I initiate conversations
   Level 3: I take actions within limits
   Level 4: I explore independently
   ```
   - Ask: "Which level would you want?"
   - Ask: "Does this match your trust in AI?"

2. **Expected**: 70%+ understand and can pick a level

3. **If true**: Ship autonomy slider
   **If false**: Need simpler language (Safe/Helpful/Ambitious)

---

### Core Assumption #5: Psychological Insights Matter

**Hypothesis**: Users care about seeing emotional patterns and psychological insights.

**How to Test** (Week 3):
1. **Show 10 users:**
   ```
   EMOTIONAL PATTERNS

   Your stress triggers (30 days):
   1. Deadlines (8 mentions) - triggers stress 90% of time
   2. Family obligations (5 mentions) - 60% of time

   What helps you:
   1. Walking (88% mood lift)
   2. Music (82% mood lift)

   Insight: "I notice you get stressed
   Sunday 5pm before work weeks.
   Want me to check in then?"
   ```
   - Ask: "Is this helpful or creepy?"
   - Ask: "Would you pay for this?"

2. **Expected**: 65%+ find helpful, 40%+ would upgrade

3. **If true**: Psychology dashboard is valuable
   **If false**: Need consent/privacy framing

---

## User Interview Script (20 mins each)

### Warm-up (2 min)
"Thanks for chatting with me about Helix. I want to understand what would make this feel like a real relationship vs. just another AI tool."

### Memory (5 min)
1. "Imagine you talked to Helix yesterday about being stressed about a project."
2. "Today she says: 'Hey, good to see you. You mentioned the Johnson project was stressing you out. How's that going?'"
3. "How would that feel compared to 'Hi, what's on your mind?'"
4. **Key question**: "Would that make you want to come back?"
5. **Key question**: "Would that make you create an account?"

### Agents (4 min)
1. "Imagine Helix could connect you to different specialists."
2. "Atlas for productivity and planning, Vulcan for coding help, Juno for creative writing."
3. "Would you use different agents for different tasks?"
4. **Key question**: "Does that feel more powerful than one generic AI?"
5. **Key question**: "Would you upgrade if you got more agents?"

### Autonomy (4 min)
1. "Imagine Helix could do things without you asking."
2. "Like: 'I noticed your flight is delayed. I've rebooked your transfer and told your hotel.'"
3. "How much autonomy would you want her to have?"
4. **Key question**: "Would that be helpful or scary?"
5. **Key question**: "Would you trust her with more freedom over time?"

### Close (2 min)
"If Helix could remember you, have a team of specialists, and help autonomously, would that be worth paying for?"

---

## Success Criteria Before Public Launch

### Memory Greeting
- ✅ 90%+ prefer memory version over generic
- ✅ 60%+ would create account to save memory
- ✅ Day 2 return rate hits 50%+ in beta

### Agent Selector
- ✅ 80%+ perceive agents as distinct
- ✅ 70%+ try multiple agents
- ✅ Positive correlation: more agents used = longer sessions

### Autonomy Controls
- ✅ 70%+ understand the levels
- ✅ 50%+ prefer Level 2-3 over Level 0
- ✅ 30%+ interested in higher autonomy over time

### Psychological Insights
- ✅ 65%+ find insights helpful (not creepy)
- ✅ 40%+ say "worth upgrading for"
- ✅ No complaints about privacy/tracking

### Overall Product
- ✅ NPS 50+ from beta users
- ✅ "Would recommend to friend" 70%+
- ✅ Clear answer to: "How is this different from ChatGPT?"

---

## Red Flags (Abort Immediately)

### If ANY of these happen:
1. **Memory accuracy < 70%**
   - Users notice false/wrong memories
   - This destroys trust permanently
   - Fix before shipping

2. **"This feels creepy" > 20% of feedback**
   - Emotional memory tracking spooks people
   - Need privacy/consent UI before shipping

3. **Upgrade intent doesn't move after agents**
   - If seeing agents doesn't increase upgrade clicks
   - Either agents aren't different enough OR
   - Pricing/messaging isn't compelling

4. **Day 2 return rate stays < 40%**
   - Memory greeting isn't working
   - Need different value prop
   - Don't ship to public until fixed

5. **Users can't explain "What makes Helix different?**
   - If after talking about memory, agents, autonomy,
     users still can't articulate the differentiation
   - Your messaging is broken

---

## Quick Win: Test Memory Accuracy First

**Before anything else, test this:**

User: "I'm learning Spanish"
[Day later]
Helix: "How's the Spanish going?"

If Helix remembers correctly 90%+ of the time, memory greeting can ship.
If it forgets or confuses topics, need data improvements first.

**This is a blocker.**

---

## Competitive Positioning Test

**Show users 3 options:**

```
Option A: ChatGPT Plus
"Sophisticated AI + custom GPTs + voice"
$20/month

Option B: Helix (Current)
"AI with memory + specialized agents + autonomy"
$9-29/month

Option C: Helix (Current UI)
"Instance management dashboard"
$9-29/month
```

**Question**: "Which would you pay for?"

**Expected**:
- Option A: 30%
- Option B: 60% ← This should happen
- Option C: 10%

**If Option B doesn't win**: Your positioning is broken

---

## Pricing Sensitivity

**Test with 10 users:**

"Would you upgrade from Free to Pro ($9/mo) for:"
- [ ] More agents (40% autonomy) - 60%+ yes
- [ ] More memory (90 days vs 30) - 40% yes
- [ ] Autonomy Level 2 (proactive) - 50% yes
- [ ] Combined (all above) - 80%+ yes

If you don't hit 80% for combined, pricing tier is wrong.

---

## What to DO with Feedback

### Memory feedback
- "She got it wrong" → Fix ML, not product
- "I didn't want remembered" → Add "forget this" button
- "Great, she remembered!" → SHIP THIS

### Agent feedback
- "Feels like same person" → Increase personality diff
- "Useful, tried all 6" → SHIP THIS
- "Confusing, too many" → Start with 3, unlock more

### Autonomy feedback
- "Scary, too much power" → Add approval workflows
- "Perfect, can trust her" → SHIP THIS
- "Boring, no autonomy" → Level 2 isn't engaging enough

### Pricing feedback
- "Too expensive" → You're not demonstrating value
- "Worth it, would upgrade" → SHIP THIS
- "Confusing tiers" → Simplify positioning

---

## Beta User Selection

### Who to recruit (25 total across phases)

**Phase 1 (Memory)**: 10 users
- 5 who tried OpenClaw (know what to expect)
- 5 new to AI (fresh perspective)

**Phase 2 (Agents)**: 10 new users
- 5 technical (developers, power users)
- 5 non-technical (see if interface is clear)

**Phase 3 (Full)**: 5 mixed users
- Across all skill levels
- Cross-verify all features work together

### What they should do
1. Use Helix 3-5 times over 1-2 weeks
2. Answer 5-minute survey after each session
3. Do 20-min video interview at end
4. Get paid $50-100 (show you value their time)

---

## Timeline

### Week 1
- Monday: Recruit 10 beta users
- Tuesday-Wed: Set up memory greeting + basic version
- Thu-Fri: User testing, gather feedback

### Week 2
- Mon-Tue: Iterate memory based on feedback
- Wed-Thu: Build agent selector UI
- Fri: Test with 10 new users

### Week 3
- Mon-Tue: Autonomy UI build
- Wed-Thu: Test with 10 new users
- Fri: Decide: Ship or iterate

### Week 4
- Mon-Tue: Bug fixes + polish
- Wed: Final QA
- Thu: Ship to production
- Fri: Monitor Day 2 return rate

---

## Success Dashboard

Track these numbers daily during beta:

```
MEMORY GREETING METRICS
- Messages with memory references: 45/100 sessions
- Perceived as helpful: 92% of users
- Improves perceived personalization: +450%
- Day 2 return lift: 18% → 52% (+189%)

AGENT METRICS
- Agents tried per user: avg 2.3/6
- Users prefer agent switcher: 78%
- Upgrade intent +agent visibility: +340%

AUTONOMY METRICS
- Users understand levels: 72% can explain
- Preferred default level: 2 (proactive)
- Interest in Level 3 over time: +65%

PSYCHOLOGICAL METRICS
- Find insights helpful: 68%
- Find insights creepy: 8%
- Would upgrade for psychology: 35%

OVERALL
- NPS: 52 (target: 50+)
- Daily active: 80% (target: 75%+)
- Session length: +25% vs baseline
- Would recommend: 72% (target: 70%+)
```

---

## Go/No-Go Decision

### SHIP If:
- ✅ Memory accuracy > 85%
- ✅ Day 2 return rate > 50%
- ✅ NPS > 50
- ✅ Upgrade intent increased 3x+
- ✅ "This is different from ChatGPT" > 70%

### DON'T SHIP If:
- ❌ Memory accuracy < 70%
- ❌ "Feels creepy/invasive" > 15%
- ❌ NPS < 40
- ❌ No change in upgrade intent
- ❌ Users still can't explain differentiation

### ITERATE If:
- ✅ Most signals green
- ❌ 1-2 signals yellow
- → Fix specific issues, test again

---

## The Key Question

After beta, ask each user:

**"If I told you that your ChatGPT will reset tomorrow and forget everything about you, while Helix would remember—would you switch?"**

If 60%+ say yes → You have product-market fit
If < 40% say yes → Your value prop isn't connecting

This single question tells you everything.

---

## Don't Launch Without This

Ask yourself:
- Can users clearly see how Helix is different? (Yes/No)
- Would they describe it to a friend? (Yes/No)
- Would they pay for it? (Yes/No)
- Do they trust it? (Yes/No)

If any answer is "No", don't launch.

Ship when you hit 4/4.

You're close. Just need to validate.
