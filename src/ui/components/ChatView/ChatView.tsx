import { useState, useRef, useEffect } from 'preact/hooks';
import { useOrchestrator } from '@/ui/hooks/useOrchestrator';
import { MessageBubble } from './MessageBubble';

export function ChatView() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, isLoading, error } = useOrchestrator('default-conv');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.value]);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (input.trim() && !isLoading.value) {
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div class="chat-view" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      <div class="messages" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
        {messages.value.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading.value && (
          <div class="message message--assistant" style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'inline-block',
              padding: '12px 16px',
              borderRadius: '18px',
              backgroundColor: 'var(--color-surface)',
            }}>
              <span class="typing-indicator">Thinking...</span>
            </div>
          </div>
        )}
        {error.value && (
          <div class="error-message" style={{
            color: '#ef4444',
            padding: '8px',
            textAlign: 'center'
          }}>
            {error.value}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={{
        padding: '16px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        gap: '8px'
      }}>
        <label for="chat-input" class="sr-only">Type a message</label>
        <input
          id="chat-input"
          ref={inputRef}
          type="text"
          value={input}
          onInput={(e) => setInput(e.currentTarget.value)}
          disabled={isLoading.value}
          placeholder="Type a message..."
          aria-disabled={isLoading.value}
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={isLoading.value || !input.trim()} aria-label="Send message">
          Send
        </button>
      </form>
    </div>
  );
}
