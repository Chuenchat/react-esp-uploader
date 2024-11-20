// pages/index.tsx
import dynamic from "next/dynamic";

const ESPFlasher = dynamic(() => import("@/components/ESPFlasher"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl mb-4">ESP Flasher</h1>
      <ESPFlasher />
    </div>
  );
}
