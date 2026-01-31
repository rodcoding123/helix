# Lit Components Skill

Activated when working with OpenClaw's Lit-based web UI components.

## Activation Triggers

- Creating or modifying Lit components in `openclaw-helix/ui/`
- Working with web components
- Styling components with scoped CSS
- Adding reactive properties
- Handling events in Lit
- Testing Lit components

## Tech Stack

- **Framework**: Lit 3.x
- **Bundler**: Vite 7.x
- **Language**: TypeScript
- **Testing**: Vitest + @open-wc/testing

## Lit Basics

### Component Structure

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('helix-status')
export class HelixStatus extends LitElement {
  // Scoped styles (Shadow DOM)
  static styles = css`
    :host {
      display: block;
      padding: 16px;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .indicator.healthy {
      background: #22c55e;
    }

    .indicator.degraded {
      background: #f59e0b;
    }

    .indicator.critical {
      background: #ef4444;
    }
  `;

  // Reactive properties (from attributes)
  @property({ type: String })
  status: 'healthy' | 'degraded' | 'critical' = 'healthy';

  @property({ type: Number })
  heartbeatAge = 0;

  // Internal state (not from attributes)
  @state()
  private expanded = false;

  // Render method
  render() {
    return html`
      <div class="status" @click=${this.toggle}>
        <div class="indicator ${this.status}"></div>
        <span>Helix: ${this.status}</span>
        ${this.expanded ? this.renderDetails() : ''}
      </div>
    `;
  }

  private renderDetails() {
    return html`
      <div class="details">
        <p>Last heartbeat: ${this.heartbeatAge}s ago</p>
      </div>
    `;
  }

  private toggle() {
    this.expanded = !this.expanded;
  }
}

// TypeScript declaration for HTML
declare global {
  interface HTMLElementTagNameMap {
    'helix-status': HelixStatus;
  }
}
```

### Property Decorators

```typescript
// String property (reflected to attribute)
@property({ type: String, reflect: true })
name = '';

// Number property
@property({ type: Number })
count = 0;

// Boolean property
@property({ type: Boolean })
disabled = false;

// Object property (not reflected)
@property({ type: Object })
data: MyData | null = null;

// Array property
@property({ type: Array })
items: string[] = [];

// Internal state (never reflected)
@state()
private loading = false;
```

### Event Handling

```typescript
// Template event binding
render() {
  return html`
    <button @click=${this.handleClick}>Click me</button>
    <input @input=${this.handleInput} @keydown=${this.handleKeydown}>
  `;
}

// Event handlers
private handleClick(e: MouseEvent) {
  console.log('Clicked', e);
}

private handleInput(e: InputEvent) {
  const input = e.target as HTMLInputElement;
  this.value = input.value;
}

private handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    this.submit();
  }
}

// Dispatching custom events
private submit() {
  this.dispatchEvent(new CustomEvent('submit', {
    detail: { value: this.value },
    bubbles: true,
    composed: true, // Cross shadow DOM boundary
  }));
}
```

### Lifecycle

```typescript
export class MyComponent extends LitElement {
  // Called when component is added to DOM
  connectedCallback() {
    super.connectedCallback();
    this.startPolling();
  }

  // Called when component is removed from DOM
  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopPolling();
  }

  // Called before first render
  firstUpdated() {
    this.focusInput();
  }

  // Called after every render
  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('status')) {
      this.announceStatusChange();
    }
  }

  // Called when properties change, before render
  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('items')) {
      this.sortedItems = this.sortItems(this.items);
    }
  }
}
```

### Slots

```typescript
// Component with slots
render() {
  return html`
    <div class="card">
      <header>
        <slot name="header">Default Header</slot>
      </header>
      <main>
        <slot></slot> <!-- Default slot -->
      </main>
      <footer>
        <slot name="footer"></slot>
      </footer>
    </div>
  `;
}

