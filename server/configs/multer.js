import multer from "multer";
import fs from 'fs'
import path from 'path'

const uploadDir = path.resolve('uploads')
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/\s+/g, '_')
        cb(null, Date.now() + '_' + safe)
    }
})

export const upload = multer({ storage })