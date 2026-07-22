const {z} = require("zod")

const userValidation = z.object({
    username: z.string().min(3, "Username too short").max(20),
    email: z.string().trim().email(),
    password: z.string().min(6, "Password must be at least 6 characters").max(20),
    //role: z.enum(["user", "admin", "theatreOwner"]).optional()
})

const loginValidationFunction = z.object({
    email: z.string().trim().email().nonempty(),
    password: z.string().min(6, "Password must be at least 6 characters").max(20)
})

const passwordValidations = z.object({
    password: z.string().min(6, "Password must be at least 6 characters").max(20)
})

module.exports = { userValidation, loginValidationFunction, passwordValidations}