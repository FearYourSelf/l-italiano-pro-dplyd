
import React, { useState, useRef } from 'react';
import { Book, Trophy, CheckCircle2, Circle, ArrowRight, Loader2, RefreshCw, Target, BrainCircuit, History, X, Sparkles, Wand2, Volume2 } from 'lucide-react';
import { UserProfile, StudyPlanData, StudyModule } from '../types';
import { gemini } from '../services/geminiService';

interface StudyPlanProps {
  profile: UserProfile;
  studyPlan: StudyPlanData | null;
  onRefresh: () => Promise<void>;
  onUpdateProfile: (p: UserProfile) => void;
}

const StudyPlan: React.FC<StudyPlanProps> = ({ profile, studyPlan, onRefresh, onUpdateProfile }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [goalInput, setGoalInput] = useState(profile.goal || '');
  const [reviewingModule, setReviewingModule] = useState<StudyModule | null>(null);
  const [reviewContent, setReviewContent] = useState<{ summary: string, quiz: string } | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [showCompletedList, setShowCompletedList] = useState(false);
  const [isReadingQuiz, setIsReadingQuiz] = useState(false);

  const handleRefresh = async () => {
    setIsUpdating(true);
    await onRefresh();
    setIsUpdating(false);
  };

  const handleGoalUpdate = () => {
    onUpdateProfile({ ...profile, goal: goalInput });
  };

  const handleStartReview = async (module: StudyModule) => {
    setReviewingModule(module);
    setIsReviewLoading(true);
    setShowCompletedList(false);
    try {
      const content = await gemini.generateReview(module);
      setReviewContent(content);
    } catch (e) {
      console.error(e);
    } finally {
      setIsReviewLoading(false);
    }
  };

  const playQuizAudio = async () => {
    if (!reviewContent?.quiz || isReadingQuiz) return;
    
    setIsReadingQuiz(true);
    try {
      const base64Audio = await gemini.generateSpeech(reviewContent.quiz, profile.voiceId);
      if (base64Audio) {
        await gemini.playRawPCM(base64Audio);
      }
    } catch (e) {
      console.error("Failed to play quiz audio", e);
    } finally {
      setIsReadingQuiz(false);
    }
  };

  const closeReview = () => {
    setReviewingModule(null);
    setReviewContent(null);
    setIsReadingQuiz(false);
  };

  const completedModules = studyPlan?.modules.filter(m => m.status === 'completed') || [];

  return (
    <div className="max-w-4xl mx-auto p-6 pb-24 h-full overflow-y-auto no-scrollbar relative">
      {/* Review Modal Backdrop */}
      {(reviewingModule || showCompletedList) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121212] w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-3">
                <History className="text-blue-400" size={24} />
                <h3 className="font-montserrat text-lg">
                  {showCompletedList ? 'Seleziona una lezione' : 'Ripasso Lezione'}
                </h3>
              </div>
              <button onClick={closeReview || (() => setShowCompletedList(false))} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto no-scrollbar">
              {showCompletedList ? (
                <div className="space-y-3">
                  {completedModules.length === 0 ? (
                    <p className="text-center text-gray-500 italic py-8">Nessuna lezione completata ancora.</p>
                  ) : (
                    completedModules.map(m => (
                      <button 
                        key={m.id}
                        onClick={() => handleStartReview(m)}
                        className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/50 hover:bg-white/10 transition-all group flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-gray-200 group-hover:text-white">{m.title}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">{m.difficulty}</p>
                        </div>
                        <ArrowRight size={18} className="text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))
                  )}
                </div>
              ) : isReviewLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="animate-spin text-blue-500" size={40} />
                  <p className="text-sm text-gray-400 font-medium">L'Italiano Pro sta preparando il tuo ripasso...</p>
                </div>
              ) : reviewContent ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest">
                      <Sparkles size={14} /> Riassunto
                    </div>
                    <p className="text-gray-300 leading-relaxed italic border-l-2 border-blue-500/30 pl-4 bg-blue-500/5 py-3 rounded-r-xl">
                      {reviewContent.summary}
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-widest">
                        <Wand2 size={14} /> Sfida Rapida
                      </div>
                      <button 
                        onClick={playQuizAudio}
                        disabled={isReadingQuiz}
                        className={`p-2 rounded-xl transition-all ${isReadingQuiz ? 'bg-amber-500/20 text-amber-500' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                        title="Ascolta la pronuncia"
                      >
                        {isReadingQuiz ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                      </button>
                    </div>
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 shadow-inner">
                      <p className="text-sm font-medium text-white mb-4 leading-relaxed">
                        {reviewContent.quiz}
                      </p>
                      <button 
                         onClick={() => {
                           window.location.hash = 'chat';
                           closeReview();
                         }}
                         className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                      >
                        Rispondi in Chat
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Main View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-montserrat flex items-center gap-3">
            <GraduationCapIcon /> Study Plan
          </h2>
          <p className="text-gray-400 mt-1">Piano personalizzato per {profile.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCompletedList(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/20 transition-all font-bold text-xs"
          >
            <History size={16} /> Ripassa
          </button>
          <div className="bg-green-600/20 text-green-500 px-4 py-2 rounded-xl flex items-center gap-2 border border-green-500/20">
            <Trophy size={18} />
            <span className="font-bold">Progress: {studyPlan?.overallProgress || 0}%</span>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={isUpdating}
            className={`p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${isUpdating ? 'animate-spin opacity-50' : ''}`}
            title="Aggiorna piano con l'AI"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Goal Setting Section */}
      <div className="bg-[#121212] p-6 rounded-2xl border border-white/5 mb-8 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-amber-500" size={20} />
          <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400">IL TUO OBIETTIVO</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="text"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder="Es: Raggiungere il livello B1 entro l'estate"
            className="flex-1 bg-white/2 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-amber-500 transition-all text-sm"
          />
          <button 
            onClick={handleGoalUpdate}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-amber-900/20 active:scale-95"
          >
            Salva
          </button>
        </div>
      </div>

      {isUpdating ? (
        <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-4 animate-in fade-in duration-500">
          <Loader2 className="animate-spin text-green-500" size={48} />
          <p className="font-montserrat text-lg text-center">L'Italiano Pro sta analizzando i tuoi progressi...</p>
        </div>
      ) : studyPlan ? (
        <div className="grid gap-4 animate-in slide-in-from-bottom-4 duration-500">
          {studyPlan.modules.map((module, idx) => (
            <div 
              key={module.id} 
              className={`p-6 rounded-2xl border transition-all ${module.status === 'locked' ? 'opacity-40 border-white/5 bg-white/1' : 'border-white/10 bg-white/5 shadow-xl hover:bg-white/8'}`}
            >
              <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${module.status === 'completed' ? 'bg-green-600 text-white shadow-lg shadow-green-900/40' : module.status === 'active' ? 'bg-blue-600 text-white animate-pulse shadow-lg shadow-blue-900/40' : 'bg-white/10 text-gray-500'}`}>
                    {module.status === 'completed' ? <CheckCircle2 size={24} /> : module.status === 'active' ? <Book size={24} /> : <Circle size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg leading-tight">{module.title}</h3>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${module.difficulty === 'Master' ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        {module.difficulty}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {module.topics.map((t, i) => (
                        <span key={i} className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {module.status === 'active' && (
                  <button className="bg-green-600 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-500 transition-all shadow-lg shadow-green-900/20 active:scale-95 shrink-0">
                    Continua <ArrowRight size={18} />
                  </button>
                )}
                {module.status === 'completed' && (
                  <button 
                    onClick={() => handleStartReview(module)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-blue-400 shrink-0"
                  >
                    <History size={14} /> Ripassa
                  </button>
                )}
              </div>

              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-4">
                <div 
                  className={`h-full transition-all duration-1000 ${module.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${module.progress}%` }}
                ></div>
              </div>
            </div>
          ))}

          <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-green-900/20 via-[#121212] to-red-900/20 border border-white/10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <BrainCircuit size={120} />
            </div>
            <div className="relative">
              <h4 className="font-montserrat text-xl mb-3 flex items-center gap-2 text-green-400">
                <SparkleIcon /> AI Mastery Coach
              </h4>
              <p className="text-gray-300 leading-relaxed text-sm mb-6 italic border-l-2 border-green-500/30 pl-4">
                "{studyPlan.coachFeedback}"
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Ultimo aggiornamento: {new Date(studyPlan.lastUpdated).toLocaleDateString()}</span>
                <button 
                   onClick={() => window.location.hash = 'chat'}
                   className="text-green-500 font-bold text-xs flex items-center gap-1 hover:underline group"
                >
                  Discuti i tuoi progressi <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 px-6 bg-white/2 rounded-3xl border border-dashed border-white/10">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Book size={32} className="text-green-500" />
          </div>
          <h3 className="text-xl font-montserrat mb-2">Inizia il tuo Viaggio</h3>
          <p className="text-gray-400 max-w-sm mx-auto mb-8">Non hai ancora un piano di studio. Imposta un obiettivo e clicca sul pulsante per lasciare che L'Italiano Pro crei una tabella di marcia per te.</p>
          <button 
            onClick={handleRefresh}
            className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-green-900/20 active:scale-95"
          >
            Genera il mio Piano AI
          </button>
        </div>
      )}
    </div>
  );
};

const GraduationCapIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);

const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
  </svg>
);

export default StudyPlan;
