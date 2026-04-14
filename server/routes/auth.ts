import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  institutionType: z.enum(["bank", "sacco", "mfi"]),
});

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid login payload.",
      details: parsed.error.flatten(),
    });
  }

  const token = jwt.sign(
    {
      email: parsed.data.email,
      institutionType: parsed.data.institutionType,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.json({
    token,
    user: {
      email: parsed.data.email,
      institutionType: parsed.data.institutionType,
    },
  });
});
