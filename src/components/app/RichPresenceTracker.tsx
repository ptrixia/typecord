"use client";

import { useEffect } from "react";
import { setRichPresence } from "@/lib/realtime/gateway-client";
import { getTauriOpenApplications, isTauriRuntime } from "@/lib/tauri";
import { usePreferences } from "./PreferencesProvider";

const DETECTABLE_APPS: Array<{ match: RegExp; label: string }> = [
  { match: /spotify/i, label: "Spotify" },
  { match: /steam/i, label: "Steam" },
  { match: /code|vscode/i, label: "Visual Studio Code" },
  { match: /devenv|visual studio/i, label: "Visual Studio" },
  { match: /chrome/i, label: "Google Chrome" },
  { match: /firefox/i, label: "Firefox" },
  { match: /msedge|edge/i, label: "Microsoft Edge" },
  { match: /brave/i, label: "Brave" },
  { match: /obs/i, label: "OBS Studio" },
  { match: /figma/i, label: "Figma" },
  { match: /discord/i, label: "Discord" },
];

export default function RichPresenceTracker() {
  const { preferences } = usePreferences();
  useEffect(() => {
    let cancelled = false;
    if (!preferences.showRichPresence) {
      void setRichPresence(null).catch(() => undefined);
      return () => { cancelled = true; };
    }
    const update = async () => {
      let detectedName: string | null = null;
      if (preferences.shareDetectedApps && isTauriRuntime()) {
        const applications = await getTauriOpenApplications().catch(() => []);
        const known = applications.find((application) => DETECTABLE_APPS.some((candidate) => candidate.match.test(application.name)));
        detectedName = known ? DETECTABLE_APPS.find((candidate) => candidate.match.test(known.name))?.label ?? null : null;
      }
      if (cancelled) return;
      void setRichPresence({
        type: "PLAYING",
        name: detectedName ?? "Typecord",
        details: detectedName ? "Atividade no desktop" : "Online",
        largeImageUrl: "/typecord-isotipo.png",
        largeImageText: "Typecord",
      }).catch(() => undefined);
    };
    void update();
    const timer = window.setInterval(() => void update(), 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [preferences.showRichPresence, preferences.shareDetectedApps]);
  return null;
}
