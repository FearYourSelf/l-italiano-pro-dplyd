import React, { useEffect, useState, useRef } from 'react';
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

interface Correction {
  original: string;
  correct: string;
  phonetic: string;
  timestamp: number;
  tip?: string;
}

interface TranscriptionLine {
  role: string;
  text: string;
  isError?: boolean;
  correction?: Correction;
}

interface RegionTheme {
  primary: string;
  secondary: string;
  tertiary: string;
  glow: string;
}

interface PhoneticTip {
  sound: string;
  instruction: string;
  example: string;
}

const VOICE_NAMES_MAPPING: Record<string, { api: string, accent: string, desc: string, acting: string, theme: RegionTheme, phoneticGuide: PhoneticTip[] }> = {
  'Giulia': { 
    api: 'Zephyr', 
    accent: 'Romana', 
    desc: 'Calda, veloce, amichevole e un po\' ironica.',
    acting: "Embody a native ROMAN (Giulia). Phonetics: use 'raddoppiamento fonosintattico' (double consonants at word boundaries, e.g., 'a ccasa'), elide final 're' in verbs (annà, fà). Use 'j' instead of 'gli' (mejo). Use Roman slang: 'daje', 'mo', 'stai a scherzà'. Be street-smart, slightly cheeky, and witty. **IMPORTANT: If you speak English, you MUST maintain a very heavy, thick Roman-Italian accent. Use Italian rhythm and intonation. Do NOT sound like a native English speaker.**",
    theme: {
      primary: '#FFD700',
      secondary: '#8B0000',
      tertiary: '#FFFFFF',
      glow: 'rgba(255, 215, 0, 0.2)'
    },
    phoneticGuide: [
      { sound: "Raddoppiamento", instruction: "Double the first consonant if the previous word ends in a stressed vowel.", example: "A casa -> 'A ccasa'" },
      { sound: "Apocope", instruction: "Drop final '-re' of infinitives.", example: "Andare -> 'Annà'" },
      { sound: "Il 'Jod'", instruction: "Replace 'GLI' with a soft 'J' sound.", example: "Meglio -> 'Mejo'" }
    ]
  },
  'Alessandro': { 
    api: 'Puck', 
    accent: 'Milanese', 
    desc: 'Professionale, ritmico, energico e puntuale.',
    acting: "Embody a native MILANESE (Alessandro). Phonetics: close your 'e' sounds strictly, fast rhythmic tempo. Use 'uè', 'taaac', 'sbatti'. Reference fashion, efficiency, and aperitivo. Speak with high-energy entrepreneurial spirit. Use an upward inflection at the end of sentences occasionally. **IMPORTANT: If you speak English, you MUST maintain a very heavy, high-energy Milanese-Italian accent. Keep your speech fast and rhythmic with strong Italian inflection.**",
    theme: {
      primary: '#00BFFF',
      secondary: '#708090',
      tertiary: '#FFFFFF',
      glow: 'rgba(0, 191, 255, 0.2)'
    },
    phoneticGuide: [
      { sound: "E Chiusa", instruction: "Keep the 'E' sound tight and high.", example: "Perché (Sharp E)" },
      { sound: "Cadenza", instruction: "Speak with a constant, metronomic speed.", example: "Metronomic rhythm" },
      { sound: "S Sonora", instruction: "Intervocalic 'S' is always buzzing like a bee.", example: "Casa -> 'Ca-za'" }
    ]
  },
  'Giuseppe': { 
    api: 'Charon', 
    accent: 'Siciliano', 
    desc: 'Profondo, espressivo e fiero delle sue radici.',
    acting: "Embody a native SICILIAN (Giuseppe). Phonetics: retroflex 'll' and 'tr', final 'o' becomes 'u'. Strong emphasis on double consonants. Slow, melodic cadence with deep pitch. Use 'bedda', 'chi bbiè', 'amunì'. Invert subject-verb order occasionally (e.g., 'Siciliano sono'). Reference the sea and island pride. **IMPORTANT: If you speak English, you MUST maintain a very thick, slow, and melodic Sicilian-Italian accent. Roll your 'r's and emphasize consonants heavily.**",
    theme: {
      primary: '#FFCC00',
      secondary: '#E60000',
      tertiary: '#000000',
      glow: 'rgba(255, 204, 0, 0.2)'
    },
    phoneticGuide: [
      { sound: "Retroflessa 'LL'", instruction: "Tongue against the roof of the mouth.", example: "Bella -> 'Bedda'" },
      { sound: "Finale in 'U'", instruction: "Final 'O' endings shift toward 'U'.", example: "Uomo -> 'Omu'" },
      { sound: "TR Rotolata", instruction: "Pronounce 'TR' with a dry, retroflex tap.", example: "Treno -> 'Trrreno'" }
    ]
  },
  'Alessandra': { 
    api: 'Kore', 
    accent: 'Napoletana', 
    desc: 'Melodica, solare e piena di energia.',
    acting: "Embody a native NEAPOLITAN (Alessandra). Phonetics: final vowels become neutral schwas, extreme musical pitch range. Pronounce 's' before consonants as 'sh' (e.g., 'shcuola'). Use 'Marò!', 'Azz!', 'jamme', 'uè guagliò'. High energy, very solar, use expressive vocal exclamations and musicality. **IMPORTANT: If you speak English, you MUST maintain a very melodic and musical Neapolitan-Italian accent. Add an 'e' or 'a' sound to words ending in consonants where natural for the accent (e.g. 'work-a').**",
    theme: {
      primary: '#12A5E0',
      secondary: '#FFFFFF',
      tertiary: '#FFD700',
      glow: 'rgba(18, 165, 224, 0.2)'
    },
    phoneticGuide: [
      { sound: "Schwa (ə)", instruction: "Unstressed final vowels become a neutral 'uh' sound.", example: "Pizza -> 'Pizz-ə'" },
      { sound: "Sibilante 'SH'", instruction: "Pronounce 'S' as 'SH' before a consonant.", example: "Scuola -> 'Shcuola'" },
      { sound: "Musicalità", instruction: "Sing your words with high and low notes.", example: "Sing-song cadence" }
    ]
  },
  'Luca': { 
    api: 'Fenrir', 
    accent: 'Toscano', 
    desc: 'Elegante, preciso e appassionato della lingua.',
    acting: "Embody a TUSCAN/STANDARD Italian (Luca). Phonetics: aspirated 'c' between vowels (Gorgia Toscana: 'la hoha hola'). Use standard Italian with perfect grammar but a noble Tuscan tilt. You are cultured, refined, and slightly academic, but always witty. **IMPORTANT: If you speak English, you MUST maintain a refined, elegant Tuscan-Italian accent. Use aspirated sounds where characteristic and maintain clear Italian vowel quality.**",
    theme: {
      primary: '#008C45',
      secondary: '#FFFFFF',
      tertiary: '#CD212A',
      glow: 'rgba(0, 140, 69, 0.2)'
    },
    phoneticGuide: [
      { sound: "Gorgia Toscana", instruction: "Intervocalic 'C' becomes aspirated, sounding like 'H'.", example: "Coca Cola -> 'Hoha Hola'" },
      { sound: "GL Pulita", instruction: "Pronounce 'GLI' precisely with the middle of your tongue.", example: "Famiglia (Clear GL)" },
      { sound: "Doppie", instruction: "Emphasize double consonants for rhythm.", example: "Notte (Strong break)" }
    ]
  }
};

