import { Navbar } from "@/components/navbar-simple";
import { Footer } from "@/components/footer-simple";
import { TitleSearchClient } from "./client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Title AI — Automated Property Title Search",
  description: "Instant title reports, lien searches, and ownership chain analysis powered by AI.",
};

export default function TitleSearchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fefce8] to-white text-gray-900 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <TitleSearchClient />
      </main>
      <Footer />
    </div>
  );
}
