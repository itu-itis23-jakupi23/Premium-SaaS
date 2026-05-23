import { ENSLogo } from "@/components/ENSLogo";
import { Spinner } from "@/components/ui/spinner";

export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5">
        <ENSLogo size="md" showTagline />
        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <Spinner className="size-5 text-primary" />
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}
