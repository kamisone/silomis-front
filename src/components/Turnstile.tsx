"use client";

import { useEffect, useRef } from "react";

interface TurnstileProps {
  siteKey: string;
  locale?: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_ID = "cf-turnstile-script";

export default function Turnstile({ siteKey, locale = "auto", onToken, onExpire, onError }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef  = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const render = () => {
      if (!containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile!.render(containerRef.current, {
        sitekey:     siteKey,
        appearance:  "interaction-only",
        execution:   "render",
        language:    locale,
        callback:             (token: string) => onToken(token),
        "expired-callback":   () => { widgetIdRef.current = null; onExpire?.(); },
        "error-callback":     () => { widgetIdRef.current = null; onError?.(); },
      });
    };

    if (window.turnstile) {
      render();
    } else {
      window.onTurnstileLoad = render;
      if (!document.getElementById(SCRIPT_ID)) {
        const script = document.createElement("script");
        script.id    = SCRIPT_ID;
        script.src   = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={containerRef} />;
}
