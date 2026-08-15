const itemModel = require("../models/foundItemModel")
const { analyzeImageForFraud } = require("../utils/geminiUtils");
const { uploadImage } = require("../utils/cloudinary");
const z = require("zod");

const addItemSchema = z.object({
    category: z.string().min(1, "Category is required").max(50),
    shortTitle: z.string().min(3, "Title must be at least 3 characters").max(100),
    description: z.string().min(10, "Description must be at least 10 characters").max(2000),
    location: z.string().min(3, "Location must be at least 3 characters").max(100),
    secretIdentity: z.string().max(500).optional(),
    images: z.array(z.string()).max(5).optional(),
    blurZones: z.array(z.any()).optional(),
    dateFound: z.string().datetime().optional()
});


const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
};

exports.addItem = async function(req,res){
    try {
        const validation = addItemSchema.safeParse(req.body);
        if (!validation.success) {
            const issues = validation.error?.issues || validation.error?.errors || [];
            return res.status(400).json({ 
                error: issues.map(e => e.message).join(", ") || validation.error?.message || "Invalid request payload"
            });
        }
        
        const {category, shortTitle, description, location, secretIdentity, images, blurZones, dateFound} = validation.data;
        if(!req.user || !req.user._id){
            return res.status(401).json({
                error: "Unauthorized. You must be logged in to report an item."
            });
        }

        
        let uploadedImageUrls = [];
        if (images && Array.isArray(images) && images.length > 0) {
            // Validate the first image for fraud using AI
            const firstImageData = images[0];
            if (firstImageData && firstImageData.startsWith('data:image')) {
                const fraudAnalysis = await analyzeImageForFraud(firstImageData, description, category);
                
                if (!fraudAnalysis.skipped) {
                    if (fraudAnalysis.isFakeImage || fraudAnalysis.isAIGenerated || fraudAnalysis.overallRiskScore > 70) {
                        return res.status(400).json({ 
                            error: `AI Security Flag: ${fraudAnalysis.reasoning}. Please upload a real, genuine photo taken with your camera. Stock photos and AI images are strictly prohibited.`
                        });
                    }
                }
            }

            for (let i = 0; i < images.length; i++) {
                const imgData = images[i];
                // Check if it looks like a base64 string
                if (imgData && imgData.startsWith('data:image')) {
                    try {
                        const url = await uploadImage(imgData);
                        if (url) uploadedImageUrls.push(url);
                    } catch (uploadErr) {
                        console.error("Cloudinary upload failed for an image:", uploadErr);
                        return res.status(500).json({ error: "Failed to upload image to secure storage." });
                    }
                } else {
                    // It might already be a URL or something else, just keep it
                    uploadedImageUrls.push(imgData);
                }
            }
        }

        const newItem = await itemModel.create({
            reportedBy: req.user._id, 
            category,
            shortTitle,
            description,
            location,
            secretIdentity: secretIdentity || "",
            status: "found", // Forcibly set to found
            images: uploadedImageUrls, 
            blurZones: blurZones || [],
            dateFound: dateFound || Date.now(), 
            imageFingerprint: "" // Computed server-side later if needed
        })
        return res.status(201).json({
            status: "success",
            message: "Successfully added",
            item: newItem
        })
    } catch (error) {
        console.error("Error saving item:", error);
        return res.status(500).json({
            error: "Internal server error while saving the item."
        });
    }
}

