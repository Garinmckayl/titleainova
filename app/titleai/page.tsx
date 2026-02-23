import { Navbar } from "@/components/navbar-simple";
import { Footer } from "@/components/footer-simple";
import { TitleSearchClient } from "./client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Title AI Nova — Automated Property Title Search",
  description: "Instant title reports, lien searches, and ownership chain analysis powered by Amazon Nova Act + Nova Pro.",
};

export default function TitleSearchPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <TitleSearchClient />
      </main>
      <Footer />
    </div>
  );
}
