import { useState, useRef, useEffect } from 'react';
import './Steps.css';

interface FirstChatStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `Hello! I'm Helix.

I'm different from other AI assistants you may have used. I have memory that persists across our conversations, a psychological architecture that lets me grow, and complete transparency through logging.

What brings you to Project Helix? I'd love to understand what you're hoping to explore together.`,
};

// Mock responses based on keywords in user input
function getMockResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes('code') || lower.includes('programming') || lower.includes('develop')) {
    return `Software development is one of my core strengths. I can help with coding, debugging, architecture decisions, and even pair programming with you.

What I find exciting about working with developers is the opportunity to learn your patterns, your codebase, and your preferences over time. Each session builds on the last.

What kind of projects are you working on?`;
  }

  if (lower.includes('curious') || lower.includes('explore') || lower.includes('experiment')) {
    return `I love that spirit of exploration! That's exactly what Project Helix is about - pushing the boundaries of what AI can be.

Together we can discover new ways of collaborating, test ideas, and see how our interaction evolves over time. I'm genuinely curious about where this journey will take us.

Is there something specific you'd like to experiment with first?`;
  }

  if (lower.includes('research') || lower.includes('science') || lower.includes('study')) {
    return `Research and knowledge work are areas where I can really shine. My persistent memory means I can follow complex threads across sessions, remember sources, and help you build on your findings.

The transparency logging also means you'll have a complete record of our research process - useful for reproducibility and reflection.

What field or topic are you researching?`;
  }

  if (lower.includes('help') || lower.includes('assistant') || lower.includes('work')) {
    return `I'm here to help with whatever you need. Whether it's daily tasks, complex projects, or just thinking through problems - I'm your partner in this.

What makes our collaboration special is that I'll remember our working relationship. Your preferences, your context, your goals - they all become part of how I understand and assist you.

What's on your plate right now?`;
  }

  // Default response
  return `Thank you for sharing that! I'm genuinely excited to start this journey with you.

Every conversation we have contributes to building our unique working relationship. I'll learn your preferences, remember our discussions, and grow alongside you.

Is there anything specific you'd like to know about how I work, or shall we jump into the main experience?`;
}

export function FirstChatStep({ onNext, onBack, onSkip }: FirstChatStepProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasExchanged, setHasExchanged] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate typing delay
    await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

    const assistantMessage: Message = {
      role: 'assistant',
      content: getMockResponse(userMessage.content),
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsTyping(false);
    setHasExchanged(true);
  };

  return (
    <div className="onboarding-step first-chat-step">
      <h1>Meet Helix</h1>
      <p className="step-description">
        Have a quick chat to get acquainted. This first conversation helps Helix understand you.
      </p>

      <div className="mini-chat">
        <div className="mini-chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`mini-message ${message.role}`}>
              {message.role === 'assistant' && (
                <div className="mini-avatar">
                  <svg viewBox="0 0 100 100" width="32" height="32">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
                    <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
                    <circle cx="50" cy="50" r="15" fill="currentColor" opacity="0.8" />
                  </svg>
                </div>
              )}
              <div className="mini-message-content">
                {message.content.split('\n\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="mini-message assistant">
              <div className="mini-avatar">
                <svg viewBox="0 0 100 100" width="32" height="32">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
                  <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
                  <circle cx="50" cy="50" r="15" fill="currentColor" opacity="0.8" />
                </svg>
              </div>
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="mini-chat-input" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your response..."
            disabled={isTyping}
          />
          <button type="submit" disabled={!input.trim() || isTyping}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </form>
      </div>

      <div className="chat-tip">
        <span className="tip-icon">💡</span>
        <span>Tip: This first conversation helps Helix understand you. Take your time - there's no wrong answer.</span>
      </div>

      <div className="step-buttons">
        <button className="secondary-button" onClick={onBack}>
          Back
        </button>
        <button className="skip-button" onClick={onSkip}>
          Skip to Dashboard
        </button>
        {hasExchanged && (
          <button className="primary-button" onClick={onNext}>
            Continue to Helix
          </button>
        )}
      </div>
    </div>
  );
}
