import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          LegalMindz Nova
        </Link>
        <div className="flex gap-4">
          <Link href="/chat">
            <Button variant="ghost">Chat</Button>
          </Link>
          <Link href="/draft">
            <Button variant="ghost">Draft</Button>
          </Link>
          <Link href="/analyze">
            <Button variant="ghost">Analyze</Button>
          </Link>
          <Link href="/titleai">
            <Button variant="ghost">Title AI</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
