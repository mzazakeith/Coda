"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useChat, Message as VercelAIMessage } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Loader2, Paperclip, Send, Github, AlertCircle, FileText, Trash2, Settings2 } from "lucide-react";
import { ProcessingIndicator } from "@/components/processing-indicator";


const AVAILABLE_MODELS = [
  { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro" },
  { id: "gemini-pro", name: "Gemini Pro (Legacy)" },
  // Add other models as needed, ensure they are supported by @ai-sdk/google
];

interface UploadedFile {
  name: string;
  content: string;
  language: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_TOTAL_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_FILE_TYPES = [
  ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cs", ".go", ".rb", ".php",
  ".html", ".css", ".scss", ".less", ".json", ".xml", ".yaml", ".yml", ".md",
  ".diff", ".patch", ".txt", ".sh", ".swift", ".kt", ".c", ".cpp", ".h", ".hpp"
];

const languageMap: { [key: string]: string } = {
  ".js": "javascript", ".jsx": "jsx", ".ts": "typescript", ".tsx": "tsx",
  ".py": "python", ".java": "java", ".cs": "csharp", ".go": "go", ".rb": "ruby",
  ".php": "php", ".html": "html", ".css": "css", ".scss": "scss", ".less": "less",
  ".json": "json", ".xml": "xml", ".yaml": "yaml", ".yml": "yaml", ".md": "markdown",
  ".diff": "diff", ".patch": "diff", ".txt": "text", ".sh": "bash", ".swift": "swift",
  ".kt": "kotlin", ".c": "c", ".cpp": "cpp", ".h": "c", ".hpp": "cpp"
};

// For reading API keys from localStorage
const GEMINI_API_KEY_STORAGE_KEY = "gemini_api_key";
const GITHUB_PAT_STORAGE_KEY = "github_pat";

const GITHUB_API_BASE = "https://api.github.com";

async function fetchGitHubPRContent(prUrl: string, githubPat: string | null) {
  try {
    // Parse the GitHub PR URL
    // Format: https://github.com/owner/repo/pull/number
    const urlParts = prUrl.split('/');
    if (urlParts.length < 7 || urlParts[2] !== 'github.com' || urlParts[5] !== 'pull') {
      throw new Error('Invalid GitHub PR URL format');
    }

    const owner = urlParts[3];
    const repo = urlParts[4];
    const prNumber = urlParts[6];

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (githubPat) {
      headers['Authorization'] = `token ${githubPat}`;
    }

    // Fetch PR details
    const prResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers
    });

    if (!prResponse.ok) {
      throw new Error(`GitHub API error: ${prResponse.status} ${await prResponse.text()}`);
    }

    const prData = await prResponse.json();
    
    // Fetch PR files
    const filesResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/files`, {
      headers
    });
    
    if (!filesResponse.ok) {
      throw new Error(`GitHub API error (files): ${filesResponse.status} ${await filesResponse.text()}`);
    }
    
    const filesData = await filesResponse.json();
    
    // Format PR info
    const prInfo = {
      url: prUrl,
      title: prData.title,
      description: prData.body || '(No description)',
      author: prData.user?.login || 'Unknown',
      additions: prData.additions,
      deletions: prData.deletions,
      changedFiles: prData.changed_files,
      files: filesData.map((file: any) => ({
        name: file.filename,
        status: file.status, // added, modified, removed
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch || '(Binary file or too large to display)',
      }))
    };
    
    return prInfo;
  } catch (error: any) {
    console.error("Error fetching GitHub PR:", error);
    throw new Error(`Failed to fetch PR details: ${error.message}`);
  }
}

function formatPRFileToDiff(file: any): string {
  // Create a git-style diff header
  let diffContent = `diff --git a/${file.name} b/${file.name}\n`;
  diffContent += `--- a/${file.name}\n`;
  diffContent += `+++ b/${file.name}\n`;
  
  // Add file metadata
  diffContent += `File status: ${file.status}\n`;
  diffContent += `Changes: ${file.additions} additions, ${file.deletions} deletions\n\n`;
  
  // Add the actual diff content if available
  if (file.patch) {
    diffContent += file.patch;
  } else {
    // Handle binary files or large diffs that GitHub API doesn't return completely
    diffContent += `[Binary file or changes too large to display]\n`;
    
    // Add explanation about potentially missing content
    if (file.status === 'modified' && !file.patch) {
      diffContent += `\nNote: This file was modified but GitHub API didn't return the patch data.\n`;
      diffContent += `This typically happens for binary files or very large changes.\n`;
    }
  }
  
  return diffContent;
}

