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
const cookieParser = require("cookie-parser")
dotenv.config()
const app = express()
const port = process.env.port || 8000
connectDB(process.env.Database_url)
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use('/', userRoute)
app.use('/', itemRoute)
app.use('/', claimRoute)
app.use('/', escrowRoute)
app.use('/', chatRoute)
app.use('/', adminRoute)
app.listen(port,()=>{
    console.log("server is started")
})