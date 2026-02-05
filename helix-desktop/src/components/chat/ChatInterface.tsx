/**
 * Chat Interface - Full-featured chat with commands, tools, and streaming
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGateway } from '../../hooks/useGateway';
import { useChatStore, type Message as StoreMessage, type ToolCall } from '../../stores/chatStore';
import { formatHelpMessage, SLASH_COMMANDS } from '../../hooks/useSlashCommands';
import { ChatHeader } from './ChatHeader';
import { ChatStatusBar, type ActivityStatus } from './ChatStatusBar';
import { MessageList, type Message } from './MessageList';
import { ChatInput } from './ChatInput';
import { type ToolExecutionData } from './ToolExecution';
import './ChatInterface.css';

interface SessionInfo {
  key: string;
  name?: string;
}

interface ModelInfo {
  provider: string;
  model: string;
}

interface AgentInfo {
  id: string;
  name: string;
}

export function ChatInterface() {
  const navigate = useNavigate();
  const { status, connected, messages: gatewayMessages, sendMessage, interrupt, hello, getClient } = useGateway();
  const chatStore = useChatStore();

  const [inputValue, setInputValue] = useState('');
  const [activityStatus, setActivityStatus] = useState<ActivityStatus>('idle');
  const [thinkingLevel, setThinkingLevel] = useState<'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'>('medium');
  const [showThinking, setShowThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [currentThinking, setCurrentThinking] = useState<string | null>(null);
  const [pendingTools, setPendingTools] = useState<ToolExecutionData[]>([]);
  const [streamStartTime, setStreamStartTime] = useState<number | undefined>();
  const [currentToolName, setCurrentToolName] = useState<string | undefined>();

  // Session info from hello response
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [tokensUsed] = useState<number | undefined>();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Convert store messages to display messages
  const displayMessages: Message[] = chatStore.getCurrentSession()?.messages.map((msg: StoreMessage) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    thinking: msg.thinking,
    toolCalls: msg.toolCalls as ToolExecutionData[] | undefined,
  })) || [];

  // Process incoming gateway messages
  useEffect(() => {
    for (const msg of gatewayMessages) {
      switch (msg.type) {
        case 'thinking':
          setCurrentThinking(msg.content || 'Thinking...');
          setActivityStatus('thinking');
          if (!streamStartTime) setStreamStartTime(Date.now());
          break;

        case 'tool_call':
          if (msg.toolName) {
            setCurrentToolName(msg.toolName);
            setActivityStatus('tool_use');
            setPendingTools(prev => [...prev, {
              id: msg.runId || String(Date.now()),
              name: msg.toolName!,
              input: msg.toolInput,
              status: 'running',
              startTime: Date.now(),
            }]);
          }
          break;

        case 'tool_result':
          setPendingTools(prev => prev.map(t =>
            t.name === msg.toolName && t.status === 'running'
              ? { ...t, status: 'completed', output: msg.toolOutput, endTime: Date.now() }
              : t
          ));
          setActivityStatus('streaming');
          break;

        case 'message':
          if (msg.content) {
            setStreamingContent(prev => prev + msg.content);
            setActivityStatus('streaming');
          }
          break;

        case 'complete':
          // Finalize the message
          if (streamingContent || pendingTools.length > 0) {
            chatStore.addMessage({
              role: 'assistant',
              content: streamingContent,
              thinking: currentThinking || undefined,
              toolCalls: pendingTools.length > 0 ? pendingTools as ToolCall[] : undefined,
            });
          }
          setStreamingContent('');
          setCurrentThinking(null);
          setPendingTools([]);
          setActivityStatus('idle');
          setStreamStartTime(undefined);
          setCurrentToolName(undefined);
          break;

        case 'error':
          chatStore.addMessage({
            role: 'system',
            content: `Error: ${msg.error}`,
          });
          setStreamingContent('');
          setCurrentThinking(null);
          setPendingTools([]);
          setActivityStatus('error');
          setStreamStartTime(undefined);
          break;
      }
    }
  }, [gatewayMessages, chatStore, streamingContent, currentThinking, pendingTools, streamStartTime]);

  // Initialize session from hello
  useEffect(() => {
    if (hello) {
      // Session info from snapshot if available
      const snapshot = hello.snapshot as { sessionKey?: string; model?: string; agent?: { id: string; name?: string } } | undefined;
      setSessionInfo({ key: snapshot?.sessionKey || 'default', name: snapshot?.sessionKey });
      if (snapshot?.model) {
        setModelInfo({ provider: 'anthropic', model: snapshot.model });
      }
      if (snapshot?.agent) {
        setAgentInfo({ id: snapshot.agent.id, name: snapshot.agent.name || snapshot.agent.id });
      }
    }
  }, [hello]);

  // Update connection status
  useEffect(() => {
    if (!status.running) {
      setActivityStatus('disconnected');
    } else if (!connected) {
      setActivityStatus('connecting');
    } else if (activityStatus === 'connecting' || activityStatus === 'disconnected') {
      setActivityStatus('connected');
      // Reset to idle after brief connection indicator
      setTimeout(() => setActivityStatus('idle'), 1500);
    }
  }, [status.running, connected, activityStatus]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, streamingContent, currentThinking]);

  // Ensure session exists
  useEffect(() => {
    if (!chatStore.currentSessionId) {
      chatStore.createSession('New Chat');
    }
  }, [chatStore]);

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || !connected) return;

    const userMessage = inputValue.trim();
    chatStore.addMessage({ role: 'user', content: userMessage });
    setInputValue('');
    setStreamingContent('');
    setCurrentThinking(null);
    setPendingTools([]);
    setActivityStatus('sending');
    setStreamStartTime(Date.now());

    sendMessage(userMessage, sessionInfo?.key).catch((err: Error) => {
      chatStore.addMessage({
        role: 'system',
        content: `Failed to send message: ${err.message}`,
      });
      setActivityStatus('error');
    });
  }, [inputValue, connected, chatStore, sendMessage, sessionInfo]);

  const handleCommand = useCallback((command: string, args: string) => {
    setInputValue('');

    // Handle commands locally or via gateway
    switch (command) {
      case 'help':
        chatStore.addMessage({
          role: 'system',
          content: formatHelpMessage(),
        });
        break;

      case 'clear':
        chatStore.clearMessages();
        break;

      case 'new':
      case 'reset':
        chatStore.createSession();
        break;

      case 'think': {
        const level = args.toLowerCase() as typeof thinkingLevel;
        if (['off', 'minimal', 'low', 'medium', 'high', 'xhigh'].includes(level)) {
          setThinkingLevel(level);
          chatStore.addMessage({
            role: 'system',
            content: `Thinking level set to: ${level}`,
          });
        } else {
          chatStore.addMessage({
            role: 'system',
            content: `Invalid thinking level. Use: off, minimal, low, medium, high, xhigh`,
          });
        }
        break;
      }

      case 'settings':
        navigate('/settings');
        break;

      case 'memory':
        navigate('/memory');
        break;

      case 'psychology':
        navigate('/psychology');
        break;

      case 'teams':
        navigate('/teams');
        break;

      case 'status':
        chatStore.addMessage({
          role: 'system',
          content: `**Status**
- Gateway: ${status.running ? 'Running' : 'Stopped'}
- Connected: ${connected ? 'Yes' : 'No'}
- Session: ${sessionInfo?.key || 'None'}
- Model: ${modelInfo?.model || 'Unknown'}
- Agent: ${agentInfo?.name || 'Default'}
- Thinking: ${thinkingLevel}`,
        });
        break;

      case 'exit':
      case 'quit':
        window.close();
        break;

      default: {
        // Send command to gateway
        const client = getClient();
        if (client?.connected) {
          const cmd = SLASH_COMMANDS.find(c => c.name === command);
          if (cmd?.handler) {
            client.request(cmd.handler, { args }).catch((err: Error) => {
              chatStore.addMessage({
                role: 'system',
                content: `Command failed: ${err.message}`,
              });
            });
          } else {
            chatStore.addMessage({
              role: 'system',
              content: `Unknown command: /${command}. Type /help for available commands.`,
            });
          }
        }
      }
    }
  }, [chatStore, navigate, status, connected, sessionInfo, modelInfo, agentInfo, thinkingLevel, getClient]);

  const handleBash = useCallback((command: string) => {
    setInputValue('');
    chatStore.addMessage({
      role: 'user',
      content: `!${command}`,
    });

    // Send bash command to gateway
    const client = getClient();
    if (client?.connected) {
      client.request('bash.run', { command }).then((result: unknown) => {
        chatStore.addMessage({
          role: 'assistant',
          content: `\`\`\`\n${String(result)}\n\`\`\``,
        });
      }).catch((err: Error) => {
        chatStore.addMessage({
          role: 'system',
          content: `Bash error: ${err.message}`,
        });
      });
    }
  }, [chatStore, getClient]);

  const handleInterrupt = useCallback(() => {
    interrupt(sessionInfo?.key);
    setActivityStatus('aborted');
    setStreamStartTime(undefined);
  }, [interrupt, sessionInfo]);

  const handleThinkingChange = useCallback((level: string) => {
    setThinkingLevel(level as typeof thinkingLevel);
  }, []);

  const toggleThinking = useCallback(() => {
    setShowThinking(prev => !prev);
  }, []);

  const handleNewSession = useCallback(() => {
    chatStore.createSession();
  }, [chatStore]);

  const isStreaming = ['sending', 'waiting', 'streaming', 'thinking', 'tool_use'].includes(activityStatus);

  // Show interface even when disconnected - with banner
  const showDisconnectedBanner = !status.running || !connected;

  return (
    <div className="chat-interface">
      <ChatHeader
        session={sessionInfo}
        model={modelInfo}
        agent={agentInfo}
        tokensUsed={tokensUsed}
        connected={connected}
        onNewSession={handleNewSession}
      />

      {showDisconnectedBanner && (
        <div className="disconnected-banner">
          <span className="disconnected-icon">⚠️</span>
          <span className="disconnected-text">
            {!status.running ? 'Gateway not running' : 'Disconnected from Helix'}
          </span>
          <span className="disconnected-hint">
            {!status.running
              ? 'Start OpenClaw gateway to enable chat'
              : 'Attempting to reconnect...'}
          </span>
        </div>
      )}

      <div className="chat-messages">
        <MessageList
          messages={displayMessages}
          thinking={currentThinking}
          isStreaming={isStreaming}
          showThinking={showThinking}
          streamingContent={streamingContent}
          pendingTools={pendingTools}
        />
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          onCommand={handleCommand}
          onBash={handleBash}
          onInterrupt={handleInterrupt}
          onToggleThinking={toggleThinking}
          onNewSession={handleNewSession}
          isStreaming={isStreaming}
          disabled={!connected}
        />
      </div>

      <ChatStatusBar
        status={activityStatus}
        thinkingLevel={thinkingLevel}
        modelName={modelInfo?.model}
        onThinkingChange={handleThinkingChange}
        startTime={streamStartTime}
        toolName={currentToolName}
      />
    </div>
  );
}
