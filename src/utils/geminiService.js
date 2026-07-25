/* ============================================================
   geminiService.js — Gemini AI API Wrapper
   
   HOW IT WORKS (simple explanation):
   
   1. The user provides their Gemini API key (free from Google AI Studio)
   2. We save the key in localStorage so they don't have to enter it every time
   3. When we need to analyze an image, we:
      - Create a Gemini AI client using the key
      - Send the image (as base64) + a prompt to Gemini Vision
      - Gemini analyzes the image and returns a JSON result
   
   We use the "gemini-2.0-flash" model because:
   - It's FREE (15 requests/minute, 1500 requests/day)
   - It's FAST (responds in 2-5 seconds)
   - It supports VISION (can see and analyze images)
   
   NOTE: The API key is stored ONLY in the user's browser (localStorage).
   It is never sent anywhere except to Google's API.
   ============================================================ */

import { GoogleGenAI } from '@google/genai';

// The API key is now securely provided by the developer via environment variables.
// In Vite, environment variables must start with VITE_ to be exposed to the client.
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';


/* ----------------------------------------------------------
   API Key Management
   ---------------------------------------------------------- */

// ── Note: API key is now hardcoded via environment variable ──
// We no longer ask the user for their API key, as that defeats the purpose of fraud detection.
// The developer provides the key via a .env file.

export function getApiKey() {
  return GEMINI_API_KEY;
}

export function hasApiKey() {
  return !!GEMINI_API_KEY;
}

// These functions are kept for backwards compatibility but do nothing now
export function saveApiKey(key) {
  console.warn("saveApiKey called but API key is now managed via environment variables.");
}

export function removeApiKey() {
  console.warn("removeApiKey called but API key is now managed via environment variables.");
}


/* ----------------------------------------------------------
   analyzeImageForFraud()
   
   THE MAIN FUNCTION — sends an image + description to Gemini
   and asks it to check for fraud.
   
   Parameters:
   - base64ImageData : the image as a base64 data URL 
                       (e.g. "data:image/jpeg;base64,/9j/...")
   - description     : the text description the user typed
   - category        : the item category (e.g. "wallet", "laptop")
   
   Returns an object like:
   {
     isAIGenerated: false,        // Is the image AI-generated?
     isFakeImage: false,          // Is it a stock/fake image?
     descriptionMismatch: false,  // Does the description not match the image?
     suspiciousQuality: false,    // Is the image quality suspicious?
     overallRiskScore: 15,        // 0-100 risk score
     reasoning: "Image appears...", // Gemini's explanation
     flags: [],                   // Array of failed check names
     skipped: false,              // true if API was not called
     error: null                  // Error message if something failed
   }
   ---------------------------------------------------------- */
