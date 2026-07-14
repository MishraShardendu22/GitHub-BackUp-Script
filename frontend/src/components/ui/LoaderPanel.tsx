import { Loader2 } from "lucide-react";

export function LoaderPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground animate-in fade-in duration-300">
      <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
      <div className="text-sm font-medium">{message}</div>
    </div>
  );
}
