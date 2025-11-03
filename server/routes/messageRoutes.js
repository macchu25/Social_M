import express from 'express'
import { callAnswer, callIce, callOffer, deleteConversationForMe, deleteMessageForMe, getChatMessages, reactToMessage, revokeMessage, sendMessage, sendVoiceMessage, sseController } from '../controllers/messageController.js'
import { upload } from '../configs/multer.js'
import { protect } from '../middleware/auth.js'

const messageRouter= express.Router()

messageRouter.get('/:userId',sseController)
messageRouter.post('/send',upload.single('image'),protect,sendMessage)
messageRouter.post('/send-voice',upload.single('audio'),protect,sendVoiceMessage)
messageRouter.post('/get',protect,getChatMessages)
messageRouter.post('/react',protect,reactToMessage)
messageRouter.post('/revoke',protect,revokeMessage)
messageRouter.post('/delete-for-me',protect,deleteMessageForMe)
messageRouter.post('/delete-conversation',protect,deleteConversationForMe)
messageRouter.post('/call/offer',protect,callOffer)
messageRouter.post('/call/answer',protect,callAnswer)
messageRouter.post('/call/ice',protect,callIce)

export default messageRouter;