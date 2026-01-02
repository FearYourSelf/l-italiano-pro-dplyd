
import React, { useState, useEffect, useRef } from 'react';
import { AppView, Message, ChatTab, UserProfile, MemoryItem, NoteItem, AIMode, AIBehaviorType, StudyPlanData } from './types';
import { gemini } from './services/geminiService';
import ChatRoom from './components/ChatRoom';
import VoiceMode from './components/VoiceMode';
import Scanner from './components/Scanner';
import StudyPlan from './components/StudyPlan';
import Walkthrough from './components/Walkthrough';
import { 
  MessageSquare, 
  Mic, 
  Scan, 
  BookOpen, 
  Plus, 
  X,
  User as UserIcon,
  LayoutGrid,
  Trash2,
  PlayCircle,
  Loader2,
  Archive,
  ArchiveRestore,
  Settings2,
  Brain,
  Info,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PanelLeftClose,
  PanelLeft,
  Languages,
  Zap,
  Award,
  Sparkles,
  UserCircle,
  Briefcase,
  Target,
  Trophy,
  History,
  Pencil,
  Volume2,
  Crown,
  HelpCircle
} from 'lucide-react';

const INITIAL_PROFILE: UserProfile = {
  name: "User",
  occupation: "Learner",
  behaviorType: AIBehaviorType.FRIENDLY,
  customBehavior: "Helpful, witty, and corrections-focused. Uses common Italian slang.",
  language: "English",
  voiceId: "Fenrir",
  mode: AIMode.LEARNING,
  goal: "Learn colloquial Italian for traveling",
  accentIntensity: 50
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>(AppView.CHAT);
  const [tabs, setTabs] = useState<ChatTab[]>(() => {
    const saved = localStorage.getItem('italiano_tabs');
    return saved ? JSON.parse(saved) : [{ id: '1', title: 'Sessione Iniziale', messages: [], archived: false }];
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    const saved = localStorage.getItem('italiano_tabs');
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed?.find((t: any) => !t.archived)?.id || (parsed?.[0]?.id) || '1';
  });
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('italiano_profile');
    return saved ? JSON.parse(saved) : INITIAL_PROFILE;
  });
  const [memories, setMemories] = useState<MemoryItem[]>(() => {
    const saved = localStorage.getItem('italiano_memories');
    return saved ? JSON.parse(saved) : [];
  });
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const saved = localStorage.getItem('italiano_notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [studyPlan, setStudyPlan] = useState<StudyPlanData | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [showTutorial, setShowTutorial] = useState(() => {
    return localStorage.getItem('italiano_tutorial_completed') !== 'true';
  });
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    localStorage.setItem('italiano_tabs', JSON.stringify(tabs));
    localStorage.setItem('italiano_profile', JSON.stringify(profile));
    localStorage.setItem('italiano_memories', JSON.stringify(memories));
    localStorage.setItem('italiano_notes', JSON.stringify(notes));
  }, [tabs, profile, memories, notes]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs.find(t => !t.archived) || tabs[0];
  const activeTabs = tabs.filter(t => !t.archived);
  const archivedTabs = tabs.filter(t => t.archived);

  const handleSendMessage = async (text: string) => {
    const userMsgId = Date.now().toString();
    const newUserMessage: Message = { id: userMsgId, role: 'user', content: text, timestamp: Date.now() };
    
    setTabs(prev => prev.map(tab => tab.id === activeTabId ? { ...tab, messages: [...tab.messages, newUserMessage] } : tab));
    setIsTyping(true);

    const aiMsgId = (Date.now() + 1).toString();
    let currentAiText = "";

    try {
      const history = activeTab.messages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const stream = gemini.chatStream(text, history, profile, memories, notes, useThinking);
      
      let isFirstChunk = true;
      for await (const chunk of stream) {
        if (isFirstChunk) {
          setIsTyping(false);
          const initialAiMessage: Message = { id: aiMsgId, role: 'ai', content: "", timestamp: Date.now() };
          setTabs(prev => prev.map(tab => tab.id === activeTabId ? { ...tab, messages: [...tab.messages, initialAiMessage] } : tab));
          isFirstChunk = false;
        }

        currentAiText += chunk;
        setTabs(prev => prev.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, messages: tab.messages.map(m => m.id === aiMsgId ? { ...m, content: currentAiText } : m) } 
            : tab
        ));
      }

      // Memory processing
      const memoryMatch = currentAiText.match(/\[\[MEMORY: (.*?)=(.*?)(?:\|context=(.*?))?\]\]/);
      let finalText = currentAiText;
      if (memoryMatch) {
        const key = memoryMatch[1].trim();
        const value = memoryMatch[2].trim();
        const context = memoryMatch[3] ? memoryMatch[3].trim() : "Stored during conversation.";
        finalText = currentAiText.replace(memoryMatch[0], '').trim();
        
        setTabs(prev => prev.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, messages: tab.messages.map(m => m.id === aiMsgId ? { ...m, content: finalText } : m) } 
            : tab
        ));

        setMemories(prev => {
           const existing = prev.findIndex(m => m.key.toLowerCase() === key.toLowerCase());
           if (existing !== -1) {
             const updated = [...prev]; updated[existing] = { ...updated[existing], value, context };
             return updated;
           }
           return [...prev, { key, value, importance: 1, context }];
        });
      }

      if (profile.mode === AIMode.LEARNING) {
        const translation = await gemini.translateLine(finalText);
        setTabs(prev => prev.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, messages: tab.messages.map(m => m.id === aiMsgId ? { ...m, translation } : m) } 
            : tab
        ));
      }

    } catch (err) { 
      console.error(err); 
      setIsTyping(false);
    } finally { 
      setIsTyping(false); 
    }
  };

  const createNewTab = () => {
    const newTab = { id: Date.now().toString(), title: `Conversazione ${tabs.length + 1}`, messages: [], archived: false };
    setTabs([...tabs, newTab]); 
    setActiveTabId(newTab.id); 
    setIsSidebarOpen(false); 
    setActiveView(AppView.CHAT);
  };

  const archiveTab = (id: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, archived: true } : t));
    if (activeTabId === id) {
      const remaining = tabs.filter(t => t.id !== id && !t.archived);
      if (remaining.length > 0) setActiveTabId(remaining[0].id);
      else createNewTab();
    }
  };

  const deleteTab = (id: string) => {
    setTabs(prev => prev.filter(t => t.id !== id));
    if (activeTabId === id) {
      const remaining = tabs.filter(t => t.id !== id && !t.archived);
      if (remaining.length > 0) setActiveTabId(remaining[0].id);
      else createNewTab();
    }
  };

  const unarchiveTab = (id: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, archived: false } : t));
    setActiveTabId(id);
    setActiveView(AppView.CHAT);
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('italiano_tutorial_completed', 'true');
    setActiveView(AppView.CHAT);
    setTutorialStep(0);
  };

  const startTutorial = () => {
    setTutorialStep(0);
    setActiveView(AppView.CHAT);
    setShowTutorial(true);
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden relative font-inter">
      <div className="absolute top-0 left-0 w-full h-[3px] z-50 italian-accent opacity-60"></div>
      {showTutorial && <Walkthrough currentStep={tutorialStep} onStepChange={setTutorialStep} onClose={closeTutorial} onViewChange={setActiveView} />}
      
      <div className={`fixed inset-y-0 left-0 z-[60] lg:z-30 bg-[#0d0d0d] border-r border-white/5 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isSidebarCollapsed ? 'lg:w-24' : 'lg:w-72'} w-72`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-10">
            {!isSidebarCollapsed && <h1 className="text-xl font-montserrat tracking-tight"><span className="text-green-500">L'Italiano</span> Pro</h1>}
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden lg:block p-2 text-gray-500 hover:bg-white/5 rounded-xl transition-all">
              {isSidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2"><X /></button>
          </div>
          
          <button onClick={createNewTab} className={`flex items-center gap-3 bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 mb-8 transition-all group ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <Plus size={20} className="text-green-500 group-hover:rotate-90 transition-transform" /> 
            {!isSidebarCollapsed && <span className="text-sm font-bold uppercase tracking-widest">Nuova Chat</span>}
          </button>
          
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
            {activeTabs.map(tab => (
              <div key={tab.id} className="group relative">
                <div 
                  onClick={() => { setActiveTabId(tab.id); setActiveView(AppView.CHAT); setIsSidebarOpen(false); }}
                  className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${activeTabId === tab.id && activeView === AppView.CHAT ? 'bg-white/10 border-white/10 shadow-lg' : 'hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare size={18} className={activeTabId === tab.id ? 'text-green-500' : 'text-gray-500'} />
                    {!isSidebarCollapsed && <span className="truncate text-sm font-medium">{tab.title}</span>}
                  </div>
                  
                  {!isSidebarCollapsed && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); archiveTab(tab.id); }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-blue-400"
                      >
                        <Archive size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteTab(tab.id); }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-auto pt-6 border-t border-white/5 space-y-2">
            <div onClick={() => { setActiveView(AppView.SETTINGS); setIsSidebarOpen(false); }} className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all hover:bg-white/5 ${activeView === AppView.SETTINGS ? 'bg-white/10 border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.03)]' : ''}`}>
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <UserIcon size={20} />
              </div>
              {!isSidebarCollapsed && <div className="flex flex-col"><span className="text-sm font-bold">{profile.name}</span><span className="text-[10px] uppercase font-black tracking-widest text-gray-500">Profilo Pro</span></div>}
            </div>
          </div>
        </div>
      </div>

      <main className={`flex-1 flex flex-col relative bg-[#050505] transition-all duration-500 ${isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-72'}`}>
        <div className="lg:hidden flex items-center justify-between p-4 bg-[#0a0a0a] border-b border-white/5 z-40">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/5 rounded-xl"><LayoutGrid size={22} /></button>
          <span className="font-montserrat text-xs tracking-[0.3em] font-black uppercase">L'Italiano Pro</span>
          <button onClick={() => setActiveView(AppView.SETTINGS)} className="p-2 bg-white/5 rounded-xl"><UserIcon size={22} /></button>
        </div>
        
        <div className="flex-1 relative overflow-hidden">
          {activeView === AppView.CHAT && <ChatRoom messages={activeTab?.messages || []} onSendMessage={handleSendMessage} isTyping={isTyping} profile={profile} onThinkingToggle={setUseThinking} useThinking={useThinking} onModeToggle={(mode) => setProfile({...profile, mode})} onUpdateProfile={setProfile} notes={notes} setNotes={setNotes} />}
          {activeView === AppView.VOICE && <VoiceMode onClose={() => setActiveView(AppView.CHAT)} profile={profile} onModeToggle={(mode) => setProfile({...profile, mode})} onUpdateProfile={setProfile} notes={notes} setNotes={setNotes} />}
          {activeView === AppView.SCAN && <Scanner profile={profile} />}
          {activeView === AppView.STUDY_PLAN && <StudyPlan profile={profile} studyPlan={studyPlan} onRefresh={async () => { const p = await gemini.generateStudyPlan(profile, memories); setStudyPlan(p); }} onUpdateProfile={setProfile} />}
          {activeView === AppView.SETTINGS && (
            <SettingsPanel 
              profile={profile} 
              memories={memories} 
              onUpdate={setProfile} 
              onUpdateMemories={setMemories} 
              archivedTabs={archivedTabs} 
              onUnarchive={unarchiveTab} 
              onDelete={deleteTab} 
              onStartTutorial={startTutorial} 
            />
          )}
        </div>
        
        <nav className="flex items-center justify-around py-4 bg-[#0d0d0d] border-t border-white/5 shrink-0 z-50 safe-area-inset-bottom">
          <NavButton active={activeView === AppView.CHAT} onClick={() => setActiveView(AppView.CHAT)} icon={<MessageSquare size={24} />} label="Chat" />
          <NavButton active={activeView === AppView.VOICE} onClick={() => setActiveView(AppView.VOICE)} icon={<Mic size={24} />} label="Voice" />
          <NavButton active={activeView === AppView.SCAN} onClick={() => setActiveView(AppView.SCAN)} icon={<Scan size={24} />} label="Scan" />
          <NavButton active={activeView === AppView.STUDY_PLAN} onClick={() => setActiveView(AppView.STUDY_PLAN)} icon={<BookOpen size={24} />} label="Learn" />
        </nav>
      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all relative ${active ? 'text-green-500 scale-110' : 'text-gray-500 hover:text-white'}`}>
    {active && <span className="absolute -top-1 w-1 h-1 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e]"></span>}
    {icon}
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const SettingsPanel = ({ profile, memories, onUpdate, onUpdateMemories, archivedTabs, onUnarchive, onDelete, onStartTutorial }: any) => {
  const slangItems = memories.filter((m: any) => m.key.toLowerCase().includes('slang') || m.key.toLowerCase().includes('idiom') || m.key.toLowerCase().includes('regional'));
  const personalMemories = memories.filter((m: any) => !slangItems.includes(m));
  
  return (
    <div className="max-w-xl mx-auto p-6 pt-10 space-y-10 h-full overflow-y-auto no-scrollbar pb-32 view-enter">
      <div className="flex flex-col items-center text-center gap-4 mb-12">
        <div className="relative group">
          <div className="w-28 h-28 rounded-[2.5rem] bg-gradient-to-tr from-green-600 via-white/20 to-blue-600 p-1 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
            <div className="w-full h-full rounded-[2.3rem] bg-[#0d0d0d] flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50"></div>
               <span className="text-4xl font-montserrat font-black text-white relative z-10">{profile.name.charAt(0).toUpperCase()}</span>
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2.5 rounded-2xl border-4 border-[#050505] shadow-xl"><Crown size={18} /></div>
        </div>
        <div className="mt-2">
          <h2 className="text-3xl font-montserrat tracking-tight text-white mb-1">{profile.name}</h2>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] bg-green-500/10 text-green-400 px-3 py-1 rounded-full font-black tracking-widest border border-green-500/20 uppercase">PRO MEMBER</span>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full font-black tracking-widest border border-indigo-500/20 uppercase">MASTER LEARNER</span>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-500 mb-2 pl-2"><HelpCircle size={16} className="text-amber-500" /> Supporto</div>
        <button onClick={onStartTutorial} className="w-full flex items-center justify-between p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] group hover:bg-amber-500/20 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform"><Sparkles size={24} /></div>
            <div className="text-left"><p className="text-sm font-bold text-white">Tour Guidato</p><p className="text-[10px] text-amber-500/60 font-black uppercase tracking-widest">Rivedi le funzioni dell'app</p></div>
          </div>
          <ChevronRight className="text-amber-500 group-hover:translate-x-1 transition-transform" />
        </button>
      </section>

      {/* Archived Vault */}
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2 pl-2">
          <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-500">
            <Archive size={16} className="text-blue-400" /> Archivio Sessioni
          </div>
          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full font-black border border-blue-500/20 uppercase tracking-widest">{archivedTabs.length} Chat</span>
        </div>
        
        <div className="grid gap-3">
          {archivedTabs.map((tab: any) => (
            <div key={tab.id} className="p-5 bg-white/5 rounded-[2rem] border border-white/5 flex items-center justify-between group hover:border-blue-500/30 transition-all">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500">
                  <History size={20} />
                </div>
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="text-sm font-bold text-white truncate">{tab.title}</span>
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{tab.messages.length} Messaggi</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => onUnarchive(tab.id)} 
                  className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-2xl transition-all"
                  title="Ripristina"
                >
                  <ArchiveRestore size={18} />
                </button>
                <button 
                  onClick={() => onDelete(tab.id)} 
                  className="p-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-2xl transition-all"
                  title="Elimina"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {archivedTabs.length === 0 && (
            <div className="p-12 text-center bg-white/2 rounded-[2.5rem] border border-dashed border-white/5">
               <Archive size={32} className="text-gray-800 mx-auto mb-4" />
               <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">L'archivio è vuoto.</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-500 mb-2 pl-2"><UserCircle size={16} className="text-green-500" /> Identità</div>
        <div className="grid gap-4 p-6 bg-white/5 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="space-y-2 relative z-10">
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest pl-2">Il Tuo Nome</label>
            <div className="relative group">
              <input type="text" value={profile.name} onChange={(e) => onUpdate({ ...profile, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-12 outline-none focus:border-green-500 focus:bg-white/10 transition-all text-[15px] text-white" placeholder="Inserisci il tuo nome" />
              <Pencil className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-green-500 transition-colors" size={18} />
            </div>
          </div>
          <div className="space-y-2 relative z-10">
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest pl-2">Occupazione</label>
            <div className="relative group">
              <input type="text" value={profile.occupation} onChange={(e) => onUpdate({ ...profile, occupation: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-12 outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-[15px] text-white" placeholder="Cosa fai?" />
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" size={18} />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2 pl-2">
          <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-500"><Zap size={16} className="text-amber-500" /> Slang Vault</div>
          <span className="text-[10px] bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full font-black border border-amber-500/20">{slangItems.length} ESPRESSIONI</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {slangItems.map((mem: any, i: number) => (
            <div key={i} className="p-5 bg-gradient-to-br from-amber-500/5 to-transparent border border-amber-500/10 rounded-[2rem] group relative hover:border-amber-500/30 transition-all flex items-center justify-between">
              <div className="flex flex-col gap-1 min-w-0 pr-4"><span className="text-[9px] font-black text-amber-500/50 uppercase tracking-tighter truncate">{mem.key}</span><span className="text-[16px] font-black text-white leading-tight italic">"{mem.value}"</span></div>
              <button onClick={() => onUpdateMemories(memories.filter((m: any) => m !== mem))} className="p-2 text-gray-700 hover:text-red-500 transition-colors bg-white/5 rounded-xl opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default App;
