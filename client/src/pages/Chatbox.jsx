import React, { useState, useRef, useEffect } from "react";
import { ImageIcon, SendHorizonal, Check, CheckCheck, MoreVertical, X } from "lucide-react";
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
  const [hoverIndex, setHoverIndex] = useState(null);
  const [menuIndex, setMenuIndex] = useState(null);
  const [showReactionsIndex, setShowReactionsIndex] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

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
          const payload = JSON.parse(event.data);
          // seen event
          if (payload?.event === 'seen') {
            if (payload.peerId === userId) {
              setMessages((prev) => prev.map(m => {
                const fromId = m.from_user_id?._id || m.from_user_id;
                if (fromId === (currentUser?._id)) return { ...m, seen: true };
                return m;
              }));
            }
            return;
          }
          if (payload?.event === 'revoked') {
            setMessages(prev => prev.map(m => m._id === payload.messageId ? { ...m, revoked: true, text: 'This message was revoked', message_type: 'text', media_url: '' } : m));
            return;
          }
          // message event (default)
          const fromId = payload.from_user_id?._id || payload.from_user_id;
          const toId = payload.to_user_id?._id || payload.to_user_id;
          if (fromId === userId || toId === userId) {
            setMessages((prev) => [...prev, payload]);
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
      if (replyTo?._id) form.append('reply_to', replyTo._id);
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
        setReplyTo(null);
        // Refresh from server to ensure persistence
        await fetchMessages();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleReact = async (messageId, emoji) => {
    try {
      const token = await getToken();
      const { data } = await api.post('/api/message/react', { messageId, type: emoji }, { headers: { Authorization: `Bearer ${token}` } });
      if (data.success) {
        setMessages(prev => prev.map(m => m._id === messageId ? data.message : m));
      }
    } catch {}
  };

  const handleRevoke = async (messageId) => {
    try {
      const token = await getToken();
      const { data } = await api.post('/api/message/revoke', { messageId }, { headers: { Authorization: `Bearer ${token}` } });
      if (data.success) {
        setMessages(prev => prev.map(m => m._id === messageId ? data.message : m));
      }
    } catch {}
  };

  const handleDeleteForMe = async (messageId) => {
    try {
      const token = await getToken();
      const { data } = await api.post('/api/message/delete-for-me', { messageId }, { headers: { Authorization: `Bearer ${token}` } });
      if (data.success) {
        setMessages(prev => prev.filter(m => m._id !== messageId));
      }
    } catch {}
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
            {(() => {
              const ordered = [...messages].toSorted((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
              let lastOutgoingIndex = -1;
              ordered.forEach((m, i) => {
                const fromId = m.from_user_id?._id || m.from_user_id;
                if (fromId === (currentUser?._id)) lastOutgoingIndex = i;
              });
              return ordered.map((message, index) => {
                const fromId = message.from_user_id?._id || message.from_user_id;
                const isOutgoing = fromId === (currentUser?._id);
                const showStatus = isOutgoing && index === lastOutgoingIndex; // only latest outgoing
                return (
                  <div key={index} className={`flex flex-col ${isOutgoing ? "items-end" : "items-start"}`}
                    onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => { setHoverIndex(null); setShowReactionsIndex(null); }}>
                    {hoverIndex === index && (
                      <span className="mb-1 text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {" "}
                        {new Date(message.createdAt).toLocaleDateString()}
                      </span>
                    )}
                    <div className={`relative p-2 text-sm max-w-sm bg-white text-slate-700 rounded-lg shadow ${isOutgoing ? "rounded-br-none" : "rounded-bl-none"}`}
                      onClick={()=> setReplyTo(message)}>
                      {message.reply_to && (
                        <div className="mb-1 pl-2 border-l-2 border-slate-300 text-[11px] text-slate-500">
                          {isOutgoing ? 'Bạn đã trả lời ' : 'Đã trả lời '} 
                          {message.reply_to.text ? (
                            <span className="italic line-clamp-1">“{message.reply_to.text}”</span>
                          ) : (
                            <span className="italic">(ảnh)</span>
                          )}
                        </div>
                      )}
                      {message.message_type === 'image' && message.media_url && (
                        <img src={message.media_url} className="w-full max-w-sm rounded-lg mb-1" alt="image" />
                      )}
                      {message.text && <p>{message.text}</p>}
                      {/* Reaction bubble */}
                      {message.reactions?.length > 0 && (
                        <div className="absolute -bottom-3 right-2 bg-white border border-slate-200 rounded-full px-1 text-[10px]">
                          {message.reactions.map((r, i) => <span key={i} className="px-0.5">{r.type}</span>)}
                        </div>
                      )}
                      {/* 3-dot menu */}
                      {hoverIndex === index && (
                        <button onClick={() => setMenuIndex(menuIndex === index ? null : index)} className="absolute -right-8 top-1 text-slate-400 hover:text-slate-600">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      )}
                      {menuIndex === index && (
                        <div className="absolute -right-32 top-0 bg-white shadow rounded-md border text-xs z-10">
                          <button onClick={() => setShowReactionsIndex(index)} className="block w-full text-left px-3 py-2 hover:bg-slate-50">Thả cảm xúc</button>
                          <button className="block w-full text-left px-3 py-2 hover:bg-slate-50">Trả lời</button>
                          <button onClick={async ()=>{ await handleDeleteForMe(message._id); setMenuIndex(null); }} className="block w-full text-left px-3 py-2 hover:bg-slate-50">Xóa với mình</button>
                          {isOutgoing && <button onClick={async ()=>{ await handleRevoke(message._id); setMenuIndex(null); }} className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-red-600">Thu hồi</button>}
                        </div>
                      )}
                      {showReactionsIndex === index && (
                        <div className="absolute -top-8 left-0 bg-white shadow rounded-full border px-2 py-1 text-base select-none">
                          {['👍','❤️','😂','😮','😢'].map(e=> (
                            <button key={e} onClick={async ()=>{ await handleReact(message._id, e); setShowReactionsIndex(null); }} className="px-1 hover:scale-110 transition">{e}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    { showStatus && (
                      <span className="mt-1 text-[10px] text-slate-400 inline-flex items-center gap-1">
                        {message.seen ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />} 
                        {message.seen ? 'Đã xem' : 'Đã gửi'}
                      </span>
                    )}
                  </div>
                );
              });
            })()}

              <div ref={messagesEndRef}  />  
          </div>
        </div>

        <div className="px-4">
          {replyTo && (
            <div className="w-full max-w-xl mx-auto mb-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 flex items-center justify-between">
              <div className="truncate">
                Đang trả lời: {replyTo.text || (replyTo.message_type === 'image' ? 'Ảnh' : 'Tin nhắn')}
              </div>
              <button onClick={()=>setReplyTo(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
          )}
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