function formatPRSummary(prData: any): string {
  let summary = `# GitHub PR Review Request\n\n`;
  
  // Basic PR information
  summary += `## PR Details\n`;
  summary += `- **Title**: ${prData.title}\n`;
  summary += `- **Author**: ${prData.author}\n`;
  summary += `- **URL**: ${prData.url}\n`;
  summary += `- **Changes**: ${prData.changedFiles} files changed, +${prData.additions} -${prData.deletions}\n\n`;
  
  // Description
  summary += `## Description\n${prData.description || '(No description provided)'}\n\n`;
  
  // Files changed summary
  summary += `## Files Changed\n`;
  prData.files.forEach((file: any) => {
    let changeSymbol = '';
    if (file.status === 'added') changeSymbol = '➕';
    else if (file.status === 'removed') changeSymbol = '🗑️';
    else if (file.status === 'modified') changeSymbol = '✏️';
    else if (file.status === 'renamed') changeSymbol = '🔄';
    
    summary += `- ${changeSymbol} \`${file.name}\` (${file.status}, +${file.additions} -${file.deletions})\n`;
  });
  
  summary += `\n## Review Request\n`;
  summary += `Please review this PR focusing on:\n`;
  summary += `- Code quality and best practices\n`;
  summary += `- Potential bugs or logic errors\n`;
  summary += `- Performance considerations\n`;
  summary += `- Security concerns\n`;
  summary += `- Overall architecture and design\n\n`;
  summary += `I've attached the diffs for each file. Please provide a thorough and constructive code review.\n`;
  
  return summary;
}

