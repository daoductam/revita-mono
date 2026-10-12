// Mode Selection Component

import React from 'react';
import { AppMode } from '../types';

interface ModeSelectionProps {
  onSelectMode: (mode: AppMode) => void;
}

const ModeSelection: React.FC<ModeSelectionProps> = ({ onSelectMode }) => {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-full">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Desktop Counter System
          </h1>
          <p className="text-xl text-gray-600">
            Chọn chế độ hoạt động
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Quầy tiếp nhận */}
          <div 
            className="cursor-pointer border-2 border-gray-200 p-8 hover:border-gray-400 transition-colors"
            onClick={() => onSelectMode('counter')}
          >
            <div className="text-center">
              <h2 className="text-3xl font-semibold text-gray-900 mb-4">
                Quầy Tiếp Nhận
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Quản lý hàng đợi bệnh nhân
              </p>
              <ul className="text-base text-gray-600 text-left space-y-2">
                <li>• Gọi bệnh nhân tiếp theo</li>
                <li>• Bỏ qua bệnh nhân</li>
                <li>• Xem hàng đợi real-time</li>
                <li>• Nhận thông báo ticket mới</li>
              </ul>
            </div>
          </div>

          {/* Phòng khám */}
          <div 
            className="cursor-pointer border-2 border-gray-200 p-8 hover:border-gray-400 transition-colors"
            onClick={() => onSelectMode('clinic')}
          >
            <div className="text-center">
              <h2 className="text-3xl font-semibold text-gray-900 mb-4">
                Phòng Khám
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Quản lý bệnh nhân trong phòng khám
              </p>
              <ul className="text-base text-gray-600 text-left space-y-2">
                <li>• Xem danh sách bệnh nhân</li>
                <li>• Cập nhật trạng thái khám</li>
                <li>• Hoàn thành khám bệnh</li>
                <li>• Quản lý lịch trình</li>
              </ul>
            </div>
          </div>

          {/* Kiosk bốc số */}
          <div 
            className="cursor-pointer border-2 border-gray-200 p-8 hover:border-gray-400 transition-colors"
            onClick={() => onSelectMode('kiosk')}
          >
            <div className="text-center">
              <h2 className="text-3xl font-semibold text-gray-900 mb-4">
                Kiosk Bốc Số
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Bệnh nhân tự thao tác để lấy số
              </p>
              <ul className="text-base text-gray-600 text-left space-y-2">
                <li>• Nhập tên, tuổi, giới tính</li>
                <li>• Chọn ưu tiên: mang thai/khuyết tật/VIP</li>
                <li>• Hỗ trợ mã hồ sơ, lịch khám, QR</li>
                <li>• Hiển thị phiếu khám sau khi bốc số</li>
              </ul>
            </div>
          </div>

          {/* Xác nhận bắt đầu dịch vụ */}
          <div 
            className="cursor-pointer border-2 border-gray-200 p-8 hover:border-gray-400 transition-colors"
            onClick={() => onSelectMode('start-services')}
          >
            <div className="text-center">
              <h2 className="text-3xl font-semibold text-gray-900 mb-4">
                Xác nhận bắt đầu dịch vụ
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Quét mã phiếu chỉ định và khởi động dịch vụ
              </p>
              <ul className="text-base text-gray-600 text-left space-y-2">
                <li>• Quét mã PR-/APT- của phiếu chỉ định</li>
                <li>• Xem số dịch vụ đang chờ</li>
                <li>• Nhấn xác nhận để bắt đầu</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeSelection;
