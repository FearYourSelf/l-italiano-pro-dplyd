
import React from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  MessageSquare, 
  Mic, 
  Scan, 
  BookOpen, 
  Settings,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { AppView } from '../types';

interface Step {
  title: string;
  description: string;
  view: AppView;
  icon: React.ReactNode;
}

interface WalkthroughProps {
  onClose: () => void;
  onViewChange: (view: AppView) => void;
  currentStep: number;
  onStepChange: (step: number) => void;
}

const STEPS: Step[] = [
  {
    title: "Welcome to L'Italiano Pro",
    description: "Your personal AI to master authentic Italian. I'll guide you through the main features to get you started.",
    view: AppView.CHAT,
    icon: <Sparkles className="text-green-500" size={32} />
  },
  {
    title: "Smart Chat",
    description: "Converse naturally here. Activate 'Thinking Mode' for deep explanations or let the Tutor correct your mistakes in real-time.",
    view: AppView.CHAT,
    icon: <MessageSquare className="text-blue-500" size={32} />
  },
  {
    title: "Real Conversations",
    description: "Choose a regional coach and speak aloud. Learn dialects and typical expressions from Rome, Milan, Naples, and other cities.",
    view: AppView.VOICE,
    icon: <Mic className="text-red-500" size={32} />
  },
  {
    title: "Point and Learn",
    description: "Use your camera to translate menus, signs, or identify objects. You'll also receive cultural facts about what you see.",
    view: AppView.SCAN,
    icon: <Scan className="text-green-500" size={32} />
  },
  {
    title: "AI Study Plan",
    description: "Your personalized path. The AI analyzes your progress and creates tailored modules for your specific goals.",
    view: AppView.STUDY_PLAN,
    icon: <BookOpen className="text-amber-500" size={32} />
  },
  {
    title: "Profile and Memory",
    description: "Customize your identity and manage what the AI remembers about you in your personal 'Slang Vault'.",
    view: AppView.SETTINGS,
    icon: <Settings className="text-gray-400" size={32} />
  }
];

const Walkthrough: React.FC<WalkthroughProps> = ({ onClose, onViewChange, currentStep, onStepChange }) => {
  const step = STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      const nextStep = currentStep + 1;
      onStepChange(nextStep);
      onViewChange(STEPS[nextStep].view);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      onStepChange(prevStep);
      onViewChange(STEPS[prevStep].view);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md glass-dark rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500">
        
        {/* Step Content */}
        <div className="p-8 sm:p-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-8 border border-white/10 shadow-inner group transition-all">
            <div className="group-hover:scale-110 transition-transform">
              {step.icon}
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-2xl font-montserrat text-white tracking-tight leading-tight">
              {step.title}
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed font-medium">
              {step.description}
            </p>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-1.5 pb-2">
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-500 ${i === currentStep ? 'w-6 bg-green-500' : 'w-1.5 bg-white/10'}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="p-6 sm:p-8 flex items-center justify-between gap-4">
          <button 
            onClick={onClose}
            className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors px-4 py-2"
          >
            Skip
          </button>
          
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button 
                onClick={handleBack}
                className="p-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all active:scale-90"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            
            <button 
              onClick={handleNext}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-green-900/20 active:scale-95 transition-all"
            >
              {currentStep === STEPS.length - 1 ? (
                <>Start <CheckCircle2 size={16} /></>
              ) : (
                <>Next <ChevronRight size={16} /></>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pulsing Hint Decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-green-500/5 rounded-full blur-[100px] pointer-events-none -z-10 animate-pulse"></div>
    </div>
  );
};

export default Walkthrough;
