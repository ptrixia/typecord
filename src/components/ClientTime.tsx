"use client";

import { useEffect, useState } from "react";

interface ClientTimeProps {
  timestamp?: string | number | Date | null;
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
}

export default function ClientTime({ timestamp, locale = "pt-BR", options }: ClientTimeProps) {
  const [text, setText] = useState<string>(() => {
    if (!timestamp) return "";
    try {
      const d = typeof timestamp === "string" || typeof timestamp === "number" ? new Date(timestamp) : timestamp;
      return new Intl.DateTimeFormat(locale, options ?? { hour: "2-digit", minute: "2-digit" }).format(d);
    } catch (e) {
      return "";
    }
  });

  useEffect(() => {
    if (!timestamp) return;
    try {
      const d = typeof timestamp === "string" || typeof timestamp === "number" ? new Date(timestamp) : timestamp;
      setText(new Intl.DateTimeFormat(locale, options ?? { hour: "2-digit", minute: "2-digit" }).format(d));
    } catch (e) {
      setText("");
    }
  }, [timestamp, locale, JSON.stringify(options ?? {})]);

  return <>{text}</>;
}
