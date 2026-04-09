import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type ApiRole = "read-only" | "analyst" | "admin";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

declare global {
  namespace Express {
    interface Request {
      user?: { sub: string; role: ApiRole };
    }
  }
}

function roleRank(role: ApiRole): number {
  if (role === "admin") return 3;
  if (role === "analyst") return 2;
  return 1;
}

export function requireRole(required: ApiRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || roleRank(role) < roleRank(required)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return next();
  };
}

export function issueDevToken(sub: string, role: ApiRole): string {
  return jwt.sign({ sub, role }, JWT_SECRET, { expiresIn: "1d" });
}

export function apiAuth(req: Request, res: Response, next: NextFunction) {
  const apiAuthEnabled = process.env.API_AUTH_ENABLED !== "false";
  if (!apiAuthEnabled) {
    req.user = { sub: "dev", role: "admin" };
    return next();
  }
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role: ApiRole };
    if (!decoded?.role || !decoded?.sub) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = { sub: decoded.sub, role: decoded.role };
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}
