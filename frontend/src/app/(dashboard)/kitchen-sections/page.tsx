"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, ChefHat } from "lucide-react";
import type { KitchenSection } from "@/types";

export default function KitchenSectionsPage() {
  const { user } = useAuthStore();
  const [kitchens, setKitchens] = useState<KitchenSection[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedKitchen, setSelectedKitchen] = useState<KitchenSection | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    fetchKitchens();
  }, []);

  const fetchKitchens = async () => {
    try {
      const res = await api.get("/kitchens");
      setKitchens(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch kitchen sections:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }

    try {
      await api.post("/kitchens", { name });
      toast.success("สร้างส่วนครัวสำเร็จ");
      setIsCreateOpen(false);
      setName("");
      fetchKitchens();
    } catch (error: any) {
      console.error("Failed to create kitchen section:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถสร้างได้");
    }
  };

  const handleUpdate = async () => {
    if (!selectedKitchen || !name.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }

    try {
      await api.patch(`/kitchens/${selectedKitchen.id}`, { name });
      toast.success("อัปเดตส่วนครัวสำเร็จ");
      setIsEditOpen(false);
      setName("");
      setSelectedKitchen(null);
      fetchKitchens();
    } catch (error: any) {
      console.error("Failed to update kitchen section:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถอัปเดตได้");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("ยืนยันการลบส่วนครัวนี้?")) return;

    try {
      await api.delete(`/kitchens/${id}`);
      toast.success("ลบส่วนครัวสำเร็จ");
      fetchKitchens();
    } catch (error: any) {
      console.error("Failed to delete kitchen section:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถลบได้");
    }
  };

  const openEdit = (kitchen: KitchenSection) => {
    setSelectedKitchen(kitchen);
    setName(kitchen.name);
    setIsEditOpen(true);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จัดการส่วนครัว</h1>
          <p className="text-gray-500">แผนกและส่วนต่างๆ ในห้องครัว</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มส่วนครัว
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มส่วนครัวใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>ชื่อส่วนครัว</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ครัวร้อน, ครัวเย็น"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCreateOpen(false)}
                >
                  ยกเลิก
                </Button>
                <Button className="flex-1" onClick={handleCreate}>
                  บันทึก
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kitchen Sections Table */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kitchens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                    ไม่มีส่วนครัว
                  </TableCell>
                </TableRow>
              ) : (
                kitchens.map((kitchen) => (
                  <TableRow key={kitchen.id}>
                    <TableCell className="font-mono">{kitchen.id}</TableCell>
                    <TableCell className="font-medium">{kitchen.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(kitchen)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(kitchen.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขส่วนครัว</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อส่วนครัว</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsEditOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button className="flex-1" onClick={handleUpdate}>
                บันทึก
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
