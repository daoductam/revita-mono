import { ChatbotFAB } from "@/components/chatbot/ChatbotFAB";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default function DashboardPage() {
  return (
    <div className="bg-white py-6 px-8 space-y-6">
      {/* Header */}
      {/* <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Tổng quan hệ thống và thống kê</p>
        </div>
      </div> */}

      {/* Dashboard Client Component */}
      <DashboardClient />

      <ChatbotFAB />
    </div>
  );
}
