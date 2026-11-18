import mongoose from "mongoose";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userRoom } from "../lib/socket.js";
import { validateImageDataUrl } from "../lib/utils.js";

const MAX_TEXT_LENGTH = 5000;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    // Only what the sidebar needs; don't hand every user's email to every other user
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select(
      "fullName profilePic"
    );
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    if (!isValidId(userToChatId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { image } = req.body;
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!isValidId(receiverId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (!text && !image) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ message: `Message must be ${MAX_TEXT_LENGTH} characters or fewer` });
    }

    if (image) {
      const imageError = validateImageDataUrl(image);
      if (imageError) return res.status(400).json({ message: imageError });
    }

    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text: text || undefined,
      image: imageUrl,
    });

    // Deliver to every open tab of the receiver and of the sender
    io.to(userRoom(receiverId)).to(userRoom(senderId)).emit("newMessage", newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