export async function analyzeImageForFraud(base64ImageData, description, category) {
  const apiKey = getApiKey();

  // If no API key is configured, skip the AI check
  if (!apiKey) {
    return {
      error: 'No API key configured',
      skipped: true,
      flags: [],
      overallRiskScore: 0,
      reasoning: 'AI analysis skipped — no Gemini API key configured.',
    };
  }

  try {
    // ── Step 1: Create the Gemini client ──────────────────
    const ai = new GoogleGenAI({ apiKey });

    // ── Step 2: Prepare the image ────────────────────────
    // The image comes as "data:image/jpeg;base64,/9j/4AAQ..."
    // We need JUST the base64 part (after the comma)
    const base64Data = base64ImageData.includes(',')
      ? base64ImageData.split(',')[1]
      : base64ImageData;

    // Detect the image format (JPEG or PNG)
    const mimeType = base64ImageData.startsWith('data:image/png')
      ? 'image/png'
      : 'image/jpeg';

    // ── Step 3: Build the prompt ─────────────────────────
    // This is what we ask Gemini to do. It's like giving
    // instructions to a detective — "check this image for X, Y, Z"
    const prompt = `You are a fraud detection AI for a college lost-and-found platform called "beHonest".

A student uploaded this image with the following details:
- Category: ${category}
- Description: "${description}"

Analyze the image carefully and check for these fraud indicators:

1. **AI_GENERATED**: Does this image look AI-generated? (Look for: unnatural textures, weird fingers/text, too-perfect lighting, uncanny valley effects, watermarks from AI tools like DALL-E, Midjourney, etc.)
2. **FAKE_IMAGE**: Does this image look like a stock photo, screenshot from the internet, or not a genuine photo of a real found item? (Look for: watermarks, professional studio lighting, promotional composition, screenshots)
3. **DESCRIPTION_MISMATCH**: Does the description NOT match what is actually shown in the image? (e.g., description says "laptop" but image shows a wallet)
4. **SUSPICIOUS_QUALITY**: Is the image too blurry, too small, clearly a screenshot of a screenshot, or visually unusable?

Respond ONLY with valid JSON (no markdown, no code fences, no extra text):
{
  "isAIGenerated": true or false,
  "isFakeImage": true or false,
  "descriptionMismatch": true or false,
  "suspiciousQuality": true or false,
  "overallRiskScore": a number from 0 to 100,
  "reasoning": "Brief 1-2 sentence explanation of your analysis",
  "flags": ["AI_GENERATED", "FAKE_IMAGE"]
}

The "flags" array should ONLY contain the names of checks that are suspicious.
If everything looks legitimate, return an empty flags array and a low riskScore (0-20).
Be strict but fair — don't flag genuine photos.`;

    // ── Step 4: Send to Gemini ───────────────────────────
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    // ── Step 5: Parse the response ───────────────────────
    const text = response.text.trim();

    // Sometimes Gemini wraps JSON in ```json ... ``` code fences
    // We need to strip those out before parsing
    let jsonStr = text;
    if (text.includes('```')) {
      jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const result = JSON.parse(jsonStr);

    return {
      ...result,
      skipped: false,
      error: null,
    };

  } catch (err) {
    // ── Error handling ─────────────────────────────────
    console.error('Gemini fraud analysis error:', err);

    return {
      error: err.message || 'Gemini API error',
      skipped: true,
      flags: [],
      isAIGenerated: false,
      isFakeImage: false,
      descriptionMismatch: false,
      suspiciousQuality: false,
      overallRiskScore: 0,
      reasoning: 'AI analysis failed: ' + (err.message || 'Unknown error'),
    };
  }
}

/* ----------------------------------------------------------
   runInteractiveInterrogation()
   
   Handles the conversational AI interview for claiming an item.
   ---------------------------------------------------------- */
export async function runInteractiveInterrogation(item, chatHistory) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  // Safe extraction of the first image
  const firstImage = (item.images && item.images.length > 0) ? item.images[0] : '';
  
  const base64Data = firstImage.includes(',')
    ? firstImage.split(',')[1]
    : firstImage;

  const mimeType = firstImage.startsWith('data:image/png')
    ? 'image/png'
    : 'image/jpeg';

  const systemPrompt = `You are a strict security AI for a lost-and-found platform.
We need to verify if the person claiming this item is the true owner through a conversation.

A student found this item and provided the following details:
- Title: ${item.shortTitle || item.title}
- Description: ${item.description}
- Secret Identifier (Hidden from public): ${item.secretIdentity || item.secretDetails || "None provided"}

You are conducting an interactive interview. You must ask ONE highly specific question at a time based on what the finder gave information about item.
Do NOT ask generic questions like "What color is it?". Ask about unique visual details in the image (scratches, stickers, precise colors, brand, serial number) or the Secret Identifier that is given in the Description or in the Secret Identifier by the finder.

The user's chat history is provided. Analyze their latest answer.
If they answered correctly, proceed to the next question.
If they answered incorrectly, you can give them one more chance or end the interview.
You MUST ask between 7 and 10 questions to thoroughly interrogate them before making a final verdict (unless they completely fail early on). Do not pass them after just 1 or 2 questions.

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "message": "Your next question OR your final verdict explanation",
  "status": "continue" | "verified" | "needs_review" | "rejected",
  "score": a number from 0 to 100 representing confidence (only required if status is NOT 'continue')
}`;

  // Format the chat history for Gemini
  // Gemini expects: { role: "user" | "model", parts: [{ text: "..." }] }
  // We need to inject the image in the VERY FIRST user prompt if the history is empty,
  // but actually, we can just send the system prompt + image + the whole history as one turn for simplicity,
  // OR use the actual multi-turn format.
  // Using multi-turn:
  const contents = [];
  
  // First turn must contain the instructions and the image
  contents.push({
    role: 'user',
    parts: [
      { text: systemPrompt },
      { inlineData: { mimeType, data: base64Data } }
    ]
  });

  // Since we pushed the system prompt as a 'user' role, the next should be 'model', but
  // to avoid strict role alternation issues, we will just pass the entire conversation transcript
  // inside the first prompt.
  
  const formattedHistory = chatHistory.map(msg => 
    `${msg.role === 'ai' ? 'AI' : 'Claimant'}: ${msg.text}`
  ).join('\n');

  const fullPrompt = systemPrompt + "\n\nChat History:\n" + (formattedHistory || "(No history yet. Start by asking the first question.)");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [
            { text: fullPrompt },
            { inlineData: { mimeType, data: base64Data } }
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text.trim();
    let jsonStr = text;
    
    // Fallback regex to extract JSON just in case it still wraps it
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      jsonStr = match[0];
    }

    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Gemini interrogation error:', err);
    throw err;
  }
}
