const { GoogleGenAI } = require('@google/genai');

const z = require('zod');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Schema for valid AI response
const aiResponseSchema = z.object({
  message: z.string(),
  status: z.enum(["continue", "verified", "needs_review", "rejected"]),
  score: z.number().min(0).max(100).optional()
});

// Helper function to safely fetch an image (either URL or raw base64) and return its base64 data and mimeType
async function fetchImageAsBase64(imageStr) {
  let base64Data = '';
  let mimeType = 'image/jpeg';

  if (!imageStr) return { base64Data, mimeType };

  if (imageStr.startsWith('http://') || imageStr.startsWith('https://')) {
    try {
      const response = await fetch(imageStr);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        base64Data = Buffer.from(arrayBuffer).toString('base64');
        const contentType = response.headers.get('content-type');
        if (contentType) mimeType = contentType;
      } else {
        console.warn(`Failed to fetch image from URL: ${imageStr}`);
      }
    } catch (err) {
      console.error(`Error fetching image from URL (${imageStr}):`, err);
    }
  } else {
    base64Data = imageStr.includes(',') ? imageStr.split(',')[1] : imageStr;
    mimeType = imageStr.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  }

  return { base64Data, mimeType };
}

exports.runInteractiveInterrogation = async function(item, chatHistory, proofImage = null) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const modelName = 'gemini-3.1-flash-lite';
  
  // Safe extraction of the first image
  const firstImage = (item.images && item.images.length > 0) ? item.images[0] : '';
  
  const { base64Data, mimeType } = await fetchImageAsBase64(firstImage);

  // Fetch and convert Cloudinary proofImage to base64
  const { base64Data: proofBase64Data, mimeType: proofMimeType } = await fetchImageAsBase64(proofImage);

  const systemPrompt = `You are a security AI for a lost-and-found platform.
We need to verify if the person claiming this item is the true owner through a conversation.

A student found this item and provided the following PUBLIC details:
- Title: ${item.shortTitle || item.title}
- Description: ${item.description}
- Approximate Location: ${item.location}

The finder also provided the following SECRET details (DO NOT REVEAL THESE TO THE CLAIMANT):
- Exact Location Found: ${item.exactLocation || "Not provided"}
- Secret Details/Marks: ${item.secretDetails && item.secretDetails.length > 0 ? item.secretDetails.join(", ") : "Not provided"}
- Secret Identity Note: ${item.secretIdentity || "Not provided"}

You are conducting an interactive interview. You must ask ONE highly specific question at a time.
Do NOT ask generic questions. Instead, grill the user to see if they can guess the SECRET details provided above, or unique visual details from the image.
CRITICAL: Never reveal the secret details in your questions. Frame questions like: "What was inside the front pocket?" or "Exactly where did you lose this?"

The user's chat history is provided. Analyze their latest answer.
If they answered correctly, proceed to the next question.
You MUST ask between 3 and 7 questions to thoroughly interrogate them before making a final verdict.

GRADING RULES FOR FINAL VERDICT:
1. Security is your top priority. Do NOT be lenient.
2. If the user successfully identified the secret details and specific visual marks, give a high score (85-100) and set status to "verified".
3. If they gave vague, generic answers or guessed wrong on key secrets, penalize them heavily (score 0-49) and set status to "rejected".
4. If they were partially correct but you are unsure, score them 50-84 and set status to "needs_review".

Return ONLY a valid JSON object matching this schema:
{
  "message": "Your next question OR your final verdict explanation",
  "status": "continue" | "verified" | "needs_review" | "rejected",
  "score": a number from 0 to 100 representing your calculated grade (only required if status is NOT 'continue')
}`;

  const contents = [];
  
  // Enforce Max Chat History to prevent context exhaustion/injection
  const MAX_HISTORY = 15;
  const truncatedHistory = chatHistory.slice(-MAX_HISTORY);
  
  const formattedHistory = truncatedHistory.map(msg => {
    // Basic sanitization
    const cleanText = msg.text.replace(/[\<\>\{\}]/g, ''); 
    return `${msg.role === 'ai' ? 'AI' : 'Claimant'}: ${cleanText}`;
  }).join('\n');

  let fullPrompt = systemPrompt + "\n\nChat History:\n" + (formattedHistory || "(No history yet. Start by asking the first question.)");

  let retries = 0;
  const MAX_RETRIES = 2;

  while (retries <= MAX_RETRIES) {
    try {
      const parts = [
        { text: fullPrompt }
      ];
      
      if (base64Data) {
          parts.push({ inlineData: { mimeType, data: base64Data } });
      }
      
      if (proofBase64Data) {
          parts.push({ inlineData: { mimeType: proofMimeType, data: proofBase64Data } });
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: parts,
          },
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      let jsonStr = response.text.trim();
      
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        jsonStr = match[0];
      }

      const rawJson = JSON.parse(jsonStr);
      
      // Zod validation
      const validatedData = aiResponseSchema.parse(rawJson);
      
      return {
        ...validatedData,
        aiModelUsed: modelName,
        aiVersion: '1.0'
      };

    } catch (err) {
      console.warn(`Gemini interrogation warning (Attempt ${retries + 1}):`, err.message);
      retries++;
      if (retries > MAX_RETRIES) {
        console.error('Gemini interrogation failed after max retries:', err);
        throw new Error('AI verification service is temporarily unstable or returned invalid responses. Please try again.');
      }
      // Add error correction instructions to prompt for the next retry
      fullPrompt += "\n\n[SYSTEM]: Your previous response was invalid JSON or failed schema validation. You MUST return valid JSON exactly matching the schema.";
    }
  }
}

