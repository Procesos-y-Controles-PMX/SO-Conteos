"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
};

/** Suggestion list that drops out of the field instead of popping into place. */
export default function DropdownPanel({ open, id, className, children }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.ul
          id={id}
          role="listbox"
          className={cn("neu-popover overflow-auto p-1.5", className)}
          style={{ transformOrigin: "top center" }}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scaleY: 0.9, scaleX: 0.98 }}
          animate={{ opacity: 1, y: 0, scaleY: 1, scaleX: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scaleY: 0.95, scaleX: 0.99 }}
          transition={
            reduceMotion
              ? { duration: 0.12 }
              : {
                  type: "spring",
                  stiffness: 520,
                  damping: 34,
                  mass: 0.6,
                  opacity: { duration: 0.12 },
                }
          }
        >
          {children}
        </motion.ul>
      ) : null}
    </AnimatePresence>
  );
}
