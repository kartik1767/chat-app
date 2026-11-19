import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  acceptRequest,
  cancelRequest,
  declineRequest,
  getFriends,
  getRequests,
  removeFriend,
  searchUsers,
  sendRequest,
} from "../controllers/friend.controller.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", getFriends);
router.get("/requests", getRequests);
router.get("/search", searchUsers);

router.post("/requests/:userId", sendRequest);
router.post("/requests/:requestId/accept", acceptRequest);
router.post("/requests/:requestId/decline", declineRequest);
router.delete("/requests/:requestId", cancelRequest);

router.delete("/:userId", removeFriend);

export default router;