// Usage
html`
  <my-card>
    <h2 slot="header">Title</h2>
    <p>Main content goes in default slot</p>
    <button slot="footer">Action</button>
  </my-card>
`;
```

### Directives

```typescript
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { when } from 'lit/directives/when.js';
import { ifDefined } from 'lit/directives/if-defined.js';

render() {
  // repeat for efficient list rendering
  const items = repeat(
    this.items,
    (item) => item.id,
    (item) => html`<li>${item.name}</li>`
  );

  // classMap for conditional classes
  const classes = classMap({
    active: this.active,
    disabled: this.disabled,
  });

  // styleMap for dynamic styles
  const styles = styleMap({
    color: this.color,
    fontSize: `${this.size}px`,
  });

  // when for conditional rendering
  const content = when(
    this.loading,
    () => html`<loading-spinner></loading-spinner>`,
    () => html`<div class="content">${this.data}</div>`
  );

  // ifDefined for optional attributes
  return html`
    <ul>${items}</ul>
    <div class=${classes} style=${styles}>
      ${content}
    </div>
    <a href=${ifDefined(this.href)}>Link</a>
  `;
}
```

## OpenClaw UI Components

### Common Components

```
ui/src/ui/
├── chat.ts           # Chat interface
├── config.ts         # Configuration forms
├── sessions.ts       # Session management
├── logs.ts           # Log viewer
├── skills.ts         # Skill cards
├── channels/         # Channel configs
│   ├── discord.ts
│   ├── slack.ts
│   └── ...
└── shared/           # Shared components
    ├── button.ts
    ├── input.ts
    ├── card.ts
    └── modal.ts
```

### Example: Helix Status Component

```typescript
// ui/src/ui/helix-status.ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

interface HelixStatusData {
  heartbeat: {
    lastBeat: number;
    status: 'active' | 'inactive';
  };
  hashChain: {
    valid: boolean;
    entries: number;
  };
  layers: {
    loaded: number;
    total: number;
  };
}

