import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[2rem] bg-cream-veil p-8 shadow-soft backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
