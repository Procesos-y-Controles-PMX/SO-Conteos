"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MobileNavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  active: boolean;
};

export default function MobileBottomNav({ items }: { items: MobileNavItem[] }) {
  return (
    <nav
      className="neu-bottom-nav fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Navegación principal"
    >
      <div className="flex h-[4.25rem] items-stretch">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors",
              item.active ? "text-brand" : "text-fg-subtle",
            )}
            aria-current={item.active ? "page" : undefined}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm transition-all",
                item.active ? "neu-nav-active text-white" : "neu-raised-sm text-current",
              )}
            >
              {item.icon}
            </span>
            <span className="max-w-full truncate px-0.5">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
