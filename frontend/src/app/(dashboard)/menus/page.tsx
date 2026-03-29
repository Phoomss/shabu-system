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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Utensils,
  Filter,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { MenuItem } from "@/types";

export default function MenusPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    []
  );
  const [kitchenSections, setKitchenSections] = useState<
    { id: number; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterKitchen, setFilterKitchen] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    kitchenId: "",
    imageUrl: "",
    isAvailable: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [menuRes, categoriesRes, kitchenRes] = await Promise.all([
        api.get("/menu-items").catch(() => ({ data: { data: [] } })),
        api.get("/categories").catch(() => ({ data: { data: [] } })),
        api.get("/kitchen-sections").catch(() => ({ data: { data: [] } })),
      ]);

      setMenuItems(menuRes.data.data || []);
      setCategories(categoriesRes.data.data || []);
      setKitchenSections(kitchenRes.data.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.categoryId || !formData.kitchenId) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    try {
      await api.post("/menu-items", {
        ...formData,
        categoryId: parseInt(formData.categoryId),
        kitchenId: parseInt(formData.kitchenId),
      });

      toast.success("เพิ่มเมนูสำเร็จ");
      setIsAddDialogOpen(false);
      setFormData({ name: "", categoryId: "", kitchenId: "", imageUrl: "", isAvailable: true });
      fetchData();
    } catch (error: any) {
      console.error("Failed to add menu item:", error);
      toast.error(error.response?.data?.message || "เพิ่มเมนูไม่สำเร็จ");
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await api.patch(`/menu-items/${item.id}`, {
        isAvailable: !item.isAvailable,
      });
      toast.success(item.isAvailable ? "ปิดการขายเมนู" : "เปิดการขายเมนู");
      fetchData();
    } catch (error: any) {
      console.error("Failed to toggle availability:", error);
      toast.error("ไม่สามารถอัปเดตได้");
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.category.id.toString() === filterCategory;
    const matchesKitchen = filterKitchen === "all" || item.kitchen.id.toString() === filterKitchen;
    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "available" && item.isAvailable) ||
      (filterStatus === "unavailable" && !item.isAvailable);
    
    return matchesSearch && matchesCategory && matchesKitchen && matchesStatus;
  });

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
          <h1 className="text-2xl font-bold">จัดการเมนู</h1>
          <p className="text-gray-500">จัดการรายการอาหารและหมวดหมู่</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              เพิ่มเมนูใหม่
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มเมนูใหม่</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">ชื่อเมนู</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="เช่น เนื้อวัวพรีเมียม"
                />
              </div>
              <div>
                <Label htmlFor="category">หมวดหมู่</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, categoryId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="kitchen">แผนกครัว</Label>
                <Select
                  value={formData.kitchenId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, kitchenId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกแผนกครัว" />
                  </SelectTrigger>
                  <SelectContent>
                    {kitchenSections.map((section) => (
                      <SelectItem key={section.id} value={section.id.toString()}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="imageUrl">URL รูปภาพ</Label>
                <Input
                  id="imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, imageUrl: e.target.value })
                  }
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAvailable"
                  checked={formData.isAvailable}
                  onChange={(e) =>
                    setFormData({ ...formData, isAvailable: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="isAvailable">พร้อมจำหน่าย</Label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsAddDialogOpen(false)}
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
              placeholder="ค้นหาเมนู..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-base">ตัวกรอง</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="filter-category">หมวดหมู่</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger id="filter-category">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-kitchen">แผนกครัว</Label>
              <Select value={filterKitchen} onValueChange={setFilterKitchen}>
                <SelectTrigger id="filter-kitchen">
                  <SelectValue placeholder="เลือกแผนกครัว" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกแผนกครัว</SelectItem>
                  {kitchenSections.map((section) => (
                    <SelectItem key={section.id} value={section.id.toString()}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-status">สถานะ</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder="เลือกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="available">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      พร้อมจำหน่าย
                    </div>
                  </SelectItem>
                  <SelectItem value="unavailable">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-gray-500" />
                      หมด
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(filterCategory !== "all" || filterKitchen !== "all" || filterStatus !== "all") && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                พบ {filteredItems.length} จาก {menuItems.length} เมนู
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterCategory("all");
                  setFilterKitchen("all");
                  setFilterStatus("all");
                }}
              >
                ล้างตัวกรอง
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Menu Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายการเมนูทั้งหมด ({menuItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เมนู</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>แผนกครัว</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Utensils className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-gray-500">ไม่พบเมนู</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                              <Utensils className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.category.name}</TableCell>
                      <TableCell>{item.kitchen.name}</TableCell>
                      <TableCell>
                        <Badge variant={item.isAvailable ? "success" : "secondary"}>
                          {item.isAvailable ? "พร้อมจำหน่าย" : "หมด"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAvailability(item)}
                          >
                            {item.isAvailable ? "ปิด" : "เปิด"}
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
