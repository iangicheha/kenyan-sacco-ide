import type { NextFunction, Response } from "express";
import { getSupabase } from "../lib/supabase.js";
import { injectTenantContext } from "../lib/tenantContext.js";
import type { AuthenticatedRequest } from "./auth.js";

/**
 * Middleware that injects tenant context into the database session.
 * This must be applied AFTER the requireAuth middleware.
 *
 * Usage:
 *   app.use(requireAuth);
 *   app.use(requireTenantContext);
 */
export async function requireTenantContext(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    // No Supabase configured, skip tenant context injection
    return next();
  }

  if (!req.user) {
    // No authenticated user, skip (should have been caught by requireAuth)
    return next();
  }

  try {
    await injectTenantContext(supabase, {
      tenantId: req.user.tenantId,
      userId: req.user.email,
      role: req.user.role,
    });
    next();
  } catch (error) {
    console.error("[requireTenantContext] Failed to inject tenant context:", error);
    // Fail closed - don't allow the request to proceed without proper tenant isolation
    res.status(503).json({
      error: "Service unavailable: unable to establish tenant isolation context.",
    });
  }
}
