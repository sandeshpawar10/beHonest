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

A student found this item and provided the following details:
- Title: ${item.shortTitle || item.title}
- Description: ${item.description}

You are conducting an interactive interview. You must ask ONE highly specific question at a time based on the visual details in the image (if provided) or the description.
Do NOT ask generic questions like "What color is it?". Ask about unique visual details (scratches, stickers, precise colors, brand, serial number).

The user's chat history is provided. Analyze their latest answer.
If they answered correctly, proceed to the next question.
If they answered incorrectly, you can give them one more chance or simply continue to the next question.
You MUST ask between 4 and 10 questions to thoroughly interrogate them before making a final verdict. Do not pass them after just 1 or 2 questions.

GRADING RULES FOR FINAL VERDICT:
1. Start with a baseline score of 100.
2. Give FULL CREDIT if the user's answer is approximately correct or demonstrates genuine knowledge (e.g., saying "dark blue" when the item is navy blue is correct; saying "Samsung" when it's a Samsung Galaxy is correct).
3. Only deduct 5-10 points for genuinely wrong answers where the user clearly does not know the detail.
4. Only deduct 15-20 points for completely fabricated or wildly incorrect answers.
5. If the user answers most questions with reasonable accuracy (even if not word-perfect), they deserve a high score.
6. If the final score is 70 or above, set status to "verified".
7. If the final score is between 40 and 69, set status to "needs_review".
8. If the final score is below 40, set status to "rejected".

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
  if (!proofImage) {
    // If no proof image is uploaded, just return the tentative verdict as final
    return {
      message: tentativeVerdict.message,
      status: tentativeVerdict.status,
      score: tentativeVerdict.score || 0,
      aiModelUsed: 'gemini-3.1-flash-lite',
      aiVersion: 'v1'
    };
  }

  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const modelName = 'gemini-3.1-flash-lite';
  
  const firstImage = (item.images && item.images.length > 0) ? item.images[0] : '';
  
  const { base64Data, mimeType } = await fetchImageAsBase64(firstImage);
  const { base64Data: proofBase64Data, mimeType: proofMimeType } = await fetchImageAsBase64(proofImage);

  const systemPrompt = `You are a security AI for a lost-and-found platform.
We are finalizing a claim verification. The user has already completed a chat interview.
Based purely on their chat, the tentative verdict was: "${tentativeVerdict.status}" with a score of ${tentativeVerdict.score}.

The user has now uploaded photographic proof of ownership (a receipt, bill, or an old photo of them with the item). This is the SECOND image.
The FIRST image is the actual found item.

CRITICAL INSTRUCTIONS:
1. Cross-reference the proof image with the found item image.
2. Look for matching serial numbers, visual defects, exact product models.
3. FORENSIC CHECK: If the proof image appears to be a generic stock photo downloaded from the internet, or AI-generated, immediately set status to "needs_review" and explain the fraud.
4. If the proof image strongly matches the item (same brand, same model, same visual features, or a genuine receipt/bill for the same product), the MINIMUM final score MUST be 75 and status MUST be "verified". This is because a matching proof photo is very strong evidence of ownership.
5. If the proof image somewhat matches (same type of product but unclear details), boost the tentative score by at least 15 points.
6. If the proof image clearly does NOT match the item, set status to "rejected" or "needs_review".

SCORING THRESHOLDS:
- 70 or above → "verified"
- 40 to 69 → "needs_review"  
- Below 40 → "rejected"

Return ONLY a valid JSON object matching this schema:
{
  "message": "Your final verdict explanation, mentioning the photo proof.",
  "status": "verified" | "needs_review" | "rejected",
  "score": a number from 0 to 100 representing the FINAL COMBINED confidence score.
}`;

  try {
    const parts = [
      { text: systemPrompt }
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
    // Fallback if AI fails: use the tentative verdict but flag for review just in case
    return {
      message: "AI evaluation of the proof photo failed. Using chat score and flagging for manual review.",
      status: "needs_review",
      score: tentativeVerdict.score || 0,
      aiModelUsed: modelName,
      aiVersion: 'v1'
    };
  }
};
