import React, { useEffect, useReducer, type ReactNode } from "react";
import AccessGate from "@/pages/AccessGate";
import {
  SESSION_EXPIRED_EVENT,
  SESSION_EXPIRED_NOTICE_KEY,
  sessionGateReducer,
  type SessionGateState,
} from "@/lib/sessionExpiry";

/**
 * Single auth-expiry boundary for all routes. Once expired, no protected child
 * remains mounted; only AccessGate (public auth calls) is rendered.
 */
export default function SessionExpiryBoundary({ children }: { children: ReactNode }) {
  const [sessionGate, dispatch] = useReducer(
    sessionGateReducer,
    undefined,
    (): SessionGateState => sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === "1" ? "ACCESS_GATE" : "WORKSPACE",
  );

  useEffect(() => {
    const redirectToAccessGate = () => dispatch("SESSION_EXPIRED");
    window.addEventListener(SESSION_EXPIRED_EVENT, redirectToAccessGate);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, redirectToAccessGate);
  }, []);

  if (sessionGate === "ACCESS_GATE") {
    return <AccessGate onAuthenticated={() => dispatch("AUTHENTICATED")} />;
  }

  return children;
}
