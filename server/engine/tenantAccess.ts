export function assertTenantAccess(resourceTenantId: string, userTenantId: string): void {
  if (!resourceTenantId || !userTenantId || resourceTenantId !== userTenantId) {
    throw new Error("Cross-tenant access denied.");
  }
}

export function assertSessionTenantAccess(sessionId: string, userTenantId: string): void {
  const sessionTenantId = sessionId.split(":")[0] ?? "";
  assertTenantAccess(sessionTenantId, userTenantId);
}
