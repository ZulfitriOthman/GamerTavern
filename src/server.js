import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();

/* ---------------------------- Middleware ---------------------------- */
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

/* ----------------------------- Routes ------------------------------- */
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "GamerTavern Admin Backend is running"
  });
});

/* ---------------------------- Server -------------------------------- */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 GamerTavern Admin API running on port ${PORT}`);
});
