const express = require("express")
const router = express.Router()
const {verifyJWT} = require("../middlewares/authMiddleware")
const controller = require("../controllers/userController")
router.post('/api/user/register',controller.registerUser)
router.post('/api/user/login',controller.loginUser)
router.post('/api/user/logout',verifyJWT,controller.logoutUser)
module.exports = router