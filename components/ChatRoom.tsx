
import React, { useState, useRef, useEffect } from 'react';
import { Message, UserProfile, AIMode, Scenario, NoteItem } from '../types';
import { gemini } from '../services/geminiService';
import { 
  Send, 
  Sparkles, 
  X, 
  Loader2, 
  Tent,
  ChevronRight,
  Globe,
  PencilLine,
  Plus,
  Trash2,
  Zap
} from 'lucide-react';

interface ChatRoomProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isTyping: boolean;
  profile: UserProfile;
  onThinkingToggle: (enabled: boolean) => void;
  useThinking: boolean;
  onModeToggle: (mode: AIMode) => void;
  onUpdateProfile: (p: UserProfile) => void;
  notes: NoteItem[];
  setNotes: React.Dispatch<React.SetStateAction<NoteItem[]>>;
}

const SCENARIOS: Scenario[] = [
  { id: 'cafe', title: 'Al Bar', description: 'Ordering breakfast in a busy Milanese cafe.', icon: '☕', goal: 'Order a macchiato and a croissant while asking about the local newspaper.' },
  { id: 'lost', title: 'Perso in Città', description: 'Asking for directions in Venice without GPS.', icon: '🗺️', goal: 'Find the Rialto Bridge and ask where the nearest pharmacy is.' },
  { id: 'dinner', title: 'A Cena', description: 'Booking a table for a special occasion.', icon: '🍝', goal: 'Book a table for 4 tonight, near the window, and mention a gluten allergy.' }
];

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|💡 .*?\n)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**')) return <strong key={i} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*')) return <em key={i} className="italic text-blue-300 opacity-90">{part.slice(1, -1)}</em>;
        if (part.startsWith('💡')) return <div key={i} className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 my-2 text-xs">{part}</div>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

