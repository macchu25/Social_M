import React, { useState, useRef, useEffect } from "react";
import { ImageIcon, SendHorizonal } from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";

const Chatbox = () => {
  const { userId } = useParams();
  const { getToken } = useAuth();
  const currentUser = useSelector((state) => state.user.value);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);

  const loadUser = async () => {
    try {
      const token = await getToken();
      const { data } = await api.post(
        "/api/user/profiles",
        { profileId: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setUser(data.profile);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const fetchMessages = async () => {
    try {
      const token = await getToken();
      // primary (expected) endpoint
      try {
        const { data } = await api.post(
          "/api/message/get",
          { to_user_id: userId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          setMessages(data.messages || []);
          return;
        }
      } catch (err) {
        // fallback 1: older deployments may expose GET
        if (err?.response?.status === 404) {
          try {
            const { data } = await api.get(
              "/api/message/get",
              {
                headers: { Authorization: `Bearer ${token}` },
                params: { to_user_id: userId },
              }
            );
            if (data.success) {
              setMessages(data.messages || []);
              return;
            }
          } catch {}
          // fallback 2: pluralized path
          try {
            const { data } = await api.post(
              "/api/messages/get",
              { to_user_id: userId },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (data.success) {
              setMessages(data.messages || []);
              return;
            }
          } catch {}
        } else {
          throw err;
        }
      }
      toast.error("Không tải được lịch sử tin nhắn (404)");
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    loadUser();
    fetchMessages();

    // Subscribe to SSE for real-time incoming messages
    let es;
    if (currentUser?._id) {
      es = new EventSource(`${import.meta.env.VITE_BASEURL}/api/message/${currentUser._id}`);
      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // only append if it's from the other user in this chat
          const fromId = msg.from_user_id?._id || msg.from_user_id;
          const toId = msg.to_user_id?._id || msg.to_user_id;
          if (fromId === userId || toId === userId) {
            setMessages((prev) => [...prev, msg]);
          }
        } catch {}
      };
    }
    return () => {
      if (es) es.close();
    };
  }, [userId, currentUser?._id]);

  const sendMessage = async () => {
    try {
      if (!text && !image) return;
      const token = await getToken();
      const form = new FormData();
      form.append("to_user_id", userId);
      if (text) form.append("text", text);
      if (image) form.append("image", image);

      let data;
      try {
        ({ data } = await api.post("/api/message/send", form, {
          headers: { Authorization: `Bearer ${token}` },
        }));
      } catch (err) {
        if (err?.response?.status === 404) {
          // fallback pluralized
          ({ data } = await api.post("/api/messages/send", form, {
            headers: { Authorization: `Bearer ${token}` },
          }));
        } else {
          throw err;
        }
      }
      if (data.success) {
        const newMsg = data.message || {
          from_user_id: currentUser?._id,
          to_user_id: userId,
          text,
          message_type: image ? "image" : "text",
          media_url: null,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMsg]);
        setText("");
        setImage(null);
        // Refresh from server to ensure persistence
        await fetchMessages();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  return (
    user && (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-2 p-2 md:px-10 xl:pl-24 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-300">
          <img
            src={user.profile_picture}
            className="size-8 rounded-full"
            alt=""
          />
          <div>
            <p className="font-medium">{user.full_name}</p>
            <p className="text-sm text-gray-500 -mt-1.5">@{user.username}</p>
          </div>
        </div>

        <div className="p-5 md:px-10 h-full overflow-y-scroll">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages
              .toSorted((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
              .map((message, index) => (
                <div key={index} className={`flex flex-col ${(message.from_user_id?._id || message.from_user_id) === (currentUser?._id) ? "items-end" : "items-start"}`}>
                  <div className={`p-2 text-sm max-w-sm bg-white text-slate-700 rounded-lg shadow ${(message.from_user_id?._id || message.from_user_id) === (currentUser?._id) ? "rounded-br-none" : "rounded-bl-none"}`}>
                    {message.message_type === 'image' && message.media_url && (
                      <img src={message.media_url} className="w-full max-w-sm rounded-lg mb-1" alt="image" />
                    )}
                    {message.text && <p>{message.text}</p>}
                  </div>
                  { (message.from_user_id?._id || message.from_user_id) === (currentUser?._id) && (
                    <span className="mt-1 text-[10px] text-slate-400">{message.seen ? 'Seen' : 'Sent'}</span>
                  )}
                </div>
              ))}

              <div ref={messagesEndRef}  />  
          </div>
        </div>

        <div className="px-4">
          <div className="flex items-center gap-3 pl-5 p-1.5 bg-white w-full max-w-xl mx-auto border border-gray-200 shadow rounded-full mb-5">
            <input
              type="text"
              placeholder="Type your message..."
              className="flex-1 outline-none text-slate-700"
              onKeyDown={e=>e.key==='Enter' && sendMessage()}
              onChange={(e) => setText(e.target.value)}
              value={text}
            />
            <label htmlFor="image">
              {
                image ? <img src={URL.createObjectURL(image)} className="w-8 h-8 rounded" alt="" /> : <ImageIcon className="size-7 text-gray-400 cursor-pointer" />
              }
              <input type="file" name="" id="image" accept="image/*" hidden  onChange={(e) => setImage(e.target.files[0])} />
            </label>
            <button onClick={sendMessage} className="bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 active:scale-95 cursor-pointer text-white p-2 rounded-full">
              <SendHorizonal size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  );
};

export default Chatbox;
