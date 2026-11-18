// Load .env before any other module reads process.env
import "dotenv/config";

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import path from "path";

import { connectDB } from "./lib/db.js";
import { CLIENT_URL } from "./lib/utils.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

// Images are capped at ~5 MB in the controllers; base64 adds ~33%
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ limit: "8mb", extended: true }));

app.use(cookieParser());
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Oversized bodies and bad JSON get a clear 4xx instead of a stack trace
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Upload is too large (max 5 MB image)" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid request body" });
  }
  console.log("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

server.listen(PORT, () => {
  console.log("server is running on PORT:-" + PORT);
  connectDB();
});
