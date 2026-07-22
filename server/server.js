const express = require("express")
const connectDB = require("./db/connection")
const cors = require("cors")
const dotenv = require("dotenv")
const userRoute = require("./routes/userRoutes")
const cookieParser = require("cookie-parser")
dotenv.config()
const app = express()
const port = process.env.port || 8000
connectDB(process.env.Database_url)
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true
  })
);
app.use('/', userRoute)
app.listen(port,()=>{
    console.log("server is started")
})