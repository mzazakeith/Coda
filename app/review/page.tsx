"use client"; // This page will involve client-side interactions

import { useState, useEffect, useRef, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"; // Or any theme you prefer
import { Loader2, Paperclip, Send, Github, AlertCircle, FileText, Trash2 } from "lucide-react";

// TODO: Replace with actual models from Gemini or configuration
const AVAILABLE_MODELS = [
	{ id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-pro-preview-03-24", name: "Gemini 2.5 Pro" },
	{ id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "gemini-2.0-pro", name: "Gemini 2.0 Pro" },
  { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro" },
  { id: "gemini-pro", name: "Gemini Pro (Legacy)" },
];

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface UploadedFile {
  name: string;
  content: string;
  language: string; // For syntax highlighting
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

export default function ReviewPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [githubPrUrl, setGithubPrUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll to bottom of chat on new message
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
        toast.error(`File ${file.name} exceeds the maximum size of ${MAX_FILE_SIZE / (1024*1024)}MB.`);
        continue;
      }
      const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!SUPPORTED_FILE_TYPES.includes(fileExtension)) {
        toast.error(`File type for ${file.name} is not supported.`);
        continue;
      }
      
      currentTotalSize += file.size;
      if (currentTotalSize > MAX_TOTAL_UPLOAD_SIZE) {
        toast.error("Total upload size exceeds the limit of 50MB.");
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
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset file input
    }
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles(files => files.filter(file => file.name !== fileName));
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;
    if (!inputMessage.trim() && uploadedFiles.length === 0 && !githubPrUrl.trim()) {
      toast.error("Please provide code, a GitHub PR URL, or a message to start the review.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const userMessageContent = inputMessage.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMessageContent,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage(""); // Clear input after sending

    // Prepare payload for API
    const payload = {
      message: userMessageContent,
      history: messages, // Send previous messages for context
      model: selectedModel,
      files: uploadedFiles,
      githubPrUrl: githubPrUrl,
    };

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error occurred" }));
        throw new Error(errorData.message || `API error: ${response.status}`);
      }
      
      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessageId = Date.now().toString() + "-assistant";
      let accumulatedResponse = "";

      setMessages(prev => [...prev, { id: assistantMessageId, role: "assistant", content: "▋", timestamp: new Date() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulatedResponse += decoder.decode(value, { stream: true });
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId ? { ...msg, content: accumulatedResponse + "▋" } : msg
          )
        );
      }
      // Final update to remove cursor
       setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId ? { ...msg, content: accumulatedResponse } : msg
          )
        );

    } catch (err: any) {
      console.error("Error during review:", err);
      setError(err.message || "Failed to get review. Please try again.");
      toast.error(err.message || "Failed to get review.");
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "system", content: `Error: ${err.message}`, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
      // Clear files and PR URL after initial submission if they were part of it
      // setUploadedFiles([]); 
      // setGithubPrUrl("");
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem-1px)]"> {/* Adjust height based on header */}
      {/* Left Panel: Inputs & File Viewer */}
      <aside className="w-1/3 border-r p-4 flex flex-col space-y-4 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><FileText className="mr-2 h-5 w-5" /> Upload Code Files</CardTitle>
            <CardDescription>Upload one or more code files for review. Max 50MB total.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              id="file-upload"
              type="file"
              multiple
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="mb-2"
              accept={SUPPORTED_FILE_TYPES.join(",")}
            />
            <p className="text-xs text-muted-foreground">
              Supported: {SUPPORTED_FILE_TYPES.slice(0, 5).join(", ")}... (see all in console)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Github className="mr-2 h-5 w-5" /> GitHub Pull Request</CardTitle>
            <CardDescription>Enter a GitHub PR URL for review.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              id="github-pr-url"
              type="url"
              placeholder="https://github.com/owner/repo/pull/123"
              value={githubPrUrl}
              onChange={(e) => setGithubPrUrl(e.target.value)}
            />
          </CardContent>
        </Card>
        
        {uploadedFiles.length > 0 && (
          <Card className="flex-shrink-0">
            <CardHeader>
              <CardTitle>Uploaded Files ({uploadedFiles.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] pr-3"> {/* Max height for scroll area */}
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
          <CardHeader>
            <CardTitle>Model Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select AI Model" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Button onClick={() => handleSubmit()} disabled={isLoading} className="w-full mt-auto">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icons.Code className="mr-2 h-4 w-4" />}
          {messages.length > 0 ? "Send Message & Context" : "Start Code Review"}
        </Button>
      </aside>

      {/* Right Panel: Chat Interface */}
      <main className="w-2/3 flex flex-col p-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <ScrollArea className="flex-1 mb-4 pr-3" ref={chatContainerRef}>
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Icons.Bot className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                Welcome to AI Code Reviewer!
              </p>
              <p className="text-sm text-muted-foreground">
                Upload your code files or enter a GitHub PR URL, then type a message or click "Start Code Review".
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-4 p-3 rounded-lg max-w-[85%] ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground ml-auto"
                  : msg.role === "assistant"
                  ? "bg-muted mr-auto"
                  : "bg-destructive/20 text-destructive-foreground text-sm mr-auto" 
              }`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  // Allow users to click line numbers (basic example)
                  // This would need more sophisticated parsing of the LLM output
                  // to identify line numbers and associate them with uploaded code.
                  // For now, this is a placeholder.
                  a: ({node, ...props}) => {
                    if (props.href?.startsWith("#line-")) {
                      const lineNum = props.href.substring(6);
                      return <button onClick={() => toast.info(`Clicked line: ${lineNum}`)} className="text-blue-500 underline">{props.children}</button>
                    }
                    return <a {...props} target="_blank" rel="noopener noreferrer" />
                  }
                }}
              >
                {msg.content}
              </ReactMarkdown>
              <p className={`text-xs mt-1 ${msg.role === "user" ? "text-primary-foreground/70 text-right" : "text-muted-foreground/70"}`}>
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
          ))}
          {isLoading && messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-lg text-muted-foreground">Analyzing your code...</p>
             </div>
          )}
        </ScrollArea>
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <Textarea
            placeholder="Ask questions about the review, request clarifications, or provide more context..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="flex-1 resize-none"
            rows={2}
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} title="Attach files">
            <Paperclip className="h-4 w-4" />
            <span className="sr-only">Attach files</span>
          </Button>
        </form>
      </main>
    </div>
  );
}
