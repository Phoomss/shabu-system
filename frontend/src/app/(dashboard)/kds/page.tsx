"use client";

import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { getSocket, addConnectListener, removeConnectListener } from "@/lib/socket";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  ChefHat,
  Timer,
  XCircle,
  Eye,
} from "lucide-react";
import type { OrderItem, KitchenSection } from "@/types";
import { Socket } from "socket.io-client";

interface OrderItemWithSession extends OrderItem {
  orderId: string;
  tableNumber: string;
  tableId: number;
  createdAt: string;
}

export default function KDSPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<OrderItemWithSession[]>([]);
  const [kitchenSections, setKitchenSections] = useState<KitchenSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "PENDING" | "PREPARING" | "SERVED">("all");
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [selectedVoidItem, setSelectedVoidItem] = useState<OrderItemWithSession | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const kitchenSectionsRef = useRef<KitchenSection[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const isSocketInitialized = useRef(false);

  useEffect(() => {
    // Register connect callback BEFORE initializing socket
    const handleConnect = (socketId: string) => {
      console.log("✅ Socket connected:", socketId);
      setSocketConnected(true);
      if (socketRef.current) {
        joinKitchenRooms(socketRef.current);
      }
    };

    addConnectListener(handleConnect);

    // Store cleanup function
    socketRef.current = socketRef.current || ({} as any);
    (socketRef.current as any).cleanup = () => {
      removeConnectListener(handleConnect);
      if (socketRef.current) {
        socketRef.current.off("kitchen:new_order");
        socketRef.current.off("order:item_status_changed");
        socketRef.current.off("kitchen:void_order");
      }
    };

    const initData = async () => {
      await fetchKitchenSections();
      // Fetch orders immediately after kitchen sections are loaded
      console.log("[KDS] Kitchen sections loaded, fetching orders...");
      await fetchOrders();
    };
    initData();

    // Initialize socket only once
    if (!isSocketInitialized.current) {
      const s = getSocket();
      socketRef.current = s;

      console.log("[KDS] Socket object created:", !!s);
      console.log("[KDS] Socket connected status:", s.connected);

      // If already connected, call immediately
      if (s.connected) {
        console.log("[KDS] Socket already connected, joining rooms now");
        handleConnect(s.id || 'unknown');
      }

      // Listen for new orders
      s.on("kitchen:new_order", (data) => {
        console.log("🔔 [KDS] Received kitchen:new_order event:", data);
        fetchOrders();
        toast.success("📋 ออเดอร์ใหม่เข้ามา!");
      });

      // Listen for order item status changes
      s.on("order:item_status_changed", (data) => {
        console.log("🔔 [KDS] Received order:item_status_changed event:", data);
        fetchOrders();
      });

      // Listen for void orders
      s.on("kitchen:void_order", (data) => {
        console.log("🔔 [KDS] Received kitchen:void_order event:", data);
        fetchOrders();
        toast.warning(`⚠️ ยกเลิกออเดอร์: ${data.reason}`);
      });

      isSocketInitialized.current = true;
    } else {
      console.log("[KDS] Socket already initialized, skipping");
      // If socket exists and is connected, join rooms and fetch orders
      if (socketRef.current?.connected) {
        console.log("[KDS] Re-joining kitchen rooms and fetching orders");
        joinKitchenRooms(socketRef.current);
        fetchOrders();
      }
    }

    return () => {
      // Cleanup listeners
      const s = socketRef.current;
      if (s && (s as any).cleanup) {
        (s as any).cleanup();
      }
    };
  }, []);

  const joinKitchenRooms = (s: Socket) => {
    const sections = kitchenSectionsRef.current;
    console.log("[KDS] Joining kitchen rooms:", sections);
    if (sections.length > 0) {
      sections.forEach((kitchen) => {
        s.emit("kitchen:join", { kitchenId: kitchen.id });
        console.log(`🔗 Joined kitchen: ${kitchen.id}`);
      });
    } else {
      console.warn("[KDS] No kitchen sections to join!");
    }
  };

  // Re-join kitchen rooms when kitchenSections state changes
  useEffect(() => {
    if (kitchenSections.length > 0 && socketRef.current && socketConnected) {
      console.log("[KDS] Kitchen sections updated, joining rooms...");
      joinKitchenRooms(socketRef.current);
    }
  }, [kitchenSections, socketConnected]);

  const fetchOrders = async () => {
    try {
      const sections = kitchenSectionsRef.current;
      console.log("🔍 [KDS] Fetching orders for kitchens:", sections);

      if (sections.length === 0) {
        console.log("⚠️ [KDS] No kitchen sections found, skipping fetch");
        return;
      }

      // Fetch from all kitchens by trying each section
      const allOrders: OrderItemWithSession[] = [];
      for (const kitchen of sections) {
        try {
          const url = `/orders/kitchen/${kitchen.id}`;
          console.log(`📡 [KDS] Fetching: ${url}`);
          const res = await api.get(url);
          console.log(`✅ [KDS] Kitchen ${kitchen.id} response:`, res.data);

          const items = Array.isArray(res.data) ? res.data : (res.data.data || []);
          console.log(`📦 [KDS] Kitchen ${kitchen.id} items count: ${items.length}`);

          // Map to include tableNumber from order.session.table.number
          const mappedItems = items.map((item: any) => ({
            ...item,
            tableNumber: item.order?.session?.table?.number || 'N/A',
            tableId: item.order?.session?.table?.id || 0,
          }));
          allOrders.push(...mappedItems);
        } catch (error: any) {
          console.log(`❌ [KDS] Kitchen ${kitchen.id} error:`, error.response?.status, error.response?.data);
          // Skip if kitchen has no orders
        }
      }
      console.log("🎯 [KDS] All orders:", allOrders);
      setOrders(allOrders);
    } catch (error) {
      console.error("💥 [KDS] Failed to fetch orders:", error);
    }
  };

  const fetchKitchenSections = async () => {
    try {
      const res = await api.get("/kitchens");
      console.log("Kitchen sections:", res.data);
      // Service returns array directly, not wrapped in { data: ... }
      const sections = Array.isArray(res.data) ? res.data : (res.data.data || []);
      console.log("Parsed kitchen sections:", sections);
      setKitchenSections(sections);
      kitchenSectionsRef.current = sections; // Update ref
    } catch (error) {
      console.error("Failed to fetch kitchen sections:", error);
    }
  };

  const updateOrderStatus = async (
    orderItemId: string,
    status: "PREPARING" | "SERVED"
  ) => {
    try {
      await api.patch(`/orders/items/${orderItemId}/status`, { status });
      toast.success("อัปเดตสถานะสำเร็จ");
      fetchOrders();

      // Emit socket event for real-time update
      socketRef.current?.emit("update-order-item", {
        orderItemId,
        status,
      });
    } catch (error: any) {
      console.error("Failed to update status:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถอัปเดตได้");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" />
            รอดำเนินการ
          </Badge>
        );
      case "PREPARING":
        return (
          <Badge variant="default" className="gap-1">
            <ChefHat className="h-3 w-3" />
            กำลังทำ
          </Badge>
        );
      case "SERVED":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            เสิร์ฟแล้ว
          </Badge>
        );
      case "VOIDED":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            ยกเลิก
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000); // minutes

    if (diff < 1) return "เพิ่งสั่ง";
    if (diff < 60) return `${diff} นาทีที่แล้ว`;
    const hours = Math.floor(diff / 60);
    return `${hours} ชม. ${diff % 60} นาทีที่แล้ว`;
  };

  // Filter orders by section and status
  const filteredOrders = orders.filter((order) => {
    // Filter by kitchen section
    if (selectedSection !== "all" && order.kitchen?.id?.toString() !== selectedSection) {
      return false;
    }
    // Filter by status
    if (statusFilter !== "all" && order.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const groupedOrders = filteredOrders
    .reduce(
      (acc, order) => {
        const key = order.orderId;
        if (!acc[key]) {
          acc[key] = {
            orderId: order.orderId,
            tableNumber: order.tableNumber,
            tableId: order.tableId,
            createdAt: order.createdAt,
            items: [],
          };
        }
        acc[key].items.push(order);
        return acc;
      },
      {} as Record<
        string,
        {
          orderId: string;
          tableNumber: string;
          tableId: number;
          createdAt: string;
          items: OrderItemWithSession[];
        }
      >
    );

  // Sort by time (oldest first)
  const sortedGroups = Object.values(groupedOrders).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const preparingCount = orders.filter((o) => o.status === "PREPARING").length;
  const servedCount = orders.filter((o) => o.status === "SERVED").length;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between border">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <ChefHat className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kitchen Display System</h1>
              <p className="text-sm text-gray-500">ระบบจัดการออเดอร์ห้องครัว</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Status Badges */}
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xs text-amber-600 font-medium">รอดำเนินการ</p>
                <p className="text-xl font-bold text-amber-700">{pendingCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <ChefHat className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">กำลังทำ</p>
                <p className="text-xl font-bold text-blue-700">{preparingCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-green-600 font-medium">เสิร์ฟแล้ว</p>
                <p className="text-xl font-bold text-green-700">{servedCount}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            <Timer className="h-4 w-4" />
            <span>อัปเดต: {new Date().toLocaleTimeString("th-TH")}</span>
          </div>
        </div>
      </div>

      {/* Kitchen Section Filter */}
      <div className="flex gap-4 items-center">
        <Tabs value={selectedSection} onValueChange={setSelectedSection} className="flex-1">
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="all" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
              ทั้งหมด ({sortedGroups.length})
            </TabsTrigger>
            {kitchenSections.map((section) => {
              const count = sortedGroups.filter((group) =>
                group.items.some((item) => item.kitchen.id === section.id)
              ).length;
              return (
                <TabsTrigger 
                  key={section.id} 
                  value={section.id.toString()}
                  className="data-[state=active]:bg-red-50 data-[state=active]:text-red-600"
                >
                  {section.name.replace('_', ' ')} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Status Filter */}
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
            className={statusFilter === "all" ? "bg-red-600 hover:bg-red-700" : ""}
          >
            ทั้งหมด
          </Button>
          <Button
            variant={statusFilter === "PENDING" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("PENDING")}
            className={statusFilter === "PENDING" ? "bg-amber-500 hover:bg-amber-600" : ""}
          >
            <Clock className="h-4 w-4 mr-1" />
            รอทำ ({pendingCount})
          </Button>
          <Button
            variant={statusFilter === "PREPARING" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("PREPARING")}
            className={statusFilter === "PREPARING" ? "bg-blue-500 hover:bg-blue-600" : ""}
          >
            <ChefHat className="h-4 w-4 mr-1" />
            กำลังทำ ({preparingCount})
          </Button>
          <Button
            variant={statusFilter === "SERVED" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("SERVED")}
            className={statusFilter === "SERVED" ? "bg-green-500 hover:bg-green-600" : ""}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            เสิร์ฟแล้ว ({servedCount})
          </Button>
        </div>
      </div>

      {/* Orders Grid */}
      <ScrollArea className="flex-1">
        {sortedGroups.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="bg-gray-50 rounded-full p-8 inline-block mb-4">
                <ChefHat className="h-24 w-24 text-gray-300" />
              </div>
              <p className="text-xl font-medium text-gray-600">ไม่มีออเดอร์ในห้องครัว</p>
              <p className="text-sm text-gray-400 mt-2">ออเดอร์ใหม่จะปรากฏที่นี่ทันที</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedGroups.map((orderGroup) => {
              const hasPending = orderGroup.items.some((item) => item.status === "PENDING");
              const hasPreparing = orderGroup.items.some((item) => item.status === "PREPARING");
              const allServed = orderGroup.items.every((item) => item.status === "SERVED" || item.status === "VOIDED");
              
              return (
                <Card
                  key={orderGroup.orderId}
                  className={`border-2 shadow-md hover:shadow-lg transition-shadow ${
                    hasPending
                      ? "border-red-300 bg-red-50"
                      : hasPreparing
                      ? "border-blue-300 bg-blue-50"
                      : "border-green-300 bg-green-50"
                  }`}
                >
                  <CardHeader className="pb-3 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          hasPending ? "bg-red-100" : hasPreparing ? "bg-blue-100" : "bg-green-100"
                        }`}>
                          <ChefHat className={`h-5 w-5 ${
                            hasPending ? "text-red-600" : hasPreparing ? "text-blue-600" : "text-green-600"
                          }`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold">
                            โต๊ะ {orderGroup.tableNumber}
                          </CardTitle>
                          <p className="text-xs text-gray-500 mt-1">
                            #{orderGroup.orderId.slice(-8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={hasPending ? "warning" : hasPreparing ? "default" : "success"}
                        className="gap-1 px-3 py-1"
                      >
                        <Timer className="h-3 w-3" />
                        {getTimeAgo(orderGroup.createdAt)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-2">
                    {orderGroup.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          item.status === "VOIDED"
                            ? "bg-red-50 border-red-200 opacity-60"
                            : item.status === "SERVED"
                            ? "bg-green-50 border-green-200"
                            : item.status === "PREPARING"
                            ? "bg-blue-50 border-blue-200"
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-lg font-bold text-lg ${
                              item.status === "VOIDED"
                                ? "bg-red-200 text-red-700"
                                : item.status === "SERVED"
                                ? "bg-green-200 text-green-700"
                                : item.status === "PREPARING"
                                ? "bg-blue-200 text-blue-700"
                                : "bg-amber-200 text-amber-700"
                            }`}>
                              {item.quantity}x
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{item.menuItem.name}</p>
                              <p className="text-xs text-gray-500 mt-1">{item.kitchen.name.replace('_', ' ')}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {getStatusBadge(item.status)}
                          </div>
                        </div>
                        {item.status !== "VOIDED" && item.status !== "SERVED" && (
                          <div className="flex gap-2 mt-2">
                            {item.status === "PENDING" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 bg-white hover:bg-amber-50 border-amber-300 text-amber-700"
                                onClick={() => updateOrderStatus(item.id, "PREPARING")}
                              >
                                <ChefHat className="h-4 w-4 mr-1" />
                                เริ่มทำ
                              </Button>
                            )}
                            {item.status === "PREPARING" && (
                              <Button
                                size="sm"
                                variant="default"
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                onClick={() => updateOrderStatus(item.id, "SERVED")}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                เสิร์ฟ
                              </Button>
                            )}
                          </div>
                        )}
                        {item.status === "VOIDED" && (
                          <div className="flex items-center gap-2 mt-2 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            <p className="text-xs font-medium">ยกเลิกโดยผู้จัดการ</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
