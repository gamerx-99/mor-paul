export const SESSION_EXPIRED_EVENT = "clinic:session-expired";
export const SESSION_EXPIRED_NOTICE_KEY = "clinic.session-expired";

export type SessionGateState = "WORKSPACE" | "ACCESS_GATE";
export type SessionGateEvent = "SESSION_EXPIRED" | "AUTHENTICATED";

/** Idempotent state transition used above every protected route in App. */
export function sessionGateReducer(state: SessionGateState, event: SessionGateEvent): SessionGateState {
  if (event === "SESSION_EXPIRED") return "ACCESS_GATE";
  return "WORKSPACE";
}

export function markSessionExpired() {
  sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, "1");
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