exports.getAllFoundItems = async function(req,res){
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const { search, category } = req.query;
        
        let query = {};
        
        if (category) {
            query.category = category;
        }
        
        if (search && typeof search === 'string') {
            // ReDoS protection: trim, limit length, and escape special regex characters
            const sanitizedSearch = escapeRegExp(search.substring(0, 100));
            query.$or = [
                { shortTitle: { $regex: sanitizedSearch, $options: 'i' } },
                { location: { $regex: sanitizedSearch, $options: 'i' } }
            ];
        }

        const totalItems = await itemModel.countDocuments(query);

        const allItems = await itemModel.find(query)
            .select('-secretIdentity')
            .populate('reportedBy', 'email')
            .sort({ dateFound: -1 })
            .skip(skip)
            .limit(limit);

        const userEmail = req.user ? req.user.email : null;
        const userDomain = userEmail ? userEmail.split('@')[1].toLowerCase() : null;

        const sanitizedItems = allItems.map(item => {
            const itemObj = item.toObject();
            const finderEmail = itemObj.reportedBy?.email;
            
            if (finderEmail) {
                const finderDomain = finderEmail.split('@')[1].toLowerCase();
                itemObj.isFinder = userEmail ? (userEmail.toLowerCase() === finderEmail.toLowerCase()) : false;
                itemObj.isSameCollege = userDomain ? (userDomain === finderDomain) : false;
            } else {
                itemObj.isFinder = false;
                itemObj.isSameCollege = false;
            }
            delete itemObj.reportedBy; // Erase the entire reportedBy object to protect privacy
            return itemObj;
        });

        return res.status(200).json({
            status: "success",
            items: sanitizedItems,
            pagination: {
                totalItems,
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                hasMore: (page * limit) < totalItems
            }
        });
    } catch (error) {
        return res.status(400).json({
            errorMsg: error
        })
    }
}

exports.getFoundItemById = async function(req,res){
    try {
        const { itemid } = req.params
        if(!itemid){
            return res.status(400).json({Status: "item id not found"})
        }
        const item = await itemModel.findById(itemid)
            .select('-secretIdentity')
            .populate('reportedBy', 'email');
        if(!item){
            return res.status(400).json({
                errorMsg: "item not found"
            })
        }

        const userEmail = req.user ? req.user.email : null;
        const userDomain = userEmail ? userEmail.split('@')[1].toLowerCase() : null;

        const itemObj = item.toObject();
        const finderEmail = itemObj.reportedBy?.email;
        
        if (finderEmail) {
            const finderDomain = finderEmail.split('@')[1].toLowerCase();
            itemObj.isFinder = userEmail ? (userEmail.toLowerCase() === finderEmail.toLowerCase()) : false;
            itemObj.isSameCollege = userDomain ? (userDomain === finderDomain) : false;
        } else {
            itemObj.isFinder = false;
            itemObj.isSameCollege = false;
        }
        delete itemObj.reportedBy; // Erase the entire reportedBy object to protect privacy

        return res.status(200).json({
            status: "success",
            items: itemObj
        })
    } catch (error) {
        return res.status(400).json({
            errorMsg: error
        })
    }
}

exports.scanFraud = async function(req, res) {
    try {
        const { base64ImageData, description, category } = req.body;
        
        if (!base64ImageData) {
            return res.status(400).json({ error: "Missing image data for fraud scan." });
        }

        // Ensure the user is authenticated to use this endpoint (prevent abuse)
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: "Unauthorized. You must be logged in to run fraud detection." });
        }

        const aiResult = await analyzeImageForFraud(base64ImageData, description || "", category || "other");
        
        return res.status(200).json(aiResult);
    } catch (error) {
        console.error("Error in scanFraud:", error);
        return res.status(500).json({
            error: "Internal server error during fraud scan."
        });
    }
}

exports.deleteItem = async function(req, res) {
    try {
        const { id } = req.params;
        
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const item = await itemModel.findById(id);
        
        if (!item) {
            return res.status(404).json({ error: "Item not found" });
        }

        if (item.reportedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "You can only delete your own reported items." });
        }

        if (item.status === 'claimed') {
            return res.status(400).json({ error: "Cannot delete an item that has already been claimed." });
        }

        await itemModel.findByIdAndDelete(id);

        return res.status(200).json({
            status: "success",
            message: "Item deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting item:", error);
        return res.status(500).json({
            error: "Internal server error"
        });
    }
}
