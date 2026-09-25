const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// We need the raw body to verify the Razorpay signature.
// By using express.raw here, it prevents express.json() from parsing it later if this route is hit.
router.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), webhookController.razorpayWebhook);

module.exports = router;
