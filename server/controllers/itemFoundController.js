const itemModel = require("../models/foundItemModel")
const { analyzeImageForFraud } = require("../utils/geminiUtils");

exports.addItem = async function(req,res){
    try {
        //console.log("hello")
        const {category,shortTitle,description,location,secretIdentity,status,images,blurZones,dateFound} = req.body

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
        const newItem = await itemModel.create({
            reportedBy: req.user._id, category,shortTitle,description,location,secretIdentity,status:status || "found",images: images || [], blurZones: blurZones || [],dateFound: dateFound || Date.now()
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
        const allItems = await itemModel.find()
            .select('-secretIdentity')
            .populate('reportedBy', 'email')
            .sort({ createdAt: -1 });
        return res.status(200).json({
            status: "success",
            items: allItems
        })
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
        return res.status(200).json({
            status: "success",
            items: item
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
