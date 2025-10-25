export const protect = async (req, res, next) => {

    try {
        const { userId } = await req.auth() //auth will be added to req by clerkMiddleware
        if (!userId) {
            return res.json({ success: false, message: "Not authenticated" })
        }
        next()
    } catch (error) {
        return res.json({ success: false, message: error.message })
    }
}