"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export default function PromexmaLogotipo({ align = "left" }: { align?: "left" | "center" }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <div className={cn(align === "center" ? "flex justify-center" : "-translate-x-[2.5%]")}>
      <Image
        src={isDark ? "/promexma-logotipo.png" : "/promexma-logo.png"}
        alt="Promexma"
        width={isDark ? 637 : 2640}
        height={isDark ? 138 : 554}
        className="block h-20 w-auto max-w-full sm:h-28 xl:h-36"
        priority
      />
    </div>
  );
}
