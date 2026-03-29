"use client";

import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { getSocket, addConnectListener, removeConnectListener } from "@/lib/socket";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Utensils,
  X,
  Clock,
  CheckCircle,
} from "lucide-react";
import type { MenuItem, Table, Tier, Session } from "@/types";
import { Socket } from "socket.io-client";
import Image from "next/image";

export default function POSPage() {
  const { user } = useAuthStore();
  const { items, addItem, removeItem, updateQuantity, clearCart, totalItems } =
    useCartStore();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    fetchData();

    // Initialize socket
    const s = getSocket();
    setSocket(s);

    // Listen for real-time updates
    s.on("menu:availability_changed", (data) => {
      console.log("Menu availability changed:", data);
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === data.menuItemId ? { ...item, isAvailable: data.isAvailable } : item
        )
      );
      toast.info(`${data.name} ${data.isAvailable ? "พร้อมให้บริการ" : "หมดชั่วคราว"}`);
    });

    s.on("table:status_changed", (data) => {
      console.log("Table status changed:", data);
      fetchData();
    });

    return () => {
      s.off("menu:availability_changed");
      s.off("table:status_changed");
    };
  }, []);

  const fetchData = async () => {
    try {
      const [menuRes, tablesRes, tiersRes, sessionsRes] = await Promise.all([
        api.get("/menu-items").catch(() => ({ data: { data: [] } })),
        api.get("/tables").catch(() => ({ data: { data: [] } })),
        api.get("/tiers").catch(() => ({ data: { data: [] } })),
        api.get("/sessions").catch(() => ({ data: { data: [] } })),
      ]);

      setMenuItems(menuRes.data.data || []);
      setTables(tablesRes.data.data || []);
      setTiers(tiersRes.data.data || []);
      setSessions(sessionsRes.data.data || []);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Map(
          (menuRes.data.data || []).map((item: MenuItem) => [
            item.category.id,
            item.category,
          ])
        ).values()
      ) as { id: number; name: string }[];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error("Failed to fetch POS data:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" ||
      item.category.id.toString() === selectedCategory;
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && item.isAvailable;
  });

  const handleCheckout = async () => {
    if (!selectedTable) {
      toast.error("กรุณาเลือกโต๊ะ");
      return;
    }
    if (!selectedTier) {
      toast.error("กรุณาเลือกระดับราคา");
      return;
    }
    if (items.length === 0) {
      toast.error("กรุณาเพิ่มสินค้าในตะกร้า");
      return;
    }

    try {
      // Check if table already has active session
      const existingSession = sessions.find(
        (s) => s.tableId === parseInt(selectedTable) && s.status === "ACTIVE"
      );

      let sessionId: string;

      if (existingSession) {
        sessionId = existingSession.id;
        toast.info("ใช้เซสชันที่มีอยู่แล้ว");
      } else {
        // Create new session
        const sessionRes = await api.post("/sessions", {
          tableId: parseInt(selectedTable),
          tierId: parseInt(selectedTier),
        });
        sessionId = sessionRes.data.data.id;
        toast.success("เปิดเซสชันใหม่สำเร็จ");
      }

      // Create order
      const orderItems = items.map((item) => ({
        menuItemId: item.id,
        kitchenId: item.kitchen.id,
        quantity: item.quantity,
      }));

      await api.post("/orders", {
        sessionId,
        items: orderItems,
      });

      toast.success("สร้างออเดอร์สำเร็จ");
      clearCart();
      setIsCheckoutOpen(false);
      setSelectedTable("");
      setSelectedTier("");
      fetchData();

      // Emit socket event for real-time update
      socket?.emit("new-order", {
        sessionId,
        items: orderItems,
      });
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.response?.data?.message || "สร้างออเดอร์ไม่สำเร็จ");
    }
  };

  const availableTables = tables.filter((t) => t.status === "AVAILABLE");
  const activeSessions = sessions.filter((s) => s.status === "ACTIVE");

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Menu Section */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="ค้นหาเมนูอาหาร..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="หมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Menu Grid */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => addItem(item)}
              >
                <div className="aspect-square relative bg-gray-100 rounded-t-lg overflow-hidden">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Utensils className="h-12 w-12 text-gray-300" />
                    </div>
                  )}
                  {!item.isAvailable && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Badge variant="destructive">หมด</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.category.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Section */}
      <Card className="w-96 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            ตะกร้าสินค้า
          </CardTitle>
        </CardHeader>
        <Separator />
        <ScrollArea className="flex-1 p-4">
          {items.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>ยังไม่มีสินค้าในตะกร้า</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          updateQuantity(
                            item.id,
                            item.quantity - 1 > 0 ? item.quantity - 1 : 1
                          )
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm w-8 text-center">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <Separator />
        <div className="p-4 space-y-4">
          <div className="flex justify-between text-lg font-bold">
            <span>รวม</span>
            <span>฿{totalItems().toLocaleString()}</span>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={items.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
          >
            ชำระเงิน
          </Button>
        </div>
      </Card>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ชำระเงิน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>เลือกโต๊ะ (ว่าง: {availableTables.length} โต๊ะ)</Label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกโต๊ะ" />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((table) => (
                    <SelectItem key={table.id} value={table.id.toString()}>
                      โต๊ะ {table.number} ({table.zone || "-"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ระดับราคา</Label>
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกระดับราคา" />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id.toString()}>
                      {tier.name} - {tier.priceAdult}฿ (ผู้ใหญ่) / {tier.priceChild}฿ (เด็ก)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>ยอดรวม</span>
              <span>฿{totalItems().toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsCheckoutOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button className="flex-1" onClick={handleCheckout}>
                ยืนยันการชำระเงิน
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
