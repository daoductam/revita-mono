'use client';

import { Button } from '@/components/ui/button';
import { CalendarPlus, RefreshCw } from 'lucide-react';

interface CalendarHeaderProps {
  loading?: boolean;
  onRefresh: () => void;
  onCreateNew: () => void;
  isAdmin?: boolean;
  selectedDoctorId?: string | null;
  onShowDoctorList?: () => void;
  onShowAdminAppointments?: () => void;
}

export function CalendarHeader({ 
  loading, 
  onRefresh, 
  onCreateNew, 
  isAdmin = false, 
  selectedDoctorId,
  onShowAdminAppointments,
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#35b8cf]">
          Quản lý lịch làm việc
        </h1>
        
        {isAdmin && selectedDoctorId && (
          <p className="text-sm text-[#35b8cf] font-medium">
            Đang xem lịch của bác sĩ đã chọn
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShowAdminAppointments}
            className="border-gray-300"
          >
            Lịch đã đặt
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="border-gray-300 hover:bg-gray-200 hover:text-black"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </Button>
        
        <Button
          onClick={onCreateNew}
          disabled={loading}
          className="bg-[#35b8cf] hover:bg-[#2a9bb5] text-white"
        >
          <CalendarPlus className="h-4 w-4 mr-2" />
          Tạo lịch mới
        </Button>
      </div>
    </div>
  );
}
