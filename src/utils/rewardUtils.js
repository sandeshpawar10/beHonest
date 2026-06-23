/* ============================================================
   rewardUtils.js — AI Reward Recommendation System
   
   HOW IT WORKS (simple explanation):
   
   1. Every item category has a REWARD RANGE (min–max in ₹).
      The range depends on the typical value of that type of item.
      
   2. When ownership is verified, the AI "recommends" a fair
      reward within that range. The recommendation is based on:
      - The item's category (wallet vs laptop = different ranges)
      - The description (keywords like "branded", "new", "expensive")
      - The verification confidence score (higher score = slightly higher reward)
      
   3. The owner can ADJUST the reward within the range using a
      slider, but they can NEVER go below the minimum or above
      the maximum. This prevents unfair demands.
      
   4. Once the reward is confirmed, it goes into a simulated
      "escrow" — meaning it's held safely until the item is
      physically returned.
   
   NOTE: This is a frontend simulation. In a real product,
   the escrow would be handled by a payment gateway.
   ============================================================ */

/* ----------------------------------------------------------
   REWARD_CATEGORIES
   
   Each item category has:
   - label      : displayed name
   - icon       : emoji for UI
   - minReward  : minimum reward in ₹
   - maxReward  : maximum reward in ₹
   - description: why this range was chosen
   
   These ranges are designed to be FAIR:
   - Low enough that the owner doesn't feel exploited
   - High enough that the finder feels appreciated
   ---------------------------------------------------------- */
export const REWARD_CATEGORIES = {
  // ── Documents & IDs ──
  id_card: {
    label: 'ID Card / College Card',
    icon: '🪪',
    minReward: 20,
    maxReward: 50,
    description: 'Low material value but essential for the owner. Quick return is the priority.'
  },
  aadhar_pan: {
    label: 'Aadhar / PAN / Driving License',
    icon: '📄',
    minReward: 30,
    maxReward: 100,
    description: 'Government IDs are irreplaceable. Moderate reward to encourage honest return.'
  },

  // ── Everyday Items ──
  water_bottle: {
    label: 'Water Bottle / Sipper',
    icon: '🧴',
    minReward: 20,
    maxReward: 100,
    description: 'Ranges from basic to branded insulated bottles.'
  },
  umbrella: {
    label: 'Umbrella',
    icon: '☂️',
    minReward: 20,
    maxReward: 80,
    description: 'Common item with low to moderate value.'
  },
  tiffin_box: {
    label: 'Tiffin Box / Lunch Bag',
    icon: '🍱',
    minReward: 20,
    maxReward: 80,
    description: 'Usually sentimental or practical value. Modest reward.'
  },

  // ── Stationery & Study ──
  calculator: {
    label: 'Calculator (Scientific)',
    icon: '🔢',
    minReward: 50,
    maxReward: 200,
    description: 'Scientific calculators (Casio FX-991) can cost ₹800–₹1500. Fair reward range.'
  },
  notebook: {
    label: 'Notebook / Notes',
    icon: '📓',
    minReward: 20,
    maxReward: 100,
    description: 'Low material value but notes can be PRICELESS before exams!'
  },
  books: {
    label: 'Textbook / Book',
    icon: '📚',
    minReward: 30,
    maxReward: 150,
    description: 'Textbooks can be expensive. Reward depends on the book.'
  },

  // ── Personal Accessories ──
  wallet: {
    label: 'Wallet / Purse',
    icon: '👜',
    minReward: 50,
    maxReward: 300,
    description: 'Wallets vary widely. Reward covers the effort, not the cash inside.'
  },
  watch: {
    label: 'Watch',
    icon: '⌚',
    minReward: 100,
    maxReward: 500,
    description: 'Watches range from basic to premium. AI adjusts based on description.'
  },
  sunglasses: {
    label: 'Sunglasses / Spectacles',
    icon: '🕶️',
    minReward: 50,
    maxReward: 300,
    description: 'Prescription glasses are expensive to replace. Branded shades even more.'
  },
  jewellery: {
    label: 'Ring / Chain / Jewellery',
    icon: '💍',
    minReward: 100,
    maxReward: 800,
    description: 'Jewellery can be very valuable or sentimental. Higher reward range.'
  },

  // ── Electronics ──
  earbuds: {
    label: 'Earbuds / Headphones',
    icon: '🎧',
    minReward: 100,
    maxReward: 500,
    description: 'Ranges from basic earphones to premium ANC earbuds.'
  },
  phone: {
    label: 'Phone / Mobile',
    icon: '📱',
    minReward: 200,
    maxReward: 1000,
    description: 'Phones are high-value. Reward is a fraction of the device cost.'
  },
  charger: {
    label: 'Charger / Cable / Power Bank',
    icon: '🔌',
    minReward: 30,
    maxReward: 150,
    description: 'Common electronics accessories. Low to moderate value.'
  },
  pendrive: {
    label: 'Pen Drive / Hard Drive',
    icon: '💾',
    minReward: 50,
    maxReward: 200,
    description: 'The data inside is often more valuable than the device itself.'
  },
  tablet: {
    label: 'Tablet / iPad',
    icon: '📲',
    minReward: 300,
    maxReward: 1500,
    description: 'Tablets are expensive. Fair reward for an honest return.'
  },
  laptop: {
    label: 'Laptop',
    icon: '💻',
    minReward: 500,
    maxReward: 2000,
    description: 'Laptops are among the most valuable items students carry.'
  },

  // ── Bags & Carriers ──
  bag: {
    label: 'Bag / Backpack',
    icon: '🎒',
    minReward: 50,
    maxReward: 300,
    description: 'Bags vary from basic to branded. Contents make them more valuable.'
  },
  keychain: {
    label: 'Keys / Keychain',
    icon: '🗝️',
    minReward: 30,
    maxReward: 100,
    description: 'Keys are critical — losing them can mean locksmith costs.'
  },

  // ── Clothing ──
  jacket: {
    label: 'Jacket / Hoodie / Clothing',
    icon: '🧥',
    minReward: 50,
    maxReward: 300,
    description: 'Branded jackets and hoodies can be expensive.'
  },
  shoes: {
    label: 'Shoes / Footwear',
    icon: '👟',
    minReward: 50,
    maxReward: 400,
    description: 'Sports shoes and branded footwear have high value.'
  },

  // ── Miscellaneous ──
  sports: {
    label: 'Sports Equipment',
    icon: '🏏',
    minReward: 50,
    maxReward: 400,
    description: 'Cricket bats, footballs, rackets — varies by sport and brand.'
  },
  musical: {
    label: 'Musical Instrument',
    icon: '🎸',
    minReward: 100,
    maxReward: 600,
    description: 'Instruments like guitars or flutes can be very personal and valuable.'
  },
  other: {
    label: 'Other Item',
    icon: '📦',
    minReward: 20,
    maxReward: 200,
    description: 'General items. AI uses description keywords to recommend a fair reward.'
  }
};


