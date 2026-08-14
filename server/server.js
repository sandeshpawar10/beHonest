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
dotenv.config()
const app = express()
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
app.use('/', userRoute)
app.use('/', itemRoute)
app.use('/', claimRoute)
app.use('/', escrowRoute)
app.use('/', chatRoute)
app.use('/', adminRoute)
app.use('/', notificationRoute)
app.listen(port,()=>{
    console.log("server is started")
})