"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { initializeAuth } from "@/lib/api";

// UX only. Every REST call and socket join remains authorized by the backend.
export default function StaffAuth({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  const status = useAuthStore((state) => state.status);
  const router = useRouter();
  useEffect(() => {
    void initializeAuth().catch(() => {});
    const changed = (event: StorageEvent) => {
      if (
        event.storageArea === localStorage &&
        (event.key === "auth-storage" || event.key === null)
      ) {
        // Invalidate pending requests before adopting another tab's persisted session.
        // rehydrate reads storage before any state write, avoiding overwriting the other tab.
        void Promise.resolve(useAuthStore.persist.rehydrate())
          .then(() => initializeAuth())
          .catch(() => {});
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    if (required && status === "anonymous") router.replace("/login");
  }, [required, status, router]);
  if (status === "error")
    return (
      <div role="alert" className="p-8 text-center">
        เชื่อมต่อเพื่อตรวจสอบการเข้าสู่ระบบไม่ได้{" "}
        <button
          className="underline"
          onClick={() => void initializeAuth().catch(() => {})}
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  if (status === "checking" || status === "logging-out")
    return (
      <div role="status" className="p-8 text-center">
        กำลังตรวจสอบการเข้าสู่ระบบ…
      </div>
    );
  if (required && status !== "authenticated") return null;
  return <>{children}</>;
}
