
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { UserProfile, AIMode, NoteItem } from '../types';
import { gemini } from '../services/geminiService';
import { 
  Mic, 
  PhoneOff, 
  ChevronRight, 
  ChevronLeft,
  VolumeX,
  MapPin,
  Languages,
  Sparkles,
  PencilLine,
  X as CloseIcon,
  Trash2,
  Plus,
  Loader2,
  MessageSquare,
  Activity,
  GripHorizontal,
  Waves
} from 'lucide-react';

interface VoiceModeProps {
  onClose: () => void;
  profile: UserProfile;
  onModeToggle: (mode: AIMode) => void;
  onUpdateProfile: (profile: UserProfile) => void;
  notes: NoteItem[];
  setNotes: React.Dispatch<React.SetStateAction<NoteItem[]>>;
}

interface TranscriptionLine {
  role: 'Tu' | 'AI';
  text: string;
  translation?: string;
}

const VOICE_NAMES_MAPPING: Record<string, any> = {
  'Giulia': { api: 'Zephyr', accent: 'Romana', theme: { primary: '#FFD700', pulse: 'rgba(255, 215, 0, 0.1)' }, acting: "GIULIA (Roman)", culturalFact: "In Rome, 'daje' is a state of mind." },
  'Alessandro': { api: 'Puck', accent: 'Milanese', theme: { primary: '#00BFFF', pulse: 'rgba(0, 191, 255, 0.1)' }, acting: "ALESSANDRO (Milanese)", culturalFact: "The 'aperitivo' is sacred in Milan." },
  'Giuseppe': { api: 'Charon', accent: 'Siciliano', theme: { primary: '#FFCC00', pulse: 'rgba(255, 204, 0, 0.1)' }, acting: "GIUSEPPE (Sicilian)", culturalFact: "Sicilian breakfast means Granita and Brioche." },
  'Alessandra': { api: 'Kore', accent: 'Napoletana', theme: { primary: '#12A5E0', pulse: 'rgba(18, 165, 224, 0.1)' }, acting: "ALESSANDRA (Neapolitan)", culturalFact: "Neapolitan coffee is a form of art." },
  'Luca': { api: 'Fenrir', accent: 'Toscano', theme: { primary: '#008C45', pulse: 'rgba(0, 140, 69, 0.1)' }, acting: "LUCA (Tuscan)", culturalFact: "Tuscany is the cradle of the Italian language." }
};

