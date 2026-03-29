"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  ChefHat,
  LayoutDashboard,
  UtensilsCrossed,
  TableProperties,
  FileText,
  ClipboardList,
  Package,
  Users,
  ArrowRight,
  LogIn,
} from "lucide-react";

const features = [
  {
    title: "POS",
    description: "ระบบขายหน้าร้าน สั่งอาหารและชำระเงิน",
    icon: ShoppingCart,
    href: "/pos",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    roles: ["OWNER", "MANAGER", "STAFF"],
  },
  {
    title: "Kitchen Display",
    description: "ระบบแสดงออเดอร์ห้องครัว",
    icon: ChefHat,
    href: "/kds",
    color: "text-green-600",
    bgColor: "bg-green-50",
    roles: ["OWNER", "MANAGER", "KITCHEN"],
  },
  {
    title: "Dashboard",
    description: "ภาพรวมและสถิติร้านอาหาร",
    icon: LayoutDashboard,
    href: "/dashboard",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    roles: ["OWNER", "MANAGER"],
  },
  {
    title: "จัดการโต๊ะ",
    description: "จัดการโต๊ะและโซนในร้าน",
    icon: TableProperties,
    href: "/tables",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    roles: ["OWNER", "MANAGER", "STAFF"],
  },
  {
    title: "เซสชัน",
    description: "เปิด/ปิด เซสชันการทาน",
    icon: FileText,
    href: "/sessions",
    color: "text-pink-600",
    bgColor: "bg-pink-50",
    roles: ["OWNER", "MANAGER", "STAFF"],
  },
  {
    title: "ออเดอร์",
    description: "จัดการออเดอร์ทั้งหมด",
    icon: ClipboardList,
    href: "/orders",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    roles: ["OWNER", "MANAGER", "STAFF"],
  },
  {
    title: "ใบเสร็จ",
    description: "ประวัติการชำระเงิน",
    icon: FileText,
    href: "/invoices",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    roles: ["OWNER", "MANAGER"],
  },
  {
    title: "จัดการเมนู",
    description: "จัดการเมนูอาหาร",
    icon: UtensilsCrossed,
    href: "/menus",
    color: "text-red-600",
    bgColor: "bg-red-50",
    roles: ["OWNER", "MANAGER"],
  },
  {
    title: "วัตถุดิบ",
    description: "จัดการสต็อกวัตถุดิบ",
    icon: Package,
    href: "/ingredients",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    roles: ["OWNER", "MANAGER"],
  },
  {
    title: "ผู้ใช้",
    description: "จัดการผู้ใช้งานระบบ",
    icon: Users,
    href: "/users",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    roles: ["OWNER"],
  },
];

export default function HomePage() {
  const { user } = useAuthStore();

  const canAccess = (roles: string[]) => {
    if (!user) return true; // Show all features to guests
    return roles.includes(user.role);
  };

  const accessibleFeatures = features.filter((f) => canAccess(f.roles));

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🍲</span>
              <div>
                <h1 className="text-2xl font-bold text-red-600">Shabu Restaurant</h1>
                <p className="text-sm text-gray-500">ระบบจัดการร้านอาหารแบบครบวงจร</p>
              </div>
            </div>
            {user ? (
              <Link href="/pos">
                <Button>
                  เข้าใช้งาน
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button>
                  <LogIn className="mr-2 h-4 w-4" />
                  เข้าสู่ระบบ
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            ยินดีต้อนรับสู่ Shabu System
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            ระบบจัดการร้านอาหารชาบูแบบครบวงจร รองรับทั้ง POS, ห้องครัว, การสั่งอาหารผ่าน QR Code
            และระบบจัดการหลังบ้าน
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accessibleFeatures.map((feature) => (
            <Link key={feature.href} href={feature.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <div
                    className={`w-12 h-12 rounded-lg ${feature.bgColor} flex items-center justify-center mb-4`}
                  >
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="flex items-center justify-between">
                    <span>{feature.title}</span>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Start Guide */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
          <h3 className="text-2xl font-bold mb-6">เริ่มต้นใช้งาน</h3>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                1
              </div>
              <h4 className="font-semibold mb-2">เข้าสู่ระบบ</h4>
              <p className="text-sm text-gray-600">
                ใช้ username และ password ที่ได้รับ
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                2
              </div>
              <h4 className="font-semibold mb-2">เปิดโต๊ะ</h4>
              <p className="text-sm text-gray-600">
                เลือกโต๊ะและระดับราคา
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                3
              </div>
              <h4 className="font-semibold mb-2">สั่งอาหาร</h4>
              <p className="text-sm text-gray-600">
                ลูกค้าสแกน QR Code เพื่อสั่งอาหาร
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                4
              </div>
              <h4 className="font-semibold mb-2">ชำระเงิน</h4>
              <p className="text-sm text-gray-600">
                สร้างใบเสร็จและปิดโต๊ะ
              </p>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Shabu System v1.0 - ระบบจัดการร้านอาหารแบบครบวงจร</p>
        </div>
      </main>
    </div>
  );
}
