import { GoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, StreamingTextResponse, CoreMessage } from 'ai';
import { NextRequest } from 'next/server';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ message: "Missing GOOGLE_GEMINI_API_KEY environment variable." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const google = new GoogleGenerativeAI({ apiKey: GEMINI_API_KEY });

  try {
    const { messages: historyMessages, data } = await req.json();
    const { model: modelName, files = [], githubPrUrl, userMessage } = data;

    if (!userMessage && files.length === 0 && !githubPrUrl) {
      return new Response(
        JSON.stringify({ message: "No input provided (message, files, or GitHub PR URL)." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let systemPrompt = "You are an expert AI code reviewer. Your primary goal is to provide a comprehensive, clear, and actionable review of the submitted code or pull request. \n\n" +
      "Key areas to focus on:\n" +
      "- **Bugs and Logic Errors**: Identify any potential bugs, logical flaws, or edge cases not handled.\n" +
      "- **Performance**: Highlight inefficiencies and suggest optimizations.\n" +
      "- **Security Vulnerabilities**: Point out potential security risks (e.g., XSS, SQLi, insecure handling of secrets).\n" +
      "- **Best Practices**: Check adherence to language-specific best practices, design patterns, and coding standards.\n" +
      "- **Code Style & Readability**: Suggest improvements for clarity, maintainability, and consistency. Comment on naming conventions, complexity, and documentation.\n" +
      "- **Actionable Suggestions**: Provide concrete examples or code snippets for your recommendations where appropriate.\n" +
      "- **Conciseness and Thoroughness**: Be concise in your explanations but thorough in your analysis. Prioritize critical issues.\n" +
      "- **Tone**: Maintain a constructive and helpful tone.\n\n";

    if (githubPrUrl) {
      systemPrompt += \`A GitHub Pull Request is submitted for review: ${githubPrUrl}\n\`;
      systemPrompt += "Please analyze this Pull Request. If you cannot directly access the URL content, state that clearly and perform your review based on any other provided code and context. Focus on the conceptual changes if the diff is not available to you.\n\n";
    }

    if (files.length > 0) {
      systemPrompt += "The following code files are submitted for review:\n\n";
      files.forEach((file: { name: string; content: string }) => {
        systemPrompt += `--- File: ${file.name} ---\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
      });
    }
    
    // The user's actual message is the last one in historyMessages from useChat
    // Or it can be passed in `userMessage` if it's the first message.
    // The Vercel AI SDK `useChat` hook sends messages in `messages` array.
    // The last message is the current user prompt.

    const currentMessages: CoreMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.map((msg: { role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool', content: string }) => ({ // map to CoreMessage
        role: msg.role,
        content: msg.content,
      }))
    ];
    
    const result = await streamText({
      model: google(modelName || 'gemini-1.5-flash-latest'),
      messages: currentMessages,
      temperature: 0.7,
      topK: 1,
      topP: 1,
      // maxOutputTokens: 8192, // This is often set by the model provider by default
      // safetySettings can be configured here if needed, similar to your previous setup
    });

    return result.toAIStreamResponse();

  } catch (error: any) {
    console.error("Error in /api/review:", error);
    const errorMessage = error.message || "An unexpected error occurred.";
    // Check if the error is a Response object (e.g. from a fetch error)
    if (error instanceof Response) {
        const text = await error.text();
        console.error("Underlying error response:", text);
        return new Response(JSON.stringify({ message: `API Error: ${error.status} ${text}` }), { status: error.status, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
