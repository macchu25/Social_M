
import fs from 'fs'
import imagekit from '../configs/imagekit.js'
import path from 'path'
import Message from '../models/Messages.js'
// create empty object to store server side event connections
const connections = {}

// controoler function for sever side event endpoints


export const sseController = (req, res) => {

    const { userId } = req.params
    console.log("new client connected: ", userId)

    // /set serve side event headers

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // add client's response object to connections object
    connections[userId] = res

    // set initial event to client
    // SSE- server side event
    res.write('log: connected to SSE stream\n\n')
    req.on('close', () => {
        // remmove client's response object from connections object
        delete connections[userId]
        console.log("client disconnected: ", userId)
    })
}


// send Message
export const sendMessage= async(req,res)=>{
    try {

        const {userId} = req.auth()
        const {to_user_id, text, reply_to} = req.body

        const image= req.file
        let media_url= ''
        let message_type= image ? 'image' : 'text'

        if(message_type === 'image'){
            const fileBuffer= fs.readFileSync(image.path)
            const response= await imagekit.upload({
                file: fileBuffer,
                fileName: image.originalname
            })
            media_url= imagekit.url({
                path: response.filePath,
                transformation: [
                    { quality: "auto" },
                    { format: "webp" },
                    { width: "1280" },
                ]
            })
        }

        const message= await Message.create({
            from_user_id: userId,
            to_user_id,
            text,
            message_type,
            media_url,
            reply_to,
        })

        const populatedForSender = await Message.findById(message._id).populate('reply_to')
        res.json({success: true, message: populatedForSender})
        // send message to recipient using SSE
        const messageWithUserData= await Message.findById(message._id).populate('from_user_id reply_to')

        if(connections[to_user_id]){
            connections[to_user_id].write(`data: ${JSON.stringify(messageWithUserData)}\n\n`)
        }
        
    } catch (error) {
        console.error("Error sending message: ", error)
        res.status(500).json({success: false, error: "Failed to send message"})
    }
}

// get chat message
export const getChatMessages= async(req,res)=>{
    try {
        const {userId} = req.auth()
        const {to_user_id} = req.body
        const messages= await Message.find({
            $or: [
                {from_user_id: userId, to_user_id},
                {from_user_id: to_user_id, to_user_id: userId},
            ],
            hidden_for: { $ne: userId }
        }).populate('reply_to').sort({createdAt: -1})

        // mark messages as seen

        const updateResult = await Message.updateMany({
            from_user_id: to_user_id,
            to_user_id: userId, 
        }, {seen: true})

        res.json({ success: true, messages })

        // notify sender that their messages were seen via SSE (realtime seen)
        try {
            if(updateResult?.modifiedCount > 0 && connections[to_user_id]){
                const payload = { event: 'seen', peerId: userId }
                connections[to_user_id].write(`data: ${JSON.stringify(payload)}\n\n`)
            }
        } catch(err) {
            console.log('SSE seen notify error', err?.message)
        }
    } catch (error) {
        
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}


// 
export const getUserRecentMessages= async(req,res)=>{

    try {

        const { userId } = req.auth()
        const messages = await Message.find({to_user_id: userId}).populate('from_user_id to_user_id').sort({ createdAt: -1 })
        res.json({ success: true, messages })
        
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// react to a message
export const reactToMessage = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { messageId, type } = req.body
        const message = await Message.findById(messageId)
        if (!message) return res.json({ success: false, message: 'Message not found' })
        // remove previous reaction by this user
        message.reactions = (message.reactions || []).filter(r => r.user_id !== userId)
        if (type) {
            message.reactions.push({ user_id: userId, type })
        }
        await message.save()
        const populated = await Message.findById(message._id).populate('reply_to')
        res.json({ success: true, message: populated })
        // notify both participants via SSE
        try {
            const payload = { event: 'reaction', message: populated }
            if (connections[message.to_user_id]) {
                connections[message.to_user_id].write(`data: ${JSON.stringify(payload)}\n\n`)
            }
            if (connections[message.from_user_id]) {
                connections[message.from_user_id].write(`data: ${JSON.stringify(payload)}\n\n`)
            }
        } catch {}
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// revoke (delete for everyone) - only sender
export const revokeMessage = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { messageId } = req.body
        const message = await Message.findById(messageId)
        if (!message) return res.json({ success: false, message: 'Message not found' })
        if (message.from_user_id !== userId) return res.json({ success: false, message: 'Not allowed' })
        message.revoked = true
        message.text = 'This message was revoked'
        message.media_url = ''
        message.message_type = 'text'
        await message.save()
        // notify peer via SSE
        if (connections[message.to_user_id]) {
            connections[message.to_user_id].write(`data: ${JSON.stringify({ event: 'revoked', messageId })}\n\n`)
        }
        res.json({ success: true, message })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// delete for me (hide)
export const deleteMessageForMe = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { messageId } = req.body
        const message = await Message.findById(messageId)
        if (!message) return res.json({ success: false, message: 'Message not found' })
        if (!message.hidden_for?.includes(userId)) {
            message.hidden_for = [...(message.hidden_for || []), userId]
            await message.save()
        }
        res.json({ success: true })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// delete entire conversation for me
export const deleteConversationForMe = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { to_user_id } = req.body
        await Message.updateMany({
            $or: [
                {from_user_id: userId, to_user_id},
                {from_user_id: to_user_id, to_user_id: userId},
            ]
        }, { $addToSet: { hidden_for: userId } })
        res.json({ success: true })
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// voice message (audio)
export const sendVoiceMessage = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { to_user_id } = req.body
        const audio = req.file
        if (!audio) return res.json({ success: false, message: 'No audio' })
        // use local file URL to avoid external 400s
        const fileName = path.basename(audio.path)
        const media_url = `${req.protocol}://${req.get('host')}/uploads/${fileName}`
        const message = await Message.create({
            from_user_id: userId,
            to_user_id,
            text: '',
            message_type: 'audio',
            media_url,
        })
        const populated = await Message.findById(message._id)
        res.json({ success: true, message: populated })
        // push to recipient via SSE
        if (connections[to_user_id]) {
            connections[to_user_id].write(`data: ${JSON.stringify(populated)}\n\n`)
        }
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// WebRTC signaling relay
export const callOffer = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { to_user_id, sdp } = req.body
        const payload = { event: 'call-offer', from: userId, sdp }
        if (connections[to_user_id]) connections[to_user_id].write(`data: ${JSON.stringify(payload)}\n\n`)
        res.json({ success: true })
    } catch (e) { res.json({ success: false, message: e.message }) }
}

export const callAnswer = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { to_user_id, sdp } = req.body
        const payload = { event: 'call-answer', from: userId, sdp }
        if (connections[to_user_id]) connections[to_user_id].write(`data: ${JSON.stringify(payload)}\n\n`)
        res.json({ success: true })
    } catch (e) { res.json({ success: false, message: e.message }) }
}

export const callIce = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { to_user_id, candidate } = req.body
        const payload = { event: 'call-ice', from: userId, candidate }
        if (connections[to_user_id]) connections[to_user_id].write(`data: ${JSON.stringify(payload)}\n\n`)
        res.json({ success: true })
    } catch (e) { res.json({ success: false, message: e.message }) }
}
