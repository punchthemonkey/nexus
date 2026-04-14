import DOMPurify from 'dompurify';
import { Message } from '@/domain/entities';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  let content = message.content;
  if (message.role === 'assistant') {
    content = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li']
    });
  }

  return (
    <div
      class={`message message--${message.role}`}
      style={{
        display: 'flex',
        marginBottom: '16px',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '12px 16px',
          borderRadius: '18px',
          backgroundColor: isUser ? 'var(--color-primary)' : 'var(--color-surface)',
          color: 'var(--color-text)',
          border: isSystem ? '1px dashed var(--color-border)' : 'none',
          fontSize: isSystem ? '14px' : '16px',
          fontStyle: isSystem ? 'italic' : 'normal',
        }}
        dangerouslySetInnerHTML={message.role === 'assistant' ? { __html: content } : undefined}
      >
        {message.role !== 'assistant' ? content : null}
      </div>
    </div>
  );
}
