import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { getErrorMessage } from "../lib/utils";
import { useAuthStore } from "./useAuthStore";

// Append a message unless it's already shown (the sender gets it both from the HTTP response and the socket)
const addMessage = (messages, message) =>
  messages.some((m) => m._id === message._id) ? messages : [...messages, message];

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      // Ignore a late response if the user switched to another chat meanwhile
      if (get().selectedUser?._id === userId) set({ messages: res.data });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      // Read messages *after* the await so ones that arrived over the socket meanwhile aren't lost
      if (get().selectedUser?._id === selectedUser._id) {
        set({ messages: addMessage(get().messages, res.data) });
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      throw error;
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || !socket) return;

    socket.off("newMessage");
    socket.on("newMessage", (newMessage) => {
      const current = get().selectedUser;
      if (!current) return;

      // Show it if it belongs to the open conversation, in either direction
      // (sent from another of my tabs, or received from the other person)
      const isInOpenChat =
        newMessage.senderId === current._id || newMessage.receiverId === current._id;
      if (!isInOpenChat) return;

      set({ messages: addMessage(get().messages, newMessage) });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off("newMessage");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser, messages: [] }),
}));
