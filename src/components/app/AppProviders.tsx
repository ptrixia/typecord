"use client";

import { ActivityProvider } from "./ActivityProvider";
import { GatewayStatusProvider } from "./GatewayStatusProvider";
import { PreferencesProvider } from "./PreferencesProvider";
import { ToastProvider } from "./ToastProvider";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <GatewayStatusProvider>
        <ActivityProvider>
          <ToastProvider>{children}</ToastProvider>
        </ActivityProvider>
      </GatewayStatusProvider>
    </PreferencesProvider>
  );
}
