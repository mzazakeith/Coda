"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Github, Save, Settings } from "lucide-react";

const GEMINI_API_KEY_STORAGE_KEY = "gemini_api_key";
const GITHUB_PAT_STORAGE_KEY = "github_pat";

export function ApiKeyDialog() {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedGeminiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
    const storedGithubPat = localStorage.getItem(GITHUB_PAT_STORAGE_KEY);
    if (storedGeminiKey) setGeminiApiKey(storedGeminiKey);
    if (storedGithubPat) setGithubPat(storedGithubPat);
  }, []);

  const handleSave = () => {
    if (geminiApiKey) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, geminiApiKey);
    } else {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    }
    if (githubPat) {
      localStorage.setItem(GITHUB_PAT_STORAGE_KEY, githubPat);
    } else {
      localStorage.removeItem(GITHUB_PAT_STORAGE_KEY);
    }
    toast.success("API credentials saved successfully!");
    setIsOpen(false);
    // Optionally, trigger a state update in the parent component or a page reload
    // if the keys are immediately needed by other parts of the application.
    // For now, components reading these keys should do so on their own mount/update.
  };

  if (!isMounted) {
    return null; // Avoid hydration mismatch
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          API Keys
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Configure API Credentials</DialogTitle>
          <DialogDescription>
            Manage your Google Gemini API Key and GitHub Personal Access Token.
            These are stored locally in your browser. The Gemini API key entered here
            is primarily for client-side features or if you intend to use a personal key.
            The backend typically uses a server-configured key.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gemini-key" className="text-right col-span-1">
              <KeyRound className="inline-block mr-1 h-4 w-4" />
              Gemini Key
            </Label>
            <Input
              id="gemini-key"
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Enter your Google Gemini API Key"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="github-pat" className="text-right col-span-1">
              <Github className="inline-block mr-1 h-4 w-4" />
              GitHub PAT
            </Label>
            <Input
              id="github-pat"
              type="password"
              value={githubPat}
              onChange={(e) => setGithubPat(e.target.value)}
              placeholder="Enter your GitHub PAT (optional)"
              className="col-span-3"
            />
          </div>
          <p className="text-xs text-muted-foreground px-2">
            Your GitHub Personal Access Token (PAT) can be used for features like fetching private repository details or increasing API rate limits for GitHub operations. Ensure it has the necessary permissions (e.g., `repo` for private repos, `public_repo` for public repos).
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
