
export enum AppView {
  CHAT = 'CHAT',
  VOICE = 'VOICE',
  SCAN = 'SCAN',
  SETTINGS = 'SETTINGS',
  STUDY_PLAN = 'STUDY_PLAN'
}

export enum AIMode {
  CONVERSATIONAL = 'CONVERSATIONAL',
  LEARNING = 'LEARNING'
}

export enum AIBehaviorType {
  STRICT = 'STRICT',
  FRIENDLY = 'FRIENDLY',
  CASUAL = 'CASUAL',
  CUSTOM = 'CUSTOM'
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export interface ChatTab {
  id: string;
  title: string;
  messages: Message[];
  archived?: boolean;
}

export interface UserProfile {
  name: string;
  occupation: string;
  behaviorType: AIBehaviorType;
  customBehavior: string;
  language: string;
  voiceId: string;
  mode: AIMode;
  goal?: string;
  accentIntensity: number; // 0 (Standard) to 100 (Deep Dialect)
}

export interface MemoryItem {
  key: string;
  value: string;
  importance: number;
  context?: string;
}

export interface StudyModule {
  id: string;
  title: string;
  topics: string[];
  progress: number;
  status: 'completed' | 'active' | 'locked';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Master';
}

export interface StudyPlanData {
  goal: string;
  lastUpdated: number;
  modules: StudyModule[];
  coachFeedback: string;
  overallProgress: number;
}
