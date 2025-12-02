import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, CATEGORIES } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const suggestCategory = async (description: string): Promise<string | null> => {
  const ai = getAiClient();
  if (!ai) return null;

  try {
    const prompt = `
      Given the transaction description: "${description}",
      suggest the best fitting category from this list: ${CATEGORIES.join(', ')}.
      If none fit perfectly, choose "Miscellaneous".
      Return only the category name string.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    const json = JSON.parse(text);
    return json.category || 'Miscellaneous';

  } catch (error) {
    console.error("Error suggesting category:", error);
    return null;
  }
};

export const generateSpendingReport = async (transactions: Transaction[]): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Unable to generate report. API Key missing.";

  try {
    // Simplify data to save tokens and reduce noise
    const summaryData = transactions.map(t => 
      `${t.date.split('T')[0]}: ${t.type} - ${t.category} - $${t.amount} (${t.description})`
    ).join('\n');

    const prompt = `
      Analyze the following petty cash transaction history:
      
      ${summaryData}

      Please provide a brief, helpful financial summary.
      1. Identify the biggest spending category.
      2. Point out any unusual or high expenses.
      3. Give 1 actionable tip to improve cash flow management.
      
      Keep the tone professional but friendly. Format with Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Error generating report:", error);
    return "Failed to generate report due to an error.";
  }
};