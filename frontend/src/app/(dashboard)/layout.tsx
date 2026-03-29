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
  User,
  Menu,
  X,
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const hasToken = !!accessToken || !!localStorage.getItem('accessToken');

    if (!hasToken) {
      router.push('/login');
    } else if (!user && hasToken) {
      api.get('/auth/me')
        .then(() => setIsLoading(false))
        .catch(() => {
          clearAuth();
          router.push('/login');
        });
    } else {
      setIsLoading(false);
    }
  }, [user, accessToken, router, clearAuth]);

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

  const renderNavItem = (item: any) => {
    if (!canAccess(item.roles)) return null;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          pathname === item.href
            ? 'bg-red-50 text-red-600'
            : 'text-gray-600 hover:bg-gray-100',
        )}
        onClick={() => setSidebarOpen(false)}
      >
        <item.icon size={18} />
        {item.label}
      </Link>
    );
  };

  const Sidebar = () => (
    <div className="w-64 bg-white border-r flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍲</span>
          <div>
            <p className="font-bold text-red-600">Shabu</p>
            <p className="text-xs text-gray-400">Restaurant</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X size={18} />
        </Button>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 p-3">
        {navItems.map((category) => {
          const visibleItems = category.items.filter((item) => canAccess(item.roles));
          if (visibleItems.length === 0) return null;

          return (
            <div key={category.category} className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
                {category.category}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => renderNavItem(item))}
              </div>
              <Separator className="my-3" />
            </div>
          );
        })}
      </ScrollArea>

      {/* User */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-red-100 text-red-600 text-xs">
              {user.fullName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.fullName}</p>
            <p className="text-xs text-gray-400">{user.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-500 hover:text-red-600"
          onClick={handleLogout}
        >
          <LogOut size={16} className="mr-2" />
          ออกจากระบบ
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-40">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🍲</span>
            <span className="font-bold text-red-600">Shabu</span>
          </div>
          <div className="w-10" />
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
