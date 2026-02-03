# Marketplace User Guide

## Overview

The Marketplace is a community space where you can:

- **Discover** templates and tools created by other users
- **Clone** public resources to customize for your needs
- **Publish** your creations to help the community
- **Rate and review** resources you find useful
- **Build on** existing templates to create variations

Think of it like an app store for AI agents and tools—find what you need, use it, improve it, and share it.

## Accessing the Marketplace

1. Click **Marketplace** in the sidebar
2. You'll see three main sections:
   - **Templates** - Agent configuration templates
   - **Tools** - Custom AI tools you can use
   - **Skills** - Multi-step workflows

## Finding Resources

### Browse by Category

**Templates are organized by:**

- Productivity (task management, planning)
- Analytics (data analysis, reporting)
- Communication (writing, translation)
- Creative (content, brainstorming)
- Development (code, documentation)
- Learning (tutoring, research)

**Tools are tagged by:**

- Utility (text, formatting)
- Integration (API, external services)
- Analysis (data, statistics)
- Generation (content, creative)

### Search

Use the search bar to find resources by:

```
Search Query Examples:
- "code reviewer" → Find templates for code review
- "python" → Tools/templates for Python
- "email" → Integration with email
- "documentation" → Help with writing docs
```

**Advanced search:**

- `tag:productivity` - Resources with specific tag
- `type:tool` - Only show tools
- `rating:4+` - Only highly-rated resources
- `updated:week` - Recent updates

### Filter & Sort

**Filters:**

- **Rating** - 1-5 stars
- **Download count** - Popular resources
- **Last updated** - Recent vs established
- **Creator** - Find all resources from one person

**Sort by:**

- **Trending** - Most popular this week
- **New** - Recently published
- **Rating** - Highest rated first
- **Downloads** - Most used
- **Newest** - Most recently updated

## Using Public Resources

### Preview

Before cloning, click **Preview** to see:

**For Templates:**

- System prompt (how the agent behaves)
- Personality settings
- Capabilities (what tools it can use)
- Example conversations
- User reviews

**For Tools:**

- Function description
- Input parameters
- Output format
- Code (read-only)
- Example usage

**For Skills:**

- Workflow steps
- How data flows between steps
- Error handling strategy
- Example execution results

### Clone

When you find a resource you like:

1. Click **Clone**
2. Give it a name:
   - For templates: "My Code Reviewer"
   - For tools: "JSON Validator - Custom"
   - For skills: "Data Pipeline v2"
3. Choose visibility:
   - **Private** (only you) - Good for personal use
   - **Public** (everyone) - Share your improvements
4. Click **Clone**

You now have a personal copy you can modify!

## Customizing Cloned Resources

### Templates

After cloning, you can change:

- System prompt (how it should behave)
- Personality (tone, formality)
- Capabilities (which tools it can use)
- Instructions (specific guidelines)
- Knowledge (background information)

[See Agent Templates guide for customization details]

### Tools

After cloning, you can modify:

- Function code (JavaScript)
- Input parameters
- Capabilities (what it can access)
- Sandbox profile (security level)
- Metadata (name, description, tags)

**Example:**

```javascript
// Original tool
async function execute(params) {
  return { result: params.text.toUpperCase() };
}

// Your modified version
async function execute(params) {
  return {
    result: params.text.toUpperCase(),
    wordCount: params.text.split(' ').length,
  };
}
```

### Skills

After cloning, you can:

- Add or remove steps
- Change tool references
- Modify input mapping
- Adjust error handling
- Add conditional logic

## Publishing Your Resources

### When to Publish

Publish a template/tool/skill when:

- ✓ It solves a real problem
- ✓ You've tested it thoroughly
- ✓ You've written clear descriptions
- ✓ You want to help the community

Don't publish if:

- ✗ It's incomplete or untested
- ✗ It's just copied with no changes
- ✗ It contains sensitive information

### How to Publish

**Step 1: Prepare**

In your resource settings, fill in:

```
Name:           "Content Summarizer"
Description:    "Summarizes long text into key points.
                 Perfect for articles, emails, and docs."
Tags:           summarize, productivity, writing
Category:       Productivity (suggested based on tags)
```

**Step 2: Set Visibility**

Choose: **Public** ✓ (Everyone can see and clone)

**Step 3: Review**

Check:

- Name is clear and searchable
- Description explains what it does
- Tags match content
- Preview looks good

**Step 4: Publish**

Click **Publish to Marketplace**

Your resource is now live! 🎉

### Writing Good Descriptions

**Good description:**

> "Template for analyzing customer feedback. Uses sentiment analysis to categorize comments as positive, negative, or neutral. Perfect for product teams reviewing survey responses. Customizable for different industries."

**Bad description:**

> "Template for feedback"

**Tips:**

- Start with what it does
- Mention who would use it
- Include use cases
- Keep it under 200 words
- Be honest about limitations

## Managing Your Resources

### View Your Publications

1. Go to **Marketplace → My Contributions**
2. See all your published resources
3. Check download counts and ratings

### Update Your Resource

Click **Edit** on any public resource to:

- Update description
- Add tags
- Change category
- Fix issues based on feedback

New version appears with:

- Updated badge
- Changelog link
- Option for users to update

### Manage Ratings & Reviews