/* ----------------------------------------------------------
   VALUE_KEYWORDS
   
   Words in the item description that suggest HIGHER value.
   If the AI finds these words, it nudges the reward UPWARD
   within the allowed range.
   
   Each keyword has a "boost" value (0.0 to 1.0):
   - Higher boost = pushes reward more toward the max
   ---------------------------------------------------------- */
const VALUE_KEYWORDS = {
  // Premium/brand indicators → big boost
  'branded':     0.25,
  'premium':     0.25,
  'expensive':   0.30,
  'original':    0.20,
  'genuine':     0.20,
  'apple':       0.30,
  'samsung':     0.20,
  'sony':        0.25,
  'nike':        0.15,
  'adidas':      0.15,
  'puma':        0.10,
  'casio':       0.10,
  'boat':        0.10,
  'jbl':         0.15,
  'ray-ban':     0.20,
  'titan':       0.15,
  'fossil':      0.20,

  // Condition indicators → moderate boost
  'new':         0.15,
  'brand new':   0.25,
  'unused':      0.15,
  'mint':        0.20,
  'perfect':     0.10,

  // Value indicators → small boost
  'gold':        0.20,
  'silver':      0.15,
  'leather':     0.10,
  'metal':       0.08,
  'stainless':   0.10,
  'wireless':    0.10,
  'bluetooth':   0.08,
  'touchscreen': 0.10,

  // Low value indicators → negative boost (pushes toward min)
  'old':        -0.10,
  'broken':     -0.20,
  'damaged':    -0.15,
  'torn':       -0.15,
  'scratched':  -0.10,
  'cracked':    -0.15,
  'used':       -0.05,
  'basic':      -0.10,
  'cheap':      -0.15,
};


