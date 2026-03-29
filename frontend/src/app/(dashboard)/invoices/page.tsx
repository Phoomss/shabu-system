"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { getSocket } from "@/lib/socket";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  DollarSign,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  FileText,
  Printer,
} from "lucide-react";
import { Socket } from "socket.io-client";
import type { Invoice, Session } from "@/types";

export default function InvoicesPage() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "QR_CODE" | "BANK_TRANSFER">("CASH");
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    fetchData();

    const s = getSocket();
    setSocket(s);

    s.on("invoice:new", (data) => {
      console.log("New invoice:", data);
      fetchData();
      toast.success("สร้างใบเสร็จสำเร็จ");
    });

    return () => {
      s.off("invoice:new");
    };
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesRes, sessionsRes] = await Promise.all([
        api.get("/invoices").catch(() => ({ data: { data: [] } })),
        api.get("/sessions").catch(() => ({ data: { data: [] } })),
      ]);
      setInvoices(invoicesRes.data.data || []);
      setSessions(sessionsRes.data.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedSession) {
      toast.error("กรุณาเลือกเซสชัน");
      return;
    }

    try {
      // Fetch session details with tier info
      const sessionRes = await api.get(`/sessions/${selectedSession}`);
      const session = sessionRes.data.data;
      
      console.log("Session data:", session);
      
      // Get tier prices
      const priceAdult = session.tier?.priceAdult || 0;
      const priceChild = session.tier?.priceChild || 0;
      
      console.log("Tier prices:", { priceAdult, priceChild });
      
      // For simplicity, use adult price as base (you can customize this logic)
      // In real scenario, you might want to track adult/child count separately
      const totalAmount = priceAdult;

      const payload = {
        sessionId: selectedSession,
        totalAmount,
        discount,
        paymentMethod,
      };

      console.log("Creating invoice with payload:", payload);

      await api.post("/invoices", payload);
      toast.success("สร้างใบเสร็จสำเร็จ");
      setIsCreateOpen(false);
      setSelectedSession("");
      setDiscount(0);
      fetchData();
    } catch (error: any) {
      console.error("Failed to create invoice:", error);
      console.error("Error response:", error.response?.data);
      toast.error(error.response?.data?.message || "ไม่สามารถสร้างใบเสร็จได้");
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "CASH":
        return <Banknote className="h-4 w-4" />;
      case "CREDIT_CARD":
        return <CreditCard className="h-4 w-4" />;
      case "DEBIT_CARD":
        return <CreditCard className="h-4 w-4" />;
      case "QR_CODE":
        return <Smartphone className="h-4 w-4" />;
      case "BANK_TRANSFER":
        return <Building className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "CASH":
        return "เงินสด";
      case "CREDIT_CARD":
        return "บัตรเครดิต";
      case "DEBIT_CARD":
        return "บัตรเดบิต";
      case "QR_CODE":
        return "QR Code";
      case "BANK_TRANSFER":
        return "โอนเงิน";
      default:
        return method;
    }
  };

  const activeSessions = sessions.filter((s) => s.status === "ACTIVE");

  const filteredInvoices = invoices.filter((invoice) => {
    return (
      invoice.id.toString().includes(searchQuery) ||
      invoice.session?.table.number.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.netAmount, 0);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ใบเสร็จ</h1>
          <p className="text-gray-500">ประวัติการชำระเงินและรายได้</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              สร้างใบเสร็จ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>สร้างใบเสร็จใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>เลือกเซสชัน (กำลังใช้งาน: {activeSessions.length})</Label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกเซสชัน" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        โต๊ะ {session.table.number} - {session.tier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>วิธีการชำระเงิน</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกวิธีการชำระเงิน" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">เงินสด</SelectItem>
                    <SelectItem value="CREDIT_CARD">บัตรเครดิต</SelectItem>
                    <SelectItem value="DEBIT_CARD">บัตรเดบิต</SelectItem>
                    <SelectItem value="QR_CODE">QR Code</SelectItem>
                    <SelectItem value="BANK_TRANSFER">โอนเงิน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ส่วนลด (฿)</Label>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>
                  ยกเลิก
                </Button>
                <Button className="flex-1" onClick={handleCreateInvoice}>
                  สร้างใบเสร็จ
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ใบเสร็จทั้งหมด</CardTitle>
            <FileText className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">รายได้รวม</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿{totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">เซสชันที่ใช้งาน</CardTitle>
            <Building className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ค้นหาโดย ID หรือโต๊ะ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>โต๊ะ</TableHead>
                <TableHead>ยอดรวม</TableHead>
                <TableHead>ส่วนลด</TableHead>
                <TableHead>สุทธิ</TableHead>
                <TableHead>ชำระเงิน</TableHead>
                <TableHead>เวลา</TableHead>
                <TableHead>จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    ยังไม่มีใบเสร็จ
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">
                      #{invoice.id.toString().padStart(6, "0")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {invoice.session?.table.number || "-"}
                    </TableCell>
                    <TableCell>฿{invoice.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-green-600">
                      -฿{invoice.discount.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-bold">
                      ฿{invoice.netAmount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPaymentMethodIcon(invoice.paymentMethod)}
                        <span className="text-sm">{getPaymentMethodLabel(invoice.paymentMethod)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.createdAt).toLocaleString("th-TH")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setIsDetailsOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>รายละเอียดใบเสร็จ</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Invoice ID</p>
                  <p className="font-mono">#{selectedInvoice.id.toString().padStart(6, "0")}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">โต๊ะ</p>
                  <p className="font-medium">{selectedInvoice.session?.table.number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">วิธีการชำระเงิน</p>
                  <div className="flex items-center gap-2">
                    {getPaymentMethodIcon(selectedInvoice.paymentMethod)}
                    <span>{getPaymentMethodLabel(selectedInvoice.paymentMethod)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">เวลา</p>
                  <p>{new Date(selectedInvoice.createdAt).toLocaleString("th-TH")}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>ยอดรวม</span>
                    <span className="font-medium">฿{selectedInvoice.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>ส่วนลด</span>
                    <span>-฿{selectedInvoice.discount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>ยอดสุทธิ</span>
                    <span>฿{selectedInvoice.netAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <Button className="w-full" variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                พิมพ์ใบเสร็จ
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
