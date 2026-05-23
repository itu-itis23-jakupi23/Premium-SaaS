import { Card, CardContent } from "@/components/ui/card";
import { ENSLogo } from "@/components/ENSLogo";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="w-full">
      <div className="w-full max-w-md mx-auto px-4">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-4">
            <ENSLogo size="md" showTagline href="/" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-center">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-center mt-2">{description}</p>
          )}
        </div>

        <Card className="border-border/70 bg-card/85 backdrop-blur-2xl shadow-2xl">
          <CardContent className="pt-6 max-h-[62vh] overflow-y-auto">
            {children}
          </CardContent>
        </Card>

        <div className="mt-5 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} ENS Exhibition Network Service. All rights reserved.
        </div>
      </div>
    </div>
  );
}
