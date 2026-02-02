/**
 * Slash Commands Hook - Parse and handle slash commands
 */

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  args?: string;
  handler?: string; // RPC method to call
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'help', description: 'Show available commands' },
  { name: 'status', description: 'Show gateway and connection status' },
  { name: 'agent', args: '[id]', description: 'Switch agent or open picker', handler: 'agent.select' },
  { name: 'agents', description: 'Open agent picker', handler: 'agent.list' },
  { name: 'session', args: '[key]', description: 'Switch session or open picker', handler: 'session.select' },
  { name: 'sessions', description: 'Open session picker', handler: 'session.list' },
  { name: 'new', aliases: ['reset'], description: 'Start a new chat session', handler: 'session.new' },
  { name: 'model', args: '[provider/model]', description: 'Set model or open picker', handler: 'config.model' },
  { name: 'models', description: 'Open model picker', handler: 'model.list' },
  { name: 'think', args: '<level>', description: 'Set thinking level (off|minimal|low|medium|high|xhigh)', handler: 'config.thinking' },
  { name: 'verbose', args: '<on|off>', description: 'Toggle verbose output', handler: 'config.verbose' },
  { name: 'reasoning', args: '<on|off>', description: 'Toggle reasoning display', handler: 'config.reasoning' },
  { name: 'usage', args: '<off|tokens|full>', description: 'Set token usage display', handler: 'config.usage' },
  { name: 'elevated', aliases: ['elev'], args: '<on|off|ask|full>', description: 'Set elevated mode', handler: 'config.elevated' },
  { name: 'activation', args: '<mention|always>', description: 'Set group activation mode', handler: 'config.activation' },
  { name: 'abort', description: 'Abort current run', handler: 'run.abort' },
  { name: 'settings', description: 'Open settings' },
  { name: 'memory', description: 'Open memory viewer' },
  { name: 'psychology', description: 'Open psychology dashboard' },
  { name: 'clear', description: 'Clear chat display' },
  { name: 'exit', aliases: ['quit'], description: 'Exit application' },
];

// Thinking level completions
export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];

// Boolean completions
export const BOOL_OPTIONS = ['on', 'off'];

// Elevated mode completions
export const ELEVATED_OPTIONS = ['on', 'off', 'ask', 'full'];

// Usage mode completions
export const USAGE_OPTIONS = ['off', 'tokens', 'full'];

// Activation mode completions
export const ACTIVATION_OPTIONS = ['mention', 'always'];

export interface ParsedCommand {
  command: string;
  args: string;
  rawInput: string;
  isCommand: boolean;
  isBash: boolean;
}

export function parseInput(input: string): ParsedCommand {
  const trimmed = input.trim();

  // Check for bash command (starts with !)
  if (trimmed.startsWith('!') && trimmed.length > 1) {
    return {
      command: 'bash',
      args: trimmed.slice(1).trim(),
      rawInput: input,
      isCommand: false,
      isBash: true,
    };
  }

  // Check for slash command
  if (trimmed.startsWith('/')) {
    const match = trimmed.match(/^\/(\w+)\s*(.*)/);
    if (match) {
      let cmdName = match[1].toLowerCase();
      const args = match[2] || '';

      // Resolve aliases
      const cmd = SLASH_COMMANDS.find(c =>
        c.name === cmdName || c.aliases?.includes(cmdName)
      );
      if (cmd) {
        cmdName = cmd.name;
      }

      return {
        command: cmdName,
        args,
        rawInput: input,
        isCommand: true,
        isBash: false,
      };
    }
  }

  // Regular message
  return {
    command: '',
    args: '',
    rawInput: input,
    isCommand: false,
    isBash: false,
  };
}

export interface CommandCompletion {
  value: string;
  display: string;
  description: string;
}

export function getCompletions(input: string): CommandCompletion[] {
  const trimmed = input.trim();

  // Not a command - no completions
  if (!trimmed.startsWith('/')) {
    return [];
  }

  const match = trimmed.match(/^\/(\w*)\s*(.*)/);
  if (!match) return [];

  const cmdPart = match[1].toLowerCase();
  const argPart = match[2] || '';

  // If no space after command, complete command names
  if (!trimmed.includes(' ') || !argPart) {
    return SLASH_COMMANDS
      .filter(cmd => cmd.name.startsWith(cmdPart))
      .map(cmd => ({
        value: `/${cmd.name}`,
        display: `/${cmd.name}${cmd.args ? ' ' + cmd.args : ''}`,
        description: cmd.description,
      }));
  }

  // Complete arguments for specific commands
  const cmd = SLASH_COMMANDS.find(c =>
    c.name === cmdPart || c.aliases?.includes(cmdPart)
  );

  if (!cmd) return [];

  switch (cmd.name) {
    case 'think':
      return THINKING_LEVELS
        .filter(l => l.startsWith(argPart.toLowerCase()))
        .map(l => ({
          value: `/${cmd.name} ${l}`,
          display: l,
          description: `Set thinking to ${l}`,
        }));

    case 'verbose':
    case 'reasoning':
      return BOOL_OPTIONS
        .filter(o => o.startsWith(argPart.toLowerCase()))
        .map(o => ({
          value: `/${cmd.name} ${o}`,
          display: o,
          description: `Turn ${cmd.name} ${o}`,
        }));

    case 'elevated':
      return ELEVATED_OPTIONS
        .filter(o => o.startsWith(argPart.toLowerCase()))
        .map(o => ({
          value: `/${cmd.name} ${o}`,
          display: o,
          description: `Set elevated mode to ${o}`,
        }));

    case 'usage':
      return USAGE_OPTIONS
        .filter(o => o.startsWith(argPart.toLowerCase()))
        .map(o => ({
          value: `/${cmd.name} ${o}`,
          display: o,
          description: `Set usage display to ${o}`,
        }));

    case 'activation':
      return ACTIVATION_OPTIONS
        .filter(o => o.startsWith(argPart.toLowerCase()))
        .map(o => ({
          value: `/${cmd.name} ${o}`,
          display: o,
          description: `Set activation mode to ${o}`,
        }));

    default:
      return [];
  }
}

export function formatHelpMessage(): string {
  const lines: string[] = ['**Available Commands:**\n'];

  for (const cmd of SLASH_COMMANDS) {
    const aliases = cmd.aliases ? ` (${cmd.aliases.map(a => `/${a}`).join(', ')})` : '';
    const args = cmd.args ? ` ${cmd.args}` : '';
    lines.push(`\`/${cmd.name}${args}\`${aliases} - ${cmd.description}`);
  }

  lines.push('\n**Keyboard Shortcuts:**');
  lines.push('- `Enter` - Send message');
  lines.push('- `Shift+Enter` - New line');
  lines.push('- `Ctrl+G` - Select agent');
  lines.push('- `Ctrl+L` - Select model');
  lines.push('- `Ctrl+P` - Select session');
  lines.push('- `Ctrl+N` - New session');
  lines.push('- `Ctrl+T` - Toggle thinking display');
  lines.push('- `Escape` - Abort current run');
  lines.push('\n**Bash Shortcut:**');
  lines.push('- Type `!command` to run a shell command directly');

  return lines.join('\n');
}
