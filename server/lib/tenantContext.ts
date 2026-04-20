import type { SupabaseClient } from "@supabase/supabase-js";

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}

/**
 * Injects tenant context into the current Postgres session.
 * This must be called before any tenant-scoped queries to ensure RLS policies work.
 *
 * The function sets session configuration parameters that RLS policies reference:
 * - app.tenant_id: The current tenant ID
 * - app.user_id: The current user ID
 * - app.user_role: The current user's role
 *
 * These are read by the current_setting() function in RLS policies.
 */
export async function injectTenantContext(
  supabase: SupabaseClient,
  context: TenantContext
): Promise<void> {
  if (!supabase) return;

  try {
    // Set session configuration for RLS policies
    // The 'true' third parameter makes these settings transaction-local
    await supabase.rpc("set_config", {
      key: "app.tenant_id",
      value: context.tenantId,
      is_local: true,
    });

    await supabase.rpc("set_config", {
      key: "app.user_id",
      value: context.userId,
      is_local: true,
    });

    await supabase.rpc("set_config", {
      key: "app.user_role",
      value: context.role,
      is_local: true,
    });
  } catch (error) {
    // If RPC fails, log but don't fail - the RLS policies will fail closed
    console.warn("[tenantContext] Failed to inject tenant context:", error);
  }
}

/**
 * Creates a Supabase client with tenant context pre-injected.
 * Use this when you need to make queries within a specific tenant context.
 */
export async function withTenantContext<T>(
  supabase: SupabaseClient,
  context: TenantContext,
  callback: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  await injectTenantContext(supabase, context);
  return callback(supabase);
}

/**
 * Validates that a tenant context is complete and valid.
 * Throws an error if any required field is missing.
 */
export function validateTenantContext(context: Partial<TenantContext>): asserts context is TenantContext {
  if (!context.tenantId) {
    throw new Error("Tenant ID is required for tenant-scoped operations");
  }
  if (!context.userId) {
    throw new Error("User ID is required for tenant-scoped operations");
  }
  if (!context.role) {
    throw new Error("Role is required for tenant-scoped operations");
  }
}