/* ----------------------------------------------------------
   calculateReward()  ← THE MAIN FUNCTION
   
   Given an item and its verification score, recommends a
   fair reward amount within the category's range.
   
   Parameters:
   - item               : the found item object
   - rewardCategory     : key from REWARD_CATEGORIES (e.g. "laptop")
   - verificationScore  : 0–100 confidence score from AI verification
   
   Returns:
   {
     category: { label, icon, minReward, maxReward, ... },
     recommendedReward: 350,
     minReward: 100,
     maxReward: 500,
     reasoning: [
       "Base reward for Watch category: ₹100–₹500",
       "+₹75: Description mentions 'branded'",
       ...
     ]
   }
   ---------------------------------------------------------- */
export function calculateReward(item, rewardCategory, verificationScore = 70) {

  // Step 1: Get the reward range for this category
  const category = REWARD_CATEGORIES[rewardCategory] || REWARD_CATEGORIES.other;
  const { minReward, maxReward } = category;
  const range = maxReward - minReward; // e.g. 500 - 100 = 400

  // Step 2: Start at the MIDDLE of the range
  //         This is a fair starting point — not too low, not too high
  let rewardFactor = 0.5; // 0.0 = min, 1.0 = max, 0.5 = middle
  const reasoning = [];   // Human-readable explanation of adjustments

  reasoning.push(
    `📊 Base reward for ${category.label}: ₹${minReward}–₹${maxReward}`
  );

  // Step 3: Adjust based on VALUE_KEYWORDS in the description
  //         Scan the item's title and description for keywords
  const fullText = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  let keywordBoost = 0;

  Object.entries(VALUE_KEYWORDS).forEach(([keyword, boost]) => {
    if (fullText.includes(keyword)) {
      keywordBoost += boost;
      if (boost > 0) {
        reasoning.push(
          `⬆️ Description mentions "${keyword}" → +${Math.round(boost * range)} boost`
        );
      } else {
        reasoning.push(
          `⬇️ Description mentions "${keyword}" → ${Math.round(boost * range)} adjustment`
        );
      }
    }
  });

  // Cap the keyword boost between -0.4 and +0.4
  // (prevents extreme swings from too many keywords)
  keywordBoost = Math.max(-0.4, Math.min(0.4, keywordBoost));
  rewardFactor += keywordBoost;

  // Step 4: Small adjustment based on verification confidence score
  //         Higher confidence = slightly higher reward (the AI is more sure)
  if (verificationScore >= 90) {
    rewardFactor += 0.05;
    reasoning.push('⬆️ Very high verification confidence → +5% boost');
  } else if (verificationScore >= 80) {
    rewardFactor += 0.02;
    reasoning.push('⬆️ Strong verification confidence → +2% boost');
  }

  // Step 5: Clamp the factor to 0.0–1.0 range
  //         (never go below min or above max)
  rewardFactor = Math.max(0, Math.min(1, rewardFactor));

  // Step 6: Calculate the final recommended reward
  //         reward = minReward + (range × factor)
  const rawReward = minReward + (range * rewardFactor);

  // Round to nearest ₹10 for cleanliness
  const recommendedReward = Math.round(rawReward / 10) * 10;

  // Final clamp (safety net — always stay within range)
  const finalReward = Math.max(minReward, Math.min(maxReward, recommendedReward));

  reasoning.push(`💡 AI recommended reward: ₹${finalReward}`);

  return {
    category,
    recommendedReward: finalReward,
    minReward,
    maxReward,
    reasoning,
  };
}


/* ----------------------------------------------------------
   ESCROW STORAGE
   
   Simulates a secure escrow system.
   In a real product, this would be a payment gateway (Razorpay, etc.)
   Here we just save the escrow record to localStorage.
   
   Each escrow record:
   {
     id: "bh_escrow_...",
     itemId: "bh_item_...",
     rewardAmount: 350,
     depositorEmail: "owner@college.edu",
     finderEmail: "finder@college.edu",
     status: "held",     // "held" | "released" | "refunded"
     createdAt: "2024-...",
   }
   ---------------------------------------------------------- */

const ESCROW_KEY = 'bh_escrow';

// Save a new escrow deposit
export function createEscrow(escrowData) {
  const existing = getAllEscrows();
  const newEscrow = {
    ...escrowData,
    id: 'bh_escrow_' + Date.now(),
    status: 'held',               // Money is being held
    createdAt: new Date().toISOString(),
  };
  existing.push(newEscrow);
  localStorage.setItem(ESCROW_KEY, JSON.stringify(existing));
  return newEscrow;
}

// Get all escrow records
export function getAllEscrows() {
  const raw = localStorage.getItem(ESCROW_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); }
  catch { return []; }
}

// Get escrow for a specific item
export function getEscrowForItem(itemId) {
  return getAllEscrows().find(e => e.itemId === itemId) || null;
}
