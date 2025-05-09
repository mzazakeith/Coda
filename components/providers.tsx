"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as SonnerToaster } from "@/components/ui/sonner"; // For general notifications
import { Toaster as UiToaster } from "@/components/ui/toaster"; // For shadcn/ui toasts

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <TooltipProvider>
        {children}
        <SonnerToaster richColors closeButton />
        <UiToaster />
      </TooltipProvider>
    </NextThemesProvider>
  );
}
