
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { UserProfile, AIMode } from '../types';
import { gemini } from '../services/geminiService';
import { 
  Mic, 
  PhoneOff, 
  ChevronRight, 
  ChevronLeft,
  Volume2,
  User,
  Bot,
  VolumeX,
  Loader2,
  X as CloseIcon,
  Sliders,
  MapPin,
  Quote,
  Sparkles,
  Zap,
  BookOpen
} from 'lucide-react';

interface VoiceModeProps {
  onClose: () => void;
  profile: UserProfile;
  onModeToggle: (mode: AIMode) => void;
  onUpdateProfile: (profile: UserProfile) => void;
}

interface TranscriptionLine {
  role: 'Tu' | 'AI';
  text: string;
}

const VOICE_NAMES_MAPPING: Record<string, { api: string, accent: string, desc: string, acting: string, theme: any, culturalFact: string }> = {
  'Giulia': { 
    api: 'Zephyr', 
    accent: 'Romana', 
    desc: 'Calda, veloce, amichevole e un po\' ironica.',
    acting: "Native ROMAN (Giulia). Double consonants ('a ccasa'), elide 're' (annà). Slang: 'daje', 'mo'.",
    theme: { primary: '#FFD700', secondary: '#8B0000', pulse: 'rgba(255, 215, 0, 0.1)' },
    culturalFact: "A Roma, 'daje' non è solo un saluto, è uno stato d'animo: incoraggiamento, gioia, o semplice conferma!"
  },
  'Alessandro': { 
    api: 'Puck', 
    accent: 'Milanese', 
    desc: 'Professionale, ritmico, energico e puntuale.',
    acting: "Native MILANESE (Alessandro). Fast, rhythmic. Slang: 'uè', 'taaac', 'figo'.",
    theme: { primary: '#00BFFF', secondary: '#4682B4', pulse: 'rgba(0, 191, 255, 0.1)' },
    culturalFact: "A Milano l'aperitivo è sacro: è il momento in cui il lavoro lascia spazio alla socialità (e allo spritz)."
  },
  'Giuseppe': { 
    api: 'Charon', 
    accent: 'Siciliano', 
    desc: 'Profondo, espressivo e fiero delle sue radici.',
    acting: "Native SICILIAN (Giuseppe). Retroflex 'll'/'tr'. Melodic. Slang: 'bedda', 'amunì'.",
    theme: { primary: '#FFCC00', secondary: '#E60000', pulse: 'rgba(255, 204, 0, 0.1)' },
    culturalFact: "In Sicilia, la colazione con granita e brioche è una religione estiva."
  },
  'Alessandra': { 
    api: 'Kore', 
    accent: 'Napoletana', 
    desc: 'Melodica, solare e piena di energia.',
    acting: "Native NEAPOLITAN (Alessandra). Schwas, 's' -> 'sh'. Slang: 'Marò!', 'Azz!'.",
    theme: { primary: '#12A5E0', secondary: '#FFFFFF', pulse: 'rgba(18, 165, 224, 0.1)' },
    culturalFact: "A Napoli il caffè è 'sospeso': ne paghi due per lasciarne uno a chi non può permetterselo."
  },
  'Luca': { 
    api: 'Fenrir', 
    accent: 'Toscano', 
    desc: 'Elegante, preciso e appassionato della lingua.',
    acting: "Native TUSCAN (Luca). Aspirated 'c' (hoha hola). Refined and witty.",
    theme: { primary: '#008C45', secondary: '#8B4513', pulse: 'rgba(0, 140, 69, 0.1)' },
    culturalFact: "Il Toscano è la culla dell'Italiano: qui Dante, Petrarca e Boccaccio hanno forgiato la nostra lingua."
  }
};

