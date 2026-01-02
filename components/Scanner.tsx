
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Loader2, 
  Sparkles, 
  X, 
  Zap, 
  ChevronLeft, 
  Languages, 
  Globe, 
  History,
  Maximize2,
  ScanLine
} from 'lucide-react';
import { gemini } from '../services/geminiService';
import { UserProfile } from '../types';

interface ScannerProps {
  profile: UserProfile;
}

const Scanner: React.FC<ScannerProps> = ({ profile }) => {
  const [file, setFile] = useState<File | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      setIsLive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setIsLive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsLive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
        
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            setFile(file);
            handleAnalyze(file);
          });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setCapturedImage(URL.createObjectURL(selectedFile));
      setResult('');
      handleAnalyze(selectedFile);
    }
  };

  const handleAnalyze = async (targetFile: File) => {
    setLoading(true);
    try {
      const prompt = `
        Analizza questo frame per uno studente di italiano. 
        Risposta in ${profile.language} (Breve e concisa):
        1. 🇮🇹 TRADUZIONE: Traduci eventuali testi italiani.
        2. 🏛️ CULTURA: Significato culturale rapido.
        3. 🔍 OGGETTI: Nomi italiani degli oggetti.
        4. 💡 FRASI: 2 frasi utili.
      `;
      const res = await gemini.analyzeMedia(targetFile, prompt, profile);
      setResult(res);
    } catch (err) {
      setResult('Ops! Errore analisi. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setCapturedImage(null);
    setResult('');
    stopCamera();
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden relative font-inter">
      {/* Dynamic Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      
      {/* Top Bar */}
      {!isLive && (
        <div className="px-6 pt-6 pb-2 flex items-center justify-between shrink-0 relative z-50">
          <div>
            <h2 className="text-xl font-montserrat flex items-center gap-2">
              <ScanLine className="text-green-500" size={20} /> Punta e Impara
            </h2>
            <p className="text-[9px] uppercase font-black tracking-widest text-gray-600 mt-0.5">Visione Pro</p>
          </div>
          <button className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-gray-500 hover:text-white transition-colors">
            <History size={18} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative flex flex-col items-center justify-center overflow-hidden px-6 pb-4">
        {isLive ? (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-[20px] sm:border-[40px] border-black/60 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-full h-full border border-white/20 rounded-[2.5rem] relative flex items-center justify-center">
                <div className="absolute top-0 left-0 w-10 h-10 border-t-[4px] border-l-[4px] border-green-500 rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-10 h-10 border-t-[4px] border-r-[4px] border-green-500 rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[4px] border-l-[4px] border-green-500 rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[4px] border-r-[4px] border-green-500 rounded-br-xl"></div>
              </div>
            </div>
            <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-8 z-[110]">
              <button onClick={stopCamera} className="p-4 rounded-2xl bg-white/10 backdrop-blur-xl text-white border border-white/10"><X size={24} /></button>
              <button onClick={capturePhoto} className="w-20 h-20 rounded-full border-[5px] border-white flex items-center justify-center p-1.5 bg-transparent group active:scale-90 transition-all">
                <div className="w-full h-full rounded-full bg-white"></div>
              </button>
              <div className="w-12"></div>
            </div>
          </div>
        ) : capturedImage ? (
          <div className="w-full h-full max-w-lg bg-[#0d0d0d] rounded-[2.5rem] border border-white/10 overflow-hidden relative shadow-2xl animate-in fade-in duration-500">
            <img src={capturedImage} className="w-full h-full object-cover" />
            {loading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent shadow-[0_0_20px_#22c55e] animate-scanner-line z-30"></div>
                 <div className="p-6 bg-black/40 backdrop-blur-xl rounded-[2rem] flex flex-col items-center gap-3 border border-white/10 shadow-2xl">
                    <Loader2 className="animate-spin text-green-500" size={32} />
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Analisi...</span>
                    </div>
                 </div>
              </div>
            )}
            <button onClick={reset} className="absolute top-4 left-4 p-2.5 rounded-xl bg-black/40 backdrop-blur-md text-white border border-white/10"><ChevronLeft size={20} /></button>
          </div>
        ) : (
          <div className="w-full max-w-sm flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Interactive Scan Area */}
            <div 
              onClick={startCamera}
              className="aspect-square sm:aspect-[4/5] w-full rounded-[3rem] bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/10 transition-all group relative overflow-hidden shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.8rem] bg-green-500/10 flex items-center justify-center border border-green-500/20 group-hover:scale-105 transition-all">
                <Camera size={32} className="text-green-500" />
              </div>
              <div className="text-center px-6 relative z-10">
                <h3 className="text-base sm:text-lg font-montserrat mb-0.5">Avvia Scanner</h3>
                <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase font-black tracking-widest leading-snug">
                  Traduzioni e contesto<br/>in tempo reale
                </p>
              </div>
              <div className="absolute bottom-6 w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-green-500/30 w-1/3 animate-ping-horizontal"></div>
              </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 gap-3">
               <div className="p-3.5 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center gap-2">
                  <Languages size={12} className="text-blue-400" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Traduzione</span>
               </div>
               <div className="p-3.5 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center gap-2">
                  <Globe size={12} className="text-amber-400" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Cultura</span>
               </div>
            </div>

            {/* Compact Upload */}
            <label className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[1.5rem] bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all group">
              <Upload size={12} className="text-gray-500 group-hover:text-white" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 group-hover:text-white">Galleria</span>
              <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,video/*" />
            </label>
          </div>
        )}

        {/* Results Dashboard */}
        {result && (
          <div className="absolute inset-x-0 bottom-0 z-50 p-4 pt-8 bg-gradient-to-t from-black via-black/98 to-transparent h-[60%] flex flex-col animate-in slide-in-from-bottom-full duration-400">
            <div className="w-full max-w-lg mx-auto flex flex-col h-full gap-4">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-green-600 flex items-center justify-center text-white">
                    <Zap size={16} />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">Intelligence Pro</h4>
                </div>
                <button onClick={() => setResult('')} className="p-2 bg-white/5 rounded-lg text-gray-500"><Maximize2 size={14} /></button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-6">
                {result.split(/\d\.\s/).filter(Boolean).map((section, idx) => {
                  const [title, ...content] = section.split(':');
                  return (
                    <div key={idx} className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                      <div className="text-[8px] font-black text-green-500 uppercase tracking-widest mb-1.5 opacity-60">
                        {title?.trim()}
                      </div>
                      <div className="text-xs text-gray-200 leading-relaxed font-medium">
                        {content.join(':')?.trim()}
                      </div>
                    </div>
                  );
                })}
                <button 
                  onClick={reset}
                  className="w-full py-3.5 rounded-xl bg-white text-black font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all mt-2"
                >
                  Nuova Scansione
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <style>{`
        @keyframes scanner-line {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(50vh); opacity: 0; }
        }
        .animate-scanner-line {
          animation: scanner-line 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes ping-horizontal {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .animate-ping-horizontal {
          animation: ping-horizontal 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Scanner;
