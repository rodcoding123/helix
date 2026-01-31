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
import { Layout, Maximize2, Minimize2, Settings, PanelLeftClose, PanelLeft } from 'lucide-react';

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
        isFullscreen && 'fixed inset-0 z-50 bg-slate-950',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={showSidebar ? 'Hide panels' : 'Show panels'}
          >
            {showSidebar ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </button>
          <h2 className="text-sm font-medium text-slate-200">Code Interface</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Panel toggles */}
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={() => togglePanel('thinking')}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                isPanelVisible('thinking')
                  ? 'bg-helix-500/20 text-helix-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              Thinking
            </button>
            <button
              onClick={() => togglePanel('terminal')}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                isPanelVisible('terminal')
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              Terminal
            </button>
            <button
              onClick={() => togglePanel('diff')}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                isPanelVisible('diff')
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              Diff
            </button>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <button
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Side panels */}
        {showSidebar && (
          <div className="w-96 flex-shrink-0 flex flex-col gap-4 p-4 overflow-y-auto border-r border-slate-700 bg-slate-950/50">
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
          <div className="flex-1 overflow-y-auto p-4">
            {!isConnected ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Layout className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">
                    Connecting to Helix...
                  </h3>
                  <p className="text-sm text-slate-500">
                    Establishing secure connection to your instance
                  </p>
                  <button
                    onClick={() => connect()}
                    className="mt-4 px-4 py-2 rounded-lg bg-helix-500 text-white hover:bg-helix-600 transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <Layout className="h-12 w-12 text-helix-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">Ready to Code</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    Connected to your Helix instance. Ask anything and watch the AI think, execute
                    tools, and transform code in real-time.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {[
                      'Debug this function',
                      'Add error handling',
                      'Refactor for clarity',
                      'Write tests for...',
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => handleSend(suggestion)}
                        className="px-3 py-2 text-sm rounded-lg bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors text-left"
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
                  <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                    <p className="text-sm text-slate-400 whitespace-pre-wrap">{thinking}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="p-4 border-t border-slate-700">
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
        className="border-t border-slate-700"
      />
    </div>
  );
}
