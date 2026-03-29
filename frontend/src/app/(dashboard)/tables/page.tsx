"use client";

import { useEffect, useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit, Trash2, Search, Utensils, Users } from "lucide-react";

interface Table {
  id: number;
  number: string;
  zone?: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    number: "",
    zone: "",
    status: "AVAILABLE" as Table["status"],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/tables").catch(() => ({ data: { data: [] } }));
      setTables(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.number) {
      toast.error("กรุณากรอกหมายเลขโต๊ะ");
      return;
    }

    try {
      if (editingTable) {
        await api.patch(`/tables/${editingTable.id}`, formData);
        toast.success("อัปเดตโต๊ะสำเร็จ");
      } else {
        await api.post("/tables", formData);
        toast.success("เพิ่มโต๊ะสำเร็จ");
      }

      setIsAddDialogOpen(false);
      setEditingTable(null);
      setFormData({ number: "", zone: "", status: "AVAILABLE" });
      fetchData();
    } catch (error: any) {
      console.error("Failed to save table:", error);
      toast.error(error.response?.data?.message || "บันทึกไม่สำเร็จ");
    }
  };

  const handleEdit = (table: Table) => {
    setEditingTable(table);
    setFormData({
      number: table.number,
      zone: table.zone || "",
      status: table.status,
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (tableId: number) => {
    if (!confirm("ต้องการลบโต๊ะนี้หรือไม่?")) return;

    try {
      await api.delete(`/tables/${tableId}`);
      toast.success("ลบโต๊ะสำเร็จ");
      fetchData();
    } catch (error: any) {
      console.error("Failed to delete table:", error);
      toast.error("ไม่สามารถลบได้");
    }
  };

  const updateStatus = async (tableId: number, status: Table["status"]) => {
    try {
      await api.patch(`/tables/${tableId}/status`, { status });
      toast.success("อัปเดตสถานะสำเร็จ");
      fetchData();
    } catch (error: any) {
      console.error("Failed to update status:", error);
      toast.error("ไม่สามารถอัปเดตได้");
    }
  };

  const filteredTables = tables.filter((table) =>
    table.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (table.zone?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return <Badge variant="success">ว่าง</Badge>;
      case "OCCUPIED":
        return <Badge variant="default">มีลูกค้า</Badge>;
      case "RESERVED":
        return <Badge variant="warning">จองไว้</Badge>;
      case "CLEANING":
        return <Badge variant="secondary">ทำความสะอาด</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จัดการโต๊ะ</h1>
          <p className="text-gray-500">จัดการโต๊ะและโซนในร้าน</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingTable(null);
            setFormData({ number: "", zone: "", status: "AVAILABLE" });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              เพิ่มโต๊ะ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTable ? "แก้ไขโต๊ะ" : "เพิ่มโต๊ะใหม่"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="number">หมายเลขโต๊ะ</Label>
                <Input
                  id="number"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="เช่น T1, T2"
                />
              </div>
              <div>
                <Label htmlFor="zone">โซน</Label>
                <Input
                  id="zone"
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  placeholder="เช่น Indoor, Outdoor"
                />
              </div>
              <div>
                <Label htmlFor="status">สถานะ</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Table["status"]) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">ว่าง</SelectItem>
                    <SelectItem value="OCCUPIED">มีลูกค้า</SelectItem>
                    <SelectItem value="RESERVED">จองไว้</SelectItem>
                    <SelectItem value="CLEANING">ทำความสะอาด</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingTable(null);
                  }}
                >
                  ยกเลิก
                </Button>
                <Button type="submit" className="flex-1">
                  บันทึก
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ค้นหาโต๊ะหรือโซน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTables.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Utensils className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-gray-500">ไม่พบข้อมูลโต๊ะ</p>
          </div>
        ) : (
          filteredTables.map((table) => (
            <Card key={table.id} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-2 h-full ${
                table.status === "AVAILABLE" ? "bg-green-500" :
                table.status === "OCCUPIED" ? "bg-red-500" :
                table.status === "RESERVED" ? "bg-yellow-500" : "bg-gray-500"
              }`} />
              <CardHeader className="pb-2 pl-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">โต๊ะ {table.number}</CardTitle>
                  {getStatusBadge(table.status)}
                </div>
              </CardHeader>
              <CardContent className="pl-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="h-4 w-4" />
                  <span>{table.zone || "ไม่มีโซน"}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(table)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(table.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
                <Select
                  value={table.status}
                  onValueChange={(value: Table["status"]) => updateStatus(table.id, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">ว่าง</SelectItem>
                    <SelectItem value="OCCUPIED">มีลูกค้า</SelectItem>
                    <SelectItem value="RESERVED">จองไว้</SelectItem>
                    <SelectItem value="CLEANING">ทำความสะอาด</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
