import React, { useState, useEffect, useRef } from 'react';
import { AppView, Message, ChatTab, UserProfile, MemoryItem, AIMode, AIBehaviorType, StudyPlanData } from './types';
import { gemini } from './services/geminiService';
import ChatRoom from './components/ChatRoom';
import VoiceMode from './components/VoiceMode';
import Scanner from './components/Scanner';
import StudyPlan from './components/StudyPlan';
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
  Save,
  GraduationCap,
  MessagesSquare,
  PlayCircle,
  Loader2,
  Archive,
  RotateCcw,
  ArchiveRestore,
  Settings2,
  Cpu,
  Brain,
  Target,
  Info,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  MapPin,
  Quote,
  PanelLeftClose,
  PanelLeft,
  Columns
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

const VOICE_NAMES_MAPPING: Record<string, { api: string, region: string, characteristics: string, phrases: string }> = {
  'Giulia': { 
    api: 'Zephyr', 
    region: 'Rome', 
    characteristics: "Warm, witty, and slightly cynical. Uses double consonants ('a ccasa') and elides verb endings ('fà' for 'fare').",
    phrases: "daje, mo, n'attimo, mejo"
  },
  'Alessandro': { 
    api: 'Puck', 
    region: 'Milan', 
    characteristics: "Fast-paced, rhythmic, and professional. Features very closed 'e' sounds and a 'managerial' energetic cadence.",
    phrases: "uè, taaac, figo, sbatti"
  },
  'Giuseppe': { 
    api: 'Charon', 
    region: 'Sicily', 
    characteristics: "Deep, melodic, and expressive. Features retroflex 'll' and 'tr' sounds; 'o' often sounds like 'u'.",
    phrases: "bedda, amunì, chi bbiè"
  },
  'Alessandra': { 
    api: 'Kore', 
    region: 'Naples', 
    characteristics: "Highly musical and solar. Final vowels often become neutral schwas; 's' is pronounced like 'sh' before consonants.",
    phrases: "Marò!, uè guagliò, jamme, azz!"
  },
  'Luca': { 
    api: 'Fenrir', 
    region: 'Standard/Florence', 
    characteristics: "Refined, precise, and academic. Features the 'Gorgia Toscana' (aspirated 'c' sounds like 'h').",
    phrases: "la hoha hola (accent), punto"
  }
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>(AppView.CHAT);
  const [tabs, setTabs] = useState<ChatTab[]>(() => {
    const saved = localStorage.getItem('italiano_tabs');
    return saved ? JSON.parse(saved) : [{ id: '1', title: 'Welcome!', messages: [], archived: false }];
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    const activeOnes = tabs.filter(t => !t.archived);
    return activeOnes.length > 0 ? activeOnes[0].id : tabs[0].id;
  });
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('italiano_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.behaviorType) parsed.behaviorType = AIBehaviorType.FRIENDLY;
      if (parsed.behavior && !parsed.customBehavior) parsed.customBehavior = parsed.behavior;
      if (parsed.accentIntensity === undefined) parsed.accentIntensity = 50;
      return parsed;
    }
    return INITIAL_PROFILE;
  });
  const [memories, setMemories] = useState<MemoryItem[]>(() => {
    const saved = localStorage.getItem('italiano_memories');
    return saved ? JSON.parse(saved) : [];
  });
  const [studyPlan, setStudyPlan] = useState<StudyPlanData | null>(() => {
    const saved = localStorage.getItem('italiano_studyplan');
    return saved ? JSON.parse(saved) : null;
  });
  const [isTyping, setIsTyping] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    localStorage.setItem('italiano_tabs', JSON.stringify(tabs));
    localStorage.setItem('italiano_profile', JSON.stringify(profile));
    localStorage.setItem('italiano_memories', JSON.stringify(memories));
    if (studyPlan) localStorage.setItem('italiano_studyplan', JSON.stringify(studyPlan));
  }, [tabs, profile, memories, studyPlan]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs.filter(t => !t.archived)[0] || tabs[0];
  const activeTabs = tabs.filter(t => !t.archived);
  const archivedTabs = tabs.filter(t => t.archived);

  const handleSendMessage = async (text: string) => {
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    const updatedTabs = tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, messages: [...tab.messages, newUserMessage] }
        : tab
    );
    setTabs(updatedTabs);
    setIsTyping(true);

    try {
      const history = activeTab.messages.map(m => ({
        role: m.role === 'ai' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const rawAiResponse = await gemini.chat(text, history, profile, memories, activeTabId, tabs, useThinking);
      
      let cleanResponse = rawAiResponse;
      const memoryMatch = rawAiResponse.match(/\[\[MEMORY: (.*?)=(.*?)(?:\|context=(.*?))?\]\]/);
      if (memoryMatch) {
        const key = memoryMatch[1].trim();
        const value = memoryMatch[2].trim();
        const context = memoryMatch[3] ? memoryMatch[3].trim() : "Stored during conversation.";
        cleanResponse = rawAiResponse.replace(memoryMatch[0], '').trim();
        
        setMemories(prev => {
           const existing = prev.findIndex(m => m.key.toLowerCase() === key.toLowerCase());
           if (existing !== -1) {
             const updated = [...prev];
             updated[existing] = { ...updated[existing], value, context };
             return updated;
           }
           return [...prev, { key, value, importance: 1, context }];
        });
      }

      const newAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: cleanResponse,
        timestamp: Date.now()
      };

      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, messages: [...tab.messages, newAiMessage] }
          : tab
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const updateStudyPlan = async () => {
    setIsTyping(true);
    try {
      const plan = await gemini.generateStudyPlan(profile, memories);
      setStudyPlan(plan);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  const createNewTab = () => {
    const newTab: ChatTab = {
      id: Date.now().toString(),
      title: `Session ${tabs.length + 1}`,
      messages: [],
      archived: false
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setIsSidebarOpen(false);
    setActiveView(AppView.CHAT);
  };

  const deleteTab = (id: string) => {
    const filtered = tabs.filter(t => t.id !== id);
    if (filtered.length === 0) {
      const resetTab = { id: Date.now().toString(), title: 'New Session', messages: [], archived: false };
      setTabs([resetTab]);
      setActiveTabId(resetTab.id);
    } else {
      setTabs(filtered);
      if (activeTabId === id) {
        const nextActive = filtered.find(t => !t.archived) || filtered[0];
        setActiveTabId(nextActive.id);
      }
    }
  };

  const archiveTab = (id: string) => {
    const updated = tabs.map(t => t.id === id ? { ...t, archived: true } : t);
    setTabs(updated);
    if (activeTabId === id) {
      const nextActive = updated.find(t => !t.archived);
      if (nextActive) setActiveTabId(nextActive.id);
      else createNewTab();
    }
  };

  const unarchiveTab = (id: string) => {
    const updated = tabs.map(t => t.id === id ? { ...t, archived: false } : t);
    setTabs(updated);
  };

  const toggleMode = (mode: AIMode) => {
    setProfile(p => ({ ...p, mode }));
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-[3px] z-50 italian-accent"></div>

      {/* Sidebar Overlay for Mobile */}
      <div className={`
        fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden
        ${isSidebarOpen ? 'block' : 'hidden'}
      `} onClick={() => setIsSidebarOpen(false)}></div>

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 lg:z-30 bg-[#0d0d0d] flex flex-col border-r border-white/5 transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}
        w-72
      `}>
        <div className="flex flex-col h-full p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-8 px-2 shrink-0">
            {!isSidebarCollapsed && (
              <h1 className="text-xl font-montserrat tracking-tight flex items-center gap-2 truncate">
                <span className="text-green-500">L'Italiano</span> Pro
              </h1>
            )}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                className="hidden lg:flex p-2 hover:bg-white/10 rounded-xl text-gray-400 bg-white/5 border border-white/5 shadow-sm"
              >
                {isSidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
              </button>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2"><X /></button>
            </div>
          </div>

          <button 
            onClick={createNewTab}
            className={`
              flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors p-3 rounded-xl border border-white/10 mb-6 text-sm font-medium shrink-0
              ${isSidebarCollapsed ? 'justify-center' : ''}
            `}
          >
            <Plus size={18} /> 
            {!isSidebarCollapsed && <span className="truncate">New Conversation</span>}
          </button>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
            {!isSidebarCollapsed && <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold px-2 mb-2">Conversations</p>}
            {activeTabs.map(tab => (
              <div 
                key={tab.id}
                onClick={() => { setActiveTabId(tab.id); setActiveView(AppView.CHAT); setIsSidebarOpen(false); }}
                className={`
                  group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all
                  ${activeTabId === tab.id && activeView === AppView.CHAT ? 'bg-white/10 border border-white/10 shadow-lg' : 'hover:bg-white/5'}
                  ${isSidebarCollapsed ? 'justify-center' : ''}
                `}
                title={tab.title}
              >
                <div className={`flex items-center gap-3 overflow-hidden ${isSidebarCollapsed ? '' : 'flex-1'}`}>
                  <MessageSquare size={16} className={activeTabId === tab.id && activeView === AppView.CHAT ? 'text-green-500' : 'text-gray-500'} />
                  {!isSidebarCollapsed && <span className="truncate text-sm font-medium">{tab.title}</span>}
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); archiveTab(tab.id); }}
                      className="p-1 hover:text-blue-400 transition-all"
                      title="Archive"
                    >
                      <Archive size={14} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteTab(tab.id); }}
                      className="p-1 hover:text-red-500 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-white/5 space-y-2 shrink-0">
             <div 
              onClick={() => { setActiveView(AppView.SETTINGS); setIsSidebarOpen(false); }}
              className={`flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors ${activeView === AppView.SETTINGS ? 'bg-white/10 border border-white/10' : ''} ${isSidebarCollapsed ? 'justify-center' : ''}`}
             >
                <UserIcon size={18} className="text-gray-400" />
                {!isSidebarCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{profile.name}</span>
                    <span className="text-[10px] text-gray-500 truncate">{memories.length} facts remembered</span>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col relative overflow-hidden bg-[#050505] transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-[#0a0a0a] border-b border-white/5 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-1"><LayoutGrid size={24} /></button>
          <span className="font-montserrat text-sm tracking-widest">L'ITALIANO PRO</span>
          <button onClick={() => setActiveView(AppView.SETTINGS)} className="p-1"><UserIcon size={24} /></button>
        </div>

        {/* View Container */}
        <div className="flex-1 relative overflow-hidden">
          {activeView === AppView.CHAT && (
            <ChatRoom 
              messages={activeTab.messages} 
              onSendMessage={handleSendMessage}
              isTyping={isTyping}
              profile={profile}
              onThinkingToggle={setUseThinking}
              useThinking={useThinking}
              onModeToggle={toggleMode}
            />
          )}
          {activeView === AppView.VOICE && (
            <VoiceMode 
              onClose={() => setActiveView(AppView.CHAT)} 
              profile={profile} 
              onModeToggle={toggleMode}
              onUpdateProfile={(p) => setProfile(p)}
            />
          )}
          {activeView === AppView.SCAN && (
            <Scanner profile={profile} />
          )}
          {activeView === AppView.STUDY_PLAN && (
            <StudyPlan profile={profile} studyPlan={studyPlan} onRefresh={updateStudyPlan} onUpdateProfile={setProfile} />
          )}
          {activeView === AppView.SETTINGS && (
            <SettingsPanel 
              profile={profile} 
              memories={memories} 
              onUpdate={setProfile} 
              onUpdateMemories={setMemories}
              archivedTabs={archivedTabs}
              onUnarchive={unarchiveTab}
              onDelete={deleteTab}
            />
          )}
        </div>

        {/* Bottom Navigation */}
        <nav className="flex items-center justify-around py-3 bg-[#0d0d0d] border-t border-white/5 shrink-0 z-10">
          <NavButton 
            active={activeView === AppView.CHAT} 
            onClick={() => setActiveView(AppView.CHAT)}
            icon={<MessageSquare size={22} />}
            label="Chat"
          />
          <NavButton 
            active={activeView === AppView.VOICE} 
            onClick={() => setActiveView(AppView.VOICE)}
            icon={<Mic size={22} />}
            label="Voice"
          />
          <NavButton 
            active={activeView === AppView.SCAN} 
            onClick={() => setActiveView(AppView.SCAN)}
            icon={<Scan size={22} />}
            label="Scan"
          />
          <NavButton 
            active={activeView === AppView.STUDY_PLAN} 
            onClick={() => setActiveView(AppView.STUDY_PLAN)}
            icon={<BookOpen size={22} />}
            label="Learn"
          />
        </nav>
      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-green-500 scale-110' : 'text-gray-500 hover:text-white'}`}
  >
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
  </button>
);

interface SettingsPanelProps {
  profile: UserProfile;
  memories: MemoryItem[];
  onUpdate: (p: UserProfile) => void;
  onUpdateMemories: (m: MemoryItem[]) => void;
  archivedTabs: ChatTab[];
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  profile, 
  memories, 
  onUpdate, 
  onUpdateMemories,
  archivedTabs,
  onUnarchive,
  onDelete
}) => {
  const [newMemKey, setNewMemKey] = useState('');
  const [newMemVal, setNewMemVal] = useState('');
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [selectedMemoryIndex, setSelectedMemoryIndex] = useState<number | null>(null);

  const addMemory = () => {
    if (newMemKey && newMemVal) {
      onUpdateMemories([...memories, { key: newMemKey, value: newMemVal, importance: 1, context: "Added manually by user." }]);
      setNewMemKey('');
      setNewMemVal('');
    }
  };

  const removeMemory = (idx: number) => {
    onUpdateMemories(memories.filter((_, i) => i !== idx));
    if (selectedMemoryIndex === idx) setSelectedMemoryIndex(null);
  };

  const previewVoice = async (apiVoiceName: string) => {
    setPreviewing(apiVoiceName);
    try {
      const base64Audio = await gemini.generateSpeech("Ciao! Come va? Io sono la tua voce per imparare l'italiano.", apiVoiceName);
      if (base64Audio) {
        await gemini.playRawPCM(base64Audio);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewing(null);
    }
  };

  const behaviorPresets = [
    { type: AIBehaviorType.FRIENDLY, label: 'Friendly Tutor', desc: 'Patient and helpful.' },
    { type: AIBehaviorType.STRICT, label: 'Strict Teacher', desc: 'Focus on perfect grammar.' },
    { type: AIBehaviorType.CASUAL, label: 'Conversation Partner', desc: 'Slang and casual chat.' },
    { type: AIBehaviorType.CUSTOM, label: 'Custom Persona', desc: 'Define your own AI.' }
  ];

  return (
    <div className="max-w-xl mx-auto p-8 space-y-8 h-full overflow-y-auto no-scrollbar pb-32 relative">
      <h2 className="text-3xl font-montserrat flex items-center gap-3">
        <Settings2 className="text-green-500" /> Settings
      </h2>

      {selectedMemoryIndex !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] w-full max-w-sm rounded-3xl border border-white/10 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
             <button onClick={() => setSelectedMemoryIndex(null)} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors">
               <X size={20} />
             </button>
             <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400">
                  <Brain size={24} />
                </div>
                <div>
                   <h4 className="text-sm uppercase font-bold text-gray-500 tracking-widest">Memory Insights</h4>
                   <p className="text-white font-bold">{memories[selectedMemoryIndex].key}</p>
                </div>
             </div>
             <div className="space-y-4">
                <div>
                   <p className="text-[10px] uppercase font-bold text-blue-500 mb-1">Why is this important?</p>
                   <p className="text-sm text-gray-300 leading-relaxed italic border-l-2 border-blue-500/30 pl-3">
                     "{memories[selectedMemoryIndex].context || 'Information relevant to your learning journey.'}"
                   </p>
                </div>
                <button 
                  onClick={() => setSelectedMemoryIndex(null)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95 mt-2"
                >
                  Got it!
                </button>
             </div>
          </div>
        </div>
      )}
      
      <section className="space-y-6">
        <h3 className="text-lg font-bold flex items-center gap-2 border-b border-white/5 pb-2">
          <UserIcon size={20} className="text-green-500" /> User Profile
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">Name</label>
            <input 
              type="text" 
              value={profile.name}
              onChange={(e) => onUpdate({ ...profile, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-green-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">Occupation</label>
            <input 
              type="text" 
              value={profile.occupation}
              onChange={(e) => onUpdate({ ...profile, occupation: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none focus:border-green-500"
            />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-lg font-bold flex items-center gap-2 border-b border-white/5 pb-2">
          <Mic size={20} className="text-green-500" /> Voices & Regional Accents
        </h3>
        <p className="text-xs text-gray-500 mb-4 px-1">Choose a native coach based on the region whose accent and idioms you want to learn.</p>
        <div className="grid grid-cols-1 gap-6">
          {Object.entries(VOICE_NAMES_MAPPING).map(([italianName, data]) => (
            <div key={italianName} className="space-y-2">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onUpdate({ ...profile, voiceId: data.api })}
                  className={`flex-1 p-4 rounded-2xl border transition-all text-left flex justify-between items-center ${profile.voiceId === data.api ? 'bg-green-600/20 border-green-500 shadow-lg shadow-green-900/10' : 'bg-white/5 border-white/10 hover:border-white/30'}`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-black">{italianName}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-black flex items-center gap-1">
                      <MapPin size={10} /> {data.region}
                    </span>
                  </div>
                  {profile.voiceId === data.api && (
                    <div className="bg-green-500 text-[9px] px-2 py-0.5 rounded-full font-black text-white uppercase animate-pulse">
                      Native Selected
                    </div>
                  )}
                </button>
                <button 
                  onClick={() => previewVoice(data.api)}
                  disabled={previewing === data.api}
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-blue-400 disabled:opacity-50 border border-white/5"
                >
                  {previewing === data.api ? <Loader2 className="animate-spin" size={18} /> : <PlayCircle size={18} />}
                </button>
              </div>
              <div className="px-1 py-1 flex items-start gap-2 bg-white/2 rounded-xl border border-white/5">
                <div className="p-1.5 rounded-lg bg-white/5 text-gray-500 mt-0.5"><Info size={12} /></div>
                <div className="flex-1 pb-1">
                  <p className="text-[11px] text-gray-400 leading-tight">
                    <span className="text-gray-300 font-bold uppercase text-[9px]">Traits:</span> {data.characteristics}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Quote size={10} className="text-green-500/40 shrink-0" />
                    <p className="text-[10px] text-green-500/80 font-mono italic">
                      {data.phrases}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-lg font-bold flex items-center gap-2 border-b border-white/5 pb-2">
          <Cpu size={20} className="text-indigo-400" /> AI Personality
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {behaviorPresets.map((preset) => (
            <button 
              key={preset.type}
              onClick={() => onUpdate({ ...profile, behaviorType: preset.type })}
              className={`
                p-4 rounded-2xl border text-left transition-all
                ${profile.behaviorType === preset.type 
                  ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-600/10' 
                  : 'bg-white/5 border-white/10 hover:border-white/30'}
              `}
            >
              <div className="text-sm font-bold mb-1">{preset.label}</div>
              <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">{preset.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Brain size={20} className="text-blue-500" /> Memory Bank
          </h3>
        </div>
        <div className="space-y-3">
          {memories.map((mem, i) => (
            <div key={i} className="group relative flex items-center justify-between p-4 bg-[#1a1a1a] rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all shadow-lg">
              <div className="flex items-start gap-3 min-w-0 pr-12">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider block">{mem.key}</span>
                  <span className="text-sm text-gray-200 block truncate">{mem.value}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setSelectedMemoryIndex(i)} className="p-2 text-gray-500 hover:text-blue-400"><Info size={16} /></button>
                <button onClick={() => removeMemory(i)} className="p-2 text-gray-500 hover:text-red-500"><X size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="text-lg font-bold flex items-center gap-2 border-b border-white/5 pb-2">
          <Archive size={20} className="text-amber-500" /> Conversation Archive
        </h3>
        <div className="space-y-2">
          {archivedTabs.map((tab) => (
            <div key={tab.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="text-sm flex flex-col min-w-0">
                <span className="font-bold text-gray-300 truncate">{tab.title}</span>
                <span className="text-[10px] text-gray-500">{tab.messages.length} messages</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onUnarchive(tab.id)} className="p-2 text-blue-400"><ArchiveRestore size={18} /></button>
                <button onClick={() => onDelete(tab.id)} className="p-2 text-red-500"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default App;