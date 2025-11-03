import mongoose from "mongoose";

const messageSchema= new mongoose.Schema({
    from_user_id: {type: String, ref: "User", required: true},
    to_user_id: {type: String, ref: "User", required: true},
    text: {type: String, trim:true},
    message_type: {type: String, enum: ["text", "image", "video"], default: "text"},
    media_url: {type: String,},
    seen: {type: Boolean, default: false},
    reactions: [{ user_id: { type: String }, type: { type: String } }],
    hidden_for: [{ type: String }],
    revoked: { type: Boolean, default: false },
    reply_to: { type: String, ref: 'Message' },
}, { timestamps: true })

const Message = mongoose.model("Message", messageSchema);
export default Message;