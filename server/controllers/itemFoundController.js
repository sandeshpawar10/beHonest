const itemModel = require("../models/foundItemModel")

exports.addItem = async function(req,res){
    try {
        console.log("hello")
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
        const item = await itemModel.findById(itemid).populate('reportedBy', 'email')
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

