import mongoose from "mongoose";
import User from "../models/user.model.js";
import FriendRequest, { pairKeyFor } from "../models/friendRequest.model.js";
import { getFriendIds, PUBLIC_USER_FIELDS, toPublicUser } from "../lib/friends.js";
import { normalizeEmail } from "../lib/utils.js";
import { io, userRoom } from "../lib/socket.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const emit = (userId, event, payload) => io.to(userRoom(userId)).emit(event, payload);

// GET /api/friends
export const getFriends = async (req, res) => {
  try {
    const ids = await getFriendIds(req.user._id);
    const friends = await User.find({ _id: { $in: ids } })
      .select(PUBLIC_USER_FIELDS)
      .sort({ fullName: 1 });
    res.status(200).json(friends);
  } catch (error) {
    console.log("Error in getFriends:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/friends/requests -> { incoming: [{ _id, user }], outgoing: [{ _id, user }] }
export const getRequests = async (req, res) => {
  try {
    const me = req.user._id;
    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ receiver: me, status: "pending" })
        .populate("sender", PUBLIC_USER_FIELDS)
        .sort({ createdAt: -1 }),
      FriendRequest.find({ sender: me, status: "pending" })
        .populate("receiver", PUBLIC_USER_FIELDS)
        .sort({ createdAt: -1 }),
    ]);

    res.status(200).json({
      incoming: incoming.filter((r) => r.sender).map((r) => ({ _id: r._id, user: r.sender })),
      outgoing: outgoing.filter((r) => r.receiver).map((r) => ({ _id: r._id, user: r.receiver })),
    });
  } catch (error) {
    console.log("Error in getRequests:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/friends/search?q=  — by name (partial) or exact email; never returns emails
export const searchUsers = async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      return res.status(400).json({ message: "Type at least 2 characters to search" });
    }
    if (q.length > 100) {
      return res.status(400).json({ message: "Search is too long" });
    }

    const me = req.user._id;
    const users = await User.find({
      _id: { $ne: me },
      $or: [{ fullName: { $regex: escapeRegex(q), $options: "i" } }, { email: normalizeEmail(q) }],
    })
      .select(PUBLIC_USER_FIELDS)
      .limit(20);

    // Tell the client how each result relates to me, so it can show the right button
    const relations = await FriendRequest.find({
      pairKey: { $in: users.map((u) => pairKeyFor(me, u._id)) },
    });
    const byKey = new Map(relations.map((r) => [r.pairKey, r]));

    const results = users.map((u) => {
      const r = byKey.get(pairKeyFor(me, u._id));
      let status = "none";
      if (r?.status === "accepted") status = "friend";
      else if (r) status = r.sender.toString() === me.toString() ? "outgoing" : "incoming";
      return { ...toPublicUser(u), status, requestId: r?._id ?? null };
    });

    res.status(200).json(results);
  } catch (error) {
    console.log("Error in searchUsers:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/friends/requests/:userId
export const sendRequest = async (req, res) => {
  try {
    const me = req.user._id;
    const { userId } = req.params;

    if (!isValidId(userId)) return res.status(400).json({ message: "Invalid user id" });
    if (userId === me.toString()) {
      return res.status(400).json({ message: "You can't send a friend request to yourself" });
    }

    const target = await User.findById(userId).select(PUBLIC_USER_FIELDS);
    if (!target) return res.status(404).json({ message: "User not found" });

    const pairKey = pairKeyFor(me, userId);
    const existing = await FriendRequest.findOne({ pairKey });

    if (existing?.status === "accepted") {
      return res.status(400).json({ message: "You're already friends" });
    }

    if (existing && existing.sender.toString() === me.toString()) {
      return res.status(400).json({ message: "Friend request already sent" });
    }

    // They already asked me: sending one back means yes
    if (existing) {
      existing.status = "accepted";
      await existing.save();
      emit(userId, "friend:added", { requestId: existing._id, user: toPublicUser(req.user) });
      return res.status(200).json({ status: "friend", requestId: existing._id, user: toPublicUser(target) });
    }

    const request = await FriendRequest.create({ sender: me, receiver: userId, pairKey });
    emit(userId, "friendRequest:received", { _id: request._id, user: toPublicUser(req.user) });

    res.status(201).json({ status: "outgoing", requestId: request._id, user: toPublicUser(target) });
  } catch (error) {
    if (error.code === 11000) {
      // Both users sent a request at the same moment
      return res.status(409).json({ message: "A request between you already exists. Refresh and try again." });
    }
    console.log("Error in sendRequest:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const findPendingRequest = async (requestId) => {
  if (!isValidId(requestId)) return null;
  return FriendRequest.findOne({ _id: requestId, status: "pending" });
};

// POST /api/friends/requests/:requestId/accept
export const acceptRequest = async (req, res) => {
  try {
    const me = req.user._id;
    const request = await findPendingRequest(req.params.requestId);
    if (!request || request.receiver.toString() !== me.toString()) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    request.status = "accepted";
    await request.save();

    const sender = await User.findById(request.sender).select(PUBLIC_USER_FIELDS);
    emit(request.sender, "friend:added", { requestId: request._id, user: toPublicUser(req.user) });

    res.status(200).json({ requestId: request._id, user: sender ? toPublicUser(sender) : null });
  } catch (error) {
    console.log("Error in acceptRequest:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/friends/requests/:requestId/decline
export const declineRequest = async (req, res) => {
  try {
    const me = req.user._id;
    const request = await findPendingRequest(req.params.requestId);
    if (!request || request.receiver.toString() !== me.toString()) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    await request.deleteOne();
    emit(request.sender, "friendRequest:removed", { requestId: request._id });

    res.status(200).json({ requestId: request._id });
  } catch (error) {
    console.log("Error in declineRequest:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/friends/requests/:requestId  (sender cancels)
export const cancelRequest = async (req, res) => {
  try {
    const me = req.user._id;
    const request = await findPendingRequest(req.params.requestId);
    if (!request || request.sender.toString() !== me.toString()) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    await request.deleteOne();
    emit(request.receiver, "friendRequest:removed", { requestId: request._id });

    res.status(200).json({ requestId: request._id });
  } catch (error) {
    console.log("Error in cancelRequest:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/friends/:userId
export const removeFriend = async (req, res) => {
  try {
    const me = req.user._id;
    const { userId } = req.params;
    if (!isValidId(userId)) return res.status(400).json({ message: "Invalid user id" });

    const deleted = await FriendRequest.findOneAndDelete({
      pairKey: pairKeyFor(me, userId),
      status: "accepted",
    });
    if (!deleted) return res.status(404).json({ message: "You're not friends with this user" });

    emit(userId, "friend:removed", { userId: me.toString() });

    res.status(200).json({ userId });
  } catch (error) {
    console.log("Error in removeFriend:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
