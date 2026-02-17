// ==========================================
// SIYANDA AI CHAT COMPONENT
// ==========================================
// Conversational AI assistant for report support
import { useState, useRef, useEffect } from 'react';
import api from '../api/axios';

// Siyanda avatar - simple SVG icon
const SiyandaAvatar = () => (
  <div className="w-8 h-8 rounded-full bg-linear-to-br from-[#1a5f3c] to-[#0d3b5c] flex items-center justify-center shrink-0 shadow-sm">
    <span className="text-white text-xs font-bold">S</span>
  </div>
);

// Typing indicator
const TypingIndicator = () => (
  <div className="flex items-end gap-2">
    <SiyandaAvatar />
    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
      <div className="flex gap-1 items-center h-4">
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

// Individual message bubble
const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && <SiyandaAvatar />}

      <div className={`max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isUser && (
          <span className="text-xs text-slate-400 ml-1">Siyanda</span>
        )}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
            ${isUser
              ? 'bg-[#0d3b5c] text-white rounded-br-sm'
              : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
            }`}
        >
          {/* Render line breaks and basic formatting */}
          {message.content.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              {i < message.content.split('\n').length - 1 && <br />}
            </span>
          ))}
        </div>
        <span className="text-xs text-slate-400 mx-1">
          {new Date(message.timestamp).toLocaleTimeString('en-ZA', {
            hour: '2-digit', minute: '2-digit'
          })}
        </span>
      </div>
    </div>
  );
};

// Quick reply suggestions
const QUICK_REPLIES = [
  "What happens next?",
  "How long will this take?",
  "Who do I contact?",
  "How do I escalate this?",
];

// ==========================================
// MAIN CHAT COMPONENT
// ==========================================
export default function SiyandaChat({ report, initialMessage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load initial AI response if provided
  useEffect(() => {
    if (initialMessage) {
      setMessages([{
        role: 'assistant',
        content: initialMessage,
        timestamp: new Date().toISOString(),
      }]);
      if (!open) setUnread(1);
    }
  }, [initialMessage, open]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async (text) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Build history (exclude timestamps for API)
      const history = messages.map(({ role, content }) => ({ role, content }));

      const { data } = await api.post('/ai/chat', {
        reportId: report.id,
        message: messageText,
        history,
      });

      const aiMessage = {
        role: 'assistant',
        content: data.data.message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      if (!open) setUnread((n) => n + 1);

    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "Eish, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const reference = `#${String(report.id).padStart(4, '0')}`;

  return (
    <>
      {/* ================================ */}
      {/* FLOATING CHAT BUTTON */}
      {/* ================================ */}
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-3 bg-linear-to-br from-[#1a5f3c] to-[#0d3b5c] 
          text-white px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl 
          transition-all duration-200 hover:scale-105 text-sm font-medium`}
      >
        <span className="text-base">💬</span>
        <span>Chat with Siyanda</span>
        {unread > 0 && (
          <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unread}
          </span>
        )}
      </button>

      {/* ================================ */}
      {/* CHAT PANEL */}
      {/* ================================ */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6 pointer-events-none">
          <div className="pointer-events-auto w-full sm:w-105] h-150 max-h-[85vh] bg-slate-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">

            {/* Header */}
            <div className="bg-linear-to-br from-[#0d3b5c] to-[#1a5f3c] px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Siyanda</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                    <span className="text-white/70 text-xs">MuniSolve AI Assistant</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Report Context Banner */}
            <div className="bg-[#0d3b5c]/8 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500">Report</span>
              <span className="text-xs font-semibold text-[#0d3b5c]">{reference}</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500 truncate">{report.title}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && !loading && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-linear-to-br from-[#1a5f3c] to-[#0d3b5c] flex items-center justify-center mx-auto mb-3 shadow-md">
                    <span className="text-white text-2xl font-bold">S</span>
                  </div>
                  <p className="text-slate-700 font-semibold">Hi, I'm Siyanda!</p>
                  <p className="text-slate-500 text-sm mt-1">
                    I'm here to help you with your report. Ask me anything!
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}

              {loading && <TypingIndicator />}

              <div ref={bottomRef} />
            </div>

            {/* Quick Replies - show when no conversation yet */}
            {messages.length <= 1 && !loading && (
              <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => sendMessage(reply)}
                    className="whitespace-nowrap text-xs bg-white border border-slate-200 text-slate-600 
                      px-3 py-1.5 rounded-full hover:border-[#0d3b5c] hover:text-[#0d3b5c] 
                      transition-colors shrink-0 shadow-sm"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Siyanda anything about your report..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm 
                    focus:border-[#0d3b5c] focus:ring-1 focus:ring-[#0d3b5c] outline-none
                    max-h-24 overflow-y-auto"
                  style={{ lineHeight: '1.4' }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="bg-[#0d3b5c] hover:bg-[#0a2d45] disabled:opacity-40 disabled:cursor-not-allowed
                    text-white w-10 h-10 rounded-xl flex items-center justify-center 
                    transition-all duration-150 hover:scale-105 shrink-0"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m22 2-7 20-4-9-9-4 20-7z"/>
                    <path d="M22 2 11 13"/>
                  </svg>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 text-center">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