const VoiceMode: React.FC<VoiceModeProps> = ({ onClose, profile, onModeToggle, onUpdateProfile }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Connessione...');
  const [transcriptions, setTranscriptions] = useState<TranscriptionLine[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [showFact, setShowFact] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const analyserOutputRef = useRef<AnalyserNode | null>(null);
  const analyserInputRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isMutedRef = useRef(false);

  const voiceKeys = Object.keys(VOICE_NAMES_MAPPING);
  const [currentVoiceKey, setCurrentVoiceKey] = useState<string>(() => {
    return voiceKeys.find(key => VOICE_NAMES_MAPPING[key].api === profile.voiceId) || 'Luca';
  });

  const currentVoiceData = VOICE_NAMES_MAPPING[currentVoiceKey];

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [transcriptions]);

  const createPcmBlob = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
    return { data: gemini.encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
  };

  const drawWaveform = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = 128;
    const dataArrayIn = new Uint8Array(bufferLength);
    const dataArrayOut = new Uint8Array(bufferLength);
    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      if (analyserInputRef.current) analyserInputRef.current.getByteTimeDomainData(dataArrayIn);
      if (analyserOutputRef.current) analyserOutputRef.current.getByteTimeDomainData(dataArrayOut);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = currentVoiceData.theme.primary;
      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const vIn = (dataArrayIn[i] / 128.0) - 1;
        const vOut = (dataArrayOut[i] / 128.0) - 1;
        const v = (Math.abs(vIn) > Math.abs(vOut) ? vIn : vOut) * 2;
        const y = (v * canvas.height / 2) + (canvas.height / 2);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
    };
    render();
  }, [currentVoiceData]);

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let stream: MediaStream | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;
    let inputCtx: AudioContext | null = null;
    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputCtx;
        analyserInputRef.current = inputCtx.createAnalyser();
        analyserOutputRef.current = outputCtx.createAnalyser();
        analyserOutputRef.current.connect(outputCtx.destination);
        drawWaveform();
        const personaPrompt = `You are ${currentVoiceKey}. ${currentVoiceData.acting}. Goal: Practice Italian with intensity ${profile.accentIntensity}/100. Keep responses natural and very short.`;
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: currentVoiceData.api } } },
            systemInstruction: personaPrompt
          },
          callbacks: {
            onopen: () => {
              setStatus(`${currentVoiceKey} Live`);
              setIsActive(true);
              const source = inputCtx!.createMediaStreamSource(stream!);
              source.connect(analyserInputRef.current!);
              scriptProcessor = inputCtx!.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                if (isMutedRef.current) return;
                const pcmBlob = createPcmBlob(e.inputBuffer.getChannelData(0));
                sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx!.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
              const handleTranscription = (role: 'Tu' | 'AI', newText: string) => {
                if (!newText || newText.trim() === '') return;
                setTranscriptions(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === role) {
                    const needsSpace = last.text.length > 0 && !last.text.endsWith(' ') && !newText.startsWith(' ');
                    return [...prev.slice(0, -1), { ...last, text: last.text + (needsSpace ? ' ' : '') + newText }];
                  }
                  return [...prev, { role, text: newText.trim() }];
                });
              };
              if (msg.serverContent?.inputTranscription) handleTranscription('Tu', msg.serverContent.inputTranscription.text);
              if (msg.serverContent?.outputTranscription) handleTranscription('AI', msg.serverContent.outputTranscription.text);
              const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (audio) {
                const buffer = await gemini.decodeAudioData(gemini.decode(audio), outputCtx, 24000);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const source = outputCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(analyserOutputRef.current!); 
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              }
              if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onclose: () => setIsActive(false),
            onerror: () => setStatus('Errore')
          }
        });
        sessionRef.current = await sessionPromise;
      } catch (e) { setStatus('Permessi negati'); }
    };
    init();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (scriptProcessor) scriptProcessor.disconnect();
      if (inputCtx) inputCtx.close();
      if (sessionRef.current) sessionRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [currentVoiceKey, profile.mode, profile.accentIntensity]);

  const selectVoice = (key: string) => {
    if (key === currentVoiceKey) return;
    setCurrentVoiceKey(key);
    onUpdateProfile({ ...profile, voiceId: VOICE_NAMES_MAPPING[key].api });
    setTranscriptions([]);
    setShowFact(true);
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center overflow-hidden view-enter bg-[#050505]">
      {/* Immersive Pulse Background */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-in-out"
        style={{ background: `radial-gradient(circle at 50% 10%, ${currentVoiceData.theme.pulse}, transparent 80%)` }}
      />
      <div className="absolute inset-0 pointer-events-none animate-pulse-glow opacity-30" 
           style={{ background: `radial-gradient(circle at 50% 80%, ${currentVoiceData.theme.pulse}, transparent 60%)` }} />

      {/* Top Controls */}
      <div className="w-full flex items-center justify-between p-6 pt-8 relative z-10 shrink-0">
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl border border-white/5 text-gray-400 hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
          <button onClick={() => onModeToggle(AIMode.CONVERSATIONAL)} className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.CONVERSATIONAL ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500'}`}>Chat</button>
          <button onClick={() => onModeToggle(AIMode.LEARNING)} className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.LEARNING ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>Study</button>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(true); }} 
          className="p-3 bg-white/5 rounded-2xl border border-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <Sliders size={20} />
        </button>
      </div>

      {/* Hero Region Info */}
      <div className="w-full max-w-2xl px-6 flex flex-col items-center gap-6 relative z-10 shrink-0 mt-2">
        <div className="flex items-center gap-10">
          <button onClick={() => selectVoice(voiceKeys[(voiceKeys.indexOf(currentVoiceKey) - 1 + voiceKeys.length) % voiceKeys.length])} className="text-gray-600 hover:text-white transition-colors">
            <ChevronLeft size={32} />
          </button>
          <div className="text-center">
            <h2 className="text-4xl sm:text-5xl font-montserrat text-white uppercase tracking-tighter" style={{ textShadow: `0 0 30px ${currentVoiceData.theme.primary}40` }}>{currentVoiceKey}</h2>
            <div className="flex items-center justify-center gap-2 text-[10px] uppercase font-black tracking-widest text-green-500 mt-2">
              <MapPin size={12} /> {currentVoiceData.accent}
            </div>
          </div>
          <button onClick={() => selectVoice(voiceKeys[(voiceKeys.indexOf(currentVoiceKey) + 1) % voiceKeys.length])} className="text-gray-600 hover:text-white transition-colors">
            <ChevronRight size={32} />
          </button>
        </div>

        {/* Dynamic Waveform Visualizer */}
        <div className="w-full h-20 sm:h-24 glass rounded-[2.5rem] relative overflow-hidden border-white/10 shadow-inner">
          <canvas ref={canvasRef} width={800} height={150} className="w-full h-full opacity-60" />
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
              <Loader2 className="animate-spin text-white/40" size={24} />
            </div>
          )}
        </div>

        {/* Cultural Fact Card */}
        {showFact && (
          <div className="w-full glass-dark p-4 rounded-3xl border-white/5 flex items-start gap-3 animate-in fade-in zoom-in-95 max-w-lg">
            <div className="p-2 rounded-xl bg-green-500/10 text-green-400 mt-0.5 shrink-0"><Zap size={16} /></div>
            <div className="flex-1">
              <p className="text-[10px] uppercase font-black text-gray-500 mb-1">Lo sapevi?</p>
              <p className="text-sm text-gray-300 leading-snug">{currentVoiceData.culturalFact}</p>
            </div>
            <button onClick={() => setShowFact(false)} className="text-gray-500 hover:text-white shrink-0"><CloseIcon size={16} /></button>
          </div>
        )}
      </div>

      {/* Transcription area */}
      <div className="flex-1 w-full max-w-2xl px-6 overflow-hidden mt-6 relative z-10">
        <div ref={scrollContainerRef} className="h-full overflow-y-auto no-scrollbar space-y-4 pb-4 pr-2">
          {transcriptions.map((t, i) => (
            <div key={i} className={`flex w-full animate-in slide-in-from-bottom-2 ${t.role === 'Tu' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[90%] ${t.role === 'Tu' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${t.role === 'Tu' ? 'bg-blue-600 text-white' : 'bg-white/10 text-green-500 border border-white/10'}`}>
                  {t.role === 'Tu' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`bubble ${t.role === 'Tu' ? 'bubble-user-blue' : 'bubble-ai glass'} !text-[14px] sm:!text-[15px]`}>
                  {t.text}
                </div>
              </div>
            </div>
          ))}
          {transcriptions.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-30">
              <Sparkles size={40} className="mb-4 text-green-500" />
              <p className="font-montserrat uppercase tracking-[0.2em] text-[10px]">Connessione sicura...</p>
            </div>
          )}
        </div>
      </div>

      {/* Call UI - Optimized to sit within the layout, not covering siblings */}
      <div className="w-full p-6 flex items-center justify-center gap-8 relative z-40 shrink-0 bg-gradient-to-t from-black to-transparent">
        <button 
          onClick={() => setIsMuted(!isMuted)} 
          className={`p-4 sm:p-5 rounded-[1.8rem] transition-all border-2 ${isMuted ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'bg-white/5 border-white/10 text-gray-400'}`}
        >
          {isMuted ? <VolumeX size={22} /> : <Mic size={22} />}
        </button>

        <button 
          onClick={onClose} 
          className="p-5 sm:p-6 rounded-[2.2rem] bg-red-600 text-white shadow-[0_10px_40px_rgba(220,38,38,0.4)] active:scale-90 border-b-4 border-red-800"
        >
          <PhoneOff size={28} />
        </button>
      </div>

      {/* Local Settings Modal Layered Above VoiceMode UI */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-[110] bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in">
          <div className="w-full max-w-sm h-full bg-[#0d0d0d] border-l border-white/10 p-8 flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-2xl font-montserrat uppercase text-white/90">Personalizza</h3>
              <button 
                onClick={() => setIsSettingsOpen(false)} 
                className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>
            
            <div className="space-y-10">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Intensità Dialetto</label>
                  <span className="text-xs font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-lg">{profile.accentIntensity}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={profile.accentIntensity}
                  onChange={(e) => onUpdateProfile({ ...profile, accentIntensity: parseInt(e.target.value) })}
                  className="w-full accent-blue-500 bg-white/10 h-2 rounded-full cursor-pointer"
                />
                <div className="flex justify-between text-[8px] text-gray-600 font-black uppercase tracking-widest px-1">
                  <span>Standard</span>
                  <span>Marcato</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="mt-auto w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-blue-900/20 active:scale-95"
            >
              Applica Modifiche
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceMode;
