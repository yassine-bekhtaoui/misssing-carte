import GlobeWrapper from "@/components/GlobeWrapper";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      <GlobeWrapper />
    </div>
  );
}
