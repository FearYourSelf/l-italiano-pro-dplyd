import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Upload, ArrowRight, Loader2, Languages, Info, Sparkles, X, RefreshCw, Zap, Search } from 'lucide-react';
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
        
        // Convert to file for analysis
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
        Analyze this image/video frame for an Italian language learner. 
        Provide a detailed response in ${profile.language} with these sections:
        1. 🇮🇹 TRANSLATION: Translate any Italian text found.
        2. 🏛️ CULTURAL CONTEXT: Explain the cultural significance of the scene, objects, or brands visible.
        3. 🔍 IDENTIFICATION: Identify objects and give their Italian names with articles.
        4. 💡 PHRASES: Suggest 3 useful Italian phrases related to what's in the image.
      `;
      const res = await gemini.analyzeMedia(targetFile, prompt, profile);
      setResult(res);
    } catch (err) {
      setResult('Oops! I couldn\'t analyze this. Please try again with a clearer image.');
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
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden">
      {/* Scanner Viewport */}
      <div className="flex-1 relative bg-black flex flex-col items-center justify-center group overflow-hidden">
        {isLive ? (
          <div className="relative w-full h-full flex flex-col">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            {/* Viewfinder overlay */}
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
              <div className="w-full h-full border-2 border-white/20 rounded-3xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>
              </div>
            </div>
          </div>
        ) : capturedImage ? (
          <div className="relative w-full h-full">
            <img src={capturedImage} className="w-full h-full object-contain" />
            {loading && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                 <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_15px_#22c55e] animate-scanner-line z-20"></div>
                 <div className="p-6 bg-black/60 backdrop-blur-md rounded-3xl flex flex-col items-center gap-4 border border-white/10 animate-in zoom-in-95">
                    <Loader2 className="animate-spin text-green-500" size={32} />
                    <span className="text-sm font-bold uppercase tracking-widest text-white">Analizzando...</span>
                 </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 p-8 text-center animate-in fade-in zoom-in-95">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
              <Search size={40} className="text-gray-500" />
            </div>
            <div>
              <h3 className="text-xl font-montserrat mb-2">Punta e Impara</h3>
              <p className="text-sm text-gray-400 max-w-xs">Usa la fotocamera per tradurre menù, insegne o scoprire il contesto culturale degli oggetti.</p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-[240px]">
              <button 
                onClick={startCamera}
                className="w-full bg-white text-black py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-200 transition-all active:scale-95"
              >
                <Camera size={18} /> Apri Camera
              </button>
              <label className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10 transition-all">
                <Upload size={18} /> Carica File
                <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,video/*" />
              </label>
            </div>
          </div>
        )}

        {/* Floating result panel */}
        {result && (
          <div className="absolute bottom-4 left-4 right-4 z-30 max-h-[50%] overflow-y-auto no-scrollbar glass rounded-[2rem] border-white/10 p-6 shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-transparent">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-green-500" />
                <span className="text-[10px] uppercase font-black tracking-widest text-green-500">Analysis Completed</span>
              </div>
              <button onClick={() => setResult('')} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap prose prose-invert max-w-none">
              {result}
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        {(isLive || capturedImage) && (
          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6 z-40 px-6">
            <button 
              onClick={reset}
              className="p-4 rounded-2xl bg-black/60 backdrop-blur-md text-white border border-white/10 hover:bg-black/80 transition-all shadow-xl active:scale-90"
            >
              <X size={24} />
            </button>
            
            {isLive ? (
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 bg-transparent group"
              >
                <div className="w-full h-full rounded-full bg-white scale-90 group-active:scale-100 transition-transform"></div>
              </button>
            ) : (
              <button 
                onClick={() => handleAnalyze(file!)}
                disabled={loading}
                className="px-8 py-4 rounded-2xl bg-green-600 text-white font-black uppercase tracking-widest text-sm flex items-center gap-2 shadow-2xl shadow-green-900/40 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                Riprova
              </button>
            )}
            
            <div className="w-14"></div> {/* Spacer for balance */}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <style>{`
        @keyframes scanner-line {
          0% { transform: translateY(0); }
          50% { transform: translateY(100vh); }
          100% { transform: translateY(0); }
        }
        .animate-scanner-line {
          animation: scanner-line 4s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Scanner;