const VoiceMode: React.FC<VoiceModeProps> = ({ onClose, profile, onModeToggle, onUpdateProfile, notes, setNotes }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Connessione...');
  const [transcriptions, setTranscriptions] = useState<TranscriptionLine[]>([]);
  // Requirement: Natives closed by default
  const [showTranscript, setShowTranscript] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  // Draggable window state
  const [position, setPosition] = useState({ x: 20, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const analyserInputRef = useRef<AnalyserNode | null>(null);
  const analyserOutputRef = useRef<AnalyserNode | null>(null);
  const wakeLockRef = useRef<any>(null);
  const isMutedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');

  const voiceKeys = Object.keys(VOICE_NAMES_MAPPING);
  const currentIndex = voiceKeys.findIndex(key => VOICE_NAMES_MAPPING[key].api === profile.voiceId);
  const currentVoiceKey = currentIndex === -1 ? 'Luca' : voiceKeys[currentIndex];
  const currentVoiceData = VOICE_NAMES_MAPPING[currentVoiceKey];

  const cycleVoice = (direction: number) => {
    const nextIdx = (currentIndex + direction + voiceKeys.length) % voiceKeys.length;
    onUpdateProfile({ ...profile, voiceId: VOICE_NAMES_MAPPING[voiceKeys[nextIdx]].api });
    setTranscriptions([]);
    currentInputRef.current = '';
    currentOutputRef.current = '';
  };

  const addVoiceNote = () => {
    if (newNote.trim()) {
      setNotes(prev => [...prev, { id: Date.now().toString(), content: newNote, timestamp: Date.now() }]);
      setNewNote('');
    }
  };

  const deleteVoiceNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (err) {}
    }
  };

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcriptions, showTranscript]);

  const drawWaveform = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      const dataIn = new Uint8Array(128);
      const dataOut = new Uint8Array(128);
      if (analyserInputRef.current) analyserInputRef.current.getByteTimeDomainData(dataIn);
      if (analyserOutputRef.current) analyserOutputRef.current.getByteTimeDomainData(dataOut);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 4; 
      ctx.strokeStyle = currentVoiceData.theme.primary;
      ctx.beginPath();
      
      let x = 0; 
      const step = canvas.width / 128;
      for (let i = 0; i < 128; i++) {
        const v = ((dataIn[i] + dataOut[i]) / 256.0 - 1) * 3;
        const y = (v * canvas.height / 2) + (canvas.height / 2);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += step;
      }
      ctx.stroke();
    };
    render();
  }, [currentVoiceData]);

  // Drag logic for transcript
  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.drag-handle')) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        initialX: position.x,
        initialY: position.y
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: dragStartRef.current.initialX + dx,
      y: dragStartRef.current.initialY + dy
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    let mounted = true;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let stream: MediaStream | null = null;
    let inputCtx: AudioContext | null = null;
    let outputCtx: AudioContext | null = null;
    let session: any = null;
    const sources = new Set<AudioBufferSourceNode>();
    let nextStartTime = 0;

    const init = async () => {
      if (!mounted) return;
      setStatus('Connessione...');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
            sampleRate: { ideal: 16000 },
            channelCount: { ideal: 1 }
          } 
        });
        if (!mounted) return;

        inputCtx = new AudioContext({ sampleRate: 16000 });
        outputCtx = new AudioContext({ sampleRate: 24000 });

        const localAnalyserIn = inputCtx.createAnalyser();
        const localAnalyserOut = outputCtx.createAnalyser();
        localAnalyserOut.connect(outputCtx.destination);

        analyserInputRef.current = localAnalyserIn;
        analyserOutputRef.current = localAnalyserOut;

        drawWaveform();
        await requestWakeLock();

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: currentVoiceData.api } } },
            systemInstruction: `You are ${currentVoiceKey}. ${currentVoiceData.acting}. 
            INTENSITY LEVEL: ${profile.accentIntensity}/100.
            - If intensity is 0: Speak standard, clear English.
            - If intensity is 100: Use heavy regional dialect, thick Italian accent, and constant regional slang (daje, amunì, etc).
            
            CRITICAL INSTRUCTIONS:
            - Sensitivity: The user is learning. Pick up their voice even if quiet.
            - Role: Italian coach. Reference notes: ${notes.map(n => n.content).join(', ')}.
            - Tone: Helpful native speaker.`
          },
          callbacks: {
            onopen: () => {
              if (!mounted || !inputCtx || !stream) return;
              setStatus('Live'); 
              setIsActive(true);
              
              const source = inputCtx.createMediaStreamSource(stream);
              const inputGain = inputCtx.createGain();
              inputGain.gain.value = 1.6;
              
              source.connect(inputGain);
              inputGain.connect(localAnalyserIn);
              
              const scriptProcessor = inputCtx.createScriptProcessor(2048, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                if (isMutedRef.current || !mounted) return;
                const data = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(data.length);
                for (let i = 0; i < data.length; i++) {
                    let s = data[i] * 32768;
                    if (s > 32767) s = 32767;
                    if (s < -32768) s = -32768;
                    int16[i] = s;
                }
                sessionPromise.then(s => {
                  if (mounted) s.sendRealtimeInput({ media: { data: gemini.encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } });
                });
              };
              inputGain.connect(scriptProcessor);
              scriptProcessor.connect(inputCtx.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
              if (!mounted) return;

              const updateTranscription = (role: 'Tu' | 'AI', fullText: string) => {
                if (!mounted || !fullText.trim()) return;
                setTranscriptions(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === role) {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...last, text: fullText };
                    return updated;
                  } else {
                    return [...prev, { role, text: fullText }];
                  }
                });
              };

              if (msg.serverContent?.inputTranscription) {
                const text = msg.serverContent.inputTranscription.text;
                currentInputRef.current += text;
                updateTranscription('Tu', currentInputRef.current);
              }

              if (msg.serverContent?.outputTranscription) {
                const text = msg.serverContent.outputTranscription.text;
                currentOutputRef.current += text;
                updateTranscription('AI', currentOutputRef.current);
              }

              if (msg.serverContent?.turnComplete) {
                if (currentOutputRef.current) {
                  const finalAiText = currentOutputRef.current;
                  gemini.translateLine(finalAiText).then(translation => {
                    if (mounted) {
                      setTranscriptions(prev => {
                        const lastAiIdx = [...prev].reverse().findIndex(t => t.role === 'AI');
                        if (lastAiIdx !== -1) {
                          const actualIdx = prev.length - 1 - lastAiIdx;
                          const updated = [...prev];
                          updated[actualIdx] = { ...updated[actualIdx], translation };
                          return updated;
                        }
                        return prev;
                      });
                    }
                  });
                }
                currentInputRef.current = '';
                currentOutputRef.current = '';
              }
              
              const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (audio && mounted && outputCtx) {
                try {
                  const buffer = await gemini.decodeAudioData(gemini.decode(audio), outputCtx);
                  nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
                  const source = outputCtx.createBufferSource();
                  source.buffer = buffer; 
                  source.connect(localAnalyserOut); 
                  source.start(nextStartTime);
                  nextStartTime += buffer.duration;
                  sources.add(source);
                  source.onended = () => sources.delete(source);
                } catch (err) { console.error("Audio playback error", err); }
              }

              if (msg.serverContent?.interrupted) {
                sources.forEach(s => { try { s.stop(); } catch(e) {} });
                sources.clear(); 
                nextStartTime = 0;
              }
            },
            onclose: () => { if (mounted) setIsActive(false); },
            onerror: () => { if (mounted) setStatus('Errore'); }
          }
        });
        session = await sessionPromise;
      } catch (e) { 
        if (mounted) setStatus('Errore'); 
      }
    };

    init();

    return () => {
      mounted = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (inputCtx) inputCtx.close().catch(() => {});
      if (outputCtx) outputCtx.close().catch(() => {});
      if (session) session.close();
      if (wakeLockRef.current) wakeLockRef.current.release();
      sources.forEach(s => { try { s.stop(); } catch(e) {} });
      sources.clear();
      analyserInputRef.current = null;
      analyserOutputRef.current = null;
    };
  }, [currentVoiceKey, notes.length, profile.accentIntensity]);

  return (
    <div className="relative w-full h-full flex flex-col items-center bg-[#050505] overflow-hidden select-none">
      <div className="absolute inset-0 pointer-events-none transition-all duration-1000" style={{ background: `radial-gradient(circle at 50% 10%, ${currentVoiceData.theme.pulse}, transparent 80%)` }} />
      
      {/* Top Header */}
      <div className="w-full flex items-center justify-between p-6 pt-8 z-40">
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl border border-white/5 text-gray-400 hover:text-white transition-all active:scale-90"><ChevronLeft size={24} /></button>
        <div className="flex gap-2">
           <button 
             onClick={() => setShowNotes(!showNotes)}
             className={`p-3 rounded-xl transition-all border ${showNotes ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/5 text-gray-400'}`}
           >
             <PencilLine size={20} />
           </button>
           
           {/* Requirement: English translation and Native Closed by default */}
           <button 
             onClick={() => setShowTranscript(!showTranscript)}
             className={`px-4 py-2.5 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all border relative overflow-hidden group ${showTranscript ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-500/40' : 'bg-white/5 border-white/5 text-gray-500'}`}
           >
             <Languages size={14} /> 
             {showTranscript ? 'Subtitles On' : 'Subtitles Off'}
             <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${showTranscript ? 'bg-white animate-ping' : 'bg-green-500'}`}></span>
           </button>
        </div>
      </div>

      {/* Floating Notes Editor */}
      {showNotes && (
        <div className="absolute top-[120px] left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[100] bg-[#0d0d0d]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
           <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <PencilLine size={14} /> Appunti Vocali
              </span>
              <button onClick={() => setShowNotes(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><CloseIcon size={18} className="text-gray-500" /></button>
           </div>
           
           <div className="relative mb-4">
              <input 
                type="text" 
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addVoiceNote()}
                placeholder="Aggiungi una nota..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-indigo-500 text-xs text-white"
              />
              <button onClick={addVoiceNote} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 rounded-xl text-white active:scale-90 transition-all">
                <Plus size={14} />
              </button>
           </div>

           <div className="max-h-[300px] overflow-y-auto no-scrollbar space-y-3">
              {notes.map(note => (
                <div key={note.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 group relative hover:border-indigo-500/30 transition-all">
                   <p className="text-[13px] text-gray-200 italic font-medium leading-relaxed pr-6">"{note.content}"</p>
                   <button 
                     onClick={() => deleteVoiceNote(note.id)}
                     className="absolute top-2 right-2 p-1.5 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <Trash2 size={12} />
                   </button>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* DRAGGABLE TRANSCRIPT */}
      {showTranscript && (
        <div 
          style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={`fixed top-0 left-0 w-64 sm:w-80 z-50 transition-shadow ${isDragging ? 'shadow-2xl scale-[1.02] cursor-grabbing' : 'cursor-grab'}`}
        >
           <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-4 flex flex-col shadow-2xl pointer-events-auto h-[350px]">
              <div className="drag-handle flex items-center justify-between mb-3 shrink-0 cursor-grab active:cursor-grabbing pb-2 border-b border-white/5">
                 <div className="flex items-center gap-2">
                    <GripHorizontal size={16} className="text-gray-600" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Live Transcript</span>
                 </div>
                 <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setShowTranscript(false)} className="p-1 text-gray-600"><CloseIcon size={14} /></button>
              </div>
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar space-y-4">
                 {transcriptions.map((t, i) => (
                   <div key={i} className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-left-2">
                      <div className="flex items-center gap-1.5">
                         {t.role === 'AI' ? <MessageSquare size={10} className="text-blue-400" /> : <Activity size={10} className="text-green-400" />}
                         <span className="text-[8px] font-black uppercase text-gray-500">{t.role === 'AI' ? currentVoiceKey : 'Tu'}</span>
                      </div>
                      <p className={`text-sm font-medium ${t.role === 'AI' ? 'text-white' : 'text-blue-200'}`}>{t.text}</p>
                      {t.translation && <p className="text-[10px] text-gray-500 italic border-l border-white/10 pl-2">"{t.translation}"</p>}
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Voice Selection Carousel */}
      <div className="w-full max-w-sm flex flex-col items-center mt-4 px-6 z-20">
        <div className="flex items-center justify-between w-full">
          <button onClick={() => cycleVoice(-1)} className="p-4 rounded-full bg-white/5 border border-white/5 text-gray-400 active:scale-75"><ChevronLeft size={28} /></button>
          <div className="flex flex-col items-center text-center px-4 min-w-[180px]" key={currentVoiceKey}>
            <div className="w-24 h-24 rounded-[2.5rem] mb-6 relative group">
               <div className="absolute inset-0 rounded-[2.5rem] blur-xl opacity-20 transition-all group-hover:opacity-40" style={{ backgroundColor: currentVoiceData.theme.primary }}></div>
               <div className="w-full h-full rounded-[2.3rem] bg-[#0d0d0d] flex items-center justify-center text-white text-4xl font-montserrat font-black shadow-2xl relative z-10" style={{ background: `linear-gradient(135deg, ${currentVoiceData.theme.primary}, #0d0d0d)` }}>
                 {currentVoiceKey.charAt(0)}
               </div>
            </div>
            <h2 className="text-3xl font-montserrat text-white uppercase tracking-tighter">{currentVoiceKey}</h2>
            <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-gray-400 mt-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
              <MapPin size={12} className="text-red-500" /> {currentVoiceData.accent}
            </div>
          </div>
          <button onClick={() => cycleVoice(1)} className="p-4 rounded-full bg-white/5 border border-white/10 text-gray-400 active:scale-75"><ChevronRight size={28} /></button>
        </div>

        {/* ACCENT INTENSITY SLIDER */}
        <div className="w-full mt-10 px-4 group">
          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
               <Waves size={14} className="text-white/20" /> Intenistà Dialetto
             </div>
             <span className="text-[10px] font-black font-montserrat text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
               {profile.accentIntensity === 0 ? 'Standard' : profile.accentIntensity === 100 ? 'Full Dialetto' : `${profile.accentIntensity}%`}
             </span>
          </div>
          <input 
            type="range"
            min="0"
            max="100"
            value={profile.accentIntensity}
            onChange={(e) => onUpdateProfile({ ...profile, accentIntensity: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-current outline-none"
            style={{ color: currentVoiceData.theme.primary }}
          />
          <div className="flex justify-between mt-2 opacity-30">
             <span className="text-[8px] font-black uppercase tracking-widest">Inglese</span>
             <span className="text-[8px] font-black uppercase tracking-widest">{currentVoiceData.accent}</span>
          </div>
        </div>
      </div>

      {/* Visualizer */}
      <div className="w-full max-w-2xl px-6 h-20 mt-auto mb-24 z-20 relative flex flex-col items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center -translate-y-10 pointer-events-none">
           <span className="text-[10px] font-black text-white/20 uppercase tracking-[1em]">{status}</span>
        </div>
        <canvas ref={canvasRef} width={800} height={150} className="w-full h-full opacity-60" />
      </div>

      {/* Control Bar */}
      <div className="w-full p-8 flex items-center justify-center gap-10 z-40 bg-gradient-to-t from-black via-black/80 to-transparent pt-12">
        <button 
          onClick={() => setIsMuted(!isMuted)} 
          className={`p-6 rounded-[2.2rem] transition-all border-2 active:scale-90 ${isMuted ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
        >
          {isMuted ? <VolumeX size={28} /> : <Mic size={28} />}
        </button>
        <button 
          onClick={onClose} 
          className="p-8 rounded-[3rem] bg-red-600 text-white shadow-2xl shadow-red-900/40 active:scale-90 hover:bg-red-500 transition-all border-4 border-black"
        >
          <PhoneOff size={36} />
        </button>
      </div>

      <style>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          background: white;
          border: 4px solid currentColor;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 15px currentColor;
          transition: transform 0.1s ease;
        }
        input[type='range']::-webkit-slider-thumb:active {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
};

export default VoiceMode;
