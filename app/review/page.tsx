"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useChat, Message as VercelAIMessage } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label"; // No longer directly used for API keys here
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Loader2, Paperclip, Send, Github, AlertCircle, FileText, Trash2, Settings2 } from "lucide-react";
import { ProcessingIndicator } from "@/components/processing-indicator";
// ApiKeyDialog is now in Header, but we might need to read keys here
// import { ApiKeyDialog } from "@/components/api-key-dialog"; 

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

export default function ReviewPage() {
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [githubPrUrl, setGithubPrUrl] = useState("");
  // const [error, setError] = useState<string | null>(null); // useChat handles errors
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API Keys state (primarily for potential future client-side use or passing to backend)
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [githubPat, setGithubPat] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true); // Ensure localStorage is accessed only on the client
    if (typeof window !== "undefined") {
      setGeminiApiKey(localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY));
      setGithubPat(localStorage.getItem(GITHUB_PAT_STORAGE_KEY));
    }
  }, []);


  const { messages, input, handleInputChange, handleSubmit: handleVercelSubmit, isLoading, error: chatError } = useChat({
    api: "/api/review",
    body: { // Additional data to send to the API
      model: selectedModel,
      files: uploadedFiles,
      githubPrUrl: githubPrUrl,
      // userMessage: input, // The 'input' is already part of 'messages' sent by useChat
    },
    onError: (err) => {
      toast.error(err.message || "An error occurred with the AI chat.");
      console.error("Chat error:", err);
    },
    onFinish: () => {
      // Potentially clear files/PR URL if desired after first successful review
      // setUploadedFiles([]);
      // setGithubPrUrl("");
    }
  });

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

  const initiateReviewOrSendMessage = (e?: FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;
    if (!input.trim() && uploadedFiles.length === 0 && !githubPrUrl.trim()) {
      toast.error("Please provide code, a GitHub PR URL, or a message.");
      return;
    }

    // The useChat hook's handleSubmit will send all necessary data via its `body` config.
    // We pass the current `input` value.
    // The `body` in `useChat` is updated when `selectedModel`, `uploadedFiles`, or `githubPrUrl` change.
    // However, `useChat` sends its `messages` array which includes the current input.
    // We need to ensure the `data` field in `app/api/review/route.ts` gets the latest files/prUrl.
    // This is handled by `useChat`'s `body` option being reactive.

    let initialSystemMessageContent = "";
    if (messages.length === 0) { // Only for the very first message / "Start Review"
        if (uploadedFiles.length > 0) {
            initialSystemMessageContent += `Starting review for uploaded files: ${uploadedFiles.map(f => f.name).join(', ')}. `;
        }
        if (githubPrUrl) {
            initialSystemMessageContent += `Reviewing GitHub PR: ${githubPrUrl}. `;
        }
        if (initialSystemMessageContent) {
            // This message is for user display only, actual files/PR are sent in API body
            // We can't directly add a system message to `useChat`'s state this way.
            // Instead, the API prompt will contain this info.
            // For UI, we can show a toast or a temporary message.
            toast.info(initialSystemMessageContent + "The AI will now analyze this context.");
        }
    }
    
    handleVercelSubmit(e as any); // Pass the event
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


  return (
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
              value={githubPrUrl} onChange={(e) => setGithubPrUrl(e.target.value)}
            />
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

        <Button onClick={() => initiateReviewOrSendMessage()} disabled={isLoading} className="w-full mt-auto">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icons.Code className="mr-2 h-4 w-4" />}
          {messages.length > 0 ? "Send Message" : "Start Code Review"}
        </Button>
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
          {messages.map((msg: VercelAIMessage) => ( // Use VercelAIMessage type
            <div
              key={msg.id}
              className={`mb-4 p-3 rounded-lg max-w-[85%] whitespace-pre-wrap ${ // whitespace-pre-wrap for newlines
                msg.role === "user"
                  ? "bg-primary text-primary-foreground ml-auto"
                  : msg.role === "assistant"
                  ? "bg-muted mr-auto"
                  : "bg-blue-500/20 text-blue-700 dark:text-blue-300 text-sm mr-auto" // System/other messages
              }`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus} language={match[1]} PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>{children}</code>
                    );
                  },
                  a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />
                }}
              >
                {msg.content}
              </ReactMarkdown>
              <p className={`text-xs mt-1 ${msg.role === "user" ? "text-primary-foreground/70 text-right" : "text-muted-foreground/70"}`}>
                {new Date(msg.createdAt || Date.now()).toLocaleTimeString()} {/* Use createdAt from VercelAIMessage */}
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
  );
}
