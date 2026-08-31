"use client";

import { ActivityProvider } from "./ActivityProvider";
import { GatewayStatusProvider } from "./GatewayStatusProvider";
import { PreferencesProvider } from "./PreferencesProvider";
import { ToastProvider } from "./ToastProvider";
import RichPresenceTracker from "./RichPresenceTracker";
import TauriAppLock from "./TauriAppLock";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <GatewayStatusProvider>
        <RichPresenceTracker />
        <ActivityProvider>
          <TauriAppLock><ToastProvider>{children}</ToastProvider></TauriAppLock>
        </ActivityProvider>
      </GatewayStatusProvider>
    </PreferencesProvider>
  );
}
