import express from 'express'
import { deleteConversationForMe, deleteMessageForMe, getChatMessages, reactToMessage, revokeMessage, sendMessage, sseController } from '../controllers/messageController.js'
import { upload } from '../configs/multer.js'
import { protect } from '../middleware/auth.js'

const messageRouter= express.Router()

messageRouter.get('/:userId',sseController)
messageRouter.post('/send',upload.single('image'),protect,sendMessage)
messageRouter.post('/get',protect,getChatMessages)
messageRouter.post('/react',protect,reactToMessage)
messageRouter.post('/revoke',protect,revokeMessage)
messageRouter.post('/delete-for-me',protect,deleteMessageForMe)
messageRouter.post('/delete-conversation',protect,deleteConversationForMe)

export default messageRouter;