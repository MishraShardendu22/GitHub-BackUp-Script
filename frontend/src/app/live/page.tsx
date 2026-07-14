import { LiveLogStream } from "@/components/live/live-log-stream";

export const metadata = {
  title: "Live Monitor",
  description: "Real-time stream of worker events and execution logs.",
};

export default function LivePage() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto h-[calc(100vh-8rem)]">
      <LiveLogStream />
    </div>
  );
}
