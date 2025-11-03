import React, { useState } from "react";
import { Search } from "lucide-react";
import UserCard from "../components/UserCard";
import Loading from "../components/Loading";
import { useDispatch, useSelector } from "react-redux";
import { discoverUsers } from "../features/user/userSlice";
import { useAuth } from "@clerk/clerk-react";

const Discover = () => {
  const [input, setInput] = useState("");
  const dispatch = useDispatch();
  const { discoveredUsers, discoverLoading } = useSelector((state) => state.user);
  const { getToken } = useAuth();

  const handleSearch = async (e) => {
    if (e.key === "Enter") {
      const token = await getToken();
      if (token) {
        dispatch(discoverUsers({ token, input: input.trim() }));
      }
    }
  };

  // Load tất cả users khi component mount
  React.useEffect(() => {
    const loadAllUsers = async () => {
      const token = await getToken();
      if (token) {
        dispatch(discoverUsers({ token, input: "" }));
      }
    };
    loadAllUsers();
  }, [dispatch, getToken]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto p-6  ">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Discover People
          </h1>
          <p className="text-slate-600">
            Connect with amazing people and grow your network
          </p>
        </div>

        {/* Search */}

        <div className=" mb-8 shadow-md rounded-md border border-slate-200/60 bg-white/80">
          <div className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />

              <input
                type="text"
                placeholder="Search people by name, username, bio or location..."
                className="pl-10 sm:pl-12 py-2 w-full border border-gray-300 rounded-md max-sm:text-sm "
                onChange={(e) => setInput(e.target.value)}
                value={input}
                onKeyUp={handleSearch}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          {discoveredUsers.map((user) => (
            <UserCard user={user} key={user._id} />
          ))}
        </div>

        {discoverLoading && <Loading height="60" />}
        
        {!discoverLoading && discoveredUsers.length === 0 && input && (
          <div className="text-center py-8">
            <p className="text-slate-500">Không tìm thấy người dùng nào với từ khóa "{input}"</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default Discover;
