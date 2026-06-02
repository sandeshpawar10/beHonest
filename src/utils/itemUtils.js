/* ============================================================
   itemUtils.js — Utility functions to save and load found items
   Uses localStorage as our "database" (no real backend needed)
   ============================================================ */

// The key we use to store all found items in localStorage
const FOUND_ITEMS_KEY = 'bh_found_items';

/* ----------------------------------------------------------
   saveFoundItem()
   Saves a new found-item report into localStorage.

   Each item looks like this:
   {
     id: "bh_item_1234567890",      ← unique ID
     title: "Blue Wallet",          ← short title
     category: "wallet",            ← category (watch, wallet, phone...)
     description: "Found near...",  ← description (without giving secrets)
     location: "Library 2nd floor", ← where it was found
     imageData: "data:image/..."    ← the full image as a base64 string
     blurZones: [                   ← list of areas to blur on the image
       { x: 10, y: 20, w: 30, h: 15 }  ← x, y, width, height as %
     ],
     foundBy: "student@mit.edu",    ← email of the finder
     foundByName: "John Doe",       ← name of the finder (hidden publicly)
     foundAt: "2024-01-15T10:30:00" ← timestamp
   }
   ---------------------------------------------------------- */
export function saveFoundItem(item) {
  // Step 1: Load all existing items from localStorage
  const existing = getAllFoundItems();

  // Step 2: Create a new item object with a unique ID
  const newItem = {
    ...item,                          // Spread all the fields the caller passed
    id: 'bh_item_' + Date.now(),      // Unique ID using current timestamp
    foundAt: new Date().toISOString() // Save the exact time it was reported
  };

  // Step 3: Add the new item to the list
  existing.push(newItem);

  // Step 4: Save the updated list back to localStorage
  localStorage.setItem(FOUND_ITEMS_KEY, JSON.stringify(existing));

  return newItem; // Return the saved item (with its new ID)
}

/* ----------------------------------------------------------
   getAllFoundItems()
   Returns the full list of found items from localStorage.
   Returns an empty array [] if nothing has been saved yet.
   ---------------------------------------------------------- */
export function getAllFoundItems() {
  const raw = localStorage.getItem(FOUND_ITEMS_KEY);
  if (!raw) return []; // Nothing saved yet → return empty list

  try {
    return JSON.parse(raw); // Convert the JSON string back to a JS array
  } catch {
    return []; // If the data is corrupted, start fresh
  }
}

/* ----------------------------------------------------------
   getFoundItemById()
   Find and return a single item by its ID.
   Returns null if no item with that ID exists.
   ---------------------------------------------------------- */
export function getFoundItemById(id) {
  const items = getAllFoundItems();
  return items.find(item => item.id === id) || null;
}

/* ----------------------------------------------------------
   CATEGORY_CONFIG
   Defines each item category with:
   - label: displayed name
   - icon: emoji shown on cards
   - blurHint: tells the finder WHAT to blur (helpful instruction)
   ---------------------------------------------------------- */
export const CATEGORY_CONFIG = {
  wallet: {
    label: 'Wallet',
    icon: '👜',
    blurHint: 'Blur: ID cards, credit cards, cash, personal photos'
  },
  watch: {
    label: 'Watch',
    icon: '⌚',
    blurHint: 'Blur: back engraving, serial number, personal inscriptions'
  },
  phone: {
    label: 'Phone / Mobile',
    icon: '📱',
    blurHint: 'Blur: screen content, stickers with name/number, IMEI if visible'
  },
  keychain: {
    label: 'Keys / Keychain',
    icon: '🗝️',
    blurHint: 'Blur: any tags with address or personal info'
  },
  bag: {
    label: 'Bag / Backpack',
    icon: '🎒',
    blurHint: 'Blur: name tags, visible contents, ID cards inside'
  },
  laptop: {
    label: 'Laptop / Tablet',
    icon: '💻',
    blurHint: 'Blur: stickers with personal info, screen content, serial number'
  },
  other: {
    label: 'Other Item',
    icon: '📦',
    blurHint: 'Blur: any identifying marks, names, or personal information'
  }
};
