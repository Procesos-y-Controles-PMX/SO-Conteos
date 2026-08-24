import type { ReactNode } from "react";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showThemeToggle?: boolean;
}

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  showThemeToggle = false,
}: Props) {
  return (
    <div className="mb-6 flex shrink-0 flex-col justify-between gap-4 pb-1 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[1.85rem] font-semibold leading-none tracking-tight text-fg md:text-[2.1rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-subtle">{subtitle}</p>
        ) : null}
      </div>
      {actions || showThemeToggle ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {actions}
          {showThemeToggle ? <ThemeToggle /> : null}
        </div>
      ) : null}
    </div>
  );
}
