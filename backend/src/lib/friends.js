import FriendRequest, { pairKeyFor } from "../models/friendRequest.model.js";

// Fields of a user that are safe to show to other people
export const PUBLIC_USER_FIELDS = "fullName profilePic";

export const toPublicUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  profilePic: user.profilePic,
});

export const areFriends = async (userA, userB) =>
  Boolean(await FriendRequest.exists({ pairKey: pairKeyFor(userA, userB), status: "accepted" }));

export const getFriendIds = async (userId) => {
  const accepted = await FriendRequest.find({
    status: "accepted",
    $or: [{ sender: userId }, { receiver: userId }],
  }).select("sender receiver");

  const me = userId.toString();
  return accepted.map((r) => (r.sender.toString() === me ? r.receiver : r.sender));
};
