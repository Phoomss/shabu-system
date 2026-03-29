"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { getSocket } from "@/lib/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DollarSign,
  Users,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Utensils,
} from "lucide-react";
import { Socket } from "socket.io-client";
import api from "@/lib/api";

interface DashboardStats {
  totalRevenue: number;
  todayRevenue: number;
  totalOrders: number;
  todayOrders: number;
  activeTables: number;
  totalTables: number;
  lowStockIngredients: number;
}

interface RecentInvoice {
  id: number;
  tableNumber: string;
  netAmount: number;
  paymentMethod: string;
  createdAt: string;
}

interface LowStockIngredient {
  id: number;
  name: string;
  currentStock: number;
  unit: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    todayRevenue: 0,
    totalOrders: 0,
    todayOrders: 0,
    activeTables: 0,
    totalTables: 0,
    lowStockIngredients: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockIngredient[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    fetchRecentInvoices();
    fetchLowStockIngredients();

    // Initialize socket
    const s = getSocket();
    setSocket(s);

    s.on("invoice:new", (data) => {
      console.log("New invoice:", data);
      fetchDashboardStats();
      fetchRecentInvoices();
    });

    s.on("ingredient:low_stock", (data) => {
      console.log("Low stock alert:", data);
      fetchLowStockIngredients();
    });

    return () => {
      s.off("invoice:new");
      s.off("ingredient:low_stock");
    };
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const res = await api.get("/dashboard/stats").catch(() => ({ data: { data: null } }));
      if (res.data.data) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentInvoices = async () => {
    try {
      const res = await api.get("/invoices?limit=5");
      setRecentInvoices(res.data.data?.slice(0, 5) || []);
    } catch (error) {
      console.error("Failed to fetch recent invoices:", error);
    }
  };

  const fetchLowStockIngredients = async () => {
    try {
      const res = await api.get("/ingredients");
      const ingredients = res.data.data || [];
      const lowStock = ingredients.filter(
        (ing: any) => ing.currentStock < (ing.maxStock || 100) * 0.2
      );
      setLowStockItems(lowStock);
    } catch (error) {
      console.error("Failed to fetch low stock ingredients:", error);
    }
  };

  const statCards = [
    {
      title: "รายได้วันนี้",
      value: `฿${stats.todayRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "ออเดอร์วันนี้",
      value: stats.todayOrders.toString(),
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "โต๊ะที่ใช้งาน",
      value: `${stats.activeTables}/${stats.totalTables}`,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "วัตถุดิบใกล้หมด",
      value: stats.lowStockIngredients.toString(),
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">ภาพรวมร้านอาหารและสถิติ</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              ใบเสร็จล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {recentInvoices.length === 0 ? (
                <p className="text-center text-gray-500 py-8">ยังไม่มีใบเสร็จ</p>
              ) : (
                <div className="space-y-3">
                  {recentInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">โต๊ะ {invoice.tableNumber}</p>
                        <p className="text-sm text-gray-500">{invoice.paymentMethod}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">฿{invoice.netAmount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(invoice.createdAt).toLocaleTimeString("th-TH")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              แจ้งเตือนวัตถุดิบใกล้หมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {lowStockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mb-2" />
                  <p>วัตถุดิบเพียงพอ</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Utensils className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">หน่วย: {item.unit}</p>
                        </div>
                      </div>
                      <Badge variant="destructive">
                        {item.currentStock} {item.unit}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>การกระทำด่วน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a href="/pos">
              <div className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
                <ShoppingCart className="h-8 w-8 text-blue-600 mb-2" />
                <span className="font-medium">POS</span>
              </div>
            </a>
            <a href="/kds">
              <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer">
                <Utensils className="h-8 w-8 text-green-600 mb-2" />
                <span className="font-medium">ห้องครัว</span>
              </div>
            </a>
            <a href="/tables">
              <div className="flex flex-col items-center justify-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer">
                <Users className="h-8 w-8 text-purple-600 mb-2" />
                <span className="font-medium">จัดการโต๊ะ</span>
              </div>
            </a>
            <a href="/menus">
              <div className="flex flex-col items-center justify-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer">
                <CheckCircle className="h-8 w-8 text-orange-600 mb-2" />
                <span className="font-medium">เมนู</span>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
