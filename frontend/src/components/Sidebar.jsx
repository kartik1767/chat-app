import { useCallback, useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { UserPlus, Users } from "lucide-react";
import { useFriendStore } from "../store/useFriendStore";
import FriendsModal from "./FriendsModal";

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } = useChatStore();
  const { incoming } = useFriendStore();

  const { onlineUsers } = useAuthStore();
  // `users` is the friends list, so this counts online friends
  const onlineContactsCount = users.filter((u) => onlineUsers.includes(u._id)).length;
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [friendsModal, setFriendsModal] = useState({ open: false, tab: "find" });
  const openFriends = (tab = "find") => setFriendsModal({ open: true, tab });
  const closeFriends = useCallback(() => setFriendsModal((m) => ({ ...m, open: false })), []);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex flex-col lg:flex-row items-center gap-2">
          <Users className="size-6 hidden lg:block" />
          <span className="font-medium hidden lg:block flex-1">Friends</span>
          <button
            className="btn btn-sm btn-ghost btn-square relative"
            onClick={() => openFriends(incoming.length > 0 ? "requests" : "find")}
            title="Add friends & requests"
            aria-label={`Add friends${incoming.length ? `, ${incoming.length} pending requests` : ""}`}
          >
            <UserPlus className="size-5" />
            {incoming.length > 0 && (
              <span className="badge badge-primary badge-xs absolute -top-1 -right-1 min-w-4 h-4 text-[10px]">
                {incoming.length}
              </span>
            )}
          </button>
        </div>
        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineContactsCount} online)</span>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3">
        {filteredUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => setSelectedUser(user)}
            className={`
              w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-colors
              ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative mx-auto lg:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.fullName}
                className="size-12 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
            </div>

            {/* User info - only visible on larger screens */}
            <div className="hidden lg:block text-left min-w-0">
              <div className="font-medium truncate">{user.fullName}</div>
              <div className="text-sm text-zinc-400">
                {onlineUsers.includes(user._id) ? "Online" : "Offline"}
              </div>
            </div>
          </button>
        ))}

        {filteredUsers.length === 0 &&
          (showOnlineOnly ? (
            <div className="text-center text-zinc-500 py-4 text-sm">No friends online</div>
          ) : (
            <div className="text-center text-zinc-500 py-6 px-3 space-y-3">
              <p className="hidden lg:block text-sm">No friends yet. Add people to start chatting.</p>
              <button className="btn btn-sm btn-primary gap-1" onClick={() => openFriends("find")}>
                <UserPlus className="size-4" />
                <span className="hidden lg:inline">Find people</span>
              </button>
            </div>
          ))}
      </div>

      <FriendsModal open={friendsModal.open} initialTab={friendsModal.tab} onClose={closeFriends} />
    </aside>
  );
};
export default Sidebar;
