"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "กรุณากรอก Username"),
  password: z.string().min(6, "Password ต้องมีอย่างน้อย 6 ตัวอักษร"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { setAuth, user } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  // ตรวจสอบว่ามี user แล้วให้ redirect (กรณี refresh)
  useEffect(() => {
    if (user) {
      const path = user.role === "OWNER"
        ? "/dashboard"
        : user.role === "KITCHEN"
        ? "/kds"
        : "/pos";
      window.location.href = path; // ใช้ window.location แทน router.push
    }
  }, [user]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await api.post("/auth/login", data);
      const { accessToken, user } = res.data.data;

      setAuth(user, accessToken);
      toast.success(`ยินดีต้อนรับ ${user.fullName}`);

      // redirect ตาม role - ใช้ window.location.replace
      const redirectPath = user.role === "OWNER"
        ? "/dashboard"
        : user.role === "KITCHEN"
        ? "/kds"
        : "/pos";

      // ใช้ setTimeout ให้ Zustand ทัน persist token
      setTimeout(() => {
        window.location.replace(redirectPath);
      }, 500);
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message ?? "เข้าสู่ระบบไม่สำเร็จ");
    }
  };

  return (
    <div className="grid min-h-dvh bg-[#f8f5f1] lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#3c2a24] p-12 text-white lg:flex xl:p-16">
        <div className="relative z-10 flex items-center gap-3 text-xl font-bold"><span className="flex size-12 items-center justify-center rounded-2xl bg-[#b84328] text-2xl">🍲</span> Shabu<span className="-ml-3 text-[#efb195]">.</span></div>
        <div className="relative z-10 max-w-xl">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[#e4aa8d]">RESTAURANT OS</p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">จัดการทุกจังหวะของร้านได้ง่ายขึ้น</h1>
          <p className="mt-5 max-w-md leading-8 text-[#dfd0c8]">หน้าขาย โต๊ะ ออเดอร์ และห้องครัวอยู่ในระบบเดียว เพื่อให้ทีมทำงานต่อกันได้อย่างราบรื่น</p>
        </div>
        <p className="relative z-10 text-sm text-[#bba79b]">Shabu Restaurant Management</p>
        <div className="pointer-events-none absolute -bottom-36 -right-28 size-[480px] rounded-full border-[80px] border-white/5" />
      </div>
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-10 inline-flex items-center gap-3 lg:hidden"><span className="flex size-11 items-center justify-center rounded-2xl bg-[#b84328] text-2xl">🍲</span><span className="text-xl font-bold">Shabu<span className="text-[#b84328]">.</span></span></Link>
        <div className="mb-7">
          <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-[#fff0e9] text-[#b84328]"><ShieldCheck size={22} /></span>
          <h2 className="text-3xl font-bold tracking-tight text-[#2d241f]">ยินดีต้อนรับกลับ</h2>
          <p className="mt-2 text-sm text-[#756b64]">เข้าสู่ระบบเพื่อเริ่มงานในพื้นที่ของคุณ</p>
        </div>

        {/* Card */}
        <Card className="border-[#eadfd7] shadow-[0_12px_40px_rgba(58,32,19,0.07)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">เข้าสู่ระบบ</CardTitle>
            <CardDescription>กรอกชื่อผู้ใช้และรหัสผ่านที่ได้รับจากผู้ดูแลระบบ</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="username">ชื่อผู้ใช้</Label>
                <Input
                  id="username"
                  placeholder="กรอกชื่อผู้ใช้"
                  autoComplete="username"
                  {...register("username")}
                />
                {errors.username && (
                  <p role="alert" className="text-sm text-red-600">
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="กรอกรหัสผ่าน"
                    autoComplete="current-password"
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p role="alert" className="text-sm text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="h-11 w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  <span className="inline-flex items-center gap-2">เข้าสู่ระบบ <ArrowRight size={17} /></span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-[#8a7e75]">หากเข้าใช้งานไม่ได้ กรุณาติดต่อผู้ดูแลระบบ</p>
      </div>
      </div>
    </div>
  );
}
