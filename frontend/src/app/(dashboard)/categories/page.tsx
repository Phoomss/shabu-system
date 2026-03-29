"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit, Trash2, Search, BookOpen } from "lucide-react";

interface Category {
  id: number;
  name: string;
  iconUrl?: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    iconUrl: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/categories").catch(() => ({ data: { data: [] } }));
      setCategories(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("กรุณากรอกชื่อหมวดหมู่");
      return;
    }

    try {
      if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, formData);
        toast.success("อัปเดตหมวดหมู่สำเร็จ");
      } else {
        await api.post("/categories", formData);
        toast.success("เพิ่มหมวดหมู่สำเร็จ");
      }

      setIsAddDialogOpen(false);
      setEditingCategory(null);
      setFormData({ name: "", iconUrl: "" });
      fetchData();
    } catch (error: any) {
      console.error("Failed to save category:", error);
      toast.error(error.response?.data?.message || "บันทึกไม่สำเร็จ");
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      iconUrl: category.iconUrl || "",
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (categoryId: number) => {
    if (!confirm("ต้องการลบหมวดหมู่นี้หรือไม่?")) return;

    try {
      await api.delete(`/categories/${categoryId}`);
      toast.success("ลบหมวดหมู่สำเร็จ");
      fetchData();
    } catch (error: any) {
      console.error("Failed to delete category:", error);
      toast.error("ไม่สามารถลบได้");
    }
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold">จัดการหมวดหมู่</h1>
          <p className="text-gray-500">จัดการหมวดหมู่เมนูอาหาร</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingCategory(null);
            setFormData({ name: "", iconUrl: "" });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              เพิ่มหมวดหมู่
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">ชื่อหมวดหมู่</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น เนื้อวัว, ลูกชิ้น, ผัก"
                />
              </div>
              <div>
                <Label htmlFor="iconUrl">URL ไอคอน (ถ้ามี)</Label>
                <Input
                  id="iconUrl"
                  value={formData.iconUrl}
                  onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                  placeholder="https://example.com/icon.png"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingCategory(null);
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
              placeholder="ค้นหาหมวดหมู่..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredCategories.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-gray-500">ไม่พบหมวดหมู่</p>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <Card key={category.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  {category.iconUrl ? (
                    <img src={category.iconUrl} alt={category.name} className="h-8 w-8" />
                  ) : (
                    <BookOpen className="h-6 w-6 text-gray-400" />
                  )}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(category)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() => handleDelete(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-medium text-center">{category.name}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
