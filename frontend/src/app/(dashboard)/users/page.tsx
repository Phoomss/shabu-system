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
import { Plus, Edit, Trash2, Search, User as UserIcon, Shield, CheckCircle, XCircle } from "lucide-react";
import type { User, Role } from "@/types";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    roleId: "",
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get("/users").catch(() => ({ data: { data: [] } })),
        api.get("/role").catch(() => ({ data: { data: [] } })),
      ]);
      setUsers(usersRes.data.data || []);
      setRoles(rolesRes.data.data || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.fullName || !formData.roleId) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error("กรุณากรอกรหัสผ่าน");
      return;
    }

    try {
      const data: any = {
        username: formData.username,
        fullName: formData.fullName,
        roleId: parseInt(formData.roleId),
        isActive: formData.isActive,
      };

      if (formData.password) {
        data.password = formData.password;
      }

      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, data);
        toast.success("อัปเดตผู้ใช้สำเร็จ");
      } else {
        await api.post("/users", data);
        toast.success("เพิ่มผู้ใช้สำเร็จ");
      }

      setIsAddDialogOpen(false);
      setEditingUser(null);
      setFormData({ username: "", password: "", fullName: "", roleId: "", isActive: true });
      fetchData();
    } catch (error: any) {
      console.error("Failed to save user:", error);
      toast.error(error.response?.data?.message || "บันทึกไม่สำเร็จ");
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: "",
      fullName: user.fullName,
      roleId: user.role.id.toString(),
      isActive: user.isActive,
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("ต้องการลบผู้ใช้นี้หรือไม่?")) return;

    try {
      await api.delete(`/users/${userId}`);
      toast.success("ลบผู้ใช้สำเร็จ");
      fetchData();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast.error("ไม่สามารถลบได้");
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      toast.success(user.isActive ? "ปิดการใช้งานผู้ใช้" : "เปิดการใช้งานผู้ใช้");
      fetchData();
    } catch (error: any) {
      console.error("Failed to toggle active:", error);
      toast.error("ไม่สามารถอัปเดตได้");
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h1 className="text-2xl font-bold">จัดการผู้ใช้</h1>
          <p className="text-gray-500">จัดการผู้ใช้งานระบบและสิทธิ์</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingUser(null);
            setFormData({ username: "", password: "", fullName: "", roleId: "", isActive: true });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              เพิ่มผู้ใช้
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">ชื่อผู้ใช้</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="เช่น john.doe"
                />
              </div>
              <div>
                <Label htmlFor="fullName">ชื่อเต็ม</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="เช่น John Doe"
                />
              </div>
              <div>
                <Label htmlFor="password">
                  รหัสผ่าน {editingUser && "(เว้นว่างไว้หากไม่เปลี่ยน)"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <Label htmlFor="role">บทบาท</Label>
                <Select
                  value={formData.roleId}
                  onValueChange={(value) => setFormData({ ...formData, roleId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกบทบาท" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive">ใช้งาน</Label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingUser(null);
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
              placeholder="ค้นหาด้วยชื่อผู้ใช้หรือชื่อเต็ม..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>ผู้ใช้ทั้งหมด ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ผู้ใช้</TableHead>
                  <TableHead>ชื่อเต็ม</TableHead>
                  <TableHead>บทบาท</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <UserIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-gray-500">ไม่พบผู้ใช้</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-xs text-gray-500">ID: {user.id.slice(-8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.fullName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Shield className="h-3 w-3" />
                          {user.role.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            ใช้งาน
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            ไม่ใช้งาน
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleActive(user)}
                          >
                            {user.isActive ? "ปิด" : "เปิด"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
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
