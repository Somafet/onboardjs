"use client";

import { Button } from "@/components/ui/button";
import { useOnboarding } from "@onboardjs/react";
import { ArrowRight, SparklesIcon } from "lucide-react";
import Link from "next/link";

export default function FirstStep() {
  const { next } = useOnboarding();

  return (
    <>
      <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
        <SparklesIcon className="w-10 h-10 text-primary animate-in fade-in zoom-in duration-300" />
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to KoolSaaS
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Unlock your tailored KoolSaaS experience!
        </p>
      </div>

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={() => next()}>
          Start Onboarding Experience
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>

        <Link href="https://onboardjs.com" target="_blank">
          <Button variant="outline" size="lg" className="w-full bg-transparent">
            Go to Homepage
          </Button>
        </Link>
      </div>

      <div className="pt-4 text-xs text-muted-foreground space-y-1">
        <p>✨ Built with Next.js</p>
        <p>🔧 Powered by OnboardJS</p>
        <p>🚀 Ready in minutes, not hours</p>
        <p>🧔 Perfect for teams</p>
      </div>
    </>
  );
}
