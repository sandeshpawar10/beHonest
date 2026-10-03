# Legacy Image Migration Strategy

## Problem Statement

Items created before the image privacy system (imagePrivacyVersion: 1) have images stored in Cloudinary without redaction. These legacy items need handling to prevent privacy leaks.

## Current State

**Legacy Items (imagePrivacyVersion !== 1):**
- Images may contain sensitive information (faces, IDs, personal details)
- Cloudinary URLs may have been shared/saved by users
- Model serialization fails closed: `images: []`, `imagesUnavailable: true`
- No original/public asset separation
- URLs may still work at Cloudinary if accessed directly

**New Items (imagePrivacyVersion === 1):**
- Server-side redaction with permanent opaque masks
- Originals stored with `type: authenticated`
- Public re-encodes are separate assets
- `originalImageAssets` tracked with `select: false`

## Migration Options

### Option A: Fail Closed (Recommended for Initial Launch)

**Strategy:** Mark legacy items as unavailable until manual review.

**Implementation:**
- Current behavior already in place via model serialization
- Legacy items show `imagesUnavailable: true`
- Admin can review and decide per-item:
  - Safe images: manually stamp `imagePrivacyVersion: 1`
  - Unsafe images: request reporter to resubmit with privacy masks
  - Disputed items: keep unavailable

**Pros:**
- Zero privacy risk
- No automated processing of sensitive data
- Simple to implement (already done)
- Clear user communication

**Cons:**
- All legacy found items become invisible
- Users cannot claim legacy items (no images visible)
- May frustrate users with legitimate safe items

**Best for:** Small number of legacy items, privacy-first approach

---

### Option B: Manual Admin Review + Selective Migration

**Strategy:** Admin reviews each legacy item and decides action.

**Process:**
1. Admin dashboard shows all legacy items (imagePrivacyVersion !== 1)
2. Admin views images and determines if they're already safe
3. Actions:
   - **Safe**: Admin stamps `imagePrivacyVersion: 1` to make visible
   - **Unsafe**: Admin contacts reporter to resubmit with masks
   - **Uncertain**: Keep as `imagesUnavailable: true`

**Implementation:**
```javascript
// New admin endpoint
router.post("/api/admin/item/:id/stamp-legacy-safe", verifyAdmin, async (req, res) => {
    const item = await itemModel.findById(req.params.id);
    
    // Admin confirms images are already privacy-safe
    if (item.imagePrivacyVersion === 1) {
        return res.status(400).json({ error: "Item already stamped." });
    }
    
    // Audit log
    console.log(`[AUDIT] Admin ${req.user.email} stamped legacy item ${item._id} as privacy-safe`);
    
    // WARNING: This assumes existing images are safe
    // Does NOT re-upload or separate into original/public assets
    item.imagePrivacyVersion = 1;
    item.imagesUnavailable = false;
    await item.save();
    
    return res.json({ status: "Legacy item marked as safe" });
});
```

**Pros:**
- Human review ensures privacy
- Selective migration only for safe items
- No automated mistakes

**Cons:**
- Manual labor intensive
- Doesn't create original/public asset separation
- Stamped items lack privacy mask metadata
- If admin misjudges, privacy leak occurs

**Best for:** <100 legacy items, trusted admin team

---

### Option C: Reporter Resubmission Flow

**Strategy:** Notify reporters to resubmit with privacy masks.

**Process:**
1. System identifies all legacy items for each reporter
2. Email notification: "Please resubmit your found items with privacy masking"
3. Special resubmission page shows old item, lets them:
   - Upload same/new images
   - Apply privacy masks
   - Submit with new privacy system
4. Old item archived, new item created with `imagePrivacyVersion: 1`

**Implementation:**
- Resubmission controller already exists: `itemResubmitController.js`
- Modify to support legacy (not just rejected) items
- UI flow for "Update my old items"

**Pros:**
- Proper privacy protection for all items
- No admin manual review needed
- Creates proper original/public separation
- Reporter controls their own privacy

**Cons:**
- User friction (requires action)
- Some reporters may not resubmit (items stay hidden)
- Communication overhead

**Best for:** Privacy-critical deployment, any number of legacy items

---

### Option D: Automated Blanket Redaction (Not Recommended)

