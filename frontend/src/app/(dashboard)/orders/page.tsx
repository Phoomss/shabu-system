"use client";

import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { getSocket, addConnectListener, removeConnectListener } from "@/lib/socket";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  ChefHat,
} from "lucide-react";
import { Socket } from "socket.io-client";
import type { Order, Session } from "@/types";

export default function OrdersPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "PENDING" | "CONFIRMED" | "CANCELLED">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchData();

    // Initialize socket
    const s = getSocket();
    setSocket(s);
    socketRef.current = s;

    // Register socket listeners
    s.on("order:status_changed", (data) => {
      console.log("Order status changed:", data);
      fetchData();
      toast.success("สถานะออเดอร์อัปเดตแล้ว");
    });

    s.on("order:item_status_changed", (data) => {
      console.log("Order item status changed:", data);
      fetchData();
    });

    return () => {
      s.off("order:status_changed");
      s.off("order:item_status_changed");
    };
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, sessionsRes] = await Promise.all([
        api.get("/orders").catch(() => ({ data: { data: [] } })),
        api.get("/sessions").catch(() => ({ data: { data: [] } })),
      ]);
      setOrders(ordersRes.data.data || []);
      setSessions(sessionsRes.data.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order["status"]) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success("อัปเดตสถานะออเดอร์สำเร็จ");
      fetchData();
    } catch (error: any) {
      console.error("Failed to update order status:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถอัปเดตได้");
    }
  };

  const handleVoidItem = async () => {
    if (!selectedItemId || !voidReason) {
      toast.error("กรุณากรอกเหตุผล");
      return;
    }

    try {
      await api.post(`/orders/items/${selectedItemId}/void`, { reason: voidReason });
      toast.success("ยกเลิกไอเทมสำเร็จ");
      setIsVoidOpen(false);
      setVoidReason("");
      setSelectedItemId(null);
      fetchData();
    } catch (error: any) {
      console.error("Failed to void item:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถยกเลิกได้");
    }
  };

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" />
            รอยืนยัน
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            ยืนยันแล้ว
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            ยกเลิก
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="warning">รอดำเนินการ</Badge>;
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

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.session?.table.number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จัดการออเดอร์</h1>
          <p className="text-gray-500">ดูและจัดการออเดอร์ทั้งหมด</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="ค้นหาโดย ID หรือโต๊ะ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="PENDING">รอดำเนินการ</SelectItem>
                <SelectItem value="CONFIRMED">ยืนยันแล้ว</SelectItem>
                <SelectItem value="CANCELLED">ยกเลิก</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>โต๊ะ</TableHead>
                <TableHead>จำนวนไอเทม</TableHead>
                <TableHead>เวลาสั่ง</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    ไม่พบออเดอร์
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">
                      {order.id.slice(-8)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.session?.table.number || "-"}
                    </TableCell>
                    <TableCell>{order.items.length}</TableCell>
                    <TableCell>
                      {new Date(order.createdAt).toLocaleString("th-TH")}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.status === "PENDING" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() =>
                                handleUpdateOrderStatus(order.id, "CONFIRMED")
                              }
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                handleUpdateOrderStatus(order.id, "CANCELLED")
                              }
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>รายละเอียดออเดอร์</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Order ID</p>
                  <p className="font-mono">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">โต๊ะ</p>
                  <p className="font-medium">{selectedOrder.session?.table.number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">สถานะ</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">เวลาสั่ง</p>
                  <p>{new Date(selectedOrder.createdAt).toLocaleString("th-TH")}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">รายการอาหาร</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{item.quantity}x</Badge>
                        <div>
                          <p className="font-medium">{item.menuItem.name}</p>
                          <p className="text-sm text-gray-500">
                            {item.kitchen.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getItemStatusBadge(item.status)}
                        {item.status === "PENDING" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setIsVoidOpen(true);
                            }}
                          >
                            ยกเลิก
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={isVoidOpen} onOpenChange={setIsVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยกเลิกไอเทม</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">เหตุผลในการยกเลิก</p>
              <Input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="กรอกเหตุผล..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsVoidOpen(false)}>
                ยกเลิก
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleVoidItem}>
                ยืนยันการยกเลิก
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
