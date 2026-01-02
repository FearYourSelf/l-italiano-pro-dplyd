import React, { useState, useRef, useEffect } from 'react';
import { Message, UserProfile, AIMode } from '../types';
import { gemini } from '../services/geminiService';
import { Send, Sparkles, BrainCircuit, GraduationCap, MessagesSquare, Wand2, X, CheckCircle2, AlertCircle, Loader2, Check } from 'lucide-react';

interface ChatRoomProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isTyping: boolean;
  profile: UserProfile;
  onThinkingToggle: (enabled: boolean) => void;
  useThinking: boolean;
  onModeToggle: (mode: AIMode) => void;
}

type ValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  
  return (
    <>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (trimmed === '---' || trimmed === '***') {
          return <hr key={lineIdx} className="my-4 border-white/20" />;
        }
        
        const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        
        return (
          <div key={lineIdx} className={lineIdx > 0 ? "mt-1" : ""}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={i} className="font-extrabold text-white tracking-tight px-0.5">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              if (part.startsWith('*') && part.endsWith('*')) {
                return (
                  <em key={i} className="italic text-blue-300 font-medium opacity-90 px-1 bg-white/5 rounded-md">
                    {part.slice(1, -1)}
                  </em>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </div>
        );
      })}
    </>
  );
};

