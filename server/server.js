const express = require("express")
const connectDB = require("./db/connection")
const cors = require("cors")
const dotenv = require("dotenv")
const userRoute = require("./routes/userRoutes")
const itemRoute = require("./routes/itemFoundRoutes")
const claimRoute = require("./routes/claimRoutes")
const escrowRoute = require("./routes/escrowRoutes")
const chatRoute = require("./routes/chatRoutes")
const adminRoute = require('./routes/adminRoutes')
const notificationRoute = require('./routes/notificationRoutes')
const cookieParser = require("cookie-parser")
const { requireCustomHeaderCSRF } = require("./middlewares/csrfMiddleware");
const https = require('https');
dotenv.config()
const app = express()
app.set('trust proxy', 1);  // Required: Render runs behind a reverse proxy
const port = process.env.port || 8000
connectDB(process.env.Database_url)
// Parse allowed origins from .env, fallback to localhost for development
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ["http://localhost:5173", "http://localhost:5174"];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'));
      }
    },
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Apply CSRF Protection to all API routes
app.use('/api', requireCustomHeaderCSRF);

app.use('/', userRoute)
app.use('/', itemRoute)
app.use('/', claimRoute)
app.use('/', escrowRoute)
app.use('/', chatRoute)
app.use('/', adminRoute)
app.use('/', notificationRoute)

// Simple ping route to keep the server awake
app.get('/api/ping', (req, res) => {
    res.status(200).json({ status: "alive", message: "Server is awake!" });
});

// Seed Superadmin
const seedAdmin = async () => {
    const adminModel = require("./models/adminModel");
    const count = await adminModel.countDocuments();
    if (count === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        await adminModel.create({
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
            role: "superadmin"
        });
        console.log("Seeded initial superadmin account from environment variables.");
    }
};

app.listen(port, async () => {
    await seedAdmin();
    console.log("server is started")

    // --- Self-Ping Cron Job for Render Free Tier ---
    // Render free tier spins down the server after 15 minutes of inactivity.
    // This internal interval pings the server's own public URL every 12 minutes to keep it awake.
    // Ensure you set RENDER_EXTERNAL_URL in your Render dashboard environment variables if it's not automatically set.
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    if (renderUrl) {
        setInterval(() => {
            https.get(`${renderUrl}/api/ping`, (res) => {
                console.log(`[Self-Ping] Kept server awake. Status: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error(`[Self-Ping] Failed to ping server:`, err.message);
            });
        }, 12 * 60 * 1000); // 12 minutes
        console.log(`[Self-Ping] Cron job started for ${renderUrl}`);
    } else {
        console.log(`[Self-Ping] RENDER_EXTERNAL_URL is not set. Self-ping cron job is disabled.`);
    }
})