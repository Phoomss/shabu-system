'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ChefHat,
  TableProperties,
  LogOut,
  ClipboardList,
  FileText,
  Package,
  Users,
  Shield,
  AlertCircle,
  Clock,
  ShoppingCart,
  Menu,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';
import { toast } from 'sonner';

const navItems = [
  {
    category: 'หลัก',
    items: [
      { href: '/pos', label: 'POS', icon: ShoppingCart, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { href: '/kds', label: 'ห้องครัว', icon: ChefHat, roles: ['OWNER', 'MANAGER', 'KITCHEN'] },
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    category: 'จัดการ',
    items: [
      { href: '/tables', label: 'จัดการโต๊ะ', icon: TableProperties, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { href: '/sessions', label: 'เซสชัน', icon: Clock, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { href: '/orders', label: 'ออเดอร์', icon: ClipboardList, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { href: '/invoices', label: 'ใบเสร็จ', icon: FileText, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    category: 'เมนูและสต็อก',
    items: [
      { href: '/menus', label: 'จัดการเมนู', icon: UtensilsCrossed, roles: ['OWNER', 'MANAGER'] },
      { href: '/categories', label: 'หมวดหมู่', icon: UtensilsCrossed, roles: ['OWNER', 'MANAGER'] },
      { href: '/tiers', label: 'ระดับราคา', icon: FileText, roles: ['OWNER', 'MANAGER'] },
      { href: '/ingredients', label: 'วัตถุดิบ', icon: Package, roles: ['OWNER', 'MANAGER'] },
      { href: '/kitchen-sections', label: 'ส่วนครัว', icon: ChefHat, roles: ['OWNER', 'MANAGER'] },
    ],
  },
  {
    category: 'ระบบ',
    items: [
      { href: '/users', label: 'ผู้ใช้', icon: Users, roles: ['OWNER'] },
      { href: '/roles', label: 'บทบาท', icon: Shield, roles: ['OWNER'] },
      { href: '/void-logs', label: 'ประวัติยกเลิก', icon: AlertCircle, roles: ['OWNER', 'MANAGER'] },
    ],
  },
];

const pageDescriptions: Record<string, string> = {
  '/dashboard': 'ภาพรวมการขายและสิ่งที่ต้องดูแลวันนี้',
  '/pos': 'รับออเดอร์และดูแลการขายหน้าร้าน',
  '/kds': 'ติดตามอาหารที่กำลังเตรียม',
  '/tables': 'ดูสถานะโต๊ะและจัดการพื้นที่ให้บริการ',
  '/sessions': 'ติดตามรอบการใช้โต๊ะของลูกค้า',
  '/orders': 'ตรวจสอบและจัดการออเดอร์',
  '/invoices': 'ดูใบเสร็จและประวัติการชำระเงิน',
  '/menus': 'จัดการรายการอาหารและความพร้อมขาย',
  '/categories': 'จัดกลุ่มเมนูอาหาร',
  '/tiers': 'กำหนดระดับราคาสำหรับลูกค้า',
  '/ingredients': 'ติดตามวัตถุดิบและจำนวนคงเหลือ',
  '/kitchen-sections': 'จัดการส่วนงานในครัว',
  '/users': 'จัดการบัญชีผู้ใช้งาน',
  '/roles': 'ดูแลสิทธิ์และบทบาทของทีม',
  '/void-logs': 'ตรวจสอบรายการที่ถูกยกเลิก',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, setAuth, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const hasToken = !!accessToken || !!localStorage.getItem('accessToken');

    if (!hasToken) {
      router.push('/login');
    } else if (!user && hasToken) {
      api.get('/auth/me')
        .then((response) => {
          const currentUser = response.data.data;
          if (!currentUser) throw new Error('Missing user');
          setAuth({
            id: currentUser.id,
            username: currentUser.username,
            fullName: currentUser.fullName,
            role: typeof currentUser.role === 'string' ? currentUser.role : currentUser.role.name,
          }, localStorage.getItem('accessToken') || accessToken || '');
          setIsLoading(false);
        })
        .catch(() => {
          clearAuth();
          router.push('/login');
        });
    } else {
      setIsLoading(false);
    }
  }, [user, accessToken, router, setAuth, clearAuth]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAuth();
      router.push('/login');
      toast.success('ออกจากระบบแล้ว');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const canAccess = (roles: string[]) => roles.includes(user.role);
  const currentPage = navItems.flatMap((group) => group.items).find((item) => item.href === pathname);
  const quickLink = user.role === 'KITCHEN'
    ? { href: '/kds', label: 'ดูคิวครัว', icon: ChefHat }
    : { href: '/pos', label: 'เปิดหน้าขาย', icon: ShoppingCart };

  const renderNavItem = (item: any) => {
    if (!canAccess(item.roles)) return null;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          pathname === item.href
            ? 'bg-[#fff0e9] text-[#9f321b] shadow-sm'
            : 'text-[#655e59] hover:bg-[#f8f3ef] hover:text-[#28211e]',
        )}
        onClick={() => setSidebarOpen(false)}
      >
        <item.icon size={18} strokeWidth={pathname === item.href ? 2.3 : 1.8} />
        {item.label}
      </Link>
    );
  };

  const Sidebar = () => (
    <div className="flex h-full w-[278px] flex-col border-r border-[#ede4dc] bg-[#fffdfa] shadow-xl lg:shadow-none">
      {/* Logo */}
      <div className="flex items-center justify-between border-b border-[#f0e8e2] px-5 py-5">
        <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#b84328] text-2xl shadow-sm">🍲</span>
          <div>
            <p className="text-lg font-bold leading-tight tracking-tight text-[#33251e]">Shabu<span className="text-[#b84328]">.</span></p>
            <p className="text-[11px] font-medium tracking-wide text-[#998a80]">RESTAURANT OS</p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="ปิดเมนู"
          onClick={() => setSidebarOpen(false)}
        >
          <X size={18} />
        </Button>
      </div>

      {/* Nav */}
      <ScrollArea className="min-h-0 flex-1 px-3 py-5">
        {navItems.map((category) => {
          const visibleItems = category.items.filter((item) => canAccess(item.roles));
          if (visibleItems.length === 0) return null;

          return (
            <div key={category.category} className="mb-5">
              <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.1em] text-[#a39488]">
                {category.category}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => renderNavItem(item))}
              </div>
              <Separator className="mt-4 bg-[#f0e8e2]" />
            </div>
          );
        })}
      </ScrollArea>

      {/* User */}
      <div className="border-t border-[#f0e8e2] p-4">
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-[#f8f3ef] px-3 py-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-[#f1d9ca] text-xs font-semibold text-[#9f321b]">
              {user.fullName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.fullName}</p>
            <p className="text-xs text-[#8b7c71]">{user.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-full justify-start text-[#71665e] hover:text-[#a6341d]"
          onClick={handleLogout}
        >
          <LogOut size={16} className="mr-2" />
          ออกจากระบบ
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh min-w-0 bg-[#f8f5f1]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="fixed inset-0 bg-[#211916]/50" aria-label="ปิดเมนู" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 max-w-[85vw]">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-40 flex min-h-[76px] items-center justify-between gap-4 border-b border-[#ede4dc] bg-[#fffdfa]/95 px-4 backdrop-blur-md sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="size-10 lg:hidden" aria-label="เปิดเมนู" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>
              <Menu size={21} />
            </Button>
            <div className="min-w-0">
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.13em] text-[#aa7b65] sm:block">Shabu / {navItems.find((group) => group.items.some((item) => item.href === pathname))?.category}</p>
              <h1 className="truncate text-lg font-bold tracking-tight text-[#2d241f] sm:text-xl">{currentPage?.label ?? 'Shabu'}</h1>
              <p className="hidden text-xs text-[#8c8076] sm:block">{pageDescriptions[pathname]}</p>
            </div>
          </div>
          <Link href={quickLink.href} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-[#b84328] px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#96321d] sm:px-4">
            <quickLink.icon size={17} />
            <span className="hidden sm:inline">{quickLink.label}</span>
            <ArrowUpRight size={15} className="hidden sm:block" />
          </Link>
        </div>
        <div className="mx-auto w-full max-w-[1540px] p-4 pb-10 sm:p-7 lg:p-9">{children}</div>
      </main>
    </div>
  );
}
