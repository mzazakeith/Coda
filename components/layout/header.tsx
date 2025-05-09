"use client";

import Link from "next/link";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Icons.Logo className="h-6 w-6" />
          <span className="font-bold sm:inline-block">
            AI Code Reviewer
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm lg:gap-6">
          <Link
            href="/review"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            Review
          </Link>
          {/* Add more nav links here if needed */}
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer">
              <Icons.GitHub className="h-4 w-4 mr-2" />
              GitHub
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <Separator />
    </header>
  );
}
