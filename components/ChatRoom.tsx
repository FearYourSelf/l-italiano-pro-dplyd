
import React, { useState, useRef, useEffect } from 'react';
import { Message, UserProfile, AIMode } from '../types';
import { gemini } from '../services/geminiService';
import { 
  Send, 
  Sparkles, 
  BrainCircuit, 
  GraduationCap, 
  MessagesSquare, 
  Wand2, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Check, 
  Target, 
  ChevronDown,
  Star
} from 'lucide-react';

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
        if (trimmed === '---' || trimmed === '***') return <hr key={lineIdx} className="my-4 border-white/20" />;
        const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        return (
          <div key={lineIdx} className={lineIdx > 0 ? "mt-1" : ""}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-extrabold text-white tracking-tight">{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i} className="italic text-blue-300 font-medium opacity-90 px-1.5 bg-white/5 rounded-md border border-white/5">{part.slice(1, -1)}</em>;
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
  const [isMissionVisible, setIsMissionVisible] = useState(true);
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
    if (trimmedInput.length < 8) {
      setSuggestion(null);
      setValidationStatus('idle');
      return;
    }
    setValidationStatus('checking');
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
      } catch (e) { setValidationStatus('idle'); }
    }, 1200);
    return () => { if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current); };
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

  const missions = [
    { text: "Usa il 'passato prossimo' per descrivere cosa hai mangiato.", icon: <Star className="text-yellow-500" size={14} /> },
    { text: "Prova a inserire un intercalare regionale (es. 'Daje' o 'Uè').", icon: <Sparkles className="text-blue-400" size={14} /> },
    { text: "Usa la forma di cortesia 'Lei' con il tuo coach.", icon: <CheckCircle2 className="text-green-500" size={14} /> }
  ];
  const activeMission = missions[messages.length % missions.length];

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden view-enter">
      {/* Dynamic Header */}
      <div className="px-6 py-4 bg-[#0d0d0d] border-b border-white/5 flex flex-col gap-3 z-30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex bg-white/5 p-1 rounded-2xl shadow-inner border border-white/5">
            <button 
              onClick={() => onModeToggle(AIMode.CONVERSATIONAL)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.CONVERSATIONAL ? 'bg-green-600 text-white shadow-lg border border-green-500' : 'text-gray-500 hover:text-white'}`}
            >
              <MessagesSquare size={14} /> <span>Conversazione</span>
            </button>
            <button 
              onClick={() => onModeToggle(AIMode.LEARNING)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.LEARNING ? 'bg-blue-600 text-white shadow-lg border border-blue-500' : 'text-gray-500 hover:text-white'}`}
            >
              <GraduationCap size={14} /> <span>Studio</span>
            </button>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
            {validationStatus === 'checking' ? <Loader2 size={12} className="animate-spin text-blue-400" /> : validationStatus === 'valid' ? <CheckCircle2 size={12} className="text-green-500" /> : <Target size={12} className="text-gray-500" />}
            <span className="text-[10px] uppercase tracking-widest text-gray-500 font-black">
              {validationStatus === 'checking' ? 'Validando' : validationStatus === 'valid' ? 'Ottimo' : 'Tutor On'}
            </span>
          </div>
        </div>

        {/* Mission Card */}
        {isMissionVisible && (
          <div className="glass p-3 rounded-2xl border-white/10 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Target size={16} />
              </div>
              <p className="text-[11px] font-medium text-gray-300 italic pr-4">{activeMission.text}</p>
            </div>
            <button onClick={() => setIsMissionVisible(false)} className="p-1 hover:bg-white/5 rounded-lg text-gray-500"><X size={14} /></button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col no-scrollbar">
        {messages.length === 0 && (
          <div className="text-center mt-32 opacity-80 flex flex-col items-center">
            <div className="p-6 rounded-full bg-white/5 mb-6 border border-white/5 shadow-[0_0_30px_rgba(255,255,255,0.05)] animate-pulse-glow">
               <Sparkles size={48} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-montserrat mb-2 text-white">Buongiorno, {profile.name}!</h1>
            <p className="max-w-xs mx-auto text-sm text-gray-400 leading-relaxed">Il tuo coach {profile.voiceId} è pronto. Iniziamo con un saluto semplice?</p>
          </div>
        )}
        
        {messages.map((m, idx) => (
          <div key={m.id} className="flex flex-col animate-in slide-in-from-bottom-2 duration-300">
            <div className={`bubble ${m.role === 'user' ? (profile.mode === AIMode.CONVERSATIONAL ? 'bubble-user-green' : 'bubble-user-blue') : 'bubble-ai'}`}>
              <FormattedText text={m.content} />
            </div>
            <div className={`flex items-center gap-2 px-2 pb-4 text-[9px] uppercase font-black tracking-widest opacity-30 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              {m.role === 'user' && <Check size={10} />}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="bubble bubble-ai flex items-center gap-2 px-4 py-3">
            <span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span>
          </div>
        )}
      </div>

      {/* Modern Input Bar */}
      <div className="p-4 bg-[#0d0d0d] border-t border-white/5 relative z-40">
        {suggestion && (
          <div className="absolute left-4 right-4 bottom-full mb-4 animate-in slide-in-from-bottom-4">
            <div className="glass-dark border border-green-500/30 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
                  <Wand2 size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-black text-green-500 mb-0.5">Suggerimento</p>
                  <p className="text-sm text-white/90 truncate italic font-medium">"{suggestion}"</p>
                </div>
              </div>
              <button onClick={applyCorrection} className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-green-900/30 active:scale-95">USA</button>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button 
            onClick={() => onThinkingToggle(!useThinking)}
            className={`p-3.5 rounded-2xl transition-all border ${useThinking ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 'bg-white/5 text-gray-500 border-white/5'}`}
          >
            <BrainCircuit size={20} />
          </button>
          
          <div className="flex-1 relative">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Scrivi in italiano..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-6 outline-none focus:border-green-500 transition-all text-[15px] text-white shadow-inner"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim()}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all ${input.trim() ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-white/10'}`}
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