@customElement('helix-status')
export class HelixStatusComponent extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
    }

    .status-card {
      background: var(--surface-color, #1a1a1a);
      border-radius: 8px;
      padding: 16px;
      color: var(--text-color, #fff);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .title {
      font-size: 1.25rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    .indicator.healthy {
      background: #22c55e;
    }

    .indicator.degraded {
      background: #f59e0b;
    }

    .indicator.critical {
      background: #ef4444;
      animation: pulse 0.5s infinite;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .metric {
      text-align: center;
      padding: 12px;
      background: var(--surface-secondary, #2a2a2a);
      border-radius: 6px;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: bold;
    }

    .metric-label {
      font-size: 0.875rem;
      color: var(--text-secondary, #888);
    }
  `;

  @property({ type: Object })
  data: HelixStatusData | null = null;

  @state()
  private loading = true;

  @state()
  private error: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.fetchStatus();
    this.startPolling();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopPolling();
  }

  private pollingInterval: number | null = null;

  private startPolling() {
    this.pollingInterval = window.setInterval(() => {
      this.fetchStatus();
    }, 5000);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  private async fetchStatus() {
    try {
      const response = await fetch('/helix/status');
      this.data = await response.json();
      this.loading = false;
      this.error = null;
    } catch (e) {
      this.error = 'Failed to fetch status';
      this.loading = false;
    }
  }

  private getOverallStatus(): 'healthy' | 'degraded' | 'critical' {
    if (!this.data) return 'critical';

    const { heartbeat, hashChain, layers } = this.data;

    if (!hashChain.valid || heartbeat.status === 'inactive') {
      return 'critical';
    }

    if (layers.loaded < layers.total) {
      return 'degraded';
    }

    return 'healthy';
  }

  render() {
    if (this.loading) {
      return html`<div class="status-card">Loading...</div>`;
    }

    if (this.error) {
      return html`<div class="status-card error">${this.error}</div>`;
    }

    const status = this.getOverallStatus();
    const indicatorClasses = classMap({
      indicator: true,
      [status]: true,
    });

    return html`
      <div class="status-card">
        <div class="header">
          <div class="title">
            <div class=${indicatorClasses}></div>
            Helix Status
          </div>
          <span>${status.toUpperCase()}</span>
        </div>

        <div class="metrics">
          <div class="metric">
            <div class="metric-value">
              ${this.data?.heartbeat.status === 'active' ? '💓' : '💔'}
            </div>
            <div class="metric-label">Heartbeat</div>
          </div>

          <div class="metric">
            <div class="metric-value">${this.data?.hashChain.entries ?? 0}</div>
            <div class="metric-label">Hash Chain</div>
          </div>

          <div class="metric">
            <div class="metric-value">${this.data?.layers.loaded}/${this.data?.layers.total}</div>
            <div class="metric-label">Layers</div>
          </div>
        </div>
      </div>
    `;
  }
}
```

## CSS Custom Properties

OpenClaw UI uses CSS custom properties for theming:

```css
:root {
  /* Colors */
  --primary-color: #3b82f6;
  --surface-color: #1a1a1a;
  --surface-secondary: #2a2a2a;
  --text-color: #ffffff;
  --text-secondary: #888888;
  --error-color: #ef4444;
  --success-color: #22c55e;
  --warning-color: #f59e0b;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Typography */
  --font-family: system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, monospace;
}
```

## Testing Lit Components

```typescript
import { fixture, html, expect } from '@open-wc/testing';
import { HelixStatusComponent } from '../helix-status';

describe('HelixStatus', () => {
  it('renders with healthy status', async () => {
    const el = await fixture<HelixStatusComponent>(html`
      <helix-status
        .data=${{
          heartbeat: { lastBeat: Date.now(), status: 'active' },
          hashChain: { valid: true, entries: 100 },
          layers: { loaded: 7, total: 7 },
        }}
      ></helix-status>
    `);

    expect(el.shadowRoot?.querySelector('.indicator.healthy')).to.exist;
  });

  it('shows critical when heartbeat inactive', async () => {
    const el = await fixture<HelixStatusComponent>(html`
      <helix-status
        .data=${{
          heartbeat: { lastBeat: Date.now() - 120000, status: 'inactive' },
          hashChain: { valid: true, entries: 100 },
          layers: { loaded: 7, total: 7 },
        }}
      ></helix-status>
    `);

    expect(el.shadowRoot?.querySelector('.indicator.critical')).to.exist;
  });

  it('dispatches refresh event on button click', async () => {
    const el = await fixture<HelixStatusComponent>(html` <helix-status></helix-status> `);

    let eventFired = false;
    el.addEventListener('refresh', () => {
      eventFired = true;
    });

    el.shadowRoot?.querySelector('button')?.click();
    expect(eventFired).to.be.true;
  });
});
```

## Accessibility

```typescript
render() {
  return html`
    <!-- Use semantic HTML -->
    <article class="status-card" role="region" aria-label="Helix Status">
      <h2>Helix Status</h2>

      <!-- Add ARIA labels -->
      <button
        aria-label="Refresh status"
        @click=${this.refresh}
      >
        <refresh-icon></refresh-icon>
      </button>

      <!-- Status announcements -->
      <div
        role="status"
        aria-live="polite"
        class="visually-hidden"
      >
        ${this.statusAnnouncement}
      </div>

      <!-- Keyboard navigation -->
      <ul role="list">
        ${this.items.map(item => html`
          <li
            tabindex="0"
            @keydown=${(e: KeyboardEvent) => this.handleItemKeydown(e, item)}
          >
            ${item.name}
          </li>
        `)}
      </ul>
    </article>
  `;
}

// Visually hidden but accessible to screen readers
static styles = css`
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
`;
```

## Verification

After Lit component work:

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Test
npm run test

# Dev server
npm run dev

# Build
npm run build
```
