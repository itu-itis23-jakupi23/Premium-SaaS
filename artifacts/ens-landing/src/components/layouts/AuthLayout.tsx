import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ENSLogo } from "@/components/ENSLogo";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5" />
      
      {/* Animated background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[100px] animate-pulse delay-700" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <ENSLogo size="md" showTagline href="/" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-center">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-center mt-2">{description}</p>
          )}
        </div>

        <Card className="border-border bg-card/50 backdrop-blur-xl shadow-2xl">
          <CardContent className="pt-6">
            {children}
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} ENS Exhibition Network Service. All rights reserved.
        </div>
      </div>
    </div>
  );
}