Monitor:

- **Total rating** - Average of all reviews
- **Review count** - How many people reviewed it
- **Recent feedback** - Latest user comments

Respond to reviews:

- Helpful feedback → Thank them
- Issues reported → Fix and publish update
- Feature requests → Consider for v2

### Remove Your Resource

If needed, you can:

- **Archive** - Hide from Marketplace (keep for history)
- **Delete** - Permanently remove
- **Deprecate** - Mark as no longer maintained

Note: Already-cloned copies aren't affected.

## Building on Resources

### Clone → Modify → Republish Pattern

1. Find a resource close to what you want
2. Clone it as private
3. Customize for your needs
4. Test thoroughly
5. Publish as a new version/variant
6. Give credit in the description

**Example:**

```
"Email Summarizer - Legal Edition"

Based on: Email Summarizer by @alice

This version is customized for legal emails:
- Extracts action items
- Highlights deadlines
- Identifies parties involved
- Detects urgency indicators

Great for: Law firms, legal departments
```

### Creating Collections

Group related resources:

**Project Planning Collection:**

- Project Planner template
- Task Breakdown skill
- Team Coordinator template
- Progress Tracker tool

Users can find and use your whole collection together!

## Community Guidelines

### Quality Standards

Resources in the Marketplace should be:

**Functional**

- Tested and working
- Clear instructions
- Appropriate error handling

**Useful**

- Solves a real problem
- Well-documented
- Easy to understand

**Safe**

- No malicious code
- Appropriate permissions
- Respects privacy

**Respectful**

- No plagiarism (give credit)
- No offensive content
- Professional tone

### Code of Conduct

When publishing:

- Give credit to resources you built on
- Don't publish identical copies
- Be responsive to bug reports
- Help others improve their versions

When using community resources:

- Respect creator attribution
- Share feedback (positive and constructive)
- Report issues respectfully
- Credit creators if you publish improvements

## Metrics & Analytics

### For Your Resources

Track:

- **Download count** - How many people cloned it
- **Star rating** - Average user rating
- **Comments** - Discussion and feedback
- **Last update** - Freshness indicator

**Example:**

```
📊 Email Summarizer
━━━━━━━━━━━━━━━━
⬇️  2.4k downloads
⭐  4.8 / 5.0 (487 ratings)
💬  132 comments
🔄  Updated 2 days ago
```

### Earning Recognition

Top creators earn:

- **Featured** badge on popular resources
- **Community Star** if consistently helpful
- **Creator** status with special benefits
- Feature in weekly Marketplace highlights

### Feedback Loop

Pay attention to:

- **Ratings** - Does it meet expectations?
- **Comments** - What do users love/hate?
- **Clone count** - Is it actually useful?
- **Update frequency** - When do people need changes?

Use this to improve future versions.

## Troubleshooting

### Resource Won't Clone

**Problem:** Clone button is disabled
**Solution:**

- Make sure you're logged in
- Check that resource is marked public
- Try refreshing the page

### Cloned Resource Missing Features

**Problem:** After cloning, some features don't work
**Solution:**

- Check if you have required capabilities enabled
- Review the original preview to see differences
- Read comments for known issues
- Contact creator if broken

### Can't Find a Resource

**Problem:** I remember a resource but can't find it
**Solution**:

- Try different search terms
- Check filters (rating, date, etc.)
- Sort by "Most downloaded"
- Check creator's profile directly

### Publishing Issues

**Problem:** Can't publish my resource
**Solution:**

- Check all required fields are filled
- Verify resource is tested and working
- Ensure description is clear
- Review community guidelines
- Try again in a moment if it's a server issue

### Low Rating/No Downloads

**Problem:** My published resource isn't popular
**Solution:**

- Update description with better keywords
- Add tags that people search for
- Include example use cases
- Respond to reviews/comments
- Consider improving based on feedback

## Advanced Usage

### Cloning for Teams

Clone a resource and share with teammates:

1. Clone resource as private
2. Customize for team needs
3. Get team feedback
4. Refine together
5. Option: Publish team version

Teammate workflow:

```
Find → Clone → Customize → Use → Provide Feedback → Refine
```

### Version Management

Track your resource versions:

- v1.0 - Initial publication
- v1.1 - Bug fixes, minor improvements
- v2.0 - Major features, redesign

Provide:

- Release notes ("What's new")
- Breaking changes ("What changed")
- Migration path ("How to upgrade")

### Building Ecosystems

Create a set of interconnected resources:

```
Main Template (Code Reviewer)
    ↓
  Tools:
  - Syntax Checker
  - Style Linter
  - Documentation Generator
    ↓
  Skills:
  - Full Code Review Workflow
  - Auto-fix Code Issues
```

Users can compose these together!

## Summary

The Marketplace is your community resource hub. By understanding how to:

✓ Find the right resources
✓ Clone and customize
✓ Publish your creations
✓ Contribute to the community
✓ Build on others' work

You can leverage collective intelligence to:

- Get better tools faster
- Help others solve problems
- Build a personal library
- Contribute valuable resources
- Participate in the community

**Next steps:**

1. Explore the Marketplace
2. Find a resource that helps you
3. Clone and customize it
4. Consider publishing your improvements
5. Help others by sharing knowledge

Happy exploring! 🌟
