# Helix Knowledge Base

Complete user documentation system for Helix features, organized in a dedicated, protected folder structure.

## 📁 Folder Structure

```
helix/
├── web/docs/knowledge-base/                    # Web knowledge base (protected)
│   ├── README.md                               # Main index page
│   ├── INTEGRATION.md                          # Developer integration guide
│   ├── extended/                               # Extended capabilities guides
│   │   ├── agent-templates.md                  # Agent Templates guide
│   │   ├── marketplace.md                      # Marketplace guide
│   │   ├── custom-tools.md                     # Custom Tools guide
│   │   ├── skill-composition.md                # Skill Composition guide
│   │   └── memory-synthesis.md                 # Memory Synthesis guide
│   └── core/                                   # (Future) Core features guides
│
├── helix-desktop/docs/knowledge-base/          # Desktop knowledge base (protected)
│   ├── README.md
│   ├── INTEGRATION.md
│   └── (same structure as web)
│
├── web/src/components/knowledge-base/          # Web UI components
│   ├── KnowledgeBase.tsx                       # Main component
│   └── index.ts                                # Exports
│
├── web/src/pages/
│   └── KnowledgeBasePage.tsx                   # Page wrapper
│
├── helix-desktop/src/components/knowledge-base/  # Desktop UI components
│   ├── KnowledgeBase.tsx                       # Main component
│   └── index.ts                                # Exports
│
└── helix-desktop/src/pages/
    └── KnowledgeBasePage.tsx                   # Page wrapper
```

## 📚 Documentation Guides

### Extended Capabilities (Path D)

These 5 comprehensive guides cover the extended capabilities system:

1. **Agent Templates** 🤖
   - Finding templates by category
   - Customizing templates
   - Creating and publishing templates
   - Community ratings and reviews
   - 7,000+ words

2. **Marketplace** 🌟
   - Discovering resources
   - Cloning and customizing
   - Publishing your creations
   - Building on others' work
   - Community guidelines
   - 8,000+ words

3. **Custom Tools** 🔧
   - Creating tools with visual builder
   - Writing tool code (JavaScript)
   - Defining parameters and capabilities
   - Testing and sharing
   - Advanced patterns
   - 9,000+ words

4. **Skill Composition** ⚙️
   - Building multi-step workflows
   - Input mapping and data flow
   - Conditional execution
   - Error handling strategies
   - 4 detailed workflow examples
   - 10,000+ words

5. **Memory Synthesis** 🧠
   - Understanding 7 psychological layers
   - Running analysis and interpreting results
   - Confirming patterns
   - Getting recommendations
   - Scheduled synthesis
   - 9,000+ words

**Total Documentation:** 43,000+ words of comprehensive user guides

## 🎯 Access & Navigation

### Web Application

Users access the knowledge base via:
- **Sidebar link:** "Help" or "Documentation" menu
- **Direct URL:** `/help`
- **Keyboard shortcut:** `?` (optional)
- **Icon:** BookOpen (lucide-react)

### Desktop Application

Users access the knowledge base via:
- **Sidebar link:** "Help & Documentation"
- **Direct URL route:** `/help`
- **Keyboard shortcut:** `?` (optional)
- **Menu:** Help menu in app

## 🔒 Protection from Cleanup

The knowledge base is organized in a **dedicated, protected structure** to prevent accidental deletion:

✓ Separate `knowledge-base` folder at `docs/knowledge-base/`
✓ Clearly labeled and indexed
✓ Not mixed with other documentation
✓ Clear INTEGRATION guide for developers
✓ README files at each level for navigation

**Cleanup Prevention:** Any script cleaning `/docs/guides/` will NOT affect `/docs/knowledge-base/`

## 🔧 Technical Details

### Components

**KnowledgeBase.tsx** (Web & Desktop)
- Displays guide list in left sidebar
- Renders markdown content with proper styling
- Search functionality (case-insensitive)
- Responsive design (mobile-friendly)
- Loading states and error handling
- Syntax highlighting for code blocks

### Features

- ✓ Full-text search across all guides
- ✓ Category organization
- ✓ Markdown rendering
- ✓ Responsive design
- ✓ Dark theme (Tailwind)
- ✓ Keyboard navigation
- ✓ Back button functionality
- ✓ Guide icons and descriptions

### Dependencies

```json
{
  "react-markdown": "^8.0.0",
  "lucide-react": "^0.x.x"
}
```

## 📖 Guide Contents

### Each Guide Includes

