"use client";

import { InteractiveGridPattern } from "@promexma/ui";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import PromexmaLogotipo from "@/components/login/PromexmaLogotipo";
import ThemeToggle from "@/components/ui/ThemeToggle";

const CLAY_LIGHT = "#e8ecf3";
const CLAY_DARK = "#1b2027";

function useLoginChromeTheme(isDark: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const theme = isDark ? CLAY_DARK : CLAY_LIGHT;
    const prevScheme = root.style.colorScheme;
    const prevHtmlBg = root.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevOverscroll = root.style.overscrollBehavior;
    root.style.colorScheme = isDark ? "dark" : "light";
    root.style.backgroundColor = theme;
    body.style.backgroundColor = theme;
    root.style.overscrollBehavior = "none";

    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    const prevTheme = meta.getAttribute("content");
    meta.setAttribute("content", theme);

    return () => {
      root.style.colorScheme = prevScheme;
      root.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      root.style.overscrollBehavior = prevOverscroll;
      if (created) meta?.remove();
      else if (prevTheme != null) meta?.setAttribute("content", prevTheme);
      else meta?.removeAttribute("content");
    };
  }, [isDark]);
}

export default function LoginShell({
  heroLine1,
  heroLine2,
  children,
}: {
  heroLine1: string;
  heroLine2: string;
  children: ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme !== "light";
  useLoginChromeTheme(isDark);

  return (
    <div className="app-canvas relative min-h-dvh overflow-hidden text-fg">
      <div className="app-grid-tile pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <InteractiveGridPattern
          key={mounted ? resolvedTheme : "dark"}
          cellSize={64}
          skewY={6}
          wave
          waveDuration={5}
          waveGap={4}
          className="absolute inset-0"
          squaresClassName="stroke-[var(--grid-line)]"
        />
      </div>

      <div className="pointer-events-auto absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-30 lg:right-8">
        <ThemeToggle />
      </div>

      <main className="pointer-events-none relative z-10 grid min-h-dvh w-full lg:grid-cols-2">
        <section className="hidden flex-col justify-center px-12 py-10 lg:flex xl:px-16">
          <div className="max-w-xl">
            <div className="mb-10">
              <PromexmaLogotipo />
            </div>
            <div className="space-y-6">
              <div className="h-1 w-10 rounded-full bg-brand" />
              <h1 className="font-display text-5xl font-semibold uppercase leading-[0.92] tracking-tight text-fg xl:text-6xl">
                {heroLine1}
                <br />
                <span className="text-fg-strong">{heroLine2}</span>
              </h1>
            </div>
          </div>
          <p className="mt-10 text-xs tracking-wide text-fg-faint">SO Conteos · frame</p>
        </section>

        <section className="login-safe-x login-safe-top login-safe-bottom flex min-h-dvh flex-col px-4 sm:px-6 lg:min-h-0 lg:justify-center lg:px-12 lg:py-10 xl:px-16">
          <div className="shrink-0 px-1 pb-5 pt-1 text-center lg:hidden">
            <PromexmaLogotipo align="center" />
            <div className="mt-5 space-y-3">
              <div className="mx-auto h-1 w-8 rounded-full bg-brand" />
              <h1 className="font-display text-[1.65rem] font-semibold uppercase leading-[1.05] tracking-tight text-fg sm:text-3xl">
                {heroLine1}
                <br />
                <span className="text-fg-strong">{heroLine2}</span>
              </h1>
            </div>
          </div>

          <div className="mt-auto flex w-full flex-col justify-end lg:mt-0 lg:justify-center">
            <div className="mx-auto w-full max-w-md lg:mx-0 xl:max-w-lg">
              <div className="pointer-events-auto neu-raised rounded-lg p-6 sm:p-8 lg:p-10">{children}</div>
              <p className="mt-4 px-2 text-center text-xs tracking-wide text-fg-faint lg:hidden">
                SO Conteos · frame
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
