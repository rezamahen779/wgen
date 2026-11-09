import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { parseTransactionText, parseTransactionReceipt } from "./aiService";

dotenv.config();

const app = express();

// 🟢 Middleware CORS Paling Atas
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// Handle Preflight OPTIONS untuk semua endpoint
app.options("*", cors());

app.use(express.json({ limit: "10mb" }));

// ... Sisa route app.post("/api/parse-chat", ...) tetap sama ...

export default app;
