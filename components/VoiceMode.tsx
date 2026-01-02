
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { UserProfile, AIMode } from '../types';
import { gemini } from '../services/geminiService';
import { 
  Mic, 
  PhoneOff, 
  AudioWaveform, 
  GraduationCap, 
  MessagesSquare, 
  ChevronRight, 
  ChevronLeft,
  Volume2,
  AlertCircle,
  User,
  Bot,
  VolumeX,
  Languages,
  ArrowRight,
  Loader2,
  BookOpen,
  X as CloseIcon,
  Sliders,
  MapPin,
  Quote,
  Sparkles
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

const VOICE_NAMES_MAPPING: Record<string, { api: string, accent: string, desc: string, acting: string, theme: any }> = {
  'Giulia': { 
    api: 'Zephyr', 
    accent: 'Romana', 
    desc: 'Calda, veloce, amichevole e un po\' ironica.',
    acting: "Native ROMAN (Giulia). Double consonants ('a ccasa'), elide 're' (annà). Slang: 'daje', 'mo'.",
    theme: { primary: '#FFD700', secondary: '#8B0000' }
  },
  'Alessandro': { 
    api: 'Puck', 
    accent: 'Milanese', 
    desc: 'Professionale, ritmico, energico e puntuale.',
    acting: "Native MILANESE (Alessandro). Fast, rhythmic. Slang: 'uè', 'taaac', 'sbatti'.",
    theme: { primary: '#00BFFF', secondary: '#708090' }
  },
  'Giuseppe': { 
    api: 'Charon', 
    accent: 'Siciliano', 
    desc: 'Profondo, espressivo e fiero delle sue radici.',
    acting: "Native SICILIAN (Giuseppe). Retroflex 'll'/'tr'. Melodic. Slang: 'bedda', 'amunì'.",
    theme: { primary: '#FFCC00', secondary: '#E60000' }
  },
  'Alessandra': { 
    api: 'Kore', 
    accent: 'Napoletana', 
    desc: 'Melodica, solare e piena di energia.',
    acting: "Native NEAPOLITAN (Alessandra). Schwas, 's' -> 'sh'. Slang: 'Marò!', 'Azz!'.",
    theme: { primary: '#12A5E0', secondary: '#FFFFFF' }
  },
  'Luca': { 
    api: 'Fenrir', 
    accent: 'Toscano', 
    desc: 'Elegante, preciso e appassionato della lingua.',
    acting: "Native TUSCAN (Luca). Aspirated 'c' (hoha hola). Refined and witty.",
    theme: { primary: '#008C45', secondary: '#FFFFFF' }
  }
};

const VoiceMode: React.FC<VoiceModeProps> = ({ onClose, profile, onModeToggle, onUpdateProfile }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Connessione...');
  const [transcriptions, setTranscriptions] = useState<TranscriptionLine[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);

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
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcriptions]);

  const createPcmBlob = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: gemini.encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
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
      const theme = currentVoiceData.theme;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      
      const layers = [
        { scale: 1.0, alpha: 0.9, color: theme.primary },
        { scale: 0.6, alpha: 0.5, color: theme.secondary }
      ];

      layers.forEach((layer) => {
        ctx.beginPath();
        ctx.strokeStyle = layer.color;
        ctx.globalAlpha = layer.alpha;
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const vIn = (dataArrayIn[i] / 128.0) - 1;
          const vOut = (dataArrayOut[i] / 128.0) - 1;
          const v = (Math.abs(vIn) > Math.abs(vOut) ? vIn : vOut) * layer.scale * 1.5;
          const y = (v * canvas.height / 2) + (canvas.height / 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      });
    };
    render();
  }, [currentVoiceData]);

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
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

        const personaPrompt = `You are ${currentVoiceKey}. ${currentVoiceData.acting}. 
        GOAL: Practice Italian. 
        ACCENT INTENSITY: ${profile.accentIntensity}/100. 
        (If intensity is low, speak standard English. If high, speak English with a very heavy, thick regional Italian accent). 
        Keep responses natural and short.`;

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
              setStatus(`${currentVoiceKey} Online`);
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

              if (msg.serverContent?.inputTranscription) {
                const text = msg.serverContent.inputTranscription.text;
                if (text) handleTranscription('Tu', text);
              }
              if (msg.serverContent?.outputTranscription) {
                const text = msg.serverContent.outputTranscription.text;
                if (text) handleTranscription('AI', text);
              }

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
  }, [currentVoiceKey, profile.mode, profile.accentIntensity]); // Reconnect when accent intensity changes

  const selectVoice = (key: string) => {
    if (key === currentVoiceKey) return;
    setCurrentVoiceKey(key);
    onUpdateProfile({ ...profile, voiceId: VOICE_NAMES_MAPPING[key].api });
    setTranscriptions([]);
  };

  const playDemo = async () => {
    if (isPlayingDemo) return;
    setIsPlayingDemo(true);
    try {
      const b64 = await gemini.generateSpeech("Ciao! Pronti per un po' di pratica?", VOICE_NAMES_MAPPING[currentVoiceKey].api);
      if (b64) await gemini.playRawPCM(b64);
    } finally { setIsPlayingDemo(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col items-center overflow-hidden">
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 transition-all duration-1000"
        style={{ background: `radial-gradient(circle at 50% 0%, ${currentVoiceData.theme.primary}, transparent 70%)` }}
      />

      {/* Top Navigation */}
      <div className="w-full flex items-center justify-between p-6 relative z-10">
        <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5">
          <ChevronLeft size={24} />
        </button>
        
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
          <button 
            onClick={() => onModeToggle(AIMode.CONVERSATIONAL)} 
            className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.CONVERSATIONAL ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500'}`}
          >
            Conversazione
          </button>
          <button 
            onClick={() => onModeToggle(AIMode.LEARNING)} 
            className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.LEARNING ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}
          >
            Studio
          </button>
        </div>

        <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-3 bg-white/5 rounded-2xl border border-white/5 text-gray-400">
          <Sliders size={20} />
        </button>
      </div>

      {/* Hero Section */}
      <div className="w-full max-w-2xl px-6 flex flex-col items-center gap-6 relative z-10 mt-4">
        <div className="flex items-center gap-8">
          <button onClick={() => selectVoice(voiceKeys[(voiceKeys.indexOf(currentVoiceKey) - 1 + voiceKeys.length) % voiceKeys.length])} className="text-gray-600 hover:text-white transition-colors">
            <ChevronLeft size={32} />
          </button>
          <div className="text-center">
            <h2 className="text-5xl font-montserrat text-white uppercase tracking-tighter" style={{ textShadow: `0 0 40px ${currentVoiceData.theme.primary}50` }}>
              {currentVoiceKey}
            </h2>
            <div className="flex items-center justify-center gap-2 text-[10px] uppercase font-black tracking-widest text-gray-500 mt-2">
              <MapPin size={12} className="text-green-500" />
              {currentVoiceData.accent}
            </div>
          </div>
          <button onClick={() => selectVoice(voiceKeys[(voiceKeys.indexOf(currentVoiceKey) + 1) % voiceKeys.length])} className="text-gray-600 hover:text-white transition-colors">
            <ChevronRight size={32} />
          </button>
        </div>

        <div className="w-full h-24 glass rounded-[2.5rem] relative overflow-hidden border border-white/10 shadow-inner">
          <canvas ref={canvasRef} width={800} height={150} className="w-full h-full" />
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <Loader2 className="animate-spin text-white/40" size={28} />
            </div>
          )}
        </div>

        <div className="w-full flex items-center justify-between px-6 py-4 glass border-white/5 rounded-3xl">
          <div className="flex items-center gap-3">
            <Quote size={16} className="text-green-500 opacity-40" />
            <p className="text-sm text-gray-300 italic font-medium">{currentVoiceData.desc}</p>
          </div>
          <button onClick={playDemo} disabled={isPlayingDemo} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-blue-400">
            {isPlayingDemo ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      {/* Transcription List */}
      <div className="flex-1 w-full max-w-2xl px-4 overflow-hidden mt-8 relative z-10">
        <div 
          ref={scrollContainerRef}
          className="h-full overflow-y-auto no-scrollbar space-y-4 pb-24 px-2"
        >
          {transcriptions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
              <Sparkles size={48} className="mb-4" />
              <p className="text-lg font-montserrat uppercase tracking-widest">Inizia a parlare...</p>
            </div>
          ) : (
            transcriptions.map((t, i) => (
              <div 
                key={i} 
                className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${t.role === 'Tu' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[85%] ${t.role === 'Tu' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${t.role === 'Tu' ? 'bg-blue-600 text-white' : 'bg-white/10 text-green-500 border border-white/10'}`}>
                    {t.role === 'Tu' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`flex flex-col ${t.role === 'Tu' ? 'items-end' : 'items-start'}`}>
                    <div className={`bubble !p-4 !text-[15px] !rounded-[1.5rem] !leading-snug ${t.role === 'Tu' ? 'bubble-user-blue' : 'bubble-ai glass'}`}>
                      {t.text}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full p-8 flex items-center justify-center gap-12 relative z-20 bg-gradient-to-t from-black via-black/95 to-transparent">
        <button 
          onClick={() => setIsMuted(!isMuted)} 
          className={`p-7 rounded-[2.2rem] transition-all border-2 active:scale-95 ${isMuted ? 'bg-red-600/20 border-red-500 text-red-500 shadow-xl shadow-red-900/20' : 'bg-white/5 border-white/10 text-gray-400'}`}
          style={isActive && !isMuted ? { boxShadow: `0 0 50px ${currentVoiceData.theme.primary}30`, borderColor: `${currentVoiceData.theme.primary}40` } : {}}
        >
          {isMuted ? <VolumeX size={32} /> : <Mic size={32} />}
        </button>

        <button 
          onClick={onClose} 
          className="p-8 rounded-[2.5rem] bg-red-600 text-white shadow-2xl hover:bg-red-500 transition-all hover:scale-105 active:scale-95 border-b-4 border-red-800"
        >
          <PhoneOff size={38} />
        </button>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in">
          <div className="w-full max-w-sm h-full bg-[#0d0d0d] border-l border-white/10 p-8 flex flex-col animate-in slide-in-from-right-full duration-500">
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-2xl font-montserrat uppercase text-white/90">Personalizza</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white/5 rounded-xl"><CloseIcon /></button>
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
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceMode;
