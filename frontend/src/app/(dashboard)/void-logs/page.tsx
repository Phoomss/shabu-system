"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  AlertCircle,
  FileText,
  Trash2,
} from "lucide-react";
import type { VoidLog } from "@/types";

export default function VoidLogsPage() {
  const { user } = useAuthStore();
  const [voidLogs, setVoidLogs] = useState<VoidLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchVoidLogs();
  }, []);

  const fetchVoidLogs = async () => {
    try {
      const res = await api.get("/orders/void-logs");
      setVoidLogs(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch void logs:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    }
  };

  const filteredLogs = voidLogs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      log.id.toString().includes(searchLower) ||
      log.orderItem?.menuItem.name.toLowerCase().includes(searchLower) ||
      log.reason.toLowerCase().includes(searchLower) ||
      log.approvedBy.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ประวัติการยกเลิก</h1>
          <p className="text-gray-500">Audit trail สำหรับการยกเลิกออเดอร์</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">การยกเลิกทั้งหมด</CardTitle>
            <AlertCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{voidLogs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">วันนี้</CardTitle>
            <FileText className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {voidLogs.filter(
                (log) =>
                  new Date(log.createdAt).toDateString() ===
                  new Date().toDateString()
              ).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">อนุมัติโดย</CardTitle>
            <Trash2 className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(voidLogs.map((log) => log.approvedBy)).size} คน
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ค้นหาโดย ID, เมนู, เหตุผล, หรือผู้อนุมัติ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Void Logs Table */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>ออเดอร์</TableHead>
                <TableHead>เมนู</TableHead>
                <TableHead>เหตุผล</TableHead>
                <TableHead>อนุมัติโดย</TableHead>
                <TableHead>เวลา</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    ไม่พบประวัติการยกเลิก
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      #{log.id.toString().padStart(6, "0")}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.orderItem?.orderId.slice(-8) || "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.orderItem?.menuItem.name || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-sm truncate">{log.reason}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.approvedBy}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(log.createdAt).toLocaleString("th-TH")}
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
