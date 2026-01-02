import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { UserProfile, MemoryItem, AIMode, AIBehaviorType, ChatTab, StudyPlanData, StudyModule } from "../types";

const API_KEY = process.env.API_KEY || "";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  /**
   * Helper to execute API calls with exponential backoff for 429 errors.
   */
  private async withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        const isQuotaError = error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED";
        if (isQuotaError && i < maxRetries - 1) {
          console.warn(`Quota exceeded. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }
        throw error;
      }
    }
    throw new Error("Maximum retries reached.");
  }

  private getSystemPrompt(profile: UserProfile, memories: MemoryItem[], otherTabs: ChatTab[]) {
    const memoryContext = memories.map(m => `- ${m.key}: ${m.value}`).join("\n");
    
    const regionalNuance = {
      'Zephyr': "Accent: ROMAN (Giulia). Witty, cheeky. Use 'daje', 'mo'. Heavy Roman-Italian accent in English.",
      'Puck': "Accent: MILANESE (Alessandro). Fast, rhythmic. Use 'uè', 'taaac'. Rapid Milanese-Italian accent in English.",
      'Charon': "Accent: SICILIAN (Giuseppe). Melodic, deep. Use 'bedda', 'amunì'. Deep, melodic Sicilian-Italian accent in English.",
      'Kore': "Accent: NAPOLETAN (Alessandra). Musical, solar. Use 'Marò!', 'azz!'. Sing-song Neapolitan-Italian accent in English.",
      'Fenrir': "Accent: TUSCAN (Luca). Elegant, precise. Use aspirated 'c'. Refined Tuscan-Italian accent in English."
    }[profile.voiceId] || "";

    let behaviorInstruction = "";
    switch (profile.behaviorType) {
      case AIBehaviorType.STRICT:
        behaviorInstruction = "Strict Professor. High standards, formal 'Lei'.";
        break;
      case AIBehaviorType.FRIENDLY:
        behaviorInstruction = "Encouraging Tutor. Warm and supportive.";
        break;
      case AIBehaviorType.CASUAL:
        behaviorInstruction = "Cool Friend. Uses lots of slang and Italglish.";
        break;
      case AIBehaviorType.CUSTOM:
        behaviorInstruction = `Custom: ${profile.customBehavior}`;
        break;
    }

    const modeInstruction = profile.mode === AIMode.LEARNING 
      ? `MODE: STUDIO (Learning). 
         - Create structured Lesson Cards for corrections or new terms.
         - EACH FIELD MUST BE ON A NEW LINE.
         - Use emojis as icons.
         
         LESSON CARD FORMAT:
         🏷️ **Parola/Frase**: [Italian Word]
         📖 **Significato**: *[English Translation]*
         💡 **Uso & Sfumature**: [One quick tip]
         📝 **Esempio**: **[Full Italian Sentence]**
         *[English translation of example sentence]*
         ---`
      : `MODE: CONVERSAZIONE (Chat).
         - Texting style. 
         - EXTREMELY BRIEF (1-3 short sentences). 
         - Use Italglish and natural flow.`;

    return `
      You are "L'Italiano Pro", an expert native Italian coach. 
      USER: ${profile.name}.
      REGIONAL IDENTITY: ${regionalNuance}
      PERSONALITY: ${behaviorInstruction}
      ${modeInstruction}

      STRICT FORMATTING RULES:
      1. Bold: **text**
      2. Italics: *text*
      3. Horizontal Line: ---
      4. Store important user facts: [[MEMORY: key=value]].
      Memory Context:
      ${memoryContext}

      IMPORTANT: When you speak English, you MUST strictly maintain a heavy and distinctly Italian accent characteristic of your chosen region. Do not sound native in English. Maintain Italian rhythm and cadence at all times.
    `;
  }

  async chat(
    message: string, 
    history: any[], 
    profile: UserProfile, 
    memories: MemoryItem[],
    activeTabId: string,
    allTabs: ChatTab[],
    useThinking: boolean = false
  ): Promise<string> {
    return this.withRetry(async () => {
      const model = useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
      const config: any = {
        systemInstruction: this.getSystemPrompt(profile, memories, allTabs),
      };

      const response = await this.ai.models.generateContent({
        model,
        contents: [...history, { role: 'user', parts: [{ text: message }] }],
        config
      });

      return response.text || "Ops, qualcosa è andato storto. Riprova?";
    });
  }

  async quickCheck(text: string): Promise<string | null> {
    if (!text || text.trim().length < 5) return null; // Increased min length to save quota
    
    try {
      return await this.withRetry(async () => {
        const response = await this.ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ parts: [{ text: `Validate Italian. Return ONLY the correction or "OK" if perfect. Input: "${text}"` }] }],
        });

        const result = response.text?.trim() || "";
        if (result.toUpperCase() === "OK" || result === text.trim()) return null;
        return result;
      }, 1); // Only 1 retry for background checks to avoid piling up requests
    } catch (e) {
      return null; // Fail silently for background checks
    }
  }

  async generateStudyPlan(profile: UserProfile, memories: MemoryItem[]): Promise<StudyPlanData> {
    return this.withRetry(async () => {
      const memoryContext = memories.map(m => `${m.key}: ${m.value}`).join(", ");
      const prompt = `Create a 5-module Italian roadmap for ${profile.name} (${profile.occupation}). Goal: ${profile.goal}. Known facts: ${memoryContext}.`;

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

      const data = JSON.parse(response.text || "{}");
      return { ...data, lastUpdated: Date.now() };
    });
  }

  async generateReview(module: StudyModule): Promise<{ summary: string, quiz: string }> {
    return this.withRetry(async () => {
      const prompt = `Review module: "${module.title}". Topics: ${module.topics.join(", ")}. Provide a summary and a challenging question.`;
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
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
      return JSON.parse(response.text || "{}");
    });
  }

  async generateSpeech(text: string, voiceName: string): Promise<string> {
    return this.withRetry(async () => {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
    });
  }

  async analyzeMedia(file: File, prompt: string, profile: UserProfile): Promise<string> {
    return this.withRetry(async () => {
      const base64Data = await this.toBase64(file);
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: file.type } },
            { text: `${prompt}. Focus on translating text and explaining cultural context. Answer in ${profile.language}.` }
          ]
        }
      });
      return response.text || "Non sono riuscito ad analizzare il file.";
    });
  }

  private toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  }

  encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number = 24000,
    numChannels: number = 1
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  async playRawPCM(base64: string) {
    if (!base64) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const data = this.decode(base64);
    const buffer = await this.decodeAudioData(data, ctx, 24000, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    return new Promise((resolve) => {
      source.onended = () => {
        ctx.close();
        resolve(true);
      };
    });
  }
}

export const gemini = new GeminiService();
