
import { GoogleGenAI } from "@google/genai";

// Always use a named parameter for the API key from process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface AIResponse<T> {
  data: T;
  sources: GroundingSource[];
}

export const geminiService = {
  getAnimeInsight: async (title: string, description: string): Promise<AIResponse<{ hook: string, similar: string[] }> | null> => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Research the anime "${title}" using Google Search. 
        Provide a short, exciting "hook" why someone should watch it based on latest critical reception.
        List 3 highly similar anime that are popular right now.
        
        Format your response strictly as:
        HOOK: [your hook here]
        SIMILAR: [Anime 1], [Anime 2], [Anime 3]`,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      // Use the .text property directly.
      const text = response.text || '';
      const hookMatch = text.match(/HOOK:\s*(.*)/i);
      const similarMatch = text.match(/SIMILAR:\s*(.*)/i);

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web)
        .filter(Boolean) || [];

      return {
        data: {
          hook: hookMatch ? hookMatch[1].trim() : "Experience a masterclass in storytelling and animation.",
          similar: similarMatch ? similarMatch[1].split(',').map(s => s.trim()) : []
        },
        sources: sources
      };
    } catch (error) {
      console.error("Gemini Insight Error:", error);
      return null;
    }
  },

  discoverAnime: async (prompt: string): Promise<AIResponse<{ title: string, reason: string }[]> | null> => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `The user wants anime recommendations based on this vibe: "${prompt}". 
        Use Google Search to find current, trending, or highly-rated anime that fit this description perfectly.
        Provide 4 recommendations.
        
        Format each item as:
        TITLE: [Anime Name]
        REASON: [Short compelling reason]`,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      // Use the .text property directly.
      const text = response.text || '';
      const items = text.split(/TITLE:/i).filter(i => i.trim()).map(item => {
        const lines = item.split('\n');
        const title = lines[0].trim();
        const reasonLine = lines.find(l => l.toUpperCase().includes('REASON:'));
        const reason = reasonLine ? reasonLine.replace(/REASON:/i, '').trim() : "Highly recommended for your current mood.";
        return { title, reason };
      });

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => chunk.web)
        .filter(Boolean) || [];

      return {
        data: items.slice(0, 4),
        sources: sources
      };
    } catch (error) {
      console.error("Discovery Error:", error);
      return null;
    }
  }
};
