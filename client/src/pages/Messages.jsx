import React, { useMemo } from "react";
import { Eye, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const Messages = () => {
  const navigate= useNavigate();
  const { followers, following } = useSelector((state) => state.connections);

  const mutuals = useMemo(() => {
    const followingIds = new Set((following || []).map(u => (u._id || u).toString()));
    const followersMap = new Map((followers || []).map(u => [ (u._id || u).toString(), u ]));
    const mutualList = [];
    followingIds.forEach(id => {
      if (followersMap.has(id)) {
        mutualList.push(followersMap.get(id));
      }
    });
    return mutualList;
  }, [followers, following]);
  return (
    <div className="min-h-screen relative bg-slate-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Messages</h1>
          <p className="text-slate-600">Talk to you friends and family</p>
        </div>

        {/* Lưu ý */}
        <div className="max-w-xl mb-6 p-4 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <p className="font-medium mb-1">Lưu ý</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Chỉ có thể nhắn khi hai bên đã follow nhau.</li>
            <li>Tin nhắn được lưu và tự tải lại khi mở phòng chat.</li>
            <li>Ảnh gửi đi có thể mất vài giây để hiển thị đúng URL.</li>
          </ul>
        </div>

        {/* Connected Users */}

        <div className="flex flex-col gap-3">
          {mutuals.map((user) => (
            <div
              key={user._id}
              className="max-w-xl flex   gap-5 p-6  bg-white shadow rounded-md"
            >
              <img
                src={user.profile_picture}
                className="rounded-full size-12 mx-auto"
                alt=""
              />
              <div className="flex-1">
                <p className="font-medium text-slate-700">{user.full_name}</p>
                <p className="text-slate-500">@{user.username}</p>
                <p className="text-sm text-gray-600">{user.bio}</p>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <button onClick={()=>navigate(`/messages/${user._id}`)} className="size-10 flex items-center justify-center text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95 transition cursor-pointer gap-1">
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button onClick={()=>navigate(`/profile/${user._id}`)} className="size-10 flex items-center justify-center text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95 transition cursor-pointer">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Messages;