export default function ReviewPage() {
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [githubPrUrl, setGithubPrUrl] = useState("");
  const [prContent, setPrContent] = useState<any>(null); // Add state for PR content
  const [isPrLoading, setIsPrLoading] = useState(false); // Add state for PR loading status
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API Keys state (primarily for potential future client-side use or passing to backend)
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [githubPat, setGithubPat] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true); // Ensure localStorage is accessed only on the client
    if (typeof window !== "undefined") {
      const storedApiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
      const storedGithubPat = localStorage.getItem(GITHUB_PAT_STORAGE_KEY);
      setGeminiApiKey(storedApiKey);
      setGithubPat(storedGithubPat);
      console.log("API key from localStorage:", storedApiKey ? "Found" : "Not found");
      
      // Set up event listener for API key changes
      const handleApiKeysUpdated = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail) {
          if (detail.geminiApiKey !== undefined) {
            setGeminiApiKey(detail.geminiApiKey);
            console.log("API key updated via event:", detail.geminiApiKey ? "Found" : "Not found");
          }
          if (detail.githubPat !== undefined) {
            setGithubPat(detail.githubPat);
          }
        }
      };
      
      window.addEventListener('apiKeysUpdated', handleApiKeysUpdated);
      
      // Clean up event listener
      return () => {
        window.removeEventListener('apiKeysUpdated', handleApiKeysUpdated);
      };
    }
  }, []);


  const { messages, input, handleInputChange, handleSubmit: handleVercelSubmit, isLoading, error: chatError } = useChat({
    api: "/api/review",
    body: { // These properties will be merged with the messages and id in the request
      model: selectedModel,
      files: uploadedFiles,
      githubPrUrl: githubPrUrl,
      apiKey: geminiApiKey, // Pass the API key to the backend
    },
    id: geminiApiKey || 'no-key', // Use API key as part of the ID to force reset when it changes
    onError: (err) => {
      toast.error(err.message || "An error occurred with the AI chat.");
      console.error("Chat error:", err);
    },
    onFinish: () => {
      console.log("Chat interaction completed successfully");
    }
  });

  // Re-initialize chat when the API key changes
  useEffect(() => {
    // No direct way to reset useChat, but we can at least track API key changes
    console.log("API key updated:", geminiApiKey ? "Present" : "Not present");
  }, [geminiApiKey]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    let currentTotalSize = uploadedFiles.reduce((acc, file) => acc + new TextEncoder().encode(file.content).length, 0);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File ${file.name} exceeds ${MAX_FILE_SIZE / (1024*1024)}MB.`);
        continue;
      }
      const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!SUPPORTED_FILE_TYPES.includes(fileExtension)) {
        toast.error(`File type for ${file.name} is not supported.`);
        continue;
      }
      
      currentTotalSize += file.size;
      if (currentTotalSize > MAX_TOTAL_UPLOAD_SIZE) {
        toast.error("Total upload size exceeds 50MB.");
        break; 
      }

      const content = await file.text();
      newFiles.push({
        name: file.name,
        content,
        language: languageMap[fileExtension] || "text",
      });
    }
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles(files => files.filter(file => file.name !== fileName));
  };

  const initiateReviewOrSendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (isLoading || isPrLoading) return;
    
    // Check if API key is available
    if (!geminiApiKey) {
      toast.error("Please set your Google Gemini API Key in the settings.");
      return;
    }

    // For file uploads or PR URL, we need input or files
    const hasValidInput = !!input.trim() || uploadedFiles.length > 0 || !!githubPrUrl.trim();
    
    if (!hasValidInput) {
      toast.error("Please provide code, a GitHub PR URL, or a message.");
      return;
    }

    console.log("Starting review with model:", selectedModel);
    
    // Handle GitHub PR - use cached PR content if available
    let prFiles: UploadedFile[] = [];
    let initialPrompt = "";
    
    // Check if we already have PR content or need to fetch it
    if (githubPrUrl) {
      if (prContent) {
        // We already have PR content, use it
        console.log("Using cached PR content for", githubPrUrl);
        
        // Regenerate files array from cached PR content
        prFiles = prContent.files.map((file: any) => ({
          name: file.name,
          content: formatPRFileToDiff(file),
          language: "diff"
        }));
        
        initialPrompt = formatPRSummary(prContent);
      } else {
        // Need to fetch PR content
        try {
          setIsPrLoading(true);
          toast.info(`Fetching PR content from ${githubPrUrl}...`);
          
          const prData = await fetchGitHubPRContent(githubPrUrl, githubPat);
          setPrContent(prData);
          
          // Convert PR data into virtual files for review
          prFiles = prData.files.map((file: any) => ({
            name: file.name,
            content: formatPRFileToDiff(file),
            language: "diff"
          }));
          
          initialPrompt = formatPRSummary(prData);
          
          toast.success(`PR data fetched successfully. Found ${prData.files.length} changed files.`);
        } catch (error: any) {
          toast.error(`Failed to fetch PR data: ${error.message}`);
          console.error("PR fetch error:", error);
          setIsPrLoading(false);
          return;
        } finally {
          setIsPrLoading(false);
        }
      }
    }
    
    console.log("Files for review:", 
      prFiles.length > 0 
        ? `${prFiles.length} files from PR` 
        : (uploadedFiles.length > 0 ? uploadedFiles.map(f => f.name).join(', ') : "None")
    );
    
    let initialSystemMessageContent = "";
    if (messages.length === 0) { // Only for the very first message / "Start Review"
        if (uploadedFiles.length > 0) {
            initialSystemMessageContent += `Starting review for uploaded files: ${uploadedFiles.map(f => f.name).join(', ')}. `;
        }
        if (githubPrUrl) {
            initialSystemMessageContent += `Reviewing GitHub PR: ${githubPrUrl}. `;
        }
        if (initialSystemMessageContent) {
            toast.info(initialSystemMessageContent + "The AI will now analyze this context.");
        }
    }
    
    // For first message with files but no input text, add a simple prompt or use PR-specific prompt
    if (messages.length === 0 && !input.trim()) {
      if (initialPrompt) {
        console.log("Setting PR-specific prompt:", initialPrompt);
        handleInputChange({ target: { value: initialPrompt } } as React.ChangeEvent<HTMLTextAreaElement>);
      } else if (uploadedFiles.length > 0 || githubPrUrl) {
        handleInputChange({ target: { value: "Please review this code." } } as React.ChangeEvent<HTMLTextAreaElement>);
      }
    }
    
    // Prepare the combined files list
    const combinedFiles = prFiles.length > 0 ? [...uploadedFiles, ...prFiles] : uploadedFiles;
    
    // Store the combined files for access in the final submission
    const tempStoredFiles = [...combinedFiles];
    
    // Create a small delay to ensure the input change is processed
    setTimeout(() => {
      const currentInput = input || initialPrompt || "Please review this code.";
      console.log("Submitting review request with input:", currentInput);
      console.log(`Sending ${tempStoredFiles.length} files to API`);
      
      if (tempStoredFiles.length > 0) {
        // Log some file details for debugging
        console.log("File names:", tempStoredFiles.map(f => f.name).join(', '));
        console.log("First file size:", tempStoredFiles[0]?.content.length || 0, "chars");
      }
      
      // We need to manually set the body for this specific request
      handleVercelSubmit(e as any, {
        body: {
          model: selectedModel,
          files: tempStoredFiles,
          githubPrUrl: prContent ? undefined : githubPrUrl, // Don't send PR URL if we've fetched content
          apiKey: geminiApiKey
        }
      });
    }, 200);
  };
  
  // Update useChat body when relevant state changes
  useEffect(() => {
    // This is a bit of a hack to ensure the body is updated.
    // `useChat` should ideally have a way to update `body` dynamically or take it as an argument to `handleSubmit`.
    // For now, we rely on the fact that `useChat` options are re-evaluated.
    // This might not be perfectly synchronized if `useChat` doesn't re-initialize its options deeply on every render.
    // A more robust way would be to pass these as part of the `append` function's options if available,
    // or ensure the API endpoint can receive them through a different mechanism if `body` is static after init.
    // The Vercel AI SDK `useChat` `body` is indeed re-evaluated if its dependencies change.
  }, [selectedModel, uploadedFiles, githubPrUrl]);

  // Function to format message content with code blocks
  const formatMessageContent = (content: string) => {
    if (!content) return null;
    
    // Check for code blocks with triple backticks
    const codeBlockRegex = /```([\w]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    // Find all code blocks and process them
    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }
      
      // Get language and code
      const language = match[1].trim() || 'text';
      const code = match[2];
      
      // Add syntax highlighted code block
      parts.push(
        <SyntaxHighlighter 
          key={`code-${match.index}`}
          language={language}
          style={vscDarkPlus}
          className="text-sm rounded-md !mt-2 !mb-2"
        >
          {code}
        </SyntaxHighlighter>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add any remaining text after the last code block
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.slice(lastIndex)}
        </span>
      );
    }
    
    return parts.length > 0 ? parts : content;
  };

  return (
    <>
      <div className="flex h-[calc(100dvh-3.5rem-1px)]">
        <aside className="w-1/3 border-r p-4 flex flex-col space-y-4 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5" /> Upload Code Files</CardTitle>
              <CardDescription>Upload files for review. Max 50MB total.</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                id="file-upload" type="file" multiple onChange={handleFileUpload} ref={fileInputRef}
                className="mb-2" accept={SUPPORTED_FILE_TYPES.join(",")}
              />
              <p className="text-xs text-muted-foreground">
                Supported: {SUPPORTED_FILE_TYPES.slice(0,3).join(", ")}...
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Github className="mr-2 h-5 w-5" /> GitHub PR</CardTitle>
              <CardDescription>Enter a GitHub PR URL for review.</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                id="github-pr-url" type="url" placeholder="https://github.com/owner/repo/pull/123"
                value={githubPrUrl} 
                onChange={(e) => {
                  // Clear PR content if URL changes
                  if (e.target.value !== githubPrUrl) {
                    setPrContent(null);
                  }
                  setGithubPrUrl(e.target.value);
                }}
              />
              
              {/* PR content status */}
              {githubPrUrl && (
                <div className="mt-2 text-sm">
                  {isPrLoading ? (
                    <div className="flex items-center text-muted-foreground">
                      <ProcessingIndicator />
                      <span>Fetching PR data...</span>
                    </div>
                  ) : prContent ? (
                    <div className="bg-muted p-2 rounded-md">
                      <p className="font-semibold">PR: {prContent.title}</p>
                      <p>Author: {prContent.author}</p>
                      <p className="text-xs">Files: {prContent.changedFiles}, +{prContent.additions} -{prContent.deletions}</p>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span className="text-green-500 font-semibold">✓</span> PR content fetched for review
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">
                      PR content will be fetched when you start the review
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {uploadedFiles.length > 0 && (
            <Card className="flex-shrink-0">
              <CardHeader><CardTitle>Uploaded Files ({uploadedFiles.length})</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px] pr-3">
                  <Accordion type="multiple" className="w-full">
                    {uploadedFiles.map((file, index) => (
                      <AccordionItem value={`item-${index}`} key={index}>
                        <AccordionTrigger className="flex justify-between items-center w-full">
                          <span className="truncate">{file.name}</span>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); removeFile(file.name); }} className="ml-2">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AccordionTrigger>
                        <AccordionContent>
                          <SyntaxHighlighter language={file.language} style={vscDarkPlus} customStyle={{ maxHeight: '300px', overflowY: 'auto', fontSize: '0.8rem' }}>
                            {file.content}
                          </SyntaxHighlighter>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Model Selection</CardTitle></CardHeader>
            <CardContent>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger><SelectValue placeholder="Select AI Model" /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 mt-4">
            <Button
              type="submit"
              onClick={initiateReviewOrSendMessage}
              disabled={isLoading || isPrLoading}
              className="w-full"
            >
              {isLoading || isPrLoading ? (
                <>
                  <ProcessingIndicator/>
                  {isPrLoading ? "Fetching PR..." : "Processing..."}
                </>
              ) : messages.length === 0 ? (
                "Start Code Review"
              ) : (
                "Send Message"
              )}
            </Button>
          </div>
        </aside>

        <main className="w-2/3 flex flex-col p-4">
          {chatError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Chat Error</AlertTitle>
              <AlertDescription>{chatError.message}</AlertDescription>
            </Alert>
          )}
          <ScrollArea className="flex-1 mb-4 pr-3" ref={chatContainerRef}>
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Icons.Bot className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">Welcome to AI Code Reviewer!</p>
                <p className="text-sm text-muted-foreground">
                  Upload code, enter a GitHub PR URL, select a model, and type a message or click "Start Code Review".
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Configure API keys via the <Settings2 className="inline h-3 w-3"/> icon in the header if needed.
                </p>
              </div>
            )}
            {messages.map((msg: VercelAIMessage) => (
              <div
                key={msg.id}
                className={`mb-4 p-3 rounded-lg max-w-[85%] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : msg.role === "assistant"
                    ? "bg-muted mr-auto"
                    : "bg-blue-500/20 text-blue-700 dark:text-blue-300 text-sm mr-auto"
                }`}
              >
                <div className="prose prose-sm dark:prose-invert">
                  {formatMessageContent(msg.content)}
                </div>
                <p className={`text-xs mt-1 ${msg.role === "user" ? "text-primary-foreground/70 text-right" : "text-muted-foreground/70"}`}>
                  {new Date(msg.createdAt || Date.now()).toLocaleTimeString()}
                </p>
              </div>
            ))}
            {isLoading && <ProcessingIndicator />}
          </ScrollArea>
          <form onSubmit={initiateReviewOrSendMessage} className="flex items-center space-x-2">
            <Textarea
              placeholder="Ask questions, request clarifications, or provide more context..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  initiateReviewOrSendMessage();
                }
              }}
              className="flex-1 resize-none"
              rows={2}
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || (!input.trim() && uploadedFiles.length === 0 && !githubPrUrl.trim())}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} title="Attach files" disabled={isLoading}>
              <Paperclip className="h-4 w-4" />
              <span className="sr-only">Attach files</span>
            </Button>
          </form>
        </main>
      </div>
      
      {/* Add debugging info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-0 right-0 p-4 bg-black/80 text-white text-xs max-w-xs z-50 rounded-tl-lg">
          <div className="font-bold">Debug Info:</div>
          <div>API Key: {geminiApiKey ? "Set ✓" : "Missing ✗"}</div>
          <div>Model: {selectedModel}</div>
          <div>Files: {uploadedFiles.length}</div>
          <div>Status: {isLoading ? "Loading..." : "Ready"}</div>
          <div>Messages: {messages.length}</div>
          {chatError && <div className="text-red-400">Error: {chatError.message}</div>}
        </div>
      )}
    </>
  );
}
