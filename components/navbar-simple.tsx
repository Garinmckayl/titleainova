import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
          Title AI Nova
        </Link>
        <div className="flex gap-4">
          <Link href="/titleai">
            <Button variant="ghost">Search</Button>
          </Link>
          <Link href="/titleai/chat">
            <Button variant="ghost">Chat</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
