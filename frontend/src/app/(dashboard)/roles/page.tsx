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
import {
  Plus,
  Edit,
  Trash2,
  Shield,
  Users,
} from "lucide-react";
import type { Role, User } from "@/types";

export default function RolesPage() {
  const { user } = useAuthStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rolesRes, usersRes] = await Promise.all([
        api.get("/role"),
        api.get("/users"),
      ]);
      setRoles(rolesRes.data.data || []);
      setUsers(usersRes.data.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }

    try {
      await api.post("/role", { name });
      toast.success("สร้างบทบาทสำเร็จ");
      setIsCreateOpen(false);
      setName("");
      fetchData();
    } catch (error: any) {
      console.error("Failed to create role:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถสร้างได้");
    }
  };

  const handleUpdate = async () => {
    if (!selectedRole || !name.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }

    try {
      await api.patch(`/role/${selectedRole.id}`, { name });
      toast.success("อัปเดตบทบาทสำเร็จ");
      setIsEditOpen(false);
      setName("");
      setSelectedRole(null);
      fetchData();
    } catch (error: any) {
      console.error("Failed to update role:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถอัปเดตได้");
    }
  };

  const handleDelete = async (id: number) => {
    const userCount = users.filter((u) => u.role.id === id).length;
    if (userCount > 0) {
      toast.error(`ไม่สามารถลบได้ มี ${userCount} ผู้ใช้ที่ใช้บทบาทนี้`);
      return;
    }

    if (!confirm("ยืนยันการลบบทบาทนี้?")) return;

    try {
      await api.delete(`/role/${id}`);
      toast.success("ลบบทบาทสำเร็จ");
      fetchData();
    } catch (error: any) {
      console.error("Failed to delete role:", error);
      toast.error(error.response?.data?.message || "ไม่สามารถลบได้");
    }
  };

  const openEdit = (role: Role) => {
    setSelectedRole(role);
    setName(role.name);
    setIsEditOpen(true);
  };

  const getUserCount = (roleId: number) => {
    return users.filter((u) => u.role.id === roleId).length;
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จัดการบทบาท</h1>
          <p className="text-gray-500">กำหนดสิทธิ์และบทบาทของผู้ใช้</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              เพิ่มบทบาท
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มบทบาทใหม่</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>ชื่อบทบาท</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ADMIN, MANAGER, STAFF"
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">บทบาททั้งหมด</CardTitle>
            <Shield className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ผู้ใช้ทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Roles Table */}
      <Card className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>ชื่อบทบาท</TableHead>
                <TableHead>จำนวนผู้ใช้</TableHead>
                <TableHead>จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    ไม่พบบทบาท
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-mono">{role.id}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getUserCount(role.id)} คน</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(role)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(role.id)}
                          disabled={getUserCount(role.id) > 0}
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
            <DialogTitle>แก้ไขบทบาท</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อบทบาท</Label>
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
