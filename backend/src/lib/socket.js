import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { CLIENT_URL } from "./utils.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL],
    credentials: true,
  },
});

// Online users: { userId: Set<socketId> } so several tabs per user work
const onlineUsers = new Map();

const getOnlineUserIds = () => [...onlineUsers.keys()];

// Each user joins a room named after their id; emit to that room to reach all their tabs
export const userRoom = (userId) => userId.toString();

const readCookie = (cookieHeader = "", name) => {
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
};

// Authenticate every socket with the same JWT cookie the REST API uses,
// instead of trusting a userId sent by the client.
io.use(async (socket, next) => {
  try {
    const token = readCookie(socket.handshake.headers.cookie, "jwt");
    if (!token) return next(new Error("Unauthorized"));

    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.exists({ _id: userId });
    if (!user) return next(new Error("Unauthorized"));

    socket.data.userId = userId.toString();
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const { userId } = socket.data;

  socket.join(userRoom(userId));
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socket.id);

  io.emit("getOnlineUsers", getOnlineUserIds());

  socket.on("disconnect", () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) onlineUsers.delete(userId);
    }
    io.emit("getOnlineUsers", getOnlineUserIds());
  });
});

export { io, app, server };