exports.analyzeImageForFraud = async function(base64ImageData, description, category) {
  if (!GEMINI_API_KEY) {
    return {
      error: 'No API key configured',
      skipped: true,
      flags: [],
      overallRiskScore: 0,
      reasoning: 'AI analysis skipped — no Gemini API key configured.',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const base64Data = base64ImageData.includes(',')
      ? base64ImageData.split(',')[1]
      : base64ImageData;

    const mimeType = base64ImageData.startsWith('data:image/png')
      ? 'image/png'
      : 'image/jpeg';

    const prompt = `You are a strict fraud detection AI for a college lost-and-found platform called "beHonest".

A student uploaded this image with the following details, claiming they FOUND this physical item:
- Category: ${category}
- Description: "${description}"

You must reject anything that is NOT a genuine, real-world photograph of a physical lost item.

Analyze the image carefully and check for these fraud indicators:

1. **AI_GENERATED**: Does this image look AI-generated? (Look for: unnatural textures, weird fingers/text, too-perfect lighting, uncanny valley effects).
2. **FAKE_IMAGE**: Is this a digital screenshot (like a screenshot of an app, UPI receipt, website, or chat), a digital document/table, a meme, a stock photo, or generally NOT a real photograph taken by a camera of a physical object?
3. **DESCRIPTION_MISMATCH**: Does the description/category NOT match what is actually shown in the image? (e.g., description says "laptop" but image shows a wallet)
4. **SUSPICIOUS_QUALITY**: Is the image too blurry, completely unreadable, or severely distorted?

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

CRITICAL RULE: If the image is a screenshot of a phone screen, a digital payment receipt (like GPay/PhonePe/Razorpay), a spreadsheet, or purely digital text, you MUST set "isFakeImage": true and "overallRiskScore": 90. Only real photographs of physical objects resting in the real world are acceptable.`;

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

    const text = response.text.trim();
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

exports.runFinalCombinedScoring = async function(item, chatHistory, tentativeVerdict, proofImage) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const modelName = 'gemini-3.1-flash-lite';
  
  const firstImage = (item.images && item.images.length > 0) ? item.images[0] : '';
  
  let base64Data = null;
  let mimeType = null;
  if (firstImage) {
      const res = await fetchImageAsBase64(firstImage);
      base64Data = res.base64Data;
      mimeType = res.mimeType;
  }
  
  let proofBase64Data = null;
  let proofMimeType = null;
  if (proofImage) {
      const res = await fetchImageAsBase64(proofImage);
      proofBase64Data = res.base64Data;
      proofMimeType = res.mimeType;
  }

  // Format the chat history for the prompt
  const formattedChat = chatHistory && chatHistory.length > 0 
    ? chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n")
    : "No chat history provided.";

  const systemPrompt = `You are a strict and highly analytical security AI for a lost-and-found platform.
Your job is to definitively determine if a user claiming an item is the true owner.
You must NOT be lenient. Security and preventing theft is your highest priority.

ITEM DETAILS:
- Title: ${item.shortTitle || item.title}
- Description: ${item.description || 'None provided'}
- Found Date: ${item.foundDate ? new Date(item.foundDate).toLocaleDateString() : 'Unknown'}

USER'S CHAT INTERVIEW:
${formattedChat}

EVALUATION RULES:
1. Carefully analyze the user's answers in the chat. Did they provide specific, non-obvious details about the item (e.g., scratches, contents, background wallpapers, unique marks)?
2. If the user provided vague, generic, or guessing answers, you MUST penalize their score heavily.
3. If photographic proof was provided, cross-reference it with the found item image. A valid proof image is a receipt, a bill, or a personal photo showing the exact item in the user's possession. 
4. If a proof image is provided but it is generic, low-quality, a random stock photo, or unrelated, it is a massive red flag. Reduce the score significantly.
5. Do NOT trust the user by default. Prove they own it.

SCORING THRESHOLDS:
- 85 or above → "verified" (The chat details and/or photo provide undeniable proof of ownership).
- 50 to 84 → "needs_review" (Plausible but lacks definitive proof, requires manual human review).
- Below 50 → "rejected" (Vague answers, guessing, mismatched details, or fraudulent proof).

Return ONLY a valid JSON object matching this schema:
{
  "message": "A 1-2 sentence explanation of your verdict, detailing exactly what convinced you or what was lacking.",
  "status": "verified" | "needs_review" | "rejected",
  "score": a number from 0 to 100 representing your confidence.
}`;

  try {
    const parts = [
      { text: systemPrompt }
    ];
    if (base64Data) {
        parts.push({ text: "\nImage 1: The found item being claimed." });
        parts.push({ inlineData: { mimeType, data: base64Data } });
    }
    if (proofBase64Data) {
        parts.push({ text: "\nImage 2: Photographic proof of ownership uploaded by the claimant." });
        parts.push({ inlineData: { mimeType: proofMimeType, data: proofBase64Data } });
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        { role: 'user', parts: parts }
      ],
      config: { responseMimeType: "application/json" }
    });

    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('\`\`\`json')) {
      jsonStr = jsonStr.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
    }
    
    const result = aiResponseSchema.parse(JSON.parse(jsonStr));
    return { ...result, aiModelUsed: modelName, aiVersion: 'v1' };

  } catch (error) {
    console.error('Final Gemini Evaluation Error:', error);
    // Secure fallback: Never default to verified on error
    return {
      message: "AI evaluation failed due to a system error. Claim flagged for manual review to ensure security.",
      status: "needs_review",
      score: 50,
      aiModelUsed: modelName,
      aiVersion: 'v1'
    };
  }
};