**Strategy:** Automatically re-upload all legacy images with full redaction.

**Why NOT recommended:**
- Makes all legacy items invisible (defeats purpose)
- Cannot automatically detect what needs masking
- Risk of over-redaction or under-redaction
- No user consent for changes

---

## Recommended Approach: Hybrid Strategy

**Phase 1: Immediate (Launch)**
- ✅ Fail closed (current behavior)
- All legacy items show `imagesUnavailable: true`
- Clear UI message: "This item was submitted before our privacy system. Contact support to make it visible."

**Phase 2: First Week Post-Launch**
- Admin reviews legacy items manually
- Contact reporters of high-value items (e.g., electronics, wallets)
- Offer resubmission option with help

**Phase 3: Ongoing**
- Implement reporter self-service resubmission flow
- Email campaigns to notify legacy reporters
- After 30 days, permanently hide unresubmitted items

**Phase 4: Cleanup (After 90 days)**
- Delete Cloudinary assets for items never resubmitted
- Mark as permanently unavailable
- Free up storage

---

## Database Query to Find Legacy Items

```javascript
// Count legacy items
const legacyCount = await itemModel.countDocuments({
    imagePrivacyVersion: { $ne: 1 }
});

// Get legacy items with details
const legacyItems = await itemModel.find({
    imagePrivacyVersion: { $ne: 1 }
}).select('shortTitle category status images createdAt reportedBy')
  .populate('reportedBy', 'email name');

// Group by status
const legacyByStatus = await itemModel.aggregate([
    { $match: { imagePrivacyVersion: { $ne: 1 } } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
]);
```

---

## Implementation Checklist

**Immediate (Before Launch):**
- [x] Model serialization fails closed for legacy items
- [x] Frontend handles `imagesUnavailable: true`
- [ ] UI message explains why images are hidden
- [ ] Document migration strategy for team

**Post-Launch (Week 1):**
- [ ] Run query to count legacy items
- [ ] Admin dashboard lists legacy items
- [ ] Decide: manual review vs. resubmission vs. keep hidden

**Post-Launch (Week 2-4):**
- [ ] Implement chosen migration path
- [ ] Test with subset of items
- [ ] Communicate with affected reporters

**Long-term (90+ days):**
- [ ] Cleanup script for permanently unavailable items
- [ ] Delete orphaned Cloudinary assets
- [ ] Archive migration documentation

---

## Security Considerations

1. **Never trust legacy URLs:**
   - Even if hidden in app, Cloudinary URLs may still work directly
   - Don't delete originals until verified no sensitive content

2. **Admin stamping is permanent:**
   - Once `imagePrivacyVersion: 1` is set, item becomes visible
   - Cannot be undone without manual intervention
   - Admin must be certain images are safe

3. **Resubmission preserves reporter control:**
   - Only original reporter can resubmit
   - New images replace old ones completely
   - Reporter explicitly opts into new privacy system

4. **Audit logging critical:**
   - Log every admin stamp action
   - Log every resubmission
   - Track who made items visible

---

## Frontend Communication

**User sees legacy item:**
```
🔒 Privacy Protection Active

This item was submitted before our image privacy system. 
Images are currently hidden to protect privacy.

[Reporter? Update this item →]
[Questions? Contact Support]
```

**Reporter dashboard:**
```
⚠️ Action Required

You have 3 items from before our privacy update.
Update them to make them visible again.

[Update My Items]
```

---

## Decision Matrix

| Scenario | Legacy Item Count | Recommended Strategy |
|----------|------------------|---------------------|
| Pre-launch, no users | 0 | N/A - launch with system active |
| <10 items | <10 | Manual admin review + selective stamp |
| 10-100 items | 10-100 | Hybrid: high-value manual, rest notify |
| 100+ items | 100+ | Reporter resubmission flow required |
| Any count, high-risk | Any | Fail closed, never auto-stamp |

---

## Current Recommendation

**Start with Option A (Fail Closed)** — it's already implemented and is the safest default.

**After launch:** Check actual legacy item count and adjust:
- If <20 items: Manual review
- If >20 items: Build resubmission flow
- If highly sensitive items exist: Keep hidden permanently

This approach prioritizes privacy over convenience, which aligns with the system's core purpose.
