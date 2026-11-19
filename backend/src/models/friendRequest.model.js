import mongoose from "mongoose";

// One document per pair of users. "pending" = request sent, "accepted" = friends.
// Declining, cancelling or unfriending deletes the document, so either side can ask again later.
const friendRequestSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
    },
    // Sorted "<idA>_<idB>" so A→B and B→A map to the same key and can't both exist
    pairKey: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

friendRequestSchema.index({ receiver: 1, status: 1 });
friendRequestSchema.index({ sender: 1, status: 1 });

export const pairKeyFor = (a, b) => [a.toString(), b.toString()].sort().join("_");

const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);

export default FriendRequest;
