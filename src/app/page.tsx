import { Dashboard } from "@/components/Dashboard";

// 인증은 Edge 미들웨어가 담당하므로 여기서는 대시보드만 렌더링한다.
export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950">
      <Dashboard />
    </main>
  );
}
