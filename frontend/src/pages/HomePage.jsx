import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useFriendStore } from "../store/useFriendStore";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { socket } = useAuthStore();
  const { fetchRequests, subscribeToFriendEvents, unsubscribeFromFriendEvents, reset } = useFriendStore();

  // Load pending requests (for the badge) once, and clear everything on logout
  useEffect(() => {
    fetchRequests();
    return () => {
      reset();
      setSelectedUser(null);
    };
  }, [fetchRequests, reset, setSelectedUser]);

  // Live friend request updates
  useEffect(() => {
    if (!socket) return;
    subscribeToFriendEvents();
    return () => unsubscribeFromFriendEvents();
  }, [socket, subscribeToFriendEvents, unsubscribeFromFriendEvents]);

  return (
    <div className="h-screen bg-base-200">
      <div className="flex items-center justify-center pt-20 px-4">
        <div className="bg-base-100 rounded-lg shadow-cl w-full max-w-6xl h-[calc(100vh-8rem)]">
          <div className="flex h-full rounded-lg overflow-hidden">
            <Sidebar />

            {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
          </div>
        </div>
      </div>
    </div>
  );
};
export default HomePage;
