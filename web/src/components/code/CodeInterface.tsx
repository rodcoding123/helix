import { useState, useCallback, useEffect } from 'react';
import { ThinkingPanel } from './ThinkingPanel';
import { TerminalPanel } from './TerminalPanel';
import { DiffPanel } from './DiffPanel';
import { ChatInput } from './ChatInput';
import { StatusBar } from './StatusBar';
import { useGatewayConnection } from '@/hooks/useGatewayConnection';
import { useStreaming } from '@/hooks/useStreaming';
import { usePanels } from '@/hooks/usePanels';
import { cn } from '@/lib/utils';
import {
  Cpu,
  Maximize2,
  Minimize2,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
} from 'lucide-react';

interface CodeInterfaceProps {
  instanceKey: string;
  authToken: string;
  gatewayUrl?: string;
  className?: string;
}

export function CodeInterface({
  instanceKey,
  authToken,
  gatewayUrl,
  className,
}: CodeInterfaceProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sessionStart] = useState(() => Date.now());
  const [sessionDuration, setSessionDuration] = useState(0);
  const [toolCallHistory, setToolCallHistory] = useState<
    Array<{
      name: string;
      input: Record<string, unknown>;
      output?: string;
    }>
  >([]);

  // Connection hook
  const { status, messages, connect, sendMessage, interrupt, isConnected } = useGatewayConnection({
    instanceKey,
    authToken,
    gatewayUrl,
    autoConnect: true,
  });

  // Streaming state
  const { thinking, currentToolCall, isComplete, processMessage, reset } = useStreaming();

  // Panel visibility
  const { isPanelVisible, togglePanel } = usePanels({
    defaultPanels: { thinking: true, terminal: true, diff: false, chat: true },
  });

  // Process incoming messages
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage) {
      processMessage(latestMessage);

      // Track completed tool calls
      if (latestMessage.type === 'tool_result' && currentToolCall) {
        setToolCallHistory(prev => [
          ...prev,
          {
            name: currentToolCall.name,
            input: currentToolCall.input,
            output: latestMessage.toolOutput,
          },
        ]);
      }
    }
  }, [messages, processMessage, currentToolCall]);

  // Session duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  // Handle send
  const handleSend = useCallback(
    (message: string) => {
      reset();
      setToolCallHistory([]);
      sendMessage(message);
    },
    [reset, sendMessage]
  );

  // Handle interrupt
  const handleInterrupt = useCallback(() => {
    interrupt();
  }, [interrupt]);

  // Check if processing
  const isProcessing = !isComplete && messages.length > 0;

  return (
    <div
      className={cn(
        'flex flex-col h-full',
        isFullscreen && 'fixed inset-0 z-50 bg-void',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-bg-secondary/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
            title={showSidebar ? 'Hide panels' : 'Show panels'}
          >
            {showSidebar ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-helix-500/10 border border-helix-500/20">
              <Cpu className="h-4 w-4 text-helix-400" />
            </div>
            <h2 className="text-sm font-display font-semibold text-white">Code Interface</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Panel toggles */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-tertiary/50 mr-2">
            <button
              onClick={() => togglePanel('thinking')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                isPanelVisible('thinking')
                  ? 'bg-helix-500 text-white shadow-sm'
                  : 'text-text-secondary hover:text-white'
              )}
            >
              Thinking
            </button>
            <button
              onClick={() => togglePanel('terminal')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                isPanelVisible('terminal')
                  ? 'bg-success text-white shadow-sm'
                  : 'text-text-secondary hover:text-white'
              )}
            >
              Terminal
            </button>
            <button
              onClick={() => togglePanel('diff')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                isPanelVisible('diff')
                  ? 'bg-warning text-bg-primary shadow-sm'
                  : 'text-text-secondary hover:text-white'
              )}
            >
              Diff
            </button>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <button
            className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden bg-bg-primary">
        {/* Side panels */}
        {showSidebar && (
          <div className="w-96 flex-shrink-0 flex flex-col gap-4 p-4 overflow-y-auto border-r border-white/5 bg-bg-secondary/50">
            {isPanelVisible('thinking') && (
              <ThinkingPanel thinking={thinking} onToggle={() => togglePanel('thinking')} />
            )}

            {isPanelVisible('terminal') && (
              <TerminalPanel
                toolCalls={toolCallHistory}
                currentToolCall={currentToolCall}
                onToggle={() => togglePanel('terminal')}
              />
            )}

            {isPanelVisible('diff') && (
              <DiffPanel diffLines={[]} onToggle={() => togglePanel('diff')} />
            )}
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages would go here */}
          <div className="flex-1 overflow-y-auto p-6">
            {!isConnected ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-helix-500/10 border border-helix-500/20">
                    <Cpu className="h-8 w-8 text-helix-400 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-display font-semibold text-white mb-2">
                    Connecting to Helix...
                  </h3>
                  <p className="text-sm text-text-secondary max-w-sm mx-auto">
                    Establishing secure connection to your instance
                  </p>
                  <button onClick={() => connect()} className="mt-6 btn btn-primary">
                    Retry Connection
                  </button>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-lg">
                  <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-helix shadow-glow-blue">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-display font-bold text-white mb-3">Ready to Code</h3>
                  <p className="text-text-secondary mb-8">
                    Connected to your Helix instance. Ask anything and watch the AI think, execute
                    tools, and transform code in real-time.
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-left">
                    {[
                      'Debug this function',
                      'Add error handling',
                      'Refactor for clarity',
                      'Write tests for...',
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => handleSend(suggestion)}
                        className="px-4 py-3 text-sm rounded-xl bg-bg-tertiary/50 border border-white/5 text-text-secondary hover:text-white hover:border-helix-500/30 hover:bg-bg-tertiary transition-all duration-200 text-left"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Render messages here */}
                {thinking && (
                  <div className="p-4 rounded-xl bg-bg-tertiary/50 border border-helix-500/20">
                    <p className="text-sm text-text-secondary whitespace-pre-wrap font-mono">
                      {thinking}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="p-4 border-t border-white/5 bg-bg-secondary/30">
            <ChatInput
              onSend={handleSend}
              onInterrupt={handleInterrupt}
              isProcessing={isProcessing}
              isConnected={isConnected}
            />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar
        connectionStatus={status}
        instanceName={`Instance ${instanceKey.slice(0, 8)}`}
        sessionDuration={sessionDuration}
        className="border-t border-white/5"
      />
    </div>
  );
}
