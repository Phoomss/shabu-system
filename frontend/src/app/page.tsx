"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import {
  ArrowRight,
  ArrowUpRight,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LogIn,
  ShoppingCart,
  TableProperties,
} from "lucide-react";

const workspaces = [
  { href: "/pos", title: "หน้าขาย", description: "รับออเดอร์และส่งรายการเข้าครัว", icon: ShoppingCart, roles: ["OWNER", "MANAGER", "STAFF"] },
  { href: "/kds", title: "ห้องครัว", description: "ดูคิวอาหารและติดตามการเตรียม", icon: ChefHat, roles: ["OWNER", "MANAGER", "KITCHEN"] },
  { href: "/tables", title: "จัดการโต๊ะ", description: "ดูโต๊ะว่างและรอบการให้บริการ", icon: TableProperties, roles: ["OWNER", "MANAGER", "STAFF"] },
  { href: "/orders", title: "ออเดอร์", description: "ตรวจสอบรายการและสถานะออเดอร์", icon: ClipboardList, roles: ["OWNER", "MANAGER", "STAFF"] },
  { href: "/dashboard", title: "ภาพรวมร้าน", description: "ดูยอดขายและเรื่องที่ต้องดูแล", icon: LayoutDashboard, roles: ["OWNER", "MANAGER"] },
];

export default function HomePage() {
  const { user } = useAuthStore();
  const visibleWorkspaces = workspaces.filter((workspace) => !user || workspace.roles.includes(user.role));
  const primaryDestination = user?.role === "KITCHEN" ? "/kds" : user?.role === "OWNER" || user?.role === "MANAGER" ? "/dashboard" : "/pos";

  return (
    <div className="min-h-screen bg-[#f8f5f1] text-[#2d241f]">
      <header className="border-b border-[#eadfd7] bg-[#fffdfa]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#b84328] text-2xl">🍲</span>
            <span className="text-xl font-bold tracking-tight">Shabu<span className="text-[#b84328]">.</span></span>
          </Link>
          <Link href={user ? primaryDestination : "/login"} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#b84328] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#96321d]">
            {user ? <ArrowUpRight size={17} /> : <LogIn size={17} />}
            {user ? "เข้าพื้นที่ทำงาน" : "เข้าสู่ระบบ"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:pt-16">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#3c2a24] px-7 py-12 text-white sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-12 -top-20 size-72 rounded-full border-[45px] border-white/5" />
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#e6ad8e]">SHABU RESTAURANT OS</p>
          <h1 className="relative max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            {user ? `พร้อมเริ่มงานวันนี้ไหม ${user.fullName}` : "ทุกงานในร้าน จัดการได้ในที่เดียว"}
          </h1>
          <p className="relative mt-4 max-w-xl text-sm leading-7 text-[#e6d8d0] sm:text-base">
            เปิดโต๊ะ รับออเดอร์ ส่งเข้าครัว และติดตามงานของร้านอย่างเป็นขั้นตอน
          </p>
          <Link href={user ? primaryDestination : "/login"} className="relative mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#91341e] transition-colors hover:bg-[#fff0e9]">
            {user ? "ไปยังหน้าทำงาน" : "เริ่มใช้งาน"}<ArrowRight size={17} />
          </Link>
        </div>

        <div className="mt-11 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b2674e]">พื้นที่ทำงาน</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">เลือกงานที่ต้องการทำ</h2>
          </div>
          {!user && <p className="text-sm text-[#766b63]">เข้าสู่ระบบเพื่อเข้าถึงหน้าที่ได้รับสิทธิ์</p>}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleWorkspaces.map((workspace) => (
            <Link key={workspace.href} href={user ? workspace.href : "/login"} className="group flex min-h-44 flex-col justify-between rounded-2xl border border-[#eadfd7] bg-white p-6 shadow-[0_2px_12px_rgba(55,32,20,0.035)] transition-all hover:-translate-y-0.5 hover:border-[#dbb7a2] hover:shadow-md">
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#fff0e9] text-[#ab4125]"><workspace.icon size={22} /></span>
              <span className="flex items-end justify-between gap-3">
                <span><strong className="block text-lg">{workspace.title}</strong><span className="mt-1 block text-sm text-[#786c64]">{workspace.description}</span></span>
                <ArrowUpRight size={19} className="shrink-0 text-[#ab8c7a] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
