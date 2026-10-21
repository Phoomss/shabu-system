"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { createCustomerSocket } from "@/lib/socket";
import { publicApi, createCustomerApi } from "@/lib/api";
import {
  bindRoomSync,
  latestRequest,
  MAX_ITEM_QUANTITY,
  MAX_ORDER_ITEMS,
} from "@/lib/workflow-client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Utensils,
  ShoppingCart,
  Plus,
  Minus,
  Clock,
  CheckCircle,
  AlertCircle,
  ChefHat,
  Timer,
} from "lucide-react";
import type { MenuItem, Session, Order } from "@/types";
import Image from "next/image";
import { isAxiosError } from "axios";

interface CartItem extends MenuItem {
  quantity: number;
}

export default function CustomerOrderPage() {
  const params = useParams();
  const token = params.token as string;

  const [session, setSession] = useState<Session | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [credential, setCredential] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [timeLeft, setTimeLeft] = useState(0);
  const dataRequests = useRef(latestRequest());
  const historyRequests = useRef(latestRequest());
  const liveToken = useRef<string | null>(null);
  const submitting = useRef(false);

  const endSession = useCallback(() => {
    dataRequests.current.invalidate();
    historyRequests.current.invalidate();
    liveToken.current = null;
    setCredential(null);
    setCart([]);
    setLoading(false);
    setAccessError("รอบการทานปิดหรือหมดเวลาแล้ว กรุณาติดต่อพนักงาน");
  }, []);

  const customerToken = credential?.token;
  const credentialExpiresAt = credential?.expiresAt;
  const sessionId = session?.id;

  const fetchData = useCallback(async () => {
    const request = dataRequests.current.begin();
    historyRequests.current.invalidate();
    try {
      const { data } = await publicApi.get(`/sessions/qr/${token}`);
      const resolved = data.data;
      const client = createCustomerApi(resolved.customerAccessToken);
      const [menus, history] = await Promise.all([
        client.get("/customer/menu-items"),
        client.get("/customer/orders"),
      ]);
      if (!dataRequests.current.isCurrent(request)) return;
      historyRequests.current.invalidate();
      liveToken.current = resolved.customerAccessToken;
      setSession(resolved);
      setMenuItems(menus.data.data);
      setOrders(history.data.data);
      setAccessError(null);
      setCredential({
        token: resolved.customerAccessToken,
        expiresAt: resolved.credentialExpiresAt,
      });
    } catch {
      if (!dataRequests.current.isCurrent(request)) return;
      liveToken.current = null;
      setCredential(null);
      setAccessError(
        "ไม่สามารถใช้ QR นี้ได้ รอบการทานอาจปิดหรือหมดเวลาแล้ว กรุณาติดต่อพนักงาน",
      );
    } finally {
      if (dataRequests.current.isCurrent(request)) setLoading(false);
    }
  }, [token]);

  const fetchOrders = useCallback(
    async (requestedSessionId?: string) => {
      if (
        !requestedSessionId ||
        !customerToken ||
        liveToken.current !== customerToken
      )
        return;
      const request = historyRequests.current.begin();
      try {
        const res = await createCustomerApi(customerToken).get(
          "/customer/orders",
          { params: { sessionId: requestedSessionId } },
        );
        if (
          liveToken.current === customerToken &&
          historyRequests.current.isCurrent(request)
        )
          setOrders(res.data.data);
      } catch (error) {
        if (
          liveToken.current !== customerToken ||
          !historyRequests.current.isCurrent(request)
        )
          return;
        if (
          isAxiosError(error) &&
          [401, 403].includes(error.response?.status || 0)
        ) {
          void fetchData();
        } else toast.error("ไม่สามารถโหลดประวัติออเดอร์ได้");
      }
    },
    [customerToken, fetchData],
  );

  useEffect(() => {
    const currentDataRequests = dataRequests.current;
    const currentHistoryRequests = historyRequests.current;
    setLoading(true);
    setCart([]);
    setSession(null);
    setOrders([]);
    setMenuItems([]);
    liveToken.current = null;
    setCredential(null);
    void fetchData();
    return () => {
      currentDataRequests.invalidate();
      currentHistoryRequests.invalidate();
      liveToken.current = null;
    };
  }, [fetchData]);

  useEffect(() => {
    if (!customerToken || !sessionId || !credentialExpiresAt) return;
    const currentSessionId = sessionId;
    const s = createCustomerSocket(customerToken);
    const sync = () => {
      void fetchOrders(currentSessionId);
    };
    const cleanupRooms = bindRoomSync(
      s,
      () => {
        s.emit("session:join", { sessionId: currentSessionId });
      },
      "session:joined",
      sync,
      ["order:item_status_changed", "order:status_changed"],
    );
    const onMenu = (data: {
      menuItemId: string;
      isAvailable: boolean;
      name: string;
    }) => {
      // Re-read the server-scoped list, including newly available items; never add an event payload as a menu.
      void data;
      void fetchData();
    };
    const onSession = (data: { sessionId: string; status: string }) => {
      if (data.sessionId === currentSessionId && data.status !== "ACTIVE")
        endSession();
    };
    const onWarning = (data: { sessionId: string; minutesLeft: number }) => {
      if (data.sessionId === currentSessionId)
        toast.warning(`⏰ เวลาเหลือ ${data.minutesLeft} นาที`);
    };
    const onAuthError = (error: Error & { data?: { status?: number } }) => {
      if ([401, 403].includes(error.data?.status || 0)) void fetchData();
    };
    s.on("session:status_changed", onSession);
    s.on("menu:availability_changed", onMenu);
    s.on("session:time_warning", onWarning);
    const onDisconnect = (reason: string) => {
      if (reason === "io server disconnect") void fetchData();
    };
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onAuthError);
    s.connect();
    const remaining = new Date(credentialExpiresAt).getTime() - Date.now();
    const renewal = setTimeout(
      () => {
        void fetchData();
      },
      remaining > 60000 ? remaining - 30000 : Math.max(1000, remaining + 100),
    );
    return () => {
      clearTimeout(renewal);
      cleanupRooms();
      s.off("session:status_changed", onSession);
      s.off("menu:availability_changed", onMenu);
      s.off("session:time_warning", onWarning);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onAuthError);
      s.disconnect();
    };
  }, [
    customerToken,
    sessionId,
    credentialExpiresAt,
    fetchOrders,
    fetchData,
    endSession,
  ]);

  useEffect(() => {
    if (!session) return;

    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(session.endTime).getTime();
      const remaining = Math.max(0, end - now);
      setTimeLeft(Math.floor(remaining / 60000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    const deadline = setTimeout(
      endSession,
      Math.max(0, new Date(session.endTime).getTime() - Date.now()),
    );
    return () => {
      clearInterval(interval);
      clearTimeout(deadline);
    };
  }, [session, endSession]);

  const addToCart = (item: MenuItem) => {
    if (!item.isAvailable) {
      toast.warning("เมนูนี้หมดชั่วคราว");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id
            ? { ...i, quantity: Math.min(MAX_ITEM_QUANTITY, i.quantity + 1) }
            : i,
        );
      }
      if (prev.length >= MAX_ORDER_ITEMS) return prev;
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === itemId
            ? {
                ...i,
                quantity: Math.min(
                  MAX_ITEM_QUANTITY,
                  Math.max(0, i.quantity + delta),
                ),
              }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const submitOrder = async () => {
    if (!session || !credential || cart.length === 0 || submitting.current)
      return;
    if (Date.now() >= new Date(session.endTime).getTime()) {
      endSession();
      return;
    }
    if (
      cart.some(
        (item) =>
          !menuItems.some((menu) => menu.id === item.id && menu.isAvailable),
      )
    ) {
      toast.error("มีเมนูที่ไม่พร้อมขาย กรุณานำออกจากตะกร้า");
      return;
    }
    submitting.current = true;

    try {
      const orderItems = cart.map((item) => ({
        menuItemId: item.id,
        quantity: item.quantity,
      }));

      await createCustomerApi(credential.token).post("/customer/orders", {
        sessionId: session.id,
        items: orderItems,
      });

      if (liveToken.current !== credential.token) return;
      toast.success("ส่งออเดอร์สำเร็จ!");
      setCart([]);
      void fetchOrders(session.id);
    } catch (error: unknown) {
      if (liveToken.current !== credential.token) return;
      if (
        isAxiosError(error) &&
        [401, 403].includes(error.response?.status || 0)
      ) {
        endSession();
      }
      console.error("Customer order request failed");
      toast.error(
        (isAxiosError<{ message?: string }>(error) &&
          error.response?.data?.message) ||
          "ส่งออเดอร์ไม่สำเร็จ",
      );
    } finally {
      submitting.current = false;
    }
  };

  const getOrderStatusBadge = (status: string) => {
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
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            ยืนยันแล้ว
          </Badge>
        );
      case "CANCELLED":
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

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity, 0);

  const categories = Array.from(
    new Map(
      menuItems.map((item) => [item.category.id, item.category]),
    ).values(),
  );

  const filteredItems =
    selectedCategory === "all"
      ? menuItems
      : menuItems.filter(
          (item) => item.category.id.toString() === selectedCategory,
        );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }

  if (accessError || !session) {
    return (
      <div className="p-8 text-center" role="alert">
        {accessError || "ไม่พบข้อมูลรอบการทาน"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">🍲 Shabu Restaurant</h1>
              <p className="text-sm text-gray-500">
                โต๊ะ {session.table.number} - {session.tier.name}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Timer className="h-4 w-4" />
                <span className={timeLeft < 15 ? "text-red-600 font-bold" : ""}>
                  {timeLeft} นาที
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOrderHistoryOpen(true)}
              >
                ประวัติออเดอร์
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <Badge
              variant={session.status === "ACTIVE" ? "success" : "secondary"}
            >
              {session.status === "ACTIVE" ? "กำลังทาน" : "ปิดโต๊ะแล้ว"}
            </Badge>
            {timeLeft < 15 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                เวลาใกล้หมด
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Category Tabs */}
        <Tabs
          value={selectedCategory}
          onValueChange={setSelectedCategory}
          className="mb-6"
        >
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className={`cursor-pointer transition-all ${
                item.isAvailable
                  ? "hover:shadow-lg hover:scale-105"
                  : "opacity-50 cursor-not-allowed"
              }`}
              onClick={() => addToCart(item)}
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
      </main>

      {/* Floating Cart Button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
        <Button
          className="w-full h-16 text-lg font-bold bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 shadow-2xl rounded-full"
          onClick={() => setIsCartOpen(true)}
          disabled={cart.length === 0}
        >
          <ShoppingCart className="h-6 w-6 mr-2" />
          ตะกร้า ({cartTotal})
          {cartTotal > 0 && (
            <Badge className="ml-2 bg-white text-red-600 hover:bg-white">
              {cartTotal} รายการ
            </Badge>
          )}
        </Button>
      </div>

      {/* Cart Sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              ตะกร้าสินค้า
            </SheetTitle>
          </SheetHeader>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 mt-8">
              <ShoppingCart className="h-16 w-16 mb-4" />
              <p>ยังไม่มีสินค้าในตะกร้า</p>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 my-4 h-[calc(100vh-250px)]">
                <div className="space-y-3">
                  {cart.map((item) => (
                    <Card key={item.id} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-16 w-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                width={64}
                                height={64}
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <Utensils className="h-6 w-6 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="font-bold w-8 text-center">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:bg-red-50"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Plus className="h-4 w-4 rotate-45" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              <Separator className="my-4" />

              <div className="space-y-3">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>รวมทั้งสิ้น</span>
                  <span className="text-red-600">{cartTotal} รายการ</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCart([])}
                  >
                    ล้างตะกร้า
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                    size="lg"
                    onClick={submitOrder}
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    ส่งออเดอร์
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Order History Dialog */}
      <Dialog open={isOrderHistoryOpen} onOpenChange={setIsOrderHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ประวัติออเดอร์</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            {orders.length === 0 ? (
              <p className="text-center text-gray-500 py-8">ยังไม่มีออเดอร์</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">
                            {new Date(order.createdAt).toLocaleString("th-TH")}
                          </p>
                        </div>
                        {getOrderStatusBadge(order.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{item.quantity}x</Badge>
                              <span>{item.menuItem.name}</span>
                            </div>
                            {getItemStatusBadge(item.status)}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
