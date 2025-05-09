import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY environment variable.");
  // We don't throw here to allow the app to build, but API calls will fail.
  // Runtime checks will handle this.
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export async function POST(req: NextRequest) {
  if (!genAI) {
    return NextResponse.json({ message: "Gemini API key not configured." }, { status: 500 });
  }

  try {
    const { message, history = [], model: modelName, files = [], githubPrUrl } = await req.json();

    if (!message && files.length === 0 && !githubPrUrl) {
      return NextResponse.json({ message: "No input provided (message, files, or GitHub PR URL)." }, { status: 400 });
    }
    
    const generationConfig = {
      temperature: 0.7, // Adjust for creativity vs. factuality
      topK: 1,
      topP: 1,
      maxOutputTokens: 8192, // Max for Gemini 1.5 Pro
    };

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    const model = genAI.getGenerativeModel({ model: modelName || "gemini-1.5-flash-latest", generationConfig, safetySettings });

    let prompt = "You are an expert AI code reviewer. Your goal is to provide a comprehensive, clear, and actionable review of the submitted code or pull request. ";
    prompt += "Focus on identifying potential bugs, performance inefficiencies, security vulnerabilities, deviations from language-specific best practices, and areas for code style improvement. Provide suggestions that are actionable and include illustrative code snippets where appropriate. Be concise but thorough.\n\n";

    if (githubPrUrl) {
      prompt += \`A GitHub Pull Request is submitted for review: \${githubPrUrl}\n\`;
      // TODO: Implement GitHub PR fetching logic here.
      // For now, we'll just tell the model about the URL.
      // In a real scenario, you'd fetch the diff and pass it.
      prompt += "Please analyze this Pull Request. If you cannot access the URL, state that and review based on any other provided context or code.\n\n";
    }

    if (files.length > 0) {
      prompt += "The following code files are submitted for review:\n\n";
      files.forEach((file: { name: string; content: string }) => {
        prompt += \`--- File: \${file.name} ---\n\`;
        prompt += \`\`\`\n\${file.content}\n\`\`\`\n\n\`;
      });
    }
    
    if (message) {
        prompt += \`The user has also provided the following message or query: "\${message}"\n\`;
    } else if (files.length > 0 || githubPrUrl) {
        prompt += "Please provide a review of the submitted code/PR.\n";
    }


    const chatHistory = history.map((msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "model" : msg.role, // Gemini uses 'model' for assistant
      parts: [{ text: msg.content }],
    }));
    
    // The last message in history is the current user message, which is already part of the prompt
    // So we take all but the last message from history for the chat object.
    // If history is empty, this is fine.
    const chat = model.startChat({
      history: chatHistory.slice(0, -1), // Exclude current user message from history if it's there
      generationConfig,
      safetySettings,
    });
    
    const result = await chat.sendMessageStream(prompt);
    
    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          try {
            const text = chunk.text();
            controller.enqueue(new TextEncoder().encode(text));
          } catch (error) {
            console.error("Error processing stream chunk:", error);
            // Potentially enqueue an error message or handle differently
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (error: any) {
    console.error("Error in /api/review:", error);
    return NextResponse.json({ message: error.message || "An unexpected error occurred." }, { status: 500 });
  }
}
