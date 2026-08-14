const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

exports.runInteractiveInterrogation = async function(item, chatHistory) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  // Safe extraction of the first image
  const firstImage = (item.images && item.images.length > 0) ? item.images[0] : '';
  
  let base64Data = '';
  let mimeType = 'image/jpeg';
  
  if (firstImage) {
    base64Data = firstImage.includes(',')
      ? firstImage.split(',')[1]
      : firstImage;

    mimeType = firstImage.startsWith('data:image/png')
      ? 'image/png'
      : 'image/jpeg';
  }

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

  const contents = [];
  
  const formattedHistory = chatHistory.map(msg => 
    `${msg.role === 'ai' ? 'AI' : 'Claimant'}: ${msg.text}`
  ).join('\n');

  const fullPrompt = systemPrompt + "\n\nChat History:\n" + (formattedHistory || "(No history yet. Start by asking the first question.)");

  try {
    const parts = [
      { text: fullPrompt }
    ];
    
    // Only attach image if it exists
    if (base64Data) {
        parts.push({ inlineData: { mimeType, data: base64Data } });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
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
