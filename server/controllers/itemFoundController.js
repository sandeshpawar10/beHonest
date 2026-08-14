const itemModel = require("../models/foundItemModel")
const { analyzeImageForFraud } = require("../utils/geminiUtils");
const { uploadImage } = require("../utils/cloudinary");

exports.addItem = async function(req,res){
    try {
        //console.log("hello")
        const {category,shortTitle,description,location,secretIdentity,status,images,blurZones,dateFound,imageFingerprint} = req.body

        if(!category || !shortTitle || !description || !location){
            return res.status(400).json({
                error: "Incomplete data, Please fill all required fields."
            })
        }
        if(!req.user || !req.user._id){
            return res.status(401).json({
                error: "Unauthorized. You must be logged in to report an item."
            });
        }

        // Intercept base64 images and upload to Cloudinary
        let uploadedImageUrls = [];
        if (images && Array.isArray(images)) {
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
            reportedBy: req.user._id, category,shortTitle,description,location,secretIdentity,status:status || "found",images: uploadedImageUrls, blurZones: blurZones || [],dateFound: dateFound || Date.now(), imageFingerprint: imageFingerprint || ""
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
        
        if (search) {
            query.$or = [
                { shortTitle: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } }
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
                delete itemObj.reportedBy.email; // Erase the email to protect privacy
            } else {
                itemObj.isFinder = false;
                itemObj.isSameCollege = false;
            }
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
            delete itemObj.reportedBy.email; // Erase the email to protect privacy
        } else {
            itemObj.isFinder = false;
            itemObj.isSameCollege = false;
        }

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
