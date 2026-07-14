import { AIDashboard } from "@/components/ai/AIDashboard";

export const metadata = {
  title: "AI Assistant",
  description:
    "AI assistant for analyzing and fixing GitHub backup operations.",
};

export default function AIPage() {
  return (
    <div className="flex h-[calc(100vh-5rem)] w-full flex-col p-0 m-0">
      <AIDashboard />
    </div>
  );
}
