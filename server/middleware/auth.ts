import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
export type UserRole = "read-only" | "analyst" | "reviewer" | "admin";

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    institutionType: "bank" | "sacco" | "mfi";
    role: UserRole;
    tenantId: string;
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
      role?: UserRole;
      tenantId?: string;
    };
    req.user = {
      email: payload.email,
      institutionType: payload.institutionType,
      role: payload.role ?? "analyst",
      tenantId: payload.tenantId ?? "default",
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function userHasAnyRole(req: AuthenticatedRequest, roles: UserRole[]): boolean {
  if (env.disableRbac) return true;
  const role = req.user?.role;
  if (!role) return false;
  return roles.includes(role);
}

export function requireRoles(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (env.disableRbac) return next();
    if (!userHasAnyRole(req, roles)) {
      res.status(403).json({
        error: `Forbidden. Required role: ${roles.join(" or ")}.`,
      });
      return;
    }
    next();
  };
}