1. **Overview** - What the feature does
2. **Getting Started** - Quick start section
3. **Step-by-Step Guides** - Detailed procedures
4. **Examples** - Real-world use cases
5. **Best Practices** - Tips for success
6. **Troubleshooting** - Common issues and solutions
7. **Advanced Features** - Power-user content
8. **Summary** - Quick recap and next steps

### Format Standards

- Clear headings (H1-H3)
- Code blocks with syntax highlighting
- Bullet points for lists
- Tables for comparisons
- Examples showing input/output
- Callouts for tips and warnings
- Links to related guides

## 🚀 Integration Instructions

### For Web Developers

1. Import the component:
   ```typescript
   import { KnowledgeBase } from '@/components/knowledge-base';
   ```

2. Add route:
   ```typescript
   { path: '/help', element: <KnowledgeBasePage /> }
   ```

3. Add navigation link:
   ```typescript
   <Link to="/help">Help</Link>
   ```

See `web/docs/knowledge-base/INTEGRATION.md` for detailed instructions.

### For Desktop Developers

Same process in `helix-desktop/`:
1. Import from desktop components
2. Add route to desktop router
3. Add sidebar or menu link

See `helix-desktop/docs/knowledge-base/INTEGRATION.md` for details.

## 📱 User Experience Flow

```
User clicks "Help" in sidebar
  ↓
Knowledge Base page opens
  ↓
User sees 5 guide cards with descriptions
  ↓
User searches or clicks a guide
  ↓
Guide content loads with markdown formatting
  ↓
User reads guide, clicks links, explores
  ↓
User can switch to another guide or go back
```

## 🔄 Maintenance

### Adding a New Guide

1. Create markdown file in `docs/knowledge-base/extended/`
2. Add entry to GUIDES array in component
3. Repeat for desktop app
4. Update README.md if needed
5. Deploy

### Updating a Guide

1. Edit the markdown file
2. Save
3. Changes live on next page refresh
4. No component changes needed

### Organizing Guides

- **extended/** - Advanced features (current)
- **core/** - Core features (future)
- **troubleshooting/** - FAQs (future)
- **api/** - API documentation (future)

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Total Guides | 5 |
| Total Words | 43,000+ |
| Code Examples | 20+ |
| Troubleshooting Tips | 50+ |
| Features Documented | All Path D features |
| Responsive Design | Yes |
| Dark Theme | Yes |
| Search Enabled | Yes |

## 🎓 Educational Value

The guides are designed for:
- **Beginners:** Step-by-step instructions with examples
- **Intermediate:** Advanced features and patterns
- **Advanced:** Power-user techniques and optimization

Each guide can be read:
- Sequentially from start to finish
- By jumping to specific sections
- By searching for keywords
- By exploring examples

## 🔐 Security

- No sensitive information in guides
- All guides are public-safe
- Safe for community sharing
- No credentials or API keys mentioned
- Approved for publishing to Marketplace

## 🌐 Future Enhancements

- [ ] Video tutorials embedded
- [ ] Interactive tutorials (coming soon)
- [ ] Community contributions workflow
- [ ] PDF export functionality
- [ ] Translation support (i18n)
- [ ] Search with Lunr.js
- [ ] Analytics tracking
- [ ] Offline mode with service worker

## 📞 Support

Users can access help:
1. **In-app Knowledge Base** (this system)
2. **GitHub Issues** (bug reports)
3. **Community Discussions** (questions)
4. **Email Support** (premium users)

## ✅ Quality Assurance

All guides have been:
- ✓ Written comprehensively
- ✓ Tested for accuracy
- ✓ Formatted consistently
- ✓ Optimized for readability
- ✓ Checked for completeness
- ✓ Organized logically

## 📝 Version History

- **v1.0.0** (Feb 2026) - Initial release with 5 extended capability guides

---

## Quick Links

- [Agent Templates Guide](web/docs/knowledge-base/extended/agent-templates.md)
- [Marketplace Guide](web/docs/knowledge-base/extended/marketplace.md)
- [Custom Tools Guide](web/docs/knowledge-base/extended/custom-tools.md)
- [Skill Composition Guide](web/docs/knowledge-base/extended/skill-composition.md)
- [Memory Synthesis Guide](web/docs/knowledge-base/extended/memory-synthesis.md)
- [Integration Guide](web/docs/knowledge-base/INTEGRATION.md)

---

**Knowledge Base v1.0.0** • February 2026 • Helix Project
