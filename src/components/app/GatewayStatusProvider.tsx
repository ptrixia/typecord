"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  connectGateway,
  getGatewayStatus,
  onGatewayStatus,
  type GatewayConnectionStatus,
} from "@/lib/realtime/gateway-client";

type GatewayStatusContextValue = {
  status: GatewayConnectionStatus;
};

const GatewayStatusContext = createContext<GatewayStatusContextValue | null>(null);

export function GatewayStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GatewayConnectionStatus>(() => getGatewayStatus());

  useEffect(() => {
    const remove = onGatewayStatus(setStatus);
    try {
      connectGateway();
    } catch {
      setStatus({ state: "error", message: "Gateway não configurado." });
    }
    return remove;
  }, []);

  const value = useMemo(() => ({ status }), [status]);

  return (
    <GatewayStatusContext.Provider value={value}>
      {children}
    </GatewayStatusContext.Provider>
  );
}

export function useGatewayStatus() {
  const value = useContext(GatewayStatusContext);
  if (!value) {
    throw new Error("useGatewayStatus precisa estar dentro de GatewayStatusProvider.");
  }
  return value.status;
}
