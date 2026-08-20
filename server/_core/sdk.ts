/**
 * Legacy compatibility export. Clinic HIS uses server/localAuth.ts and does
 * not accept Manus OAuth tokens for staff access.
 */
export class SDKServer {
  async authenticateRequest(): Promise<never> {
    throw new Error("OAuth authentication is disabled for Clinic HIS");
  }
}

export const sdk = new SDKServer();
