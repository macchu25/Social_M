import React, { useState, useRef, useEffect } from "react";
import { ImageIcon, SendHorizonal, Check, CheckCheck, MoreVertical, X, Mic, Phone } from "lucide-react";
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
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const recordStreamRef = useRef(null);
  const pcRef = useRef(null);
  const [inCall, setInCall] = useState(false);

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
    const onDocClick = (e) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setShowHeaderMenu(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    loadUser();
    fetchMessages();

    // Subscribe to SSE for real-time incoming messages
    let es;
    if (currentUser?._id) {
      es = new EventSource(`${import.meta.env.VITE_BASEURL}/api/message/${currentUser._id}`);
      es.onmessage = async (event) => {
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
          if (payload?.event === 'reaction') {
            const msg = payload.message;
            setMessages(prev => prev.map(m => m._id === msg._id ? msg : m));
            return;
          }
          if (payload?.event === 'call-offer') {
            // basic prompt; can replace with modal later
            if (confirm('Có cuộc gọi đến. Trả lời?')) {
              acceptCall(payload.sdp)
            }
            return;
          }
          if (payload?.event === 'call-answer') {
            if (pcRef.current) {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            }
            return;
          }
          if (payload?.event === 'call-ice') {
            try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(payload.candidate)) } catch {}
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

  const handleDeleteConversation = async () => {
    try {
      const token = await getToken();
      await api.post('/api/message/delete-conversation', { to_user_id: userId }, { headers: { Authorization: `Bearer ${token}` } });
      setMessages([]);
    } catch {}
  };

  const startOrStopRecording = async () => {
    try {
      if (!recording) {
        if (!navigator.mediaDevices?.getUserMedia) {
          toast.error('Trình duyệt không hỗ trợ ghi âm');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((e)=>{ toast.error('Không truy cập được micro'); throw e; });
        const mr = new MediaRecorder(stream);
        const chunks = [];
        mr.ondataavailable = (e) => chunks.push(e.data);
        mr.onstop = async () => {
          try {
            const mime = mr.mimeType || 'audio/webm';
            const ext = mime.includes('mp4') ? 'm4a' : 'webm';
            const blob = new Blob(chunks, { type: mime });
            const file = new File([blob], `voice.${ext}`, { type: mime });
            const token = await getToken();
            const form = new FormData();
            form.append('to_user_id', userId);
            form.append('audio', file);
            const { data } = await api.post('/api/message/send-voice', form, { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) {
              setMessages(prev => [...prev, data.message]);
              toast.success('Đã gửi voice');
            } else {
              toast.error(data.message || 'Gửi voice thất bại');
            }
          } catch (err) {
            toast.error(err.message);
          } finally {
            // cleanup tracks
            recordStreamRef.current?.getTracks().forEach(t => t.stop());
            recordStreamRef.current = null;
          }
        };
        mr.start();
        mediaRecorderRef.current = mr;
        recordStreamRef.current = stream;
        setRecording(true);
        toast.success('Đang ghi âm... nhấn lần nữa để gửi');
      } else {
        mediaRecorderRef.current?.stop();
        setRecording(false);
      }
    } catch {}
  };

  const createPeer = () => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        const token = await getToken();
        await api.post('/api/message/call/ice', { to_user_id: userId, candidate: e.candidate }, { headers: { Authorization: `Bearer ${token}` } })
      }
    }
    pc.ontrack = (e) => {
      const audio = document.getElementById('remoteAudio')
      if (audio) audio.srcObject = e.streams[0]
    }
    pcRef.current = pc
    return pc
  }

  const startCall = async () => {
    try {
      const pc = createPeer();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const token = await getToken();
      await api.post('/api/message/call/offer', { to_user_id: userId, sdp: offer }, { headers: { Authorization: `Bearer ${token}` } })
      setInCall(true)
    } catch {}
  }

  const acceptCall = async (sdp) => {
    try {
      const pc = createPeer();
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      const token = await getToken();
      await api.post('/api/message/call/answer', { to_user_id: userId, sdp: answer }, { headers: { Authorization: `Bearer ${token}` } })
      setInCall(true)
    } catch {}
  }

  const endCall = () => {
    pcRef.current?.getSenders()?.forEach(s => s.track?.stop())
    pcRef.current?.close();
    pcRef.current = null
    setInCall(false)
  }
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  return (
    user && (
      <div className="flex flex-col h-screen">
        <div className="flex items-center justify-between gap-2 p-2 md:px-10 xl:pl-24 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-300">
          <div className="flex items-center gap-2">
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
          <div className="relative" ref={headerMenuRef}>
            <button onClick={()=> setShowHeaderMenu(prev=>!prev)} className="p-2 text-slate-500 hover:text-slate-700"><MoreVertical className="w-5 h-5" /></button>
            {showHeaderMenu && (
              <div className="absolute right-0 mt-1 bg-white border rounded-md shadow text-sm">
                <button onClick={async ()=>{ await handleDeleteConversation(); setShowHeaderMenu(false); }} className="block w-full text-left px-4 py-2 hover:bg-slate-50">Xóa đoạn chat</button>
                <button onClick={async ()=>{ await startCall(); setShowHeaderMenu(false); }} className="block w-full text-left px-4 py-2 hover:bg-slate-50">Gọi thoại</button>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 md:px-10 h-full overflow-y-scroll">
          <div className="space-y-4 max-w-4xl mx-auto">
            {inCall && (
              <div className="sticky top-2 z-10 flex items-center justify-between bg-white border rounded-md shadow px-3 py-2 max-w-sm mx-auto">
                <div className="flex items-center gap-2 text-slate-700"><Phone className="w-4 h-4" /> Đang gọi...</div>
                <button onClick={endCall} className="text-red-600 text-sm">Kết thúc</button>
                <audio id="remoteAudio" autoPlay />
              </div>
            )}
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
                      {message.message_type === 'audio' && message.media_url && (
                        <audio src={message.media_url} controls className="mb-1" />
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
                        <div className="absolute -top-10 left-0 bg-white shadow rounded-full border px-2 py-1 text-base select-none flex items-center gap-1">
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
            <button onClick={startOrStopRecording} className={`text-slate-400 hover:text-slate-700 ${recording ? 'text-red-500' : ''}`} title={recording ? 'Đang ghi...' : 'Ghi âm'}>
              <Mic className="size-6" />
            </button>
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
