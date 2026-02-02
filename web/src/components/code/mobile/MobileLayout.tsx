import { useState } from 'react';
import { Brain, Terminal, FileCode, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThinkingPanel } from '../ThinkingPanel';
import { TerminalPanel } from '../TerminalPanel';
import { DiffPanel } from '../DiffPanel';
import { ChatInput } from '../ChatInput';
import { VoiceButton } from '../voice/VoiceButton';
import type { VoiceState } from '@/lib/webrtc-voice';

interface MobileLayoutProps {
  // Panel content
  thinking: string;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; output?: string }>;
  currentToolCall: { name: string; input: Record<string, unknown>; output?: string } | null;
  diffLines: string[];

  // Chat
  onSendMessage: (message: string) => void;
  onInterrupt: () => void;
  isProcessing: boolean;
  isConnected: boolean;

  // Voice
  voiceState: VoiceState;
  isMuted: boolean;
  onVoiceConnect: () => void;
  onVoiceDisconnect: () => void;
  onVoiceToggleMute: () => void;

  className?: string;
}

type MobilePanel = 'thinking' | 'terminal' | 'diff' | 'chat';

export function MobileLayout({
  thinking,
  toolCalls,
  currentToolCall,
  diffLines,
  onSendMessage,
  onInterrupt,
  isProcessing,
  isConnected,
  voiceState,
  isMuted,
  onVoiceConnect,
  onVoiceDisconnect,
  onVoiceToggleMute,
  className,
}: MobileLayoutProps) {
  const [activePanel, setActivePanel] = useState<MobilePanel>('chat');

  const tabs: { id: MobilePanel; icon: typeof Brain; label: string }[] = [
    { id: 'thinking', icon: Brain, label: 'Think' },
    { id: 'terminal', icon: Terminal, label: 'Terminal' },
    { id: 'diff', icon: FileCode, label: 'Diff' },
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
  ];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'thinking' && (
          <div className="h-full p-4 overflow-y-auto">
            <ThinkingPanel thinking={thinking} />
          </div>
        )}

        {activePanel === 'terminal' && (
          <div className="h-full p-4 overflow-y-auto">
            <TerminalPanel toolCalls={toolCalls} currentToolCall={currentToolCall} />
          </div>
        )}

        {activePanel === 'diff' && (
          <div className="h-full p-4 overflow-y-auto">
            <DiffPanel diffLines={diffLines} />
          </div>
        )}

        {activePanel === 'chat' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4">
              {/* Chat messages would go here */}
              <div className="flex items-center justify-center h-full text-slate-500">
                {isConnected ? (
                  <p>Send a message to start chatting with Helix</p>
                ) : (
                  <p>Connecting to Helix...</p>
                )}
              </div>
            </div>

            {/* Chat input */}
            <div className="p-4 border-t border-slate-700">
              <ChatInput
                onSend={onSendMessage}
                onInterrupt={onInterrupt}
                isProcessing={isProcessing}
                isConnected={isConnected}
              />
            </div>
          </div>
        )}
      </div>

      {/* Voice button (always visible) */}
      <div className="flex items-center justify-center py-2 border-t border-slate-700 bg-slate-900/50">
        <VoiceButton
          state={voiceState}
          isMuted={isMuted}
          onConnect={onVoiceConnect}
          onDisconnect={onVoiceDisconnect}
          onToggleMute={onVoiceToggleMute}
        />
      </div>

      {/* Tab bar */}
      <div className="flex border-t border-slate-700 bg-slate-900">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activePanel === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 transition-colors',
                isActive ? 'text-helix-400 bg-helix-500/10' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