const ChatRoom: React.FC<ChatRoomProps> = ({ 
  messages, 
  onSendMessage, 
  isTyping, 
  profile,
  onThinkingToggle,
  useThinking,
  onModeToggle
}) => {
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const scrollToBottom = (instant = false) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: instant ? 'auto' : 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    
    const trimmedInput = input.trim();
    // Increase minimum length for validation to save quota
    if (trimmedInput.length < 10) {
      setSuggestion(null);
      setValidationStatus('idle');
      return;
    }

    setValidationStatus('checking');

    // Increased debounce timer from 800ms to 1500ms to reduce request frequency
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const corrected = await gemini.quickCheck(trimmedInput);
        
        if (corrected && corrected.toLowerCase() !== trimmedInput.toLowerCase()) {
          setSuggestion(corrected);
          setValidationStatus('invalid');
        } else {
          setSuggestion(null);
          setValidationStatus('valid');
        }
      } catch (e) {
        // Fail silently on rate limit errors for background tasks
        setValidationStatus('idle');
      }
    }, 1500);

    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [input]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
    setSuggestion(null);
    setValidationStatus('idle');
  };

  const applyCorrection = () => {
    if (suggestion) {
      setInput(suggestion);
      setSuggestion(null);
      setValidationStatus('valid');
    }
  };

  const formatTime = (timestamp: number) => {
    return new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-[#0d0d0d] border-b border-white/5 flex items-center justify-between z-20 shrink-0 lg:pl-16">
        <div className="flex bg-white/5 p-1 rounded-2xl shadow-inner border border-white/5 mx-auto sm:mx-0">
          <button 
            onClick={() => onModeToggle(AIMode.CONVERSATIONAL)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.CONVERSATIONAL ? 'bg-green-600 text-white shadow-lg border border-green-500' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          >
            <MessagesSquare size={14} /> <span className="hidden xs:inline">Conversazione</span>
          </button>
          <button 
            onClick={() => onModeToggle(AIMode.LEARNING)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.LEARNING ? 'bg-blue-600 text-white shadow-lg border border-blue-500' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          >
            <GraduationCap size={14} /> <span className="hidden xs:inline">Studio</span>
          </button>
        </div>
        
        {/* Tutor Status Label */}
        <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
          {validationStatus === 'checking' && <Loader2 size={12} className="animate-spin text-blue-400" />}
          {validationStatus === 'valid' && <CheckCircle2 size={12} className="text-green-500" />}
          {validationStatus === 'invalid' && <AlertCircle size={12} className="text-amber-500" />}
          <span className="text-[10px] uppercase tracking-widest text-gray-500 font-black">
            {validationStatus === 'checking' ? 'Validazione...' : 
             validationStatus === 'valid' ? 'Italiano Doc' : 
             validationStatus === 'invalid' ? 'Suggerimento' :
             profile.mode === AIMode.LEARNING ? 'Tutor On' : 'Flow Libero'}
          </span>
        </div>
      </div>

      {/* Messages List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col no-scrollbar"
      >
        {messages.length === 0 && (
          <div className="text-center mt-32 opacity-80 flex flex-col items-center animate-in fade-in duration-700">
            <div className="p-4 rounded-full bg-white/5 mb-4 border border-white/5 shadow-inner">
               <Sparkles size={48} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-montserrat mb-2 text-white">Ciao {profile.name}!</h1>
            <p className="max-w-xs mx-auto text-sm text-gray-300">Ready to level up your Italian? Start typing below.</p>
          </div>
        )}
        
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          return (
            <React.Fragment key={m.id}>
              <div 
                className={`bubble shadow-lg ${
                  isUser 
                    ? (profile.mode === AIMode.CONVERSATIONAL ? 'bubble-user-green' : 'bubble-user-blue') 
                    : 'bubble-ai'
                }`}
              >
                <FormattedText text={m.content} />
              </div>
              <div className={`message-meta ${isUser ? 'message-meta-user' : 'message-meta-ai'}`}>
                <span>{formatTime(m.timestamp)}</span>
                {isUser && (
                  <div className="flex items-center gap-0.5 ml-1">
                    {messages.some((other, oIdx) => oIdx > idx && other.role === 'ai') ? (
                      <span className="flex text-green-500">
                        <Check size={10} strokeWidth={4} />
                        <Check size={10} strokeWidth={4} className="-ml-1" />
                        <span className="ml-1 uppercase tracking-tighter text-[8px] font-black">Letti</span>
                      </span>
                    ) : (
                      <span className="text-gray-500"><Check size={10} strokeWidth={3} /></span>
                    )}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {isTyping && (
          <div className="bubble bubble-ai flex items-center gap-3 bg-[#242426] border border-white/5 shadow-lg">
            <div className="flex gap-1.5 py-1">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0d0d0d] border-t border-white/5 relative z-20 shrink-0">
        {suggestion && (
          <div className="absolute left-4 right-4 bottom-full mb-3 animate-in slide-in-from-bottom-2 duration-300">
            <div className="bg-[#1c1c1e] border border-green-500/30 p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <Wand2 size={18} className="text-green-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-black text-green-500 tracking-wider">Miglioramento</p>
                  <p className="text-sm text-white/90 truncate font-medium italic leading-tight">"{suggestion}"</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={applyCorrection}
                  className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-xl text-xs font-black transition-all active:scale-95 shadow-lg shadow-green-900/30"
                >
                  Usa
                </button>
                <button 
                  onClick={() => { setSuggestion(null); setValidationStatus('idle'); }}
                  className="p-2 text-white/40 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button 
            onClick={() => onThinkingToggle(!useThinking)}
            className={`p-3 rounded-2xl transition-all relative ${useThinking ? 'bg-indigo-600 text-white shadow-lg border border-indigo-400/50' : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 border border-white/5'}`}
            title="Deep Thinking Mode"
          >
            <BrainCircuit size={20} />
            {useThinking && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
            )}
          </button>
          
          <div className="flex-1 relative group">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Messaggio..."
              className={`
                w-full bg-white/5 border rounded-2xl py-3 px-5 outline-none transition-all pr-12 text-[15px] text-white
                ${validationStatus === 'invalid' ? 'border-amber-500/50 focus:border-amber-500' : 
                  validationStatus === 'valid' ? 'border-green-500/50 focus:border-green-500' : 
                  'border-white/10 focus:border-green-600/50'}
              `}
            />
            
            <button 
              onClick={handleSend}
              className={`
                absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all
                ${input.trim() ? 'bg-blue-600 text-white hover:scale-110 shadow-lg' : 'bg-white/5 text-white/20 cursor-not-allowed'}
              `}
              disabled={!input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;