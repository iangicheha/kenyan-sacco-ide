import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    institutionType: "bank" | "sacco" | "mfi";
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }
  const token = authHeader.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      email: string;
      institutionType: "bank" | "sacco" | "mfi";
    };
    req.user = {
      email: payload.email,
      institutionType: payload.institutionType,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
