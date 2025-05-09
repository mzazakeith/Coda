import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/icons";
import { ArrowRight, CheckCircle2, Zap } from "lucide-react";

export default function HomePage() {
  return (
    <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
      <div className="flex flex-col items-center text-center space-y-6">
        <Icons.Logo className="h-20 w-20 text-primary" />
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Elevate Your Code with AI-Powered Reviews
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Submit your code or GitHub Pull Requests and get instant, insightful feedback from advanced AI models. Streamline your development workflow and improve code quality effortlessly.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/review" className={buttonVariants({ size: "lg" })}>
            Start Reviewing <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <Button variant="outline" size="lg" asChild>
            <Link href="https://github.com/your-repo/ai-code-reviewer" target="_blank">
              <Icons.GitHub className="mr-2 h-5 w-5" />
              View on GitHub
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-8 md:grid-cols-3 w-full max-w-5xl">
        <FeatureCard
          icon={<Zap className="h-10 w-10 text-primary mb-4" />}
          title="Instant Feedback"
          description="Get comprehensive code analysis in seconds, not hours. Identify bugs, performance issues, and security vulnerabilities quickly."
        />
        <FeatureCard
          icon={<Icons.Bot className="h-10 w-10 text-primary mb-4" />}
          title="Intelligent Analysis"
          description="Leverage state-of-the-art AI models like Google Gemini for deep code understanding and actionable suggestions."
        />
        <FeatureCard
          icon={<Icons.GitHub className="h-10 w-10 text-primary mb-4" />}
          title="Seamless GitHub Integration"
          description="Directly review GitHub Pull Requests by simply providing a URL. Keep your workflow smooth and efficient."
        />
      </section>

      <section className="w-full max-w-5xl py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
          <p className="mt-2 text-muted-foreground">A simple process to enhance your code quality.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <Step
            number="1"
            title="Submit Code"
            description="Upload your code files directly or provide a link to a GitHub Pull Request."
          />
          <Step
            number="2"
            title="AI Analysis"
            description="Our AI engine, powered by Gemini, thoroughly analyzes your code for improvements."
          />
          <Step
            number="3"
            title="Review & Discuss"
            description="Receive a detailed review and interact with the AI to understand suggestions and explore alternatives."
          />
        </div>
      </section>

      <section className="w-full max-w-3xl py-12 text-center">
         <h2 className="text-3xl font-bold tracking-tight">Ready to Improve Your Code?</h2>
         <p className="mt-4 text-lg text-muted-foreground">
           Join developers who are leveraging AI to write better, more secure, and more efficient code.
         </p>
         <Link href="/review" className={buttonVariants({ size: "lg", className: "mt-8" })}>
            Get Started for Free <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
      </section>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="text-center">
      <CardHeader>
        <div className="mx-auto flex items-center justify-center">
          {icon}
        </div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

interface StepProps {
  number: string;
  title: string;
  description: string;
}

function Step({ number, title, description }: StepProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
