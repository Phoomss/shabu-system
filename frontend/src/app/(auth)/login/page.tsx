"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowRight,
  ChefHat,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import api, { publicApi } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  username: z.string().min(1, "กรุณากรอกชื่อผู้ใช้"),
  password: z.string().min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
});

type LoginForm = z.infer<typeof loginSchema>;

type DemoAccount = { username: string; fullName: string; role: string };

function demoRoleDetails(role: string) {
  if (role === "OWNER") return { label: "เจ้าของร้าน", icon: LayoutDashboard };
  if (role === "MANAGER") return { label: "ผู้จัดการ", icon: ShieldCheck };
  if (role === "STAFF") return { label: "พนักงาน", icon: ShoppingCart };
  if (role === "KITCHEN") return { label: "ห้องครัว", icon: ChefHat };
  return { label: role, icon: ShieldCheck };
}

// This value is intentionally public when configured for a demo frontend build.
const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

function destinationForRole(role: string) {
  if (role === "OWNER") return "/dashboard";
  if (role === "KITCHEN") return "/kds";
  return "/pos";
}

export default function LoginPage() {
  const { setAuth, user } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [enteredDemoPassword, setEnteredDemoPassword] = useState("");
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [demoLoading, setDemoLoading] = useState(true);
  const [demoLoadError, setDemoLoadError] = useState(false);
  const selectedDemoPassword = demoPassword && demoPassword.length >= 8
    ? demoPassword
    : enteredDemoPassword;
  const canFillDemoPassword = selectedDemoPassword.length >= 8;
  const {
    register,
    handleSubmit,
    setFocus,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (user) window.location.replace(destinationForRole(user.role));
  }, [user]);

  useEffect(() => {
    let mounted = true;
    publicApi.get("/auth/demo-users")
      .then((response) => {
        if (mounted) setDemoAccounts(Array.isArray(response.data.data) ? response.data.data : []);
      })
      .catch(() => {
        if (mounted) setDemoLoadError(true);
      })
      .finally(() => {
        if (mounted) setDemoLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const onSubmit = async (data: LoginForm) => {
    try {
      const response = await api.post("/auth/login", data);
      const { accessToken, user: signedInUser } = response.data.data;
      setAuth(signedInUser, accessToken);
      toast.success(`ยินดีต้อนรับ ${signedInUser.fullName}`);
      window.location.replace(destinationForRole(signedInUser.role));
    } catch (error: unknown) {
      console.error("Login error:", error);
      toast.error("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน");
    }
  };

  return (
    <main className="min-h-dvh bg-[#f6f1ea] px-4 py-5 text-[#30251f] sm:px-6 sm:py-8 lg:flex lg:items-center lg:justify-center lg:px-10">
      <div className="mx-auto w-full max-w-[1180px] overflow-hidden rounded-[28px] border border-[#eaded2] bg-white shadow-[0_24px_80px_rgba(71,40,22,0.10)] lg:grid lg:min-h-[720px] lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative hidden min-h-[720px] flex-col overflow-hidden bg-[#743f30] p-10 text-white lg:flex xl:p-14" aria-label="เกี่ยวกับ Shabu">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,rgba(239,177,127,0.32),transparent_34%),linear-gradient(150deg,#9f4d32_0%,#63372c_58%,#3b2a25_100%)]" />
          <div className="pointer-events-none absolute -right-32 top-8 size-[440px] rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-16 top-24 size-[315px] rounded-full border border-white/10" />

          <Link href="/" className="relative z-10 flex w-fit items-center gap-3 text-white">
            <span className="flex size-11 items-center justify-center rounded-xl border border-white/20 bg-white/15"><UtensilsCrossed size={22} /></span>
            <span className="text-xl font-bold tracking-tight">shabu<span className="text-[#ffc29c]">.</span><span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f1c1a5]">system</span></span>
          </Link>

          <div className="relative z-10 mt-auto max-w-[440px] pb-4">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-[#ffd2b9]">YOUR RESTAURANT, IN SYNC</p>
            <h1 className="text-[clamp(2.5rem,4vw,4rem)] font-bold leading-[1.12] tracking-tight">ทุกจังหวะของร้าน<br />อยู่ในมือคุณ</h1>
            <p className="mt-6 max-w-sm text-base leading-8 text-[#f6ddd0]">จัดการหน้าขาย ห้องครัว และภาพรวมร้านในที่เดียว ให้ทีมทำงานต่อกันได้อย่างลื่นไหล</p>
          </div>

          <div className="relative z-10 mt-7 grid grid-cols-3 gap-3 border-t border-white/20 pt-7">
            <div className="flex items-center gap-2 text-sm font-medium text-white/90"><ShoppingCart size={17} /> หน้าขาย</div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/90"><ChefHat size={17} /> ห้องครัว</div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/90"><LayoutDashboard size={17} /> ภาพรวม</div>
          </div>

          <div className="pointer-events-none absolute right-10 top-[29%] z-0 flex size-56 items-center justify-center rounded-full border-[20px] border-[#f4d4b6]/85 bg-[#f7e8d4] shadow-[0_24px_60px_rgba(39,20,15,0.22)] xl:right-16 xl:size-64">
            <div className="flex size-[80%] items-center justify-center rounded-full bg-[#ca7448] shadow-[inset_0_9px_20px_rgba(92,35,22,0.25)]">
              <div className="size-[70%] rounded-full border-[14px] border-[#eebd8f] bg-[#8a3b2e] shadow-[inset_0_6px_18px_rgba(41,19,17,0.25)]" />
            </div>
          </div>
        </section>

        <section className="flex min-h-[calc(100dvh-2.5rem)] flex-col px-6 py-7 sm:px-10 sm:py-10 lg:min-h-0 lg:px-12 lg:py-12 xl:px-16" aria-label="เข้าสู่ระบบ">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 lg:hidden">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#a5472c] text-white"><UtensilsCrossed size={21} /></span>
              <span className="text-xl font-bold tracking-tight">shabu<span className="text-[#b84328]">.</span></span>
            </Link>
            <span className="ml-auto rounded-full border border-[#e9ddd2] bg-[#fbf8f5] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8d6854]">STAFF PORTAL</span>
          </div>

          <div className="my-auto w-full max-w-[390px] py-12 sm:mx-auto lg:py-6">
            <span className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-[#f9eae0] text-[#af4b2e]"><ShieldCheck size={24} /></span>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b06445]">WELCOME BACK</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">ยินดีต้อนรับกลับ</h2>
            <p className="mt-3 text-sm leading-6 text-[#786d64]">ลงชื่อเข้าใช้เพื่อเริ่มจัดการร้านในพื้นที่ของคุณ</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-9 space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold text-[#46382f]">ชื่อผู้ใช้</Label>
                <Input
                  id="username"
                  placeholder="กรอกชื่อผู้ใช้"
                  autoComplete="username"
                  className="h-12 border-[#e5d8ce] bg-[#fdfbf9] px-4"
                  aria-invalid={!!errors.username}
                  aria-describedby={errors.username ? "username-error" : undefined}
                  {...register("username")}
                />
                {errors.username && <p id="username-error" role="alert" className="text-sm text-red-600">{errors.username.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-[#46382f]">รหัสผ่าน</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="กรอกรหัสผ่าน"
                    autoComplete="current-password"
                    className="h-12 border-[#e5d8ce] bg-[#fdfbf9] px-4 pr-14"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    aria-pressed={showPassword}
                    className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-[#84766d] transition-colors hover:bg-[#f5e9e0] hover:text-[#743f30]"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
                {errors.password && <p id="password-error" role="alert" className="text-sm text-red-600">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="h-12 w-full justify-between bg-[#a5472c] px-5 text-base hover:bg-[#873720]" disabled={isSubmitting}>
                <span>{isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</span>
                {isSubmitting ? <Loader2 size={19} className="animate-spin" /> : <ArrowRight size={19} />}
              </Button>
            </form>

            <section className="mt-8 border-t border-[#eee4dc] pt-6" aria-labelledby="demo-accounts-title">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="demo-accounts-title" className="text-sm font-bold text-[#46382f]">ทดลองด้วยบัญชีสาธิต</h3>
                  <p className="mt-1 text-xs leading-5 text-[#84776d]">{canFillDemoPassword ? "เลือกบัญชีเพื่อกรอกชื่อผู้ใช้และรหัสผ่าน" : "เลือกบัญชีเพื่อกรอกชื่อผู้ใช้"}</p>
                </div>
                <span className="rounded-full bg-[#f9eae0] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9a482b]">DEMO</span>
              </div>
              {!demoLoading && demoAccounts.length > 0 && !(demoPassword && demoPassword.length >= 8) && (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="demo-password" className="text-xs font-semibold text-[#6f5b4e]">รหัสผ่านบัญชีสาธิต</Label>
                  <Input
                    id="demo-password"
                    type="password"
                    value={enteredDemoPassword}
                    onChange={(event) => setEnteredDemoPassword(event.target.value)}
                    placeholder="กรอกรหัสเดโมที่ตั้งไว้"
                    autoComplete="off"
                    className="h-10 border-[#e5d8ce] bg-[#fdfbf9]"
                  />
                  <p className="text-xs leading-5 text-[#84776d]">กรอกครั้งเดียว แล้วเลือกบัญชีเพื่อเติมข้อมูลเข้าสู่ฟอร์ม</p>
                </div>
              )}
              {demoLoading ? (
                <p className="mt-4 rounded-xl bg-[#fbf8f5] px-4 py-3 text-xs text-[#84776d]">กำลังโหลดบัญชีสาธิต...</p>
              ) : demoLoadError ? (
                <p className="mt-4 rounded-xl bg-[#fff3ee] px-4 py-3 text-xs text-[#8f462e]">โหลดบัญชีสาธิตไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ API</p>
              ) : demoAccounts.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[#fbf8f5] px-4 py-3 text-xs leading-5 text-[#84776d]">ยังไม่มีบัญชีสาธิตในระบบ กรุณาให้ผู้ดูแลระบบสร้างบัญชีก่อน</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {demoAccounts.map((account) => {
                    const details = demoRoleDetails(account.role);
                    return (
                      <button
                        key={account.username}
                        type="button"
                        onClick={() => {
                          setValue("username", account.username, { shouldDirty: true, shouldValidate: true });
                          if (canFillDemoPassword) {
                            setValue("password", selectedDemoPassword, { shouldDirty: true, shouldValidate: true });
                          }
                          setFocus("password");
                        }}
                        className="flex min-h-16 items-center gap-2.5 rounded-xl border border-[#eaded5] bg-[#fdfaf7] px-3 text-left transition-colors hover:border-[#d8ab94] hover:bg-[#fff2e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a5472c]"
                        aria-label={`ใช้บัญชี ${account.username} สำหรับ${details.label}`}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f6e8de] text-[#a5472c]"><details.icon size={17} /></span>
                        <span className="min-w-0"><span className="block text-xs font-semibold text-[#49362d]">{details.label}</span><span className="block truncate text-[11px] text-[#8a796d]">{account.username}</span></span>
                      </button>
                    );
                  })}
                </div>
              )}
              {demoAccounts.length > 0 && <p className="mt-3 text-xs leading-5 text-[#84776d]">{canFillDemoPassword ? "เลือกบัญชีแล้วระบบจะกรอกชื่อผู้ใช้และรหัสผ่านให้" : "ใช้รหัสผ่านที่ผู้ดูแลระบบตั้งไว้"}</p>}
            </section>
          </div>

          <p className="text-center text-xs text-[#9a8c81] lg:text-left">© {new Date().getFullYear()} Shabu Restaurant System</p>
        </section>
      </div>
    </main>
  );
}
