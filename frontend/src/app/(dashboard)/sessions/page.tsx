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
import { Clock, Plus, X, CheckCircle, AlertCircle, QrCode, Copy } from "lucide-react";
import { Socket } from "socket.io-client";
import type { Session, Table as TableType, Tier } from "@/types";
import { QRCodeSVG } from "qrcode.react";

export default function SessionsPage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tables, setTables] = useState<TableType[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const [adultCount, setAdultCount] = useState(0);
  const [childCount, setChildCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "ACTIVE" | "CLOSED" | "EXPIRED">("all");

  useEffect(() => {
    fetchData();

    const s = getSocket();
    setSocket(s);

    s.on("session:status_changed", (data) => {
      console.log("Session status changed:", data);
      fetchData();
      toast.success("สถานะเซสชันอัปเดตแล้ว");
    });

    return () => {
      s.off("session:status_changed");
    };
  }, []);

  const fetchData = async () => {
    try {
      const [sessionsRes, tablesRes, tiersRes] = await Promise.all([
        api.get("/sessions").catch(() => ({ data: { data: [] } })),
        api.get("/tables").catch(() => ({ data: { data: [] } })),
        api.get("/tiers").catch(() => ({ data: { data: [] } })),
      ]);
      setSessions(sessionsRes.data.data || []);
      setTables(tablesRes.data.data || []);
      setTiers(tiersRes.data.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    }
  };

  const handleCreateSession = async () => {
    if (!selectedTable) {
      toast.error("กรุณาเลือกโต๊ะ");
      return;
    }
    if (!selectedTier) {
      toast.error("กรุณาเลือกระดับราคา");
      return;
    }

    try {
      await api.post("/sessions", {
        tableId: parseInt(selectedTable),
        tierId: parseInt(selectedTier),
        adultCount: parseInt(adultCount.toString()),
        childCount: parseInt(childCount.toString()),
      });
      toast.success("เปิดเซสชันสำเร็จ");
      setIsCreateOpen(false);
      setSelectedTable("");
      setSelectedTier("");
      setAdultCount(2);
      setChildCount(0);
      fetchData();
    } catch (error: any) {
      console.error("Failed to create session:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถเปิดเซสชันได้");
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    try {
      await api.patch(`/sessions/${sessionId}/status`, { status: "CLOSED" });
      toast.success("ปิดเซสชันสำเร็จ");
      fetchData();
    } catch (error: any) {
      console.error("Failed to close session:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถปิดเซสชันได้");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("คัดลอกแล้ว");
  };

  const getStatusBadge = (status: Session["status"]) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            กำลังใช้งาน
          </Badge>
        );
      case "CLOSED":
        return (
          <Badge variant="secondary" className="gap-1">
            <X className="h-3 w-3" />
            ปิดแล้ว
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            หมดอายุ
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredSessions = sessions.filter((session) => {
    if (filter === "all") return true;
    return session.status === filter;
  });

  const availableTables = tables.filter((t) => t.status === "AVAILABLE");

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จัดการเซสชัน</h1>
          <p className="text-gray-500">เปิด/ปิด เซสชันการทานอาหาร</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              เปิดเซสชันใหม่
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เปิดเซสชันใหม่</DialogTitle>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>จำนวนผู้ใหญ่</Label>
                  <Input
                    type="number"
                    value={adultCount}
                    onChange={(e) => setAdultCount(parseInt(e.target.value) || 0)}
                    placeholder="2"
                    min="1"
                  />
                </div>
                <div>
                  <Label>จำนวนเด็ก</Label>
                  <Input
                    type="number"
                    value={childCount}
                    onChange={(e) => setChildCount(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)}>
                  ยกเลิก
                </Button>
                <Button className="flex-1" onClick={handleCreateSession}>
                  ยืนยัน
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["all", "ACTIVE", "CLOSED", "EXPIRED"] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status === "all" ? "ทั้งหมด" : status === "ACTIVE" ? "กำลังใช้งาน" : status === "CLOSED" ? "ปิดแล้ว" : "หมดอายุ"}
          </Button>
        ))}
      </div>

      {/* Sessions Table */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>โต๊ะ</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>เวลาเริ่ม</TableHead>
                <TableHead>เวลาสิ้นสุด</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>QR Token</TableHead>
                <TableHead>จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    ไม่พบเซสชัน
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      {session.table.number} ({session.table.zone || "-"})
                    </TableCell>
                    <TableCell>{session.tier.name}</TableCell>
                    <TableCell>
                      {new Date(session.startTime).toLocaleString("th-TH")}
                    </TableCell>
                    <TableCell>
                      {new Date(session.endTime).toLocaleString("th-TH")}
                    </TableCell>
                    <TableCell>{getStatusBadge(session.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {session.qrToken.slice(0, 8)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyToClipboard(session.qrToken)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {session.status === "ACTIVE" && (
                          <>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <QrCode className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>QR Code - โต๊ะ {session.table.number}</DialogTitle>
                                </DialogHeader>
                                <div className="flex flex-col items-center gap-4">
                                  <QRCodeSVG
                                    value={`${window.location.origin}/order/${session.qrToken}`}
                                    size={256}
                                  />
                                  <p className="text-sm text-gray-500">
                                    สแกนเพื่อสั่งอาหาร
                                  </p>
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      copyToClipboard(
                                        `${window.location.origin}/order/${session.qrToken}`
                                      )
                                    }
                                  >
                                    <Copy className="h-4 w-4 mr-2" />
                                    คัดลอกลิงก์
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCloseSession(session.id)}
                            >
                              ปิดเซสชัน
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
    </div>
  );
}
