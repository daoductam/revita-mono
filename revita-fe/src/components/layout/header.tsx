"use client";

import Image from "next/image";
import Link from "next/link";
import { 
  User, 
  Settings, 
  LogOut, 
  Bell, 
  Shield,
  HelpCircle,
  LogIn,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { appointmentBookingApi, workSessionApi } from "@/lib/api";

type DoctorAppointment = {
  appointmentId?: string;
  appointmentCode?: string;
  code?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  createdAt?: string;
  patientName?: string;
  services?: Array<{ serviceName?: string }>;
  doctor?: { auth?: { name?: string } };
};

export function AppHeader() {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const [notifications, setNotifications] = useState(0);
  const [apptOpen, setApptOpen] = useState(false);
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [apptLoading, setApptLoading] = useState(false);

  const isDoctor = user?.role === 'DOCTOR';
  const isAdmin = user?.role === 'ADMIN';

  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  useEffect(() => {
    console.log("isAuthenticated",isAuthenticated);
    console.log("isLoading",isLoading);
    console.log("user",user);
  }, [user, isAuthenticated, isLoading]);

  useEffect(() => {
    const loadAppointments = async () => {
      if (!apptOpen) return;
      if (!isDoctor && !isAdmin) return;
      try {
        setApptLoading(true);
        let list: DoctorAppointment[] = [];
        if (isDoctor) {
          const res = await appointmentBookingApi.getDoctorAppointments();
          const data = res.data as unknown;
          list = Array.isArray(data) ? data as DoctorAppointment[] : ((data as { appointments?: DoctorAppointment[] })?.appointments ?? []);
        } else if (isAdmin) {
          // Admin: lấy lịch làm việc trong ngày và lọc Pending
          const res = await workSessionApi.getByDate(todayStr, { userType: 'DOCTOR' });
          const data = res.data as unknown;
          const sessions = Array.isArray(data) ? data : ((data as { data?: DoctorAppointment[]; workSessions?: DoctorAppointment[] })?.data ?? (data as { workSessions?: DoctorAppointment[] })?.workSessions ?? []);
          list = (sessions as DoctorAppointment[]).filter((s) => (s as { status?: string }).status === 'PENDING');
        }
        // Filter trong ngày
        const filtered = list.filter((a: DoctorAppointment) => {
          const date = a.date || a.createdAt || a.startTime || '';
          return typeof date === 'string' && date.startsWith(todayStr);
        });
        setAppointments(filtered);
        setNotifications(filtered.length);
      } catch (err) {
        console.error('Failed to load appointments for header bell:', err);
        setAppointments([]);
        setNotifications(0);
      } finally {
        setApptLoading(false);
      }
    };
    loadAppointments();
  }, [apptOpen, isDoctor, isAdmin, todayStr]);

  const handleLogout = async () => {
    await logout();
    // Redirect to homepage after logout
    window.location.href = '/';
  };

  const handleProfile = () => {
    // For sidebar-layout users (admin, doctor, receptionist, cashier), 
    // redirect to sidebar-layout profile page
    window.location.href = '/staff-profile';
  };

  const handleSettings = () => {
    // Implement settings navigation
    console.log("Settings clicked");
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Left side - Logo and App Name */}
      <div className="flex items-center gap-3">
        <Image 
          src="/logos/LogoRevita-v1-noneBG.png" 
          alt="Revita Logo" 
          width={40} 
          height={40}
          className="rounded-lg"
        />
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-gray-900">Revita</h1>
          <p className="text-xs text-gray-500">Hệ thống quản lý y tế</p>
        </div>
      </div>

      {/* Right side - Notifications and User Profile */}
      <div className="flex items-center gap-4">
        {/* Notifications - Only show for Doctor/Admin */}
        {isAuthenticated && !isLoading && (isDoctor || isAdmin) && (
          <DropdownMenu open={apptOpen} onOpenChange={setApptOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5 text-gray-600" />
                {notifications > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {notifications}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="font-medium flex items-center justify-between">
                <span>{isDoctor ? 'Lịch hẹn hôm nay' : 'Lịch làm việc chờ duyệt hôm nay'}</span>
                {apptLoading && <span className="text-xs text-gray-500">Đang tải...</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {appointments.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  {apptLoading ? 'Đang tải...' : 'Không có lịch hẹn nào'}
                </div>
              ) : (
                <div className="max-h-[250px] overflow-auto pr-1">
                  {appointments.map((a, idx) => {
                    const start = a.startTime || '';
                    const end = a.endTime || '';
                    const dateLabel = a.date
                      ? new Date(a.date).toLocaleDateString('vi-VN')
                      : (start ? new Date(start).toLocaleDateString('vi-VN') : todayStr);
                    const timeLabel = start ? `${start}${end ? `-${end}` : ''}` : (a.startTime || '');
                    const title = isDoctor ? (a.appointmentCode || a.code || 'Lịch hẹn') : (a.doctor?.auth?.name || 'Bác sĩ');
                    return (
                      <DropdownMenuItem key={a.appointmentId || a.code || a.appointmentCode || `appt-${idx}`} className="flex items-start gap-2 py-2">
                        <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{title}</div>
                          <div className="text-xs text-gray-600">
                            {dateLabel} · {timeLabel || (a.createdAt || '')}
                          </div>
                          {isDoctor && a.patientName && (
                            <div className="text-xs text-gray-600">BN: {a.patientName}</div>
                          )}
                          {a.services?.[0]?.serviceName && (
                            <div className="text-xs text-gray-600">{a.services[0].serviceName}</div>
                          )}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User Profile Dropdown or Login Button */}
        {isAuthenticated && user && !isLoading ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild >
              <Button variant="ghost" className="flex items-center gap-2 p-2 hover:bg-gray-100 ">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback className="bg-blue-100 text-blue-500 text-sm font-medium">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium text-gray-900">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.role === 'ADMIN' ? 'Quản trị viên' : user.role === 'DOCTOR' ? 'Bác sĩ' : user.role === 'RECEPTIONIST' ? 'Lễ tân' : user.role === 'PATIENT' ? 'Bệnh nhân' : user.role === 'CASHIER' ? 'Thu ngân' : 'Kỹ thuật'}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.role === 'ADMIN' ? 'Quản trị viên' : user.role === 'DOCTOR' ? 'Bác sĩ' : user.role === 'RECEPTIONIST' ? 'Lễ tân' : user.role === 'PATIENT' ? 'Bệnh nhân' : user.role === 'CASHIER' ? 'Thu ngân' : 'Kỹ thuật'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={handleProfile}>
                <User className="mr-2 h-4 w-4" />
                <span>Hồ sơ cá nhân</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={handleSettings}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Cài đặt</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem>
                <Shield className="mr-2 h-4 w-4" />
                <span>Bảo mật</span>
              </DropdownMenuItem>
              
              <DropdownMenuItem>
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Trợ giúp</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Đăng xuất</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : !isLoading ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/register">
                <span>Đăng ký</span>
              </Link>
            </Button>
            <Button asChild>
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                <span>Đăng nhập</span>
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
