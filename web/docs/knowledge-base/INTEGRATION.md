# Knowledge Base Integration Guide

## Overview

This knowledge base is designed to be integrated into both the web and desktop applications as a user-facing help system. Users can access comprehensive documentation without leaving the app.

## File Structure

```
web/docs/knowledge-base/
├── README.md                  # Main index page
├── INTEGRATION.md            # This file
├── extended/
│   ├── agent-templates.md    # Guide for Agent Templates
│   ├── marketplace.md         # Guide for Marketplace
│   ├── custom-tools.md        # Guide for Custom Tools
│   ├── skill-composition.md   # Guide for Skill Composition
│   └── memory-synthesis.md    # Guide for Memory Synthesis
└── core/
    └── (future core feature guides)

# Components
web/src/components/knowledge-base/
├── KnowledgeBase.tsx         # Main component
└── index.ts                  # Export file

web/src/pages/
└── KnowledgeBasePage.tsx     # Page wrapper

# Desktop equivalents in:
helix-desktop/src/components/knowledge-base/
helix-desktop/src/pages/
```

## Web Integration

### 1. Add Route

In your routing configuration (e.g., `src/routes.tsx` or similar):

```typescript
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';

const routes = [
  // ... other routes
  {
    path: '/help',
    element: <KnowledgeBasePage />,
    label: 'Help',
    icon: 'HelpCircle',
  },
];
```

### 2. Add Navigation Link

In your sidebar component (e.g., `src/components/Sidebar.tsx`):

```typescript
<NavLink to="/help" icon={HelpCircle} label="Help" />
```

Or add to a Help menu:

```typescript
<DropdownMenu>
  <DropdownMenuTrigger>Help</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem asChild>
      <Link to="/help">Documentation</Link>
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <a href="https://github.com/anthropics/helix/issues">Report Issue</a>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 3. Update Component Props (Optional)

If you want to customize the component, you can modify `KnowledgeBase.tsx` to accept props:

```typescript
interface KnowledgeBaseProps {
  onClose?: () => void;
  initialGuide?: string;
}

export const KnowledgeBase: FC<KnowledgeBaseProps> = ({ onClose, initialGuide }) => {
  // Use onClose for modal integrations
  // Use initialGuide to open a specific guide
};
```

## Desktop Integration

### 1. Add Route

In your routing configuration (e.g., `src/routes.tsx`):

```typescript
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';

export const MAIN_ROUTES = [
  // ... other routes
  {
    path: '/help',
    element: <KnowledgeBasePage />,
    label: 'Help',
  },
];
```

### 2. Add Menu Item

In your main menu or sidebar:

```typescript
<NavLink to="/help">
  <BookOpen size={20} />
  <span>Help & Documentation</span>
</NavLink>
```

### 3. Keyboard Shortcut (Optional)

Add keyboard shortcut (e.g., `?` to open help):

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === '?' && !isModalOpen) {
      navigate('/help');
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

## Modal Integration (Alternative)

If you want to show the knowledge base as a modal:

```typescript
import { KnowledgeBase } from '@/components/knowledge-base';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function HelpModal({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh]">
        <KnowledgeBase onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
```

Then trigger with a button:

```typescript
const [helpOpen, setHelpOpen] = useState(false);

<button onClick={() => setHelpOpen(true)}>
  <HelpCircle size={20} />
</button>
```

## Loading Guide Content

The current component loads placeholder content. To load actual markdown:

### Option 1: Fetch from Public Folder

```typescript
// In KnowledgeBase.tsx
const loadGuideContent = async (guidePath: string) => {
  const response = await fetch(`/docs/knowledge-base${guidePath}.md`);
  const content = await response.text();
  setGuideContent(content);
};
```

### Option 2: Import Markdown

```typescript
import AgentTemplatesGuide from '@/docs/knowledge-base/extended/agent-templates.md?raw';
import MarketplaceGuide from '@/docs/knowledge-base/extended/marketplace.md?raw';
// ... etc

const GUIDE_CONTENT = {
  'agent-templates': AgentTemplatesGuide,
  'marketplace': MarketplaceGuide,
  // ... etc
};

const loadGuideContent = (guideId: string) => {
  setGuideContent(GUIDE_CONTENT[guideId] || '');
};
```

### Option 3: Store in Database/State

Create a context with all guide content and access it:

```typescript
const { guides } = useKnowledgeBase();
const guideContent = guides[activeGuide];
```

## Accessibility Considerations

- Ensure keyboard navigation works (arrow keys, Enter, Escape)
- Add skip links for accessibility
- Support search functionality
- Maintain sufficient color contrast
- Add ARIA labels to interactive elements

## Maintenance

### Adding New Guides

1. Create markdown file in `web/docs/knowledge-base/extended/` (or appropriate subfolder)
2. Add entry to `GUIDES` array in `KnowledgeBase.tsx`:

```typescript
{
  id: 'new-feature',
  title: 'New Feature Guide',
  category: 'extended',
  path: '/extended/new-feature.md',
  description: 'Guide description here',
  icon: '✨',
}
```

3. Duplicate changes in desktop version

### Updating Guides

1. Edit the markdown file
2. Re-deploy the application
3. Users see updated content on next load

### Organizing by Category

To organize guides by category, update the sidebar rendering:

```typescript
const guidesByCategory = GUIDES.reduce((acc, guide) => {
  if (!acc[guide.category]) acc[guide.category] = [];
  acc[guide.category].push(guide);
  return acc;
}, {} as Record<string, KnowledgeBaseGuide[]>);

Object.entries(guidesByCategory).map(([category, guides]) => (
  <div key={category}>
    <h3>{category}</h3>
    {guides.map(guide => (...))}
  </div>
))
```

## Search Implementation

The component includes basic search. To enhance it:

```typescript
// Full-text search with fuzzy matching
import Fuse from 'fuse.js';

const fuse = new Fuse(GUIDES, {
  keys: ['title', 'description'],
  threshold: 0.3,
});

const results = fuse.search(query);
```

## Analytics (Optional)

Track which guides are accessed:

```typescript
const trackGuideView = (guideId: string) => {
  analytics.event('knowledge_base_view', {
    guide_id: guideId,
    timestamp: new Date(),
  });
};

useEffect(() => {
  if (activeGuide) {
    trackGuideView(activeGuide);
  }
}, [activeGuide]);
```

## Performance Optimization

- Lazy-load guide content
- Cache loaded guides in memory
- Compress markdown files
- Consider code-splitting for large guides

## Troubleshooting

### Guides Not Displaying

1. Check file paths match `path` property
2. Verify markdown is valid
3. Check browser console for errors
4. Ensure `react-markdown` is installed

### Styling Issues

The component uses Tailwind CSS. Ensure:
- Tailwind is configured in your project
- Dark mode is enabled
- Color palette includes slate colors

### Navigation Issues

- Check route paths are correct
- Verify router setup matches component imports
- Test browser back button functionality

## Future Enhancements

- [ ] Full-text search with Lunr.js
- [ ] Dark/light theme support
- [ ] Offline capability with service worker
- [ ] PDF export functionality
- [ ] Video tutorials embedded in guides
- [ ] Community contributions workflow
- [ ] Translation support (i18n)
- [ ] Analytics dashboard for guide usage

## Support

For issues with the knowledge base:
1. Check this guide first
2. Review component code comments
3. Check GitHub issues
4. Ask in community discussions

---

**Last Updated:** February 2026
**Version:** 1.0.0
