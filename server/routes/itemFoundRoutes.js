const express = require("express")
const router = express.Router()
const {verifyJWT} = require("../middlewares/authMiddleware")
const controller = require("../controllers/itemFoundController")
router.post('/api/item/add', verifyJWT,controller.addItem)
router.get('/api/item/getAllFoundItems', verifyJWT, controller.getAllFoundItems)
router.get('/api/item/getFoundItemById/:itemid', verifyJWT, controller.getFoundItemById)
module.exports = router