const ChatRoom: React.FC<ChatRoomProps> = ({ 
  messages, onSendMessage, isTyping, profile, onThinkingToggle, useThinking, onModeToggle, onUpdateProfile, notes, setNotes
}) => {
  const [input, setInput] = useState('');
  const [showScenarios, setShowScenarios] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isToolLoading, setIsToolLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, isTyping]);

  const handleSend = () => { if (input.trim()) { onSendMessage(input); setInput(''); } };

  const selectScenario = (s: Scenario | null) => {
    onUpdateProfile({ ...profile, activeScenario: s });
    setShowScenarios(false);
    if (s) onSendMessage(`Iniziamo la missione: ${s.title}`);
  };

  const addNote = () => {
    if (newNote.trim()) {
      setNotes(prev => [...prev, { id: Date.now().toString(), content: newNote, timestamp: Date.now() }]);
      setNewNote('');
    }
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const getRegionalSecret = async () => {
    if (isToolLoading) return;
    setIsToolLoading(true);
    const prompt = `Tell me a very rare regional slang or cultural secret from your region. Be witty and brief. Start with 💎 **Segreto Regionale**`;
    try {
      await onSendMessage(prompt);
    } finally {
      setIsToolLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden view-enter relative">
      {/* Top Controls */}
      <div className="px-6 py-4 bg-[#0d0d0d] border-b border-white/5 flex flex-col gap-3 z-30">
        <div className="flex items-center justify-between">
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
            <button onClick={() => onModeToggle(AIMode.CONVERSATIONAL)} className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.CONVERSATIONAL ? 'bg-green-600 text-white' : 'text-gray-500'}`}>Conversazione</button>
            <button onClick={() => onModeToggle(AIMode.LEARNING)} className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.LEARNING ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Studio</button>
          </div>
        </div>
        {profile.activeScenario && (
          <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="text-xl">{profile.activeScenario.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-amber-500 uppercase">Missione: {profile.activeScenario.title}</p>
                <p className="text-[11px] text-gray-300 truncate italic">"{profile.activeScenario.goal}"</p>
              </div>
            </div>
            <button onClick={() => selectScenario(null)} className="p-1 text-amber-500/50 hover:text-amber-500"><X size={14} /></button>
          </div>
        )}
      </div>

      {/* Scenarios Panel */}
      {showScenarios && (
        <div className="absolute inset-x-0 bottom-[100px] z-50 p-4 mx-4 bg-[#0d0d0d]/95 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Scegli una Missione</h3>
            <button onClick={() => setShowScenarios(false)} className="text-gray-500"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {SCENARIOS.map(s => (
              <button key={s.id} onClick={() => selectScenario(s)} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all text-left group">
                <span className="text-2xl group-hover:scale-110 transition-transform">{s.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{s.title}</p>
                  <p className="text-[10px] text-gray-500">{s.description}</p>
                </div>
                <ChevronRight size={16} className="text-gray-700" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes Panel Overlay */}
      {showNotes && (
        <div className="absolute inset-y-0 right-0 w-80 z-[100] bg-[#0d0d0d]/95 backdrop-blur-2xl border-l border-white/10 p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                 <PencilLine size={20} className="text-indigo-400" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-white">Appunti di Studio</h3>
              </div>
              <button onClick={() => setShowNotes(false)} className="p-2 text-gray-500 hover:text-white"><X size={20} /></button>
           </div>
           
           <div className="flex flex-col gap-3 mb-6">
              <div className="relative">
                 <input 
                   type="text" value={newNote} 
                   onChange={(e) => setNewNote(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && addNote()}
                   placeholder="Aggiungi un obiettivo..."
                   className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-indigo-500 text-xs"
                 />
                 <button onClick={addNote} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 rounded-lg text-white">
                    <Plus size={14} />
                 </button>
              </div>
              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter text-center">L'AI vedrà questi appunti per aiutarti</p>
           </div>

           <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
              {notes.map(note => (
                 <div key={note.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 group relative hover:border-indigo-500/30 transition-all">
                    <p className="text-[13px] text-gray-200 leading-relaxed italic">"{note.content}"</p>
                    <button 
                      onClick={() => deleteNote(note.id)}
                      className="absolute top-2 right-2 p-1.5 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                 </div>
              ))}
              {notes.length === 0 && (
                <div className="h-40 flex flex-col items-center justify-center text-center opacity-20 gap-3">
                   <Sparkles size={32} />
                   <p className="text-[10px] font-black uppercase tracking-widest">Nessun appunto</p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col no-scrollbar">
        {messages.length === 0 && (
          <div className="text-center mt-32 opacity-80 flex flex-col items-center">
            <div className="p-8 rounded-full bg-white/5 mb-6 border border-white/5 animate-pulse-glow"><Sparkles size={48} className="text-green-500" /></div>
            <h1 className="text-2xl font-montserrat text-white">Pronto, {profile.name}?</h1>
            <p className="text-sm text-gray-400 mt-2">Inizia a scrivere o scegli una missione per testare il tuo italiano.</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} mb-4 animate-in slide-in-from-bottom-2`}>
            <div className={`bubble ${m.role === 'user' ? 'bubble-user-blue' : 'bubble-ai shadow-2xl shadow-black/40'}`}>
              <FormattedText text={m.content} />
              {m.role === 'ai' && m.translation && (
                <div className="mt-3 pt-2 border-t border-white/5 animate-in fade-in duration-700 flex flex-col gap-1.5">
                   <div className="flex items-center gap-1.5 opacity-40">
                      <Globe size={10} className="text-blue-400" />
                      <span className="text-[9px] font-black uppercase tracking-widest">Traduzione</span>
                   </div>
                   <p className="text-[11px] text-gray-400 italic font-medium leading-relaxed">"{m.translation}"</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex flex-col items-start mb-4 animate-in slide-in-from-bottom-2">
            <div className="bubble bubble-ai typing-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-[#0d0d0d] border-t border-white/5 z-40">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="flex gap-2">
            <button 
              onClick={() => setShowNotes(!showNotes)} 
              className={`p-3.5 rounded-2xl transition-all border ${showNotes ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/20' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
              title="Notes"
            >
              <PencilLine size={20} />
            </button>
            <button 
              onClick={() => setShowScenarios(!showScenarios)} 
              className={`p-3.5 rounded-2xl transition-all border ${profile.activeScenario || showScenarios ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-900/20' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}
              title="Scenarios"
            >
              <Tent size={20} />
            </button>
          </div>

          <div className="flex-1 relative">
            <input 
              type="text" value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Messaggio in italiano..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-6 outline-none focus:border-green-500 text-white"
            />
            <button onClick={handleSend} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all ${input.trim() ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/10'}`}>
              <Send size={18} />
            </button>
          </div>

          <button 
            onClick={getRegionalSecret} 
            disabled={isToolLoading}
            className={`p-3.5 rounded-2xl transition-all border ${isToolLoading ? 'bg-amber-500/20 text-amber-500 border-amber-500 animate-pulse' : 'bg-white/5 text-amber-500 border-white/5 hover:bg-amber-500/10'}`} 
            title="Regional Secret"
          >
            {isToolLoading ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
