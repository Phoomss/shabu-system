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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit, Trash2, Search, DollarSign, Clock } from "lucide-react";
import type { Tier } from "@/types";

export default function TiersPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    priceAdult: 0,
    priceChild: 0,
    timeLimit: 90,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/tiers").catch(() => ({ data: { data: [] } }));
      setTiers(res.data.data || []);
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
      toast.error("กรุณากรอกชื่อระดับราคา");
      return;
    }

    try {
      if (editingTier) {
        await api.patch(`/tiers/${editingTier.id}`, {
          ...formData,
          priceAdult: Number(formData.priceAdult),
          priceChild: Number(formData.priceChild),
          timeLimit: Number(formData.timeLimit),
        });
        toast.success("อัปเดตระดับราคาสำเร็จ");
      } else {
        await api.post("/tiers", {
          ...formData,
          priceAdult: Number(formData.priceAdult),
          priceChild: Number(formData.priceChild),
          timeLimit: Number(formData.timeLimit),
        });
        toast.success("เพิ่มระดับราคาสำเร็จ");
      }

      setIsAddDialogOpen(false);
      setEditingTier(null);
      setFormData({ name: "", priceAdult: 0, priceChild: 0, timeLimit: 90 });
      fetchData();
    } catch (error: any) {
      console.error("Failed to save tier:", error);
      toast.error(error.response?.data?.message || "บันทึกไม่สำเร็จ");
    }
  };

  const handleEdit = (tier: Tier) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      priceAdult: tier.priceAdult,
      priceChild: tier.priceChild,
      timeLimit: tier.timeLimit,
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (tierId: number) => {
    if (!confirm("ต้องการลบระดับราคานี้หรือไม่?")) return;

    try {
      await api.delete(`/tiers/${tierId}`);
      toast.success("ลบระดับราคาสำเร็จ");
      fetchData();
    } catch (error: any) {
      console.error("Failed to delete tier:", error);
      toast.error("ไม่สามารถลบได้");
    }
  };

  const filteredTiers = tiers.filter((tier) =>
    tier.name.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h1 className="text-2xl font-bold">จัดการระดับราคา</h1>
          <p className="text-gray-500">กำหนดราคาและเวลาทานของแต่ละระดับ</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingTier(null);
            setFormData({ name: "", priceAdult: 0, priceChild: 0, timeLimit: 90 });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              เพิ่มระดับราคา
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTier ? "แก้ไขระดับราคา" : "เพิ่มระดับราคาใหม่"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">ชื่อระดับ</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น Silver, Gold, Platinum"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priceAdult">ราคาผู้ใหญ่ (฿)</Label>
                  <Input
                    id="priceAdult"
                    type="number"
                    value={formData.priceAdult}
                    onChange={(e) => setFormData({ ...formData, priceAdult: Number(e.target.value) })}
                    placeholder="399"
                  />
                </div>
                <div>
                  <Label htmlFor="priceChild">ราคาเด็ก (฿)</Label>
                  <Input
                    id="priceChild"
                    type="number"
                    value={formData.priceChild}
                    onChange={(e) => setFormData({ ...formData, priceChild: Number(e.target.value) })}
                    placeholder="199"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="timeLimit">เวลาทาน (นาที)</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  value={formData.timeLimit}
                  onChange={(e) => setFormData({ ...formData, timeLimit: Number(e.target.value) })}
                  placeholder="90"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingTier(null);
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
              placeholder="ค้นหาชื่อระดับ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTiers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-gray-500">ไม่พบระดับราคา</p>
          </div>
        ) : (
          filteredTiers.map((tier) => (
            <Card key={tier.id} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(tier)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() => handleDelete(tier.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">ราคาผู้ใหญ่</p>
                    <p className="text-2xl font-bold text-red-600">฿{tier.priceAdult}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ราคาเด็ก</p>
                    <p className="text-2xl font-bold text-green-600">฿{tier.priceChild}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>เวลาทาน {tier.timeLimit} นาที</span>
                </div>
                <Badge variant="outline" className="w-full justify-center py-2">
                  {tier.timeLimit >= 120 ? "เวลาไม่จำกัด" : `จำกัด ${tier.timeLimit} นาที`}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
