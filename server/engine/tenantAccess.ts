export function assertTenantAccess(resourceTenantId: string, userTenantId: string): void {
  if (!resourceTenantId || !userTenantId || resourceTenantId !== userTenantId) {
    throw new Error("Cross-tenant access denied.");
  }
}
