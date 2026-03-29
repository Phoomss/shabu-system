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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  Package,
  Search,
  Utensils,
} from "lucide-react";
import { Socket } from "socket.io-client";
import type { Ingredient, Recipe } from "@/types";
import Image from "next/image";

export default function IngredientsPage() {
  const { user } = useAuthStore();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    unit: "",
    currentStock: 0,
    imageUrl: "",
  });
  const [stockValue, setStockValue] = useState(0);
  const [stockReason, setStockReason] = useState("");

  useEffect(() => {
    fetchData();

    const s = getSocket();
    setSocket(s);

    s.on("ingredient:low_stock", (data) => {
      console.log("Low stock alert:", data);
      fetchData();
      toast.warning(`${data.name} ใกล้หมด! คงเหลือ: ${data.currentStock} ${data.unit}`);
    });

    return () => {
      s.off("ingredient:low_stock");
    };
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/ingredients");
      setIngredients(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch ingredients:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    }
  };

  const handleCreate = async () => {
    try {
      await api.post("/ingredients", formData);
      toast.success("สร้างวัตถุดิบสำเร็จ");
      setIsCreateOpen(false);
      setFormData({ name: "", unit: "", currentStock: 0, imageUrl: "" });
      fetchData();
    } catch (error: any) {
      console.error("Failed to create ingredient:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถสร้างได้");
    }
  };

  const handleUpdate = async () => {
    if (!selectedIngredient) return;

    try {
      await api.patch(`/ingredients/${selectedIngredient.id}`, formData);
      toast.success("อัปเดตวัตถุดิบสำเร็จ");
      setIsEditOpen(false);
      setFormData({ name: "", unit: "", currentStock: 0, imageUrl: "" });
      setSelectedIngredient(null);
      fetchData();
    } catch (error: any) {
      console.error("Failed to update ingredient:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถอัปเดตได้");
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedIngredient) return;
    if (!stockReason) {
      toast.error("กรุณากรอกเหตุผล");
      return;
    }

    try {
      // Calculate the difference (amount to adjust)
      const amount = stockValue - selectedIngredient.currentStock;
      
      await api.patch(`/ingredients/${selectedIngredient.id}/stock`, {
        amount,
        reason: stockReason,
      });
      toast.success("อัปเดตสต็อกสำเร็จ");
      setIsStockOpen(false);
      setStockValue(0);
      setStockReason("");
      setSelectedIngredient(null);
      fetchData();
    } catch (error: any) {
      console.error("Failed to update stock:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถอัปเดตได้");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("ยืนยันการลบวัตถุดิบนี้?")) return;

    try {
      await api.delete(`/ingredients/${id}`);
      toast.success("ลบวัตถุดิบสำเร็จ");
      fetchData();
    } catch (error: any) {
      console.error("Failed to delete ingredient:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถลบได้");
    }
  };

  const openEdit = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setFormData({
      name: ingredient.name,
      unit: ingredient.unit,
      currentStock: ingredient.currentStock,
      imageUrl: ingredient.imageUrl || "",
    });
    setIsEditOpen(true);
  };

  const openStock = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setStockValue(ingredient.currentStock);
    setIsStockOpen(true);
  };

  const filteredIngredients = ingredients.filter((ing) =>
    ing.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockThreshold = 20;
  const lowStockCount = ingredients.filter(
    (ing) => ing.currentStock < lowStockThreshold
  ).length;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จัดการวัตถุดิบ</h1>
          <p className="text-gray-500">สต็อกวัตถุดิบและส่วนประกอบ</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มวัตถุดิบ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มวัตถุดิบใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>ชื่อวัตถุดิบ</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="เช่น เนื้อวัว, ผักกาดขาว"
                />
              </div>
              <div>
                <Label>หน่วยนับ</Label>
                <Input
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                  placeholder="เช่น kg, g, piece"
                />
              </div>
              <div>
                <Label>สต็อกเริ่มต้น</Label>
                <Input
                  type="number"
                  value={formData.currentStock}
                  onChange={(e) =>
                    setFormData({ ...formData, currentStock: Number(e.target.value) })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label>URL รูปภาพ (ถ้ามี)</Label>
                <Input
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, imageUrl: e.target.value })
                  }
                  placeholder="https://..."
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">วัตถุดิบทั้งหมด</CardTitle>
            <Package className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ingredients.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ใกล้หมดสต็อก</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lowStockCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">สต็อกเพียงพอ</CardTitle>
            <Utensils className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {ingredients.length - lowStockCount}
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
              placeholder="ค้นหาวัตถุดิบ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Ingredients Table */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รูปภาพ</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>หน่วยนับ</TableHead>
                <TableHead>สต็อกปัจจุบัน</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIngredients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    ไม่พบวัตถุดิบ
                  </TableCell>
                </TableRow>
              ) : (
                filteredIngredients.map((ing) => (
                  <TableRow key={ing.id}>
                    <TableCell>
                      <div className="h-10 w-10 relative bg-gray-100 rounded overflow-hidden">
                        {ing.imageUrl ? (
                          <Image
                            src={ing.imageUrl}
                            alt={ing.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="h-5 w-5 text-gray-300" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{ing.name}</TableCell>
                    <TableCell>{ing.unit}</TableCell>
                    <TableCell>
                      <span
                        className={
                          ing.currentStock < lowStockThreshold
                            ? "text-red-600 font-bold"
                            : ""
                        }
                      >
                        {ing.currentStock}
                      </span>
                    </TableCell>
                    <TableCell>
                      {ing.currentStock < lowStockThreshold ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          ใกล้หมด
                        </Badge>
                      ) : (
                        <Badge variant="success">เพียงพอ</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStock(ing)}
                        >
                          อัปเดตสต็อก
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEdit(ing)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDelete(ing.id)}
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
            <DialogTitle>แก้ไขวัตถุดิบ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อวัตถุดิบ</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>หน่วยนับ</Label>
              <Input
                value={formData.unit}
                onChange={(e) =>
                  setFormData({ ...formData, unit: e.target.value })
                }
              />
            </div>
            <div>
              <Label>URL รูปภาพ</Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) =>
                  setFormData({ ...formData, imageUrl: e.target.value })
                }
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

      {/* Stock Update Dialog */}
      <Dialog open={isStockOpen} onOpenChange={setIsStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>อัปเดตสต็อก</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">วัตถุดิบ</p>
              <p className="font-medium">{selectedIngredient?.name}</p>
            </div>
            <div>
              <Label>สต็อกปัจจุบัน</Label>
              <Input
                disabled
                type="number"
                value={selectedIngredient?.currentStock || 0}
              />
            </div>
            <div>
              <Label>สต็อกใหม่</Label>
              <Input
                type="number"
                value={stockValue}
                onChange={(e) => setStockValue(Number(e.target.value))}
                placeholder="ระบุสต็อกใหม่"
              />
            </div>
            <div>
              <Label>เหตุผล <span className="text-red-500">*</span></Label>
              <Input
                type="text"
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
                placeholder="เช่น รับของเข้าคลัง, นับสต็อก, วัตถุดิบหมดอายุ"
              />
            </div>
            {stockValue !== (selectedIngredient?.currentStock || 0) && (
              <div className="text-sm text-gray-500">
                ปรับเปลี่ยน: <span className={stockValue > (selectedIngredient?.currentStock || 0) ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                  {stockValue > (selectedIngredient?.currentStock || 0) ? "+" : ""}{stockValue - (selectedIngredient?.currentStock || 0)} {selectedIngredient?.unit}
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsStockOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button className="flex-1" onClick={handleUpdateStock}>
                บันทึก
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
