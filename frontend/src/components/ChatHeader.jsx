import { UserMinus, X } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { removeFriend, pendingIds } = useFriendStore();

  const handleUnfriend = () => {
    if (window.confirm(`Remove ${selectedUser.fullName} from your friends? You won't be able to message each other.`)) {
      removeFriend(selectedUser);
    }
  };

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="btn btn-sm btn-ghost btn-square"
            onClick={handleUnfriend}
            disabled={pendingIds.includes(selectedUser._id)}
            title="Remove friend"
            aria-label={`Remove ${selectedUser.fullName} from friends`}
          >
            <UserMinus className="size-5" />
          </button>

          {/* Close button */}
          <button
            className="btn btn-sm btn-ghost btn-square"
            onClick={() => setSelectedUser(null)}
            aria-label="Close chat"
          >
            <X />
          </button>
        </div>
      </div>
    </div>
  );
};
export default ChatHeader;
