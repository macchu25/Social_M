
import fs from 'fs'
import imagekit from '../configs/imagekit.js'
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
        const {to_user_id, text} = req.body

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
        })

        res.json({success: true, message})
        // send message to recipient using SSE
        const messageWithUserData= await Message.findById(message._id).populate('from_user_id')

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
            ]
        }).sort({createdAt: -1})

        // mark messages as seen

        await Message.updateMany({
            from_user_id: to_user_id,
            to_user_id: userId, 
        }, {seen: true})

        res.json({ success: true, messages })
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
