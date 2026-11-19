import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { getErrorMessage } from "../lib/utils";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";

const FRIEND_EVENTS = ["friendRequest:received", "friendRequest:removed", "friend:added", "friend:removed"];

// Friends themselves live in useChatStore.users (that's the sidebar list);
// this store owns pending requests and people search.
export const useFriendStore = create((set, get) => ({
  incoming: [], // [{ _id: requestId, user }]
  outgoing: [], // [{ _id: requestId, user }]
  searchResults: [], // [{ _id, fullName, profilePic, status, requestId }]
  searchQuery: "",
  isSearching: false,
  isLoadingRequests: false,
  pendingIds: [], // user/request ids with a request in flight, to disable their buttons

  setBusy: (id, busy) =>
    set((s) => ({ pendingIds: busy ? [...s.pendingIds, id] : s.pendingIds.filter((x) => x !== id) })),

  // Keep the status shown in search results in sync with what just happened
  patchSearchResult: (userId, changes) =>
    set((s) => ({
      searchResults: s.searchResults.map((u) => (u._id === userId ? { ...u, ...changes } : u)),
    })),

  fetchRequests: async () => {
    set({ isLoadingRequests: true });
    try {
      const res = await axiosInstance.get("/friends/requests");
      set({ incoming: res.data.incoming, outgoing: res.data.outgoing });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      set({ isLoadingRequests: false });
    }
  },

  search: async (query) => {
    const q = query.trim();
    set({ searchQuery: q });
    if (q.length < 2) return set({ searchResults: [], isSearching: false });

    set({ isSearching: true });
    try {
      const res = await axiosInstance.get("/friends/search", { params: { q } });
      // Ignore responses for a query the user has already typed past
      if (get().searchQuery === q) set({ searchResults: res.data });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      if (get().searchQuery === q) set({ isSearching: false });
    }
  },

  sendRequest: async (user) => {
    get().setBusy(user._id, true);
    try {
      const res = await axiosInstance.post(`/friends/requests/${user._id}`);
      const { status, requestId } = res.data;
      get().patchSearchResult(user._id, { status, requestId });

      if (status === "friend") {
        // They had already asked us, so this accepted their request
        set((s) => ({ incoming: s.incoming.filter((r) => r._id !== requestId) }));
        useChatStore.getState().addFriend(res.data.user);
        toast.success(`You and ${user.fullName} are now friends`);
      } else {
        set((s) => ({ outgoing: [{ _id: requestId, user: res.data.user }, ...s.outgoing] }));
        toast.success(`Friend request sent to ${user.fullName}`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      get().setBusy(user._id, false);
    }
  },

  acceptRequest: async (request) => {
    get().setBusy(request._id, true);
    try {
      await axiosInstance.post(`/friends/requests/${request._id}/accept`);
      set((s) => ({ incoming: s.incoming.filter((r) => r._id !== request._id) }));
      get().patchSearchResult(request.user._id, { status: "friend" });
      useChatStore.getState().addFriend(request.user);
      toast.success(`You and ${request.user.fullName} are now friends`);
    } catch (error) {
      toast.error(getErrorMessage(error));
      get().fetchRequests();
    } finally {
      get().setBusy(request._id, false);
    }
  },

  declineRequest: async (request) => {
    get().setBusy(request._id, true);
    try {
      await axiosInstance.post(`/friends/requests/${request._id}/decline`);
      set((s) => ({ incoming: s.incoming.filter((r) => r._id !== request._id) }));
      get().patchSearchResult(request.user._id, { status: "none", requestId: null });
    } catch (error) {
      toast.error(getErrorMessage(error));
      get().fetchRequests();
    } finally {
      get().setBusy(request._id, false);
    }
  },

  cancelRequest: async (request) => {
    get().setBusy(request._id, true);
    try {
      await axiosInstance.delete(`/friends/requests/${request._id}`);
      set((s) => ({ outgoing: s.outgoing.filter((r) => r._id !== request._id) }));
      get().patchSearchResult(request.user._id, { status: "none", requestId: null });
    } catch (error) {
      toast.error(getErrorMessage(error));
      get().fetchRequests();
    } finally {
      get().setBusy(request._id, false);
    }
  },

  removeFriend: async (user) => {
    get().setBusy(user._id, true);
    try {
      await axiosInstance.delete(`/friends/${user._id}`);
      useChatStore.getState().removeFriend(user._id);
      get().patchSearchResult(user._id, { status: "none", requestId: null });
      toast.success(`Removed ${user.fullName} from your friends`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      get().setBusy(user._id, false);
    }
  },

  // Live updates from the server
  subscribeToFriendEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    get().unsubscribeFromFriendEvents();

    socket.on("friendRequest:received", (request) => {
      set((s) => ({
        incoming: [request, ...s.incoming.filter((r) => r._id !== request._id)],
      }));
      get().patchSearchResult(request.user._id, { status: "incoming", requestId: request._id });
      toast(`${request.user.fullName} sent you a friend request`, { icon: "👋" });
    });

    socket.on("friendRequest:removed", ({ requestId }) => {
      const s = get();
      const affected = [...s.incoming, ...s.outgoing].find((r) => r._id === requestId);
      set({
        incoming: s.incoming.filter((r) => r._id !== requestId),
        outgoing: s.outgoing.filter((r) => r._id !== requestId),
      });
      if (affected) get().patchSearchResult(affected.user._id, { status: "none", requestId: null });
    });

    socket.on("friend:added", ({ requestId, user }) => {
      set((s) => ({
        incoming: s.incoming.filter((r) => r._id !== requestId),
        outgoing: s.outgoing.filter((r) => r._id !== requestId),
      }));
      get().patchSearchResult(user._id, { status: "friend" });
      useChatStore.getState().addFriend(user);
      toast.success(`You and ${user.fullName} are now friends`);
    });

    socket.on("friend:removed", ({ userId }) => {
      useChatStore.getState().removeFriend(userId);
      get().patchSearchResult(userId, { status: "none", requestId: null });
    });
  },

  unsubscribeFromFriendEvents: () => {
    const socket = useAuthStore.getState().socket;
    FRIEND_EVENTS.forEach((event) => socket?.off(event));
  },

  reset: () => set({ incoming: [], outgoing: [], searchResults: [], searchQuery: "", pendingIds: [] }),
}));
