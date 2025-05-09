import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, CoreMessage } from 'ai';
import { NextRequest } from 'next/server';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log("Received request payload:", JSON.stringify(payload, null, 2));
    
    // Extract data properties at the top level
    const { messages: historyMessages, model: modelName, files = [], githubPrUrl, apiKey } = payload;
    
    // Try to use the API key from the request first, then fall back to environment variable
    const GEMINI_API_KEY = apiKey || process.env.GOOGLE_GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ message: "Missing Google Gemini API Key. Please set your API key in the settings." }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!historyMessages?.length && files.length === 0 && !githubPrUrl) {
      return new Response(
        JSON.stringify({ message: "No input provided (message, files, or GitHub PR URL)." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create the Google AI provider with the API key
    const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });

    let systemPrompt = "You are an expert Senior Software Engineer with knowledge in multiple programming languages. Your primary goal is to provide a comprehensive, clear, and actionable review of the submitted code or pull request or chat with the user about anything tech/coding related. \n\n" +
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
      systemPrompt += `A GitHub Pull Request is submitted for review: ${githubPrUrl}\n`;
      systemPrompt += "Please analyze this Pull Request. If you cannot directly access the URL content, state that clearly and perform your review based on any other provided code and context. Focus on the conceptual changes if the diff is not available to you.\n\n";
    }

    if (files.length > 0) {
      systemPrompt += "The following code files are submitted for review:\n\n";
      files.forEach((file: { name: string; content: string }) => {
        systemPrompt += `--- File: ${file.name} ---\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
      });
    }
    
    // Build messages array with system prompt and history
    const currentMessages: CoreMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.map((msg: { role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool', content: string }) => ({
        role: msg.role,
        content: msg.content,
      }))
    ];
    
    console.log('Sending request to Google AI with model:', modelName || 'gemini-2.5-flash-preview-04-17');
    
    // Stream the response
    const result = await streamText({
      model: google(modelName || 'gemini-2.5-flash-preview-04-17'),
      messages: currentMessages,
      temperature: 0.7,
      topK: 1,
      topP: 1,
    });

    // Return the streamed response
    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error("Error in /api/review:", error);
    const errorMessage = error.message || "An unexpected error occurred.";
    
    if (error instanceof Response) {
        const text = await error.text();
        console.error("Underlying error response:", text);
        return new Response(JSON.stringify({ message: `API Error: ${error.status} ${text}` }), 
          { status: error.status, headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response(JSON.stringify({ message: errorMessage }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
