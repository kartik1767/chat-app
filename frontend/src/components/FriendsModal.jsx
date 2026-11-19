import { useEffect, useState } from "react";
import { Check, Clock, Loader2, Search, UserCheck, UserPlus, X } from "lucide-react";
import { useFriendStore } from "../store/useFriendStore";
import { useChatStore } from "../store/useChatStore";

const Avatar = ({ user }) => (
  <img
    src={user.profilePic || "/avatar.png"}
    alt={user.fullName}
    className="size-10 rounded-full object-cover shrink-0"
  />
);

const PersonRow = ({ user, children }) => (
  <li className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200">
    <Avatar user={user} />
    <span className="flex-1 min-w-0 truncate font-medium">{user.fullName}</span>
    <div className="flex items-center gap-2 shrink-0">{children}</div>
  </li>
);

const FindPeople = ({ onOpenChat }) => {
  const { search, searchResults, isSearching, sendRequest, acceptRequest, cancelRequest, pendingIds } =
    useFriendStore();
  const [query, setQuery] = useState("");

  // Search as you type, but wait for a short pause so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const trimmed = query.trim();

  return (
    <div className="space-y-3">
      <label className="input input-bordered flex items-center gap-2">
        <Search className="size-4 opacity-60" />
        <input
          type="text"
          className="grow"
          placeholder="Search by name or exact email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {isSearching && <Loader2 className="size-4 animate-spin opacity-60" />}
      </label>

      {trimmed.length < 2 ? (
        <p className="text-sm text-base-content/60 text-center py-6">
          Type at least 2 characters to find people.
        </p>
      ) : !isSearching && searchResults.length === 0 ? (
        <p className="text-sm text-base-content/60 text-center py-6">No one found for “{trimmed}”.</p>
      ) : (
        <ul className="space-y-1">
          {searchResults.map((user) => {
            const busy = pendingIds.includes(user._id) || pendingIds.includes(user.requestId);
            const request = { _id: user.requestId, user };
            return (
              <PersonRow key={user._id} user={user}>
                {user.status === "friend" && (
                  <button className="btn btn-sm btn-ghost gap-1" onClick={() => onOpenChat(user)}>
                    <UserCheck className="size-4" /> Message
                  </button>
                )}
                {user.status === "none" && (
                  <button className="btn btn-sm btn-primary gap-1" disabled={busy} onClick={() => sendRequest(user)}>
                    <UserPlus className="size-4" /> Add
                  </button>
                )}
                {user.status === "outgoing" && (
                  <button className="btn btn-sm gap-1" disabled={busy} onClick={() => cancelRequest(request)}>
                    <Clock className="size-4" /> Cancel request
                  </button>
                )}
                {user.status === "incoming" && (
                  <button className="btn btn-sm btn-primary gap-1" disabled={busy} onClick={() => acceptRequest(request)}>
                    <Check className="size-4" /> Accept
                  </button>
                )}
              </PersonRow>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const Requests = () => {
  const { incoming, outgoing, isLoadingRequests, acceptRequest, declineRequest, cancelRequest, pendingIds } =
    useFriendStore();

  if (isLoadingRequests && incoming.length === 0 && outgoing.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin opacity-60" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <h4 className="text-sm font-semibold mb-2">Received ({incoming.length})</h4>
        {incoming.length === 0 ? (
          <p className="text-sm text-base-content/60">No pending requests.</p>
        ) : (
          <ul className="space-y-1">
            {incoming.map((r) => (
              <PersonRow key={r._id} user={r.user}>
                <button
                  className="btn btn-sm btn-primary btn-square"
                  title="Accept"
                  aria-label={`Accept ${r.user.fullName}`}
                  disabled={pendingIds.includes(r._id)}
                  onClick={() => acceptRequest(r)}
                >
                  <Check className="size-4" />
                </button>
                <button
                  className="btn btn-sm btn-ghost btn-square"
                  title="Decline"
                  aria-label={`Decline ${r.user.fullName}`}
                  disabled={pendingIds.includes(r._id)}
                  onClick={() => declineRequest(r)}
                >
                  <X className="size-4" />
                </button>
              </PersonRow>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-sm font-semibold mb-2">Sent ({outgoing.length})</h4>
        {outgoing.length === 0 ? (
          <p className="text-sm text-base-content/60">You haven&apos;t sent any requests.</p>
        ) : (
          <ul className="space-y-1">
            {outgoing.map((r) => (
              <PersonRow key={r._id} user={r.user}>
                <button className="btn btn-sm" disabled={pendingIds.includes(r._id)} onClick={() => cancelRequest(r)}>
                  Cancel
                </button>
              </PersonRow>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const FriendsModal = ({ open, onClose, initialTab = "find" }) => {
  const [tab, setTab] = useState(initialTab);
  const { incoming, fetchRequests } = useFriendStore();
  const { setSelectedUser } = useChatStore();

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      fetchRequests();
    }
  }, [open, initialTab, fetchRequests]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const openChat = (user) => {
    setSelectedUser(user);
    onClose();
  };

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="friends-modal-title">
      <div className="modal-box max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 id="friends-modal-title" className="text-lg font-bold">
            Friends
          </h3>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div role="tablist" className="tabs tabs-boxed mb-4">
          <button role="tab" className={`tab ${tab === "find" ? "tab-active" : ""}`} onClick={() => setTab("find")}>
            Find people
          </button>
          <button
            role="tab"
            className={`tab gap-2 ${tab === "requests" ? "tab-active" : ""}`}
            onClick={() => setTab("requests")}
          >
            Requests
            {incoming.length > 0 && <span className="badge badge-sm badge-primary">{incoming.length}</span>}
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {tab === "find" ? <FindPeople onOpenChat={openChat} /> : <Requests />}
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
};

export default FriendsModal;