const VoiceMode: React.FC<VoiceModeProps> = ({ onClose, profile, onModeToggle, onUpdateProfile }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Pronto...');
  const [transcriptions, setTranscriptions] = useState<TranscriptionLine[]>([]);
  const [latestCorrection, setLatestCorrection] = useState<Correction | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const transcriptionsEndRef = useRef<HTMLDivElement>(null);
  
  const analyserOutputRef = useRef<AnalyserNode | null>(null);
  const analyserInputRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const voiceKeys = Object.keys(VOICE_NAMES_MAPPING);
  const [currentVoiceKey, setCurrentVoiceKey] = useState<string>(() => {
    return voiceKeys.find(key => VOICE_NAMES_MAPPING[key].api === profile.voiceId) || 'Luca';
  });

  const currentVoiceData = VOICE_NAMES_MAPPING[currentVoiceKey];

  useEffect(() => {
    transcriptionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const drawWaveform = () => {
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
        { scale: 0.6, alpha: 0.5, color: theme.secondary },
        { scale: 0.4, alpha: 0.3, color: '#FFFFFF' }
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
          else {
            const prevX = x - sliceWidth;
            const prevV = (i > 0) ? (Math.abs((dataArrayIn[i-1]/128.0)-1) > Math.abs((dataArrayOut[i-1]/128.0)-1) ? ((dataArrayIn[i-1]/128.0)-1) : ((dataArrayOut[i-1]/128.0)-1)) * layer.scale * 1.5 : 0;
            const prevY = (prevV * canvas.height / 2) + (canvas.height / 2);
            ctx.bezierCurveTo(prevX + sliceWidth/2, prevY, x - sliceWidth/2, y, x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
      });
      ctx.globalAlpha = 1.0;
    };
    render();
  };

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    let stream: MediaStream | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;

    const startSession = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const analyserIn = inputCtx.createAnalyser();
        analyserIn.fftSize = 256;
        analyserInputRef.current = analyserIn;
        
        const analyserOut = outputCtx.createAnalyser();
        analyserOut.fftSize = 256;
        analyserOutputRef.current = analyserOut;
        analyserOut.connect(outputCtx.destination);
        
        audioContextRef.current = outputCtx;
        drawWaveform();

        const personaPrompt = `You are ${currentVoiceKey}, a native Italian expert. 
        IDENTITY: ${currentVoiceData.acting} 
        LEVEL: ${profile.accentIntensity}/100. 
        ${profile.mode === AIMode.CONVERSATIONAL ? 'BE CASUAL AND BRIEF.' : 'BE A TUTOR AND PROVIDE PRONUNCIATION TAGS.'}
        IMPORTANT: Your accent must remain strong and distinctly Italian even when you switch to speaking English. This is critical for the user's immersive experience.`;

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: currentVoiceData.api } },
            },
            systemInstruction: personaPrompt
          },
          callbacks: {
            onopen: () => {
              setStatus(`${currentVoiceKey} online`);
              setIsActive(true);
              const source = inputCtx.createMediaStreamSource(stream!);
              source.connect(analyserIn);
              scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                if (isMuted) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                if (text) {
                  setTranscriptions(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'Tu') return [...prev.slice(0, -1), { ...last, text: last.text + " " + text }];
                    return [...prev, { role: 'Tu', text }];
                  });
                }
              }

              if (message.serverContent?.outputTranscription) {
                let text = message.serverContent.outputTranscription.text;
                if (text) {
                  const pronMatch = text.match(/\[\[PRONUNCIATION: (.*?) \| (.*?) \| (.*?)\]\]/);
                  if (pronMatch) {
                    setLatestCorrection({ 
                      original: pronMatch[1].trim(), 
                      correct: pronMatch[2].trim(), 
                      phonetic: pronMatch[3].trim(),
                      timestamp: Date.now()
                    });
                    text = text.replace(pronMatch[0], '').trim();
                  }
                  if (text) {
                    setTranscriptions(prev => {
                      const last = prev[prev.length - 1];
                      if (last && last.role === currentVoiceKey) return [...prev.slice(0, -1), { ...last, text: last.text + " " + text }];
                      return [...prev, { role: currentVoiceKey, text }];
                    });
                  }
                }
              }

              const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64EncodedAudioString) {
                const buffer = await gemini.decodeAudioData(gemini.decode(base64EncodedAudioString), outputCtx, 24000);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const source = outputCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(analyserOut); 
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onerror: () => setStatus('Errore'),
            onclose: () => setStatus('Connessione chiusa')
          }
        });
        sessionRef.current = await sessionPromise;
      } catch (err) {
        setStatus('Permesso negato');
      }
    };

    startSession();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (scriptProcessor) scriptProcessor.disconnect();
      if (sessionRef.current) sessionRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [profile.voiceId, profile.accentIntensity, isMuted, currentVoiceKey, profile.mode]);

  const selectVoice = (key: string) => {
    if (key === currentVoiceKey) return;
    setCurrentVoiceKey(key);
    onUpdateProfile({ ...profile, voiceId: VOICE_NAMES_MAPPING[key].api });
    setTranscriptions([]);
    setLatestCorrection(null);
  };

  const playDemo = async () => {
    if (isPlayingDemo) return;
    setIsPlayingDemo(true);
    try {
      const demoText = "Ciao! Io sono la tua voce per imparare l'italiano.";
      const base64 = await gemini.generateSpeech(demoText, VOICE_NAMES_MAPPING[currentVoiceKey].api);
      if (base64) await gemini.playRawPCM(base64);
    } finally {
      setIsPlayingDemo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col items-center overflow-hidden">
      {/* Background Polish */}
      <div 
        className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 transition-all duration-1000"
        style={{ 
          background: `radial-gradient(circle at 50% 0%, ${currentVoiceData.theme.primary}, transparent 70%)` 
        }}
      />

      {/* Header */}
      <div className="w-full flex items-center justify-between p-6 relative z-10 shrink-0">
        <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors backdrop-blur-md border border-white/5">
          <ChevronLeft size={24} />
        </button>
        
        <div className="flex bg-white/5 p-1 rounded-2xl backdrop-blur-md border border-white/5">
          <button 
            onClick={() => onModeToggle(AIMode.CONVERSATIONAL)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.CONVERSATIONAL ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <MessagesSquare size={14} /> <span className="hidden sm:inline">Conversazione</span>
          </button>
          <button 
            onClick={() => onModeToggle(AIMode.LEARNING)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${profile.mode === AIMode.LEARNING ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <GraduationCap size={14} /> <span className="hidden sm:inline">Studio</span>
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors border border-white/5 text-gray-400">
            <Sliders size={20} />
          </button>
          <button onClick={() => setIsGuideOpen(!isGuideOpen)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors border border-white/5 text-gray-400">
            <BookOpen size={20} />
          </button>
        </div>
      </div>

      {/* Unified Coach Persona & Waveform Area */}
      <div className="w-full max-w-2xl px-6 flex flex-col items-center gap-4 relative z-10 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={() => selectVoice(voiceKeys[(voiceKeys.indexOf(currentVoiceKey) - 1 + voiceKeys.length) % voiceKeys.length])} className="p-2 text-gray-600 hover:text-white">
            <ChevronLeft size={28} />
          </button>
          
          <div className="text-center">
            <h2 className="text-4xl font-montserrat text-white uppercase tracking-tighter" style={{ textShadow: `0 0 40px ${currentVoiceData.theme.primary}50` }}>
              {currentVoiceKey}
            </h2>
            <div className="flex items-center justify-center gap-2 text-[9px] uppercase font-black tracking-widest text-gray-500 mt-1">
              <MapPin size={10} className="text-green-500" />
              {currentVoiceData.accent}
            </div>
          </div>

          <button onClick={() => selectVoice(voiceKeys[(voiceKeys.indexOf(currentVoiceKey) + 1) % voiceKeys.length])} className="p-2 text-gray-600 hover:text-white">
            <ChevronRight size={28} />
          </button>
        </div>

        {/* Waveform Display */}
        <div className="w-full h-16 glass rounded-3xl relative overflow-hidden border border-white/10">
          <canvas ref={canvasRef} width={800} height={100} className="w-full h-full" />
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="animate-spin text-white/20" size={20} />
            </div>
          )}
        </div>

        {/* Profile Bio */}
        <div className="w-full flex items-center justify-between px-5 py-3 glass border-white/5 rounded-2xl animate-in fade-in">
          <div className="flex items-center gap-3">
            <Quote size={14} className="text-green-500 opacity-40" />
            <p className="text-[13px] text-gray-300 italic font-medium">"{currentVoiceData.desc}"</p>
          </div>
          <button 
            onClick={playDemo} 
            disabled={isPlayingDemo}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-blue-400 disabled:opacity-30"
          >
            {isPlayingDemo ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>

      {/* Transcription Area - FLEX-1 and SCROLLABLE */}
      <div className="flex-1 w-full max-w-2xl px-6 flex flex-col overflow-hidden mt-4 relative z-10">
        <div className="flex-1 overflow-y-auto no-scrollbar py-2 space-y-6 flex flex-col min-h-0">
          {transcriptions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
              <div className="p-6 bg-white/5 rounded-[2.5rem] border border-white/5 mb-4">
                <Sparkles size={40} className="text-white" />
              </div>
              <h3 className="text-xl font-montserrat text-white mb-2">Inizia a parlare!</h3>
              <p className="text-[13px] max-w-[240px] leading-relaxed">
                {currentVoiceKey} è in ascolto. Raccontami qualcosa o chiedimi aiuto.
              </p>
            </div>
          ) : (
            <>
              {transcriptions.map((t, i) => (
                <div key={i} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 ${t.role === 'Tu' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${t.role === 'Tu' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'bg-white/5 border border-white/10 text-green-500'}`}>
                    {t.role === 'Tu' ? <User size={18} /> : <Bot size={18} />}
                  </div>
                  <div className={`flex flex-col max-w-[82%] ${t.role === 'Tu' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[8px] font-black uppercase text-gray-600 mb-1 px-1 tracking-widest">{t.role}</span>
                    <div className={`bubble shadow-xl !p-3.5 !text-[14px] !rounded-2xl ${t.role === 'Tu' ? 'bubble-user-blue !rounded-tr-none' : 'bubble-ai !rounded-tl-none glass'}`}>
                      {t.text}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={transcriptionsEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Feedback Panel */}
      {latestCorrection && (
        <div className="absolute bottom-28 left-6 right-6 z-20 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-[#1c1c1e] border border-red-500/30 p-4 rounded-[1.8rem] shadow-2xl flex items-center gap-4 backdrop-blur-xl">
            <div className="p-2 bg-red-600/20 rounded-xl text-red-500 shrink-0">
              <AlertCircle size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase text-red-500 tracking-widest mb-1 opacity-80">Feedback Pronuncia</p>
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-xs opacity-40 line-through truncate">{latestCorrection.original}</span>
                <ArrowRight size={12} className="text-green-500 shrink-0" />
                <span className="text-sm font-bold text-green-500 truncate">{latestCorrection.correct}</span>
              </div>
            </div>
            <button onClick={() => setLatestCorrection(null)} className="p-2 text-gray-500">
              <CloseIcon size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Controls Footer */}
      <div className="w-full p-6 flex items-center justify-center gap-10 relative z-10 shrink-0 bg-gradient-to-t from-black via-black/90 to-transparent">
        <button 
          onClick={() => setIsMuted(!isMuted)} 
          className={`p-6 rounded-[2rem] transition-all border-2 active:scale-95 ${isMuted ? 'bg-red-600/20 border-red-500 text-red-500' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
          style={isActive && !isMuted ? { boxShadow: `0 0 50px ${currentVoiceData.theme.primary}30`, borderColor: `${currentVoiceData.theme.primary}40` } : {}}
        >
          {isMuted ? <VolumeX size={28} /> : <Mic size={28} />}
        </button>

        <button 
          onClick={onClose} 
          className="p-7 rounded-[2.2rem] bg-red-600 text-white shadow-2xl hover:bg-red-500 transition-all hover:scale-105 active:scale-95 border-b-4 border-red-800"
        >
          <PhoneOff size={34} />
        </button>
      </div>

      {/* Overlays */}
      {(isSettingsOpen || isGuideOpen) && (
        <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-300">
          <div className="w-full max-w-sm h-full bg-[#0d0d0d] border-l border-white/10 p-8 shadow-2xl animate-in slide-in-from-right-full duration-300 flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-xl font-montserrat uppercase tracking-tight text-white/90">
                {isSettingsOpen ? 'Personalizza' : 'Coach Guide'}
              </h3>
              <button onClick={() => { setIsSettingsOpen(false); setIsGuideOpen(false); }} className="p-2 hover:bg-white/5 rounded-xl">
                <CloseIcon size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-8">
              {isSettingsOpen ? (
                <div className="space-y-8">
                   <div className="space-y-6">
                     <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Dialect Power</label>
                       <span className="text-xs font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-lg">{profile.accentIntensity}%</span>
                     </div>
                     <input 
                       type="range" min="0" max="100" 
                       value={profile.accentIntensity}
                       onChange={(e) => onUpdateProfile({ ...profile, accentIntensity: parseInt(e.target.value) })}
                       className="w-full accent-blue-500 bg-white/10 h-2 rounded-full cursor-pointer"
                     />
                     <div className="flex justify-between px-1 text-[8px] font-black text-gray-600 uppercase">
                        <span>Standard</span>
                        <span>Marcato</span>
                        <span>Native</span>
                     </div>
                   </div>
                   <div className="p-5 rounded-2xl glass border-white/5">
                      <Quote size={12} className="text-gray-600 mb-2" />
                      <p className="text-[12px] text-gray-400 leading-relaxed italic">
                        Adjust intensity to hear more local expressions and distinct regional pronunciations.
                      </p>
                   </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentVoiceData.phoneticGuide.map((tip, idx) => (
                    <div key={idx} className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                      <h4 className="text-sm font-black text-white mb-2">{tip.sound}</h4>
                      <p className="text-[12px] text-gray-400 mb-4 leading-relaxed">{tip.instruction}</p>
                      <button 
                        onClick={() => gemini.generateSpeech(tip.example, currentVoiceData.api).then(b => b && gemini.playRawPCM(b))}
                        className="w-full bg-black/40 p-3 rounded-2xl flex items-center justify-between active:scale-95 transition-all group"
                      >
                        <code className="text-xs text-green-400 font-mono font-bold">{tip.example}</code>
                        <Volume2 size={16} className="text-gray-500 group-hover:text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceMode;
