"use client";
import { useState, useEffect } from "react";
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
import { Eye, EyeOff, Loader2 } from "lucide-react";

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

      console.log('=== LOGIN SUCCESS ===');
      console.log('User:', user);
      console.log('User Role:', user.role);
      
      setAuth(user, accessToken);
      toast.success(`ยินดีต้อนรับ ${user.fullName}`);

      // redirect ตาม role - ใช้ window.location.replace
      const redirectPath = user.role === "OWNER"
        ? "/dashboard"
        : user.role === "KITCHEN"
        ? "/kds"
        : "/pos";

      console.log('=== REDIRECTING ===');
      console.log('To:', redirectPath);
      
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
      <div className="w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🍲</div>
          <h1 className="text-3xl font-bold text-red-600">Shabu Restaurant</h1>
          <p className="text-gray-500 mt-1">ระบบจัดการร้านชาบู</p>
        </div>

        {/* Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">เข้าสู่ระบบ</CardTitle>
            <CardDescription>กรุณากรอก Username และ Password</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="กรอก Username"
                  autoComplete="username"
                  {...register("username")}
                />
                {errors.username && (
                  <p className="text-sm text-red-500">
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="กรอก Password"
                    autoComplete="current-password"
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  "เข้าสู่ระบบ"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
