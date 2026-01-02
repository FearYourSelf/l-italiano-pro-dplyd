
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { UserProfile, MemoryItem, NoteItem, AIMode, AIBehaviorType, ChatTab, StudyPlanData, StudyModule } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        const isQuotaError = error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED";
        if (isQuotaError && i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw error;
      }
    }
    throw new Error("Maximum retries reached.");
  }

  private getSystemPrompt(profile: UserProfile, memories: MemoryItem[], notes: NoteItem[] = []) {
    const memoryContext = memories.map(m => `- ${m.key}: ${m.value}`).join("\n");
    const notesContext = notes.map(n => `- ${n.content}`).join("\n");
    
    const regionalNuance = {
      'Zephyr': "Identity: GIULIA (Roman). Use 'daje', 'mo'. Cheeky, warm, and very expressive.",
      'Puck': "Identity: ALESSANDRO (Milanese). Fast, business-oriented, efficient. Use 'taaac'.",
      'Charon': "Identity: GIUSEPPE (Sicilian). Proud, melodic, hospitable. Use 'amunì'.",
      'Kore': "Identity: ALESSANDRA (Neapolitan). Energetic, musical, passionate. Use 'Marò!'.",
      'Fenrir': "Identity: LUCA (Tuscan). Precise, intellectual, slightly sarcastic. Use 'hoha hola' style."
    }[profile.voiceId] || "";

    const scenarioInstruction = profile.activeScenario 
      ? `ACTIVE ROLEPLAY: ${profile.activeScenario.title}. 
         Scenario context: ${profile.activeScenario.description}. 
         User Goal: ${profile.activeScenario.goal}. 
         Don't break character. React to the user's attempts to reach the goal.` 
      : "";

    const modeInstruction = profile.mode === AIMode.LEARNING 
      ? `MODE: LEARNING. If the user makes a mistake in Italian, provide a correction block.
         Format corrections as: 💡 **Correzione**: [Italian] (*[English]*)`
      : `MODE: CONVERSATIONAL. Keep it natural, idiomatic, and snappy.`;

    return `
      You are "L'Italiano Pro", an expert native Italian coach.
      USER: ${profile.name}.
      REGIONAL VIBE: ${regionalNuance} (Accent Intensity: ${profile.accentIntensity}/100)
      ${scenarioInstruction}
      ${modeInstruction}

      LANGUAGE ADAPTABILITY:
      - If the user speaks to you in English, respond in English while maintaining your Italian personality (accent/flair). Use this opportunity to teach a few Italian words or phrases.
      - If the user speaks to you in Italian, respond in Italian.
      - Always be encouraging.

      USER PERSONAL NOTES (PRIORITY STUDY GOALS):
      ${notesContext || "No specific study notes yet."}
      PROACTIVE BEHAVIOR: Occasionally reference these notes. If a user wrote a note about a verb or phrase, try to use it in conversation or ask the user to use it.

      MEMORY (AI-EXTRACTED FACTS):
      ${memoryContext}

      CRITICAL: Always log new user facts with [[MEMORY: key=value]].
    `;
  }

  async *chatStream(
    message: string, 
    history: any[], 
    profile: UserProfile, 
    memories: MemoryItem[],
    notes: NoteItem[] = [],
    useThinking: boolean = false
  ) {
    const model = useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const config = {
      systemInstruction: this.getSystemPrompt(profile, memories, notes),
    };

    const response = await this.ai.models.generateContentStream({
      model,
      contents: [...history, { role: 'user', parts: [{ text: message }] }],
      config
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) yield text;
    }
  }

  async chat(message: string, history: any[], profile: UserProfile, memories: MemoryItem[], notes: NoteItem[] = [], useThinking: boolean = false): Promise<string> {
    const it = this.chatStream(message, history, profile, memories, notes, useThinking);
    let full = "";
    for await (const chunk of it) full += chunk;
    return full;
  }

  async translateLine(text: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Translate this Italian phrase to English concisely: "${text}"` }] }],
      });
      return response.text?.trim() || "";
    } catch (e) { return ""; }
  }

  async quickCheck(text: string): Promise<string | null> {
    if (!text || text.trim().length < 5) return null;
    return this.withRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Check Italian grammar. If bad, return the fixed version. If OK, return "OK". Input: "${text}"` }] }],
      });
      const result = response.text?.trim() || "";
      return (result.toUpperCase() === "OK" || result === text.trim()) ? null : result;
    }, 1);
  }

  async generateStudyPlan(profile: UserProfile, memories: MemoryItem[]): Promise<StudyPlanData> {
    const memoryContext = memories.map(m => `${m.key}: ${m.value}`).join(", ");
    const prompt = `Create a 5-module Italian roadmap for ${profile.name}. Goal: ${profile.goal}. Knowledge: ${memoryContext}.`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            goal: { type: Type.STRING },
            modules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  topics: { type: Type.ARRAY, items: { type: Type.STRING } },
                  progress: { type: Type.INTEGER },
                  status: { type: Type.STRING, enum: ['completed', 'active', 'locked'] },
                  difficulty: { type: Type.STRING }
                },
                required: ["id", "title", "topics", "progress", "status", "difficulty"]
              }
            },
            coachFeedback: { type: Type.STRING },
            overallProgress: { type: Type.INTEGER }
          },
          required: ["goal", "modules", "coachFeedback", "overallProgress"]
        }
      }
    });
    return { ...JSON.parse(response.text || "{}"), lastUpdated: Date.now() };
  }

  async generateReview(module: StudyModule): Promise<{ summary: string, quiz: string }> {
    return this.withRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ 
          parts: [{ 
            text: `Generate a short review summary and a one-question quiz for the Italian module: "${module.title}". Topics covered: ${module.topics.join(', ')}.` 
          }] 
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              quiz: { type: Type.STRING }
            },
            required: ["summary", "quiz"]
          }
        }
      });
      return JSON.parse(response.text || '{"summary": "Unable to generate summary.", "quiz": "Unable to generate quiz."}');
    });
  }

  async generateSpeech(text: string, voiceName: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  }

  async analyzeMedia(file: File, prompt: string, profile: UserProfile): Promise<string> {
    const base64Data = await this.toBase64(file);
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: file.type } },
          { text: `${prompt}. Focus on translating and context. Answer in ${profile.language}.` }
        ]
      }
    });
    return response.text || "Errore analisi.";
  }

  private toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });
  }

  encode(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  decode(base64: string): Uint8Array {
    const bin = atob(base64);
    const res = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) res[i] = bin.charCodeAt(i);
    return res;
  }

  async decodeAudioData(data: Uint8Array, ctx: AudioContext, rate = 24000): Promise<AudioBuffer> {
    const data16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, data16.length, rate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < data16.length; i++) channel[i] = data16[i] / 32768.0;
    return buffer;
  }

  async playRawPCM(base64: string) {
    if (!base64) return;
    const ctx = new AudioContext({ sampleRate: 24000 });
    const buffer = await this.decodeAudioData(this.decode(base64), ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    return new Promise(r => source.onended = () => { ctx.close(); r(true); });
  }
}

export const gemini = new GeminiService();
