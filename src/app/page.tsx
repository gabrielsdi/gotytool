import { BackgroundRemoval } from "@/components/background-removal";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-bold">GameDev Tools</h1>
        <p className="text-sm text-muted-foreground">
          Utilities for game development
        </p>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <BackgroundRemoval />
      </main>
    </div>
  );
}
