/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ScanLine,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  FileCheck,
  Stethoscope,
  Users,
  PhoneCall,
  SkipForward,
  QrCode,
  Camera,
  CameraOff,
  Search,
  History
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { serviceProcessingService } from '@/lib/services/service-processing.service';
import { workSessionService } from '@/lib/services/work-session.service';
import type { WorkSession as WS } from '@/lib/types/work-session';
import {
  Prescription,
  PrescriptionService,
  ServiceStatus,
  WorkSession,
  GetMyServicesResponse
} from '@/lib/types/service-processing';

// Extended type for PrescriptionService with prescription info
type ServiceWithPrescription = PrescriptionService & {
  prescription?: {
    id: string;
    prescriptionCode: string;
    status: string;
    patientProfile: {
      id: string;
      name: string;
      dateOfBirth: string;
      gender: string;
    };
  };
};
import { UpdateResultsDialog } from '@/components/service-processing/UpdateResultsDialog';
import { CreatePrescriptionDialog } from '@/components/service-processing/CreatePrescriptionDialog';

// Helper: format time in Vietnam timezone (UTC+7) for display.
// Strip trailing Z in case backend returns UTC string but we need wall-clock display.
const parseAsLocalDate = (value: Date | string): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const normalized = value.endsWith('Z') ? value.slice(0, -1) : value;
    return new Date(normalized);
  }
  return new Date(value);
};

const formatVNTime = (date: Date | string, includeSeconds = false): string => {
  const d = parseAsLocalDate(date);
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {})
  });
  return formatter.format(d);
};

// Get current timestamp in Vietnam timezone (wall-clock UTC+7)
const getNowInVietnamMs = (): number => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});

  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
  ).getTime();
};

export default function ServiceProcessingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [prescriptionCode, setPrescriptionCode] = useState('');
  // const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  
  // QR Scanner states
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [scannerSupported, setScannerSupported] = useState<boolean | null>(null);
  const [scanHint, setScanHint] = useState<string>('Đang khởi động camera...');
  const [usingHtml5Qrcode, setUsingHtml5Qrcode] = useState(false);
  const qrVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const qrMediaStreamRef = React.useRef<MediaStream | null>(null);
  const qrHtml5QrCodeRef = React.useRef<Html5Qrcode | null>(null);
  const qrLastScanRef = React.useRef<string | null>(null);
  const qrLastScanTsRef = React.useRef<number>(0);
  const qrScanningRef = React.useRef(false);
  const [workSession, setWorkSession] = useState<WorkSession | null>(null);
  const [myServices, setMyServices] = useState<GetMyServicesResponse['services']>([]);
  const [loadingMyServices, setLoadingMyServices] = useState(false);
  const [updatingService, setUpdatingService] = useState<string | null>(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<PrescriptionService | null>(null);
  const [selectedPatientForResults, setSelectedPatientForResults] = useState<{
    patientProfileId: string;
    services: Array<{ prescriptionId: string; serviceId: string; serviceName: string; order: number; status: string }>;
  } | null>(null);
  const [shouldReschedule, setShouldReschedule] = useState(false);
  const [createPrescriptionDialogOpen, setCreatePrescriptionDialogOpen] = useState(false);
  const [selectedServiceForPrescription, setSelectedServiceForPrescription] = useState<ServiceWithPrescription | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [todaySessions, setTodaySessions] = useState<WS[]>([]);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [doctorSocket, setDoctorSocket] = useState<Socket | null>(null);
  const [technicianSocket, setTechnicianSocket] = useState<Socket | null>(null);
  const [queue, setQueue] = useState<{
    patients: Array<{
      patientProfileId: string;
      patientName: string;
      prescriptionCode: string;
      services: Array<{ id?: string; prescriptionId: string; serviceId: string; serviceName: string; order: number; status: string }>;
      overallStatus: 'SERVING' | 'PREPARING' | 'SKIPPED' | 'WAITING_RESULT' | 'RETURNING' | 'WAITING';
      queueOrder: number;
    }>;
    totalCount: number;
  } | null>(null);
  const [callingNext, setCallingNext] = useState(false);
  const [skippingPatient, setSkippingPatient] = useState<string | null>(null);

  // Load work session and my services on mount
  useEffect(() => {
    if (user?.id) {
      loadMyServices();
      // Load waiting queue
      (async () => {
        try {
          const q = await serviceProcessingService.getWaitingQueue();
          setQueue(q);
        } catch (e) {
          console.error('Error loading queue', e);
        }
      })();
    }
  }, [user?.id]);

  // Socket connection and event listeners
  useEffect(() => {
    if (!user?.id) return;

    // Only connect if Socket.IO URL is configured
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!socketUrl) {
      return;
    }
    
    // Extract base URL by removing any existing namespace
    // If URL is http://localhost:3000/doctors, base will be http://localhost:3000
    let baseSocketUrl = socketUrl.replace(/\/$/, ''); // Remove trailing slash
    // Remove common namespace paths if they exist
    baseSocketUrl = baseSocketUrl.replace(/\/(doctors|technicians|counters|booths|clinic-rooms)$/, '');
    
    // Validate URL format
    try {
      new URL(baseSocketUrl);
    } catch (e) {
      console.error('Invalid Socket.IO URL format:', baseSocketUrl);
      toast.error('Cấu hình Socket.IO URL không hợp lệ');
      return;
    }

    // Helper function to extract data from wrapper (if exists)
    const extractEventData = (payload: any) => {
      // Backend may send { type, data, timestamp } or just data directly
      if (payload && typeof payload === 'object' && 'data' in payload && 'type' in payload) {
        return payload.data;
      }
      return payload;
    };

    // Shared event handler for both doctor and technician
    const handleNewPrescriptionPatient = (payload: any) => {
      const data = extractEventData(payload);
      toast.info(`🔔 Có bệnh nhân mới: ${data.patientName} (${data.prescriptionCode})`);
      // Reload queue when new patient arrives
      serviceProcessingService.getWaitingQueue().then(setQueue).catch(console.error);
    };

    const handlePatientAction = (payload: any) => {
      const data = extractEventData(payload);
      
      if (data.action === 'CALLED') {
        toast.info(`📢 Bệnh nhân đã được gọi: ${data.patientName}`);
      } else if (data.action === 'SKIPPED') {
        toast.warning(`⏭️ Bệnh nhân đã bị bỏ qua: ${data.patientName}`);
      }
      
      // Reload queue when patient action occurs
      serviceProcessingService.getWaitingQueue().then(setQueue).catch(console.error);
    };

    const handlePatientStatusChanged = (payload: any) => {
      const data = extractEventData(payload);
      
      if (!data || !data.patientName) {
        console.error('Invalid socket data structure:', data);
        return;
      }
      
      // Reload queue when patient status changes (no toast to avoid spam)
      serviceProcessingService.getWaitingQueue().then(setQueue).catch(console.error);
    };

    // Connect to DOCTOR namespace
    const doctorSocketUrl = `${baseSocketUrl}/doctors`;
    const newDoctorSocket = io(doctorSocketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
    setDoctorSocket(newDoctorSocket);

    // Connect to TECHNICIAN namespace
    const technicianSocketUrl = `${baseSocketUrl}/technicians`;
    const newTechnicianSocket = io(technicianSocketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 5000,
    });
    setTechnicianSocket(newTechnicianSocket);

    // Keep backward compatibility - set main socket to doctor socket
    setSocket(newDoctorSocket);

    // Register event listeners for DOCTOR socket
    newDoctorSocket.on('new_prescription_patient', handleNewPrescriptionPatient);
    newDoctorSocket.on('patient_action', handlePatientAction);
    newDoctorSocket.on('patient_status_changed', handlePatientStatusChanged);
    newDoctorSocket.on('PATIENT_STATUS_CHANGED', handlePatientStatusChanged);

    // Register event listeners for TECHNICIAN socket
    newTechnicianSocket.on('new_prescription_patient', handleNewPrescriptionPatient);
    newTechnicianSocket.on('patient_action', handlePatientAction);
    newTechnicianSocket.on('patient_status_changed', handlePatientStatusChanged);
    newTechnicianSocket.on('PATIENT_STATUS_CHANGED', handlePatientStatusChanged);

    // Handle connection errors gracefully
    newDoctorSocket.on('connect_error', (error) => {
      console.error('Doctor socket connection error:', error.message);
    });

    newTechnicianSocket.on('connect_error', (error) => {
      console.error('Technician socket connection error:', error.message);
    });

    // Handle DOCTOR socket connection
    newDoctorSocket.on('connect', () => {
      if (!newDoctorSocket.connected) {
        console.error('Doctor socket connect event fired but socket.connected is false');
        return;
      }

      const socketId = newDoctorSocket.id;
      if (!socketId) {
        console.error('Doctor socket connect event fired but socket.id is missing');
        return;
      }
      
      // Join doctor room after successful connection
      newDoctorSocket.emit('join_doctor', { doctorId: user.id });
    });

    // Handle TECHNICIAN socket connection
    newTechnicianSocket.on('connect', () => {
      if (!newTechnicianSocket.connected) {
        console.error('Technician socket connect event fired but socket.connected is false');
        return;
      }

      const socketId = newTechnicianSocket.id;
      if (!socketId) {
        console.error('Technician socket connect event fired but socket.id is missing');
        return;
      }
      
      // Join technician room after successful connection
      newTechnicianSocket.emit('join_technician', { technicianId: user.id });
    });

    // Handle disconnect events
    newDoctorSocket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        toast.warning('Mất kết nối Socket.IO (Bác sĩ) - Đang thử kết nối lại...');
      }
    });

    newTechnicianSocket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        toast.warning('Mất kết nối Socket.IO (Kỹ thuật viên) - Đang thử kết nối lại...');
      }
    });

    // Handle reconnection success
    newDoctorSocket.on('reconnect', () => {
      newDoctorSocket.emit('join_doctor', { doctorId: user.id });
    });

    newTechnicianSocket.on('reconnect', () => {
      newTechnicianSocket.emit('join_technician', { technicianId: user.id });
    });

    // Cleanup on unmount
    return () => {
      if (newDoctorSocket.connected) {
        newDoctorSocket.disconnect();
      }
      if (newTechnicianSocket.connected) {
        newTechnicianSocket.disconnect();
      }
      setSocket(null);
      setDoctorSocket(null);
      setTechnicianSocket(null);
    };
  }, [user?.id]);
  const sortByStartTime = (a: WS, b: WS) =>
    parseAsLocalDate(a.startTime).getTime() - parseAsLocalDate(b.startTime).getTime();
  const toggleTodaySessions = async () => {
    try {
      if (!sessionsOpen) {
        const list = await workSessionService.getTodayMyWorkSessions();
        setTodaySessions([...list].sort(sortByStartTime));
      }
    } catch (e) {
      console.error('Error loading today work sessions', e);
      toast.error('Không thể tải phiên làm việc hôm nay');
    } finally {
      setSessionsOpen((o) => !o);
    }
  };

  const findFirstApproved = (sessions: WS[]) => sessions.find(ws => ws.status === 'APPROVED');
  const getFirstStartableApproved = (sessions: WS[]) => sessions.find(ws => ws.status === 'APPROVED' && !isOverdue(ws));

  const isOverdue = (ws: WS) => getNowInVietnamMs() > parseAsLocalDate(ws.endTime).getTime();

  const onStartSession = async (ws: WS) => {
    if (!window.confirm('Bạn có muốn bắt đầu phiên làm việc này không?')) return;
    try {
      setProcessingSessionId(ws.id);
      await workSessionService.updateStatus(ws.id, 'IN_PROGRESS');
      toast.success('Đã bắt đầu phiên làm việc');
      const list = await workSessionService.getTodayMyWorkSessions();
      setTodaySessions([...list].sort(sortByStartTime));
    } catch (e) {
      console.error('Start session failed', e);
      toast.error('Không thể bắt đầu phiên làm việc');
    } finally {
      setProcessingSessionId(null);
    }
  };

  const onCompleteSession = async (ws: WS) => {
    if (!window.confirm('Bạn có muốn hoàn thành phiên làm việc này không?')) return;
    try {
      setProcessingSessionId(ws.id);
      await workSessionService.updateStatus(ws.id, 'COMPLETED');
      toast.success('Đã hoàn thành phiên làm việc');
      const list = await workSessionService.getTodayMyWorkSessions();
      setTodaySessions([...list].sort(sortByStartTime));
    } catch (e) {
      console.error('Complete session failed', e);
      toast.error('Không thể hoàn thành phiên làm việc');
    } finally {
      setProcessingSessionId(null);
    }
  };

  const loadMyServices = async () => {
    setLoadingMyServices(true);
    try {
      const response = await serviceProcessingService.getMyServices({
        limit: 50,
        offset: 0
      });
      
      if (response && response.services) {
        setMyServices(response.services);
      } else {
        console.error('Invalid response structure:', response);
        toast.error('Dữ liệu trả về không đúng định dạng');
      }
    } catch (error: any) {
      console.error('Error loading my services:', error);
      toast.error(error.response?.data?.message || 'Không thể tải danh sách dịch vụ của bạn');
    } finally {
      setLoadingMyServices(false);
    }
  };

  const handleCallNextPatient = async () => {
    setCallingNext(true);
    try {
      const response = await serviceProcessingService.callNextPatient();
      
      // Check if response indicates success
      if (response && typeof response === 'object' && 'success' in response) {
        if (response.success) {
          toast.success(response.message || 'Đã gọi bệnh nhân tiếp theo');
        } else {
          toast.warning(response.message || 'Không thể gọi bệnh nhân tiếp theo');
        }
      } else {
      toast.success('Đã gọi bệnh nhân tiếp theo');
      }
      
      // Small delay to ensure backend has processed the update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reload queue after calling
      const q = await serviceProcessingService.getWaitingQueue();
      setQueue(q);
      
      // Also reload my services to reflect status changes
      await loadMyServices();
    } catch (error: any) {
      console.error('Error calling next patient:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Không thể gọi bệnh nhân tiếp theo';
      toast.error(errorMessage);
      
      // Still try to reload queue even on error
      try {
        const q = await serviceProcessingService.getWaitingQueue();
        setQueue(q);
      } catch (reloadError) {
        console.error('Error reloading queue after error:', reloadError);
      }
    } finally {
      setCallingNext(false);
    }
  };

  const handleSkipPatient = async (prescriptionId: string, serviceId: string) => {
    // Kiểm tra số lượng bệnh nhân trước khi skip
    if (queue && queue.totalCount <= 1) {
      toast.warning('Không thể bỏ qua bệnh nhân này vì đây là bệnh nhân duy nhất trong hàng chờ');
      return;
    }

    // Kiểm tra xem bệnh nhân có đang SERVING không
    const patient = queue?.patients.find(p => 
      p.services.some(s => s.prescriptionId === prescriptionId && s.serviceId === serviceId)
    );
    if (patient && (patient.overallStatus === 'SERVING' || patient.services.some(s => s.status === 'SERVING'))) {
      toast.warning('Không thể bỏ qua bệnh nhân đang được phục vụ');
      return;
    }

    const skipKey = `${prescriptionId}-${serviceId}`;
    setSkippingPatient(skipKey);
    try {
      const result: any = await serviceProcessingService.skipPatient(prescriptionId, serviceId);
      
      // Kiểm tra response từ backend
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success === false) {
          toast.warning((result as any).message || 'Không thể bỏ qua bệnh nhân');
        } else {
          toast.success((result as any).message || 'Đã bỏ qua bệnh nhân');
          // Đợi một chút để backend xử lý xong việc rebuild queue
          await new Promise(resolve => setTimeout(resolve, 300));
          // Reload queue after skipping để cập nhật thứ tự mới
          const q = await serviceProcessingService.getWaitingQueue();
          setQueue(q);
        }
      } else {
        toast.success('Đã bỏ qua bệnh nhân');
        // Đợi một chút để backend xử lý xong việc rebuild queue
        await new Promise(resolve => setTimeout(resolve, 300));
        // Reload queue after skipping để cập nhật thứ tự mới
        const q = await serviceProcessingService.getWaitingQueue();
        setQueue(q);
      }
    } catch (error: any) {
      console.error('Error skipping patient:', error);
      const errorMessage = error.response?.data?.message || 'Không thể bỏ qua bệnh nhân';
      // Nếu là lỗi về số lượng bệnh nhân, hiển thị warning thay vì error
      if (errorMessage.includes('duy nhất') || errorMessage.includes('1 bệnh nhân')) {
        toast.warning(errorMessage);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSkippingPatient(null);
    }
  };

  const handleScanPrescription = async (code?: string) => {
    const codeToScan = code || prescriptionCode.trim();
    if (!codeToScan) {
      toast.error('Vui lòng nhập mã phiếu chỉ định');
      return;
    }

    setScanning(true);
    try {
      const response = await serviceProcessingService.scanPrescription(codeToScan);
      setPrescription(response.prescription);
      toast.success('Quét phiếu chỉ định thành công');
    } catch (error: any) {
      console.error('Error scanning prescription:', error);
      toast.error(error.response?.data?.message || 'Không thể quét phiếu chỉ định');
      setPrescription(null);
    } finally {
      setScanning(false);
    }
  };

  // QR Scanner handlers
  const stopQrScanner = React.useCallback(async () => {
    setQrScanning(false);
    qrScanningRef.current = false;
    setUsingHtml5Qrcode(false);
    
    // Stop html5-qrcode if running
    if (qrHtml5QrCodeRef.current) {
      try {
        await qrHtml5QrCodeRef.current.stop();
        await qrHtml5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('[QR] Error stopping html5-qrcode:', e);
      }
      qrHtml5QrCodeRef.current = null;
    }
    
    // Stop media stream
    const stream = qrMediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      qrMediaStreamRef.current = null;
    }
    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
  }, []);

  const handleQrText = React.useCallback(async (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    
    const upper = trimmed.toUpperCase();
    
    // Parse mã prescription code từ format: PRE:PRE-xxx|... hoặc PRE-xxx|... hoặc PR-xxx|...
    let prescriptionCode = trimmed;
    
    // Kiểm tra nếu có format PRE:PRE-xxx hoặc PRE:PR-xxx
    if (trimmed.includes(':')) {
      const parts = trimmed.split('|');
      // Lấy phần đầu tiên (PRE:PRE-xxx)
      const firstPart = parts[0] || '';
      if (firstPart.includes(':')) {
        // Tách theo dấu : để lấy mã prescription code
        const codeParts = firstPart.split(':');
        if (codeParts.length >= 2) {
          prescriptionCode = codeParts[1].trim();
        }
      }
    } else {
      // Nếu không có format đặc biệt, lấy phần đầu trước dấu |
      const codeParts = trimmed.split('|');
      prescriptionCode = codeParts[0]?.trim() || trimmed;
    }
    
    setScanHint(`Đã quét mã: ${prescriptionCode.slice(0, 24)}${prescriptionCode.length > 24 ? '...' : ''}`);
    
    // Kiểm tra nếu mã bắt đầu bằng PRE hoặc PR
    if (!upper.startsWith('PRE') && !upper.startsWith('PR-')) {
      toast.error('Mã QR không phải mã phiếu chỉ định (PRE... hoặc PR-...)');
      setScanHint('Mã QR không đúng định dạng');
      return;
    }
    
    // Điền mã vào input
    setPrescriptionCode(prescriptionCode);
    toast.success(`Đã quét mã: ${prescriptionCode}`);
    
    // Đóng scanner sau khi quét thành công
    setTimeout(() => {
      setIsQrScannerOpen(false);
      stopQrScanner();
      
      // Tự động tìm kiếm sau khi đóng scanner
      setTimeout(async () => {
        const codeToScan = prescriptionCode;
        if (!codeToScan) {
          toast.error('Vui lòng nhập mã phiếu chỉ định');
          return;
        }

        setScanning(true);
        try {
          const response = await serviceProcessingService.scanPrescription(codeToScan);
          setPrescription(response.prescription);
          toast.success('Quét phiếu chỉ định thành công');
        } catch (error: any) {
          console.error('Error scanning prescription:', error);
          toast.error(error.response?.data?.message || 'Không thể quét phiếu chỉ định');
          setPrescription(null);
        } finally {
          setScanning(false);
        }
      }, 200); // Small delay to ensure scanner is fully closed
    }, 500);
  }, [stopQrScanner]);

  const startQrScanner = React.useCallback(async () => {
    setQrScanning(true);
    qrScanningRef.current = true;
    setScanHint('Đang khởi động camera...');
    
    try {
      // Prefer back camera; fallback to any camera
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: { ideal: 'environment' } }
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch {
          throw new Error('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.');
        }
      }
      
      console.log('[QR] Got media stream:', !!stream);
      qrMediaStreamRef.current = stream;
      const video = qrVideoRef.current;
      if (!video) {
        return;
      }
      
      video.srcObject = stream;
      await video.play();

      // Wait until video metadata is ready
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          const onLoaded = () => { resolve(); };
          video.addEventListener('loadeddata', onLoaded, { once: true });
        });
      }
      
      setScanHint('Camera đã sẵn sàng. Đưa mã QR vào khung...');

      // Try BarcodeDetector first
      interface BarcodeDetectorInterface {
        detect(image: HTMLVideoElement): Promise<Array<{ rawValue?: string; rawValueText?: string; raw?: string }>>;
      }
      
      const BD = (window as { BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorInterface }).BarcodeDetector;
      const isBarcodeDetectorSupported = typeof BD !== 'undefined';
      
      if (isBarcodeDetectorSupported) {
        setUsingHtml5Qrcode(false);
        let detector: BarcodeDetectorInterface | null = null;
        try {
          detector = new BD({ formats: ['qr_code'] });
        } catch {
          try {
            detector = new BD();
          } catch (e) {
          }
        }
        
        if (detector) {
          const tick = async () => {
            if (!qrScanningRef.current || !qrVideoRef.current) {
              return;
            }
            
            try {
              const detections = await detector!.detect(qrVideoRef.current);
              if (detections && detections.length > 0) {
                const raw = (detections[0]?.rawValue ?? detections[0]?.rawValueText ?? detections[0]?.raw ?? '').toString();
                if (raw) {
                  const norm = raw.trim();
                  const now = Date.now();
                  // Debounce
                  if (qrLastScanRef.current === norm && now - qrLastScanTsRef.current < 1500) {
                    // skip duplicate
                  } else {
                    qrLastScanRef.current = norm;
                    qrLastScanTsRef.current = now;
                    await handleQrText(norm);
                  }
                }
              }
            } catch (err) {
              console.warn('[QR] detect error:', err);
            }
            
            if (qrScanningRef.current) {
              requestAnimationFrame(tick);
            }
          };
          
          setScanHint('Đưa mã QR vào trong khung...');
          requestAnimationFrame(tick);
          return;
        }
      }
      
      // Fallback to html5-qrcode
      try {
        setScannerSupported(true);
        setUsingHtml5Qrcode(true);
        setScanHint('Đang khởi động bộ quét QR...');
        
        // Stop the current video stream
        if (qrMediaStreamRef.current) {
          qrMediaStreamRef.current.getTracks().forEach(t => t.stop());
          qrMediaStreamRef.current = null;
        }
        if (qrVideoRef.current) {
          qrVideoRef.current.srcObject = null;
        }
        
        const html5QrCode = new Html5Qrcode('prescription-qr-reader');
        qrHtml5QrCodeRef.current = html5QrCode;
        
        const qrCodeSuccessCallback = async (decodedText: string) => {
          const norm = decodedText.trim();
          const now = Date.now();
          
          // Debounce
          if (qrLastScanRef.current === norm && now - qrLastScanTsRef.current < 1500) {
            return;
          }
          
          qrLastScanRef.current = norm;
          qrLastScanTsRef.current = now;
          await handleQrText(norm);
        };
        
        const qrCodeErrorCallback = (errorMessage: string) => {
          // Ignore common "not found" errors
          if (!errorMessage.includes('No QR code found') && !errorMessage.includes('NotFoundException')) {
            // Keep scanning
          }
        };
        
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
        };
        
        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          );
        } catch {
          try {
            await html5QrCode.start(
              { facingMode: 'user' },
              config,
              qrCodeSuccessCallback,
              qrCodeErrorCallback
            );
          } catch {
            try {
              const cameras = await Html5Qrcode.getCameras();
              const cameraId = cameras[0]?.id;
              if (cameraId) {
                await html5QrCode.start(
                  cameraId,
                  config,
                  qrCodeSuccessCallback,
                  qrCodeErrorCallback
                );
              } else {
                throw new Error('Không tìm thấy camera');
              }
            } catch (finalError) {
              console.error('[QR] All camera options failed:', finalError);
              throw finalError;
            }
          }
        }
        
        setScanHint('Đưa mã QR vào trong khung...');
      } catch (html5Error) {
        console.error('[QR] html5-qrcode failed:', html5Error);
        setScannerSupported(false);
        const error = html5Error instanceof Error ? html5Error : new Error('Không thể khởi động bộ quét QR');
        toast.error(`Không thể khởi động quét QR: ${error.message}`);
        setScanHint('Lỗi khởi động bộ quét QR');
      }
    } catch (e) {
      setQrScanning(false);
      qrScanningRef.current = false;
      const error = e instanceof Error ? e : new Error('Không thể truy cập camera');
      console.error('[QR] getUserMedia error:', error);
      toast.error(error.message || 'Không thể truy cập camera');
      setScanHint('Lỗi khởi động camera');
    }
  }, [handleQrText]);

  // Handle QR scanner dialog open/close
  React.useEffect(() => {
    if (isQrScannerOpen) {
      setTimeout(() => {
        startQrScanner();
      }, 100);
    } else {
      stopQrScanner();
    }
    
    return () => {
      stopQrScanner();
    };
  }, [isQrScannerOpen, startQrScanner, stopQrScanner]);

  // Helper function to get prescriptionServiceId from multiple sources
  const getPrescriptionServiceIdFromQueue = async (
    prescriptionId: string,
    serviceId: string
  ): Promise<string | null> => {
    // First, try to find in myServices
    const foundInMyServices = myServices.find((s: any) => 
      s.prescriptionId === prescriptionId && s.serviceId === serviceId
    );
    if (foundInMyServices?.id) {
      return foundInMyServices.id;
    }

    // If not found, try to find in current prescription
    // Note: prescription object uses prescriptionCode, not prescriptionId
    // We need to match by serviceId only since we don't have prescriptionId in prescription object
    if (prescription) {
      const foundInPrescription = prescription.services.find((s: any) => 
        s.serviceId === serviceId
      );
      if (foundInPrescription?.id) {
        return foundInPrescription.id;
      }
    }

    // If still not found, try to scan prescription to get full data
    try {
      // Find prescription code from queue
      const patientInQueue = queue?.patients.find(p => 
        p.services.some(s => s.prescriptionId === prescriptionId && s.serviceId === serviceId)
      );
      if (patientInQueue?.prescriptionCode) {
        const scanResponse = await serviceProcessingService.scanPrescription(patientInQueue.prescriptionCode);
        const foundService = scanResponse.prescription.services.find((s: any) => 
          s.serviceId === serviceId
        );
        if (foundService?.id) {
          return foundService.id;
        }
      }
    } catch (e) {
      console.error('Error scanning prescription to get service ID:', e);
    }

    return null;
  };

  const handleUpdateServiceStatus = async (
    prescriptionServiceIdOrIds: string | { prescriptionId: string; serviceId: string },
    newStatus: ServiceStatus,
    note?: string
  ) => {
    let prescriptionServiceId: string;

    // If it's an object, we need to find the ID
    if (typeof prescriptionServiceIdOrIds === 'object') {
      const foundId = await getPrescriptionServiceIdFromQueue(
        prescriptionServiceIdOrIds.prescriptionId,
        prescriptionServiceIdOrIds.serviceId
      );
      if (!foundId) {
        toast.error('Không tìm thấy ID dịch vụ. Vui lòng làm mới trang.');
        return;
      }
      prescriptionServiceId = foundId;
    } else {
      prescriptionServiceId = prescriptionServiceIdOrIds;
    }

    setUpdatingService(prescriptionServiceId);
    try {
      const response = await serviceProcessingService.updateServiceStatus({
        prescriptionServiceId,
        status: newStatus,
        note
      });

      // Handle next service if exists (workflow progression)
      if (response.nextService) {
        toast.info(`Service tiếp theo đã được kích hoạt: ${response.nextService.service.name}`);
      }

      // Refresh prescription data if currently viewing one
      if (prescription) {
        const scanResponse = await serviceProcessingService.scanPrescription(prescription.prescriptionCode);
        setPrescription(scanResponse.prescription);
      }

      // Refresh my services list
      await loadMyServices();

      // Reload queue to reflect status changes
      try {
        const q = await serviceProcessingService.getWaitingQueue();
        setQueue(q);
      } catch (e) {
        console.error('Error reloading queue:', e);
      }

      toast.success(response.message || 'Cập nhật trạng thái thành công');
    } catch (error: any) {
      console.error('❌ Error updating service status:', error);
      toast.error(error.response?.data?.message || 'Không thể cập nhật trạng thái');
    } finally {
      setUpdatingService(null);
    }
  };

  const handleQuickStart = async (patientOrServiceId: {
    patientId: string;
    patientName: string;
    prescriptionCode: string;
    services: typeof myServices;
  } | string) => {

    // Handle individual service start (from prescription details)
    if (typeof patientOrServiceId === 'string') {
      // Legacy format: try to find service by id from myServices or prescription
      const serviceKey = patientOrServiceId;
      setUpdatingService(serviceKey);
      
      // Try to find service in myServices first
      const foundService = myServices.find(s => {
        const key = getPrescriptionServiceId(s);
        return key === serviceKey;
      });
      
      let prescriptionServiceId: string | undefined;
      
      if (foundService?.id) {
        prescriptionServiceId = foundService.id;
      } else if (prescription) {
        // Try to find in prescription
        const foundInPrescription = prescription.services.find(s => {
          const key = getPrescriptionServiceId(s);
          return key === serviceKey;
        });
        prescriptionServiceId = foundInPrescription?.id;
      }
      
      if (!prescriptionServiceId) {
        toast.error('Không tìm thấy ID dịch vụ. Vui lòng làm mới trang.');
        setUpdatingService(null);
        return;
      }
      
      try {
        const response = await serviceProcessingService.startService(prescriptionServiceId);

        // Handle next service if exists
        if (response.nextService) {
          toast.info(`Service tiếp theo đã được kích hoạt: ${response.nextService.service.name}`);
        }

        // Refresh data
        if (prescription) {
          const scanResponse = await serviceProcessingService.scanPrescription(prescription.prescriptionCode);
          setPrescription(scanResponse.prescription);
        }
        await loadMyServices();

        toast.success(response.message || 'Bắt đầu dịch vụ thành công');
      } catch (error: any) {
        console.error('❌ Error starting individual service:', error);
        toast.error(error.response?.data?.message || 'Không thể bắt đầu dịch vụ');
      } finally {
        setUpdatingService(null);
      }
      return;
    }

    // Handle patient batch start (from patient queue)
    const patient = patientOrServiceId;
    const waitingServices = patient.services.filter((s: any) => s.status === 'WAITING');

    if (waitingServices.length === 0) {
      toast.warning('Không có dịch vụ nào đang chờ để bắt đầu');
      return;
    }

    // Set updating state for all services
    waitingServices.forEach((service: any) => {
      setUpdatingService(getPrescriptionServiceId(service));
    });

    try {
      // Start all services concurrently
      const startPromises = waitingServices.map(async (service: any) => {
        if (!service.id) {
          throw new Error(`Service ${service.service.name} không có ID`);
        }
        return serviceProcessingService.startService(service.id);
      });

      const responses = await Promise.allSettled(startPromises);

      // Process results
      let successCount = 0;
      let errorCount = 0;

      responses.forEach((result: any) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          console.error('Failed to start service:', result.reason);
          errorCount++;
        }
      });

      // Show appropriate message
      if (successCount > 0) {
        toast.success(`Đã bắt đầu ${successCount} dịch vụ thành công${errorCount > 0 ? ` (${errorCount} thất bại)` : ''}`);
      }

      if (errorCount > 0) {
        toast.error(`Không thể bắt đầu ${errorCount} dịch vụ`);
      }

      // Refresh data
      if (prescription) {
        const scanResponse = await serviceProcessingService.scanPrescription(prescription.prescriptionCode);
        setPrescription(scanResponse.prescription);
      }
      await loadMyServices();

    } catch (error: any) {
      console.error('❌ Error starting services:', error);
      toast.error(error.response?.data?.message || 'Không thể bắt đầu dịch vụ');
    } finally {
      // Clear updating state for all services
      waitingServices.forEach(service => {
        setUpdatingService(null);
      });
    }
  };

  // Helper function to get prescription service ID
  const getPrescriptionServiceId = (serviceOrIds: any): string => {
    // Handle object with prescriptionId and serviceId
    if (serviceOrIds.prescriptionId && serviceOrIds.serviceId) {
      return `${serviceOrIds.prescriptionId}-${serviceOrIds.serviceId}`;
    }

    // Handle service object from API
    if (serviceOrIds.prescriptionId && serviceOrIds.serviceId) {
      return `${serviceOrIds.prescriptionId}-${serviceOrIds.serviceId}`;
    }

    // Handle service object with id field
    if (serviceOrIds.id) return serviceOrIds.id;

    // Handle string (already combined)
    if (typeof serviceOrIds === 'string') return serviceOrIds;

    return 'unknown';
  };

  // Helper function to get available actions based on service status
  const getActionButtons = (status: ServiceStatus) => {
    switch(status) {
      case 'WAITING':
        return ['start'];
      case 'SERVING':
        return ['complete', 'complete']; // Chờ kết quả và hoàn thành trực tiếp
      case 'WAITING_RESULT':
        return ['uploadResults']; // Chỉ cập nhật kết quả
      case 'COMPLETED':
        return [];
      default:
        return [];
    }
  };

  // Handle service actions based on status
  const handleServiceAction = (service: any, action: string) => {
    const { prescriptionId, serviceId, status } = service;

    switch(action) {
      case 'start':
        if (status === 'WAITING') {
          const serviceIdCombined = getPrescriptionServiceId(service);
          handleQuickStart(serviceIdCombined);
        }
        break;

      case 'complete':
        if (status === 'SERVING' && service.id) {
          handleUpdateServiceStatus(service.id, 'WAITING_RESULT', 'Chờ kết quả');
        } else if (!service.id) {
          toast.error('Không tìm thấy ID dịch vụ. Vui lòng làm mới trang.');
        }
        break;

      case 'uploadResults':
        if (status === 'WAITING_RESULT' || status === 'SERVING') {
          handleOpenResultsDialog(service);
        }
        break;

      default:
        console.warn('Unknown action:', action);
    }
  };

  const handleQuickComplete = async (serviceOrId: any) => {
    let prescriptionServiceId: string | undefined;
    let serviceKey: string;

    if (typeof serviceOrId === 'string') {
      // Legacy: try to find service by id from myServices or prescription
      serviceKey = serviceOrId;
      
      const foundService = myServices.find((s: any) => {
        const key = getPrescriptionServiceId(s);
        return key === serviceKey;
      });
      
      if (foundService?.id) {
        prescriptionServiceId = foundService.id;
      } else if (prescription) {
        const foundInPrescription = prescription.services.find((s: any) => {
          const key = getPrescriptionServiceId(s);
          return key === serviceKey;
        });
        prescriptionServiceId = foundInPrescription?.id;
      }
    } else {
      // New: use id from service object
      prescriptionServiceId = serviceOrId.id;
      serviceKey = getPrescriptionServiceId(serviceOrId);
    }

    if (!prescriptionServiceId) {
      toast.error('Không tìm thấy ID dịch vụ. Vui lòng làm mới trang.');
      return;
    }

    setUpdatingService(serviceKey);
    try {
      // Chuyển sang trạng thái chờ kết quả
      const response = await serviceProcessingService.completeService(prescriptionServiceId);

      // Refresh data
      if (prescription) {
        const scanResponse = await serviceProcessingService.scanPrescription(prescription.prescriptionCode);
        setPrescription(scanResponse.prescription);
      }
      await loadMyServices();

      toast.success('Hoàn thành dịch vụ thành công');
    } catch (error: any) {
      console.error('❌ Error completing service:', error);
      toast.error(error.response?.data?.message || 'Không thể hoàn thành dịch vụ');
    } finally {
      // handleUpdateServiceStatus đã clear updating state
    }
  };

  const handleOpenResultsDialog = async (service: PrescriptionService, reschedule = false) => {
    // If service is SERVING, first move it to WAITING_RESULT before opening dialog
    if (service.status === 'SERVING' && service.id) {
      try {
        await handleUpdateServiceStatus(service.id, 'WAITING_RESULT', 'Chờ kết quả');
        
        // Reload service data to get updated status
        if (prescription) {
          const scanResponse = await serviceProcessingService.scanPrescription(prescription.prescriptionCode);
          const updatedService = scanResponse.prescription.services.find(s => s.id === service.id);
          if (updatedService) {
            setSelectedService(updatedService);
            setShouldReschedule(reschedule);
            setResultsDialogOpen(true);
            return;
          }
        }
        
        // If not found in prescription, try myServices
        await loadMyServices();
        const updatedService = myServices.find(s => s.id === service.id);
        if (updatedService) {
          setSelectedService(updatedService);
          setShouldReschedule(reschedule);
          setResultsDialogOpen(true);
          return;
        }
        
        // Fallback: use original service but update status locally
        setSelectedService({ ...service, status: 'WAITING_RESULT' });
        setShouldReschedule(reschedule);
        setResultsDialogOpen(true);
      } catch (error: any) {
        console.error('Error moving service to WAITING_RESULT:', error);
        toast.error(error.response?.data?.message || 'Không thể chuyển dịch vụ sang chờ kết quả');
        return;
      }
    } else {
      // Service is already WAITING_RESULT or other status, open dialog directly
    setSelectedService(service);
    setShouldReschedule(reschedule);
    setResultsDialogOpen(true);
    }
  };

  // Handle opening results dialog from queue patient
  const handleOpenResultsDialogFromQueue = async (
    patientProfileId: string,
    prescriptionId: string,
    serviceId: string,
    serviceName: string,
    reschedule = false
  ) => {
    // Try to find full service data from myServices or prescription
    const foundService = myServices.find((s: any) => 
      s.prescriptionId === prescriptionId && s.serviceId === serviceId
    ) || prescription?.services.find((s: any) => s.serviceId === serviceId);

    // Create a service object for the dialog
    const serviceForDialog: PrescriptionService = foundService ? {
      ...foundService,
      id: foundService.id
    } : {
      prescriptionId,
      serviceId,
      service: {
        id: serviceId,
        name: serviceName,
        serviceCode: '',
        description: '',
        price: 0,
        timePerPatient: 0
      },
      status: 'WAITING_RESULT',
      order: 1,
      results: [],
      note: null,
      startedAt: null,
      completedAt: null
    };
    setSelectedService(serviceForDialog);
    setSelectedPatientForResults({
      patientProfileId,
      services: [{
        prescriptionId,
        serviceId,
        serviceName,
        order: 1,
        status: 'WAITING_RESULT'
      }]
    });
    setShouldReschedule(reschedule);
    setResultsDialogOpen(true);
  };

  const handleResultsUpdate = async () => {
    try {
      // Refresh data after results update
      if (prescription) {
        const response = await serviceProcessingService.scanPrescription(prescription.prescriptionCode);
        setPrescription(response.prescription);
      }
      await loadMyServices();
      
      // Reload queue to reflect status changes
      try {
        const q = await serviceProcessingService.getWaitingQueue();
        setQueue(q);
      } catch (e) {
        console.error('Error reloading queue:', e);
      }
      
      // Reset selected patient for results
      setSelectedPatientForResults(null);
    } catch (error: any) {
      console.error('Error refreshing data after results update:', error);
    }
  };

  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'WAITING':
        return 'bg-orange-100 text-orange-800';
      case 'SERVING':
        return 'bg-purple-100 text-purple-800';
      case 'WAITING_RESULT':
        return 'bg-cyan-100 text-cyan-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'DELAYED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      case 'NOT_STARTED':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: ServiceStatus) => {
    switch (status) {
      case 'PENDING':
        return 'Chờ thực hiện';
      case 'WAITING':
        return 'Đang chờ phục vụ';
      case 'SERVING':
        return 'Đang thực hiện';
      case 'WAITING_RESULT':
        return 'Chờ kết quả';
      case 'COMPLETED':
        return 'Hoàn thành';
      case 'DELAYED':
        return 'Trì hoãn';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'NOT_STARTED':
        return 'Chưa bắt đầu';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: ServiceStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'WAITING':
        return <Clock className="h-4 w-4" />;
      case 'SERVING':
        return <AlertCircle className="h-4 w-4" />;
      case 'WAITING_RESULT':
        return <Clock className="h-4 w-4" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4" />;
      case 'DELAYED':
        return <AlertCircle className="h-4 w-4" />;
      case 'CANCELLED':
        return <AlertCircle className="h-4 w-4" />;
      case 'NOT_STARTED':
        return <Clock className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Helper function to group services by patient
  const groupServicesByPatient = (services: typeof myServices) => {
    const patientMap = new Map();
    
    services.forEach(service => {
      const patientId = service.prescription.patientProfile.id;
      const patientName = service.prescription.patientProfile.name;
      const prescriptionCode = service.prescription.prescriptionCode;
      
      if (!patientMap.has(patientId)) {
        patientMap.set(patientId, {
          patientId,
          patientName,
          prescriptionCode,
          services: []
        });
      }
      
      patientMap.get(patientId).services.push(service);
    });
    
    return Array.from(patientMap.values());
  };

  // Patient Service Card Component
  const PatientServiceCard = ({
    patient,
    onQuickStart,
    onQuickComplete,
    onUpdateResults,
    updatingService,
    isFirstInQueue: _isFirstInQueue = false,
    showStartButton = true,
    showNextBadge = false,
    hideCard = false
  }: {
    patient: {
      patientId: string;
      patientName: string;
      prescriptionCode: string;
      services: typeof myServices;
    };
    onQuickStart?: (patientOrServiceId: {
      patientId: string;
      patientName: string;
      prescriptionCode: string;
      services: typeof myServices;
    } | string) => void;
    onQuickComplete?: (serviceOrId: any) => void;
    onUpdateResults?: (service: any) => void;
    updatingService: string | null;
    isFirstInQueue?: boolean;
    showStartButton?: boolean;
    showNextBadge?: boolean;
    hideCard?: boolean;
  }) => {
    const totalPrice = patient.services.reduce((sum, service) => sum + service.service.price, 0);
    
    // Nếu hideCard là true thì không render gì cả
    if (hideCard) {
      return null;
    }

    return (
      <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
        {/* Patient Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-lg">{patient.patientName}</h4>
            {showNextBadge && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                Kế tiếp
              </Badge>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">{totalPrice.toLocaleString()} đ</div>
            <div className="text-xs text-gray-500">{patient.services.length} dịch vụ</div>
          </div>
        </div>

        {/* Service Actions - Individual service buttons */}
        <div className="space-y-2 mb-3">
          {patient.services.map((service) => {
            const serviceKey = getPrescriptionServiceId(service);
            return (
              <div key={serviceKey} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
              <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">#{service.order}</span>
                  <span className="font-medium text-sm">{service.service.name}</span>
        </div>

                {/* Individual Service Actions */}
                <div className="flex gap-2">

                  {service.status === 'SERVING' && (
                    <>
            <Button
              size="sm"
                        onClick={() => {
                          if (!service.id) {
                            toast.error('Không tìm thấy ID dịch vụ. Vui lòng làm mới trang.');
                            return;
                          }
                          handleUpdateServiceStatus(service.id, 'WAITING_RESULT', 'Chờ kết quả');
                        }}
                        disabled={updatingService === serviceKey}
                        className="flex items-center gap-1 h-7 text-xs"
                      >
                        <Clock className="h-3 w-3" />
                        Chờ kết quả
            </Button>

            <Button
              size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!service.id) {
                            toast.error('Không tìm thấy ID dịch vụ. Vui lòng làm mới trang.');
                            return;
                          }
                          handleOpenResultsDialog(service, false);
                        }}
                        disabled={updatingService === serviceKey}
                        className="flex items-center gap-1 h-7 text-xs"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Hoàn thành
            </Button>
                    </>
          )}

                  {service.status === 'WAITING_RESULT' && onUpdateResults && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          handleOpenResultsDialog(service, false);
                        }}
                        className="flex items-center gap-1 h-7 text-xs"
                      >
                        <FileCheck className="h-3 w-3" />
                        Cập nhật kết quả
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          handleOpenResultsDialog(service, true);
                        }}
                        className="flex items-center gap-1 h-7 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        <Clock className="h-3 w-3" />
                        Hẹn lại
                      </Button>
                    </div>
                  )}

                  {/* Button to create new prescription for this service */}
                  {(service.status === 'NOT_STARTED' || service.status === 'WAITING' || service.status === 'SERVING' || service.status === 'PENDING' || service.status === 'WAITING_RESULT') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedServiceForPrescription(service);
                        setCreatePrescriptionDialogOpen(true);
                      }}
                      className="flex items-center gap-1 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      <FileText className="h-3 w-3" />
                      Tạo phiếu chỉ định
                    </Button>
                  )}

        </div>
              </div>
            );
          })}
        </div>

        {/* Bulk Actions - Start Services */}
        {(() => {
          const waitingServices = patient.services.filter(s => s.status === 'WAITING');

          return (
            <div className="flex justify-center gap-4 pt-2 border-t border-gray-200">
              {waitingServices.length > 0 && onQuickStart && showStartButton && (
                <Button
                  size="sm"
                  onClick={() => {
                    onQuickStart(patient);
                  }}
                  disabled={patient.services.some(s => updatingService === getPrescriptionServiceId(s))}
                  className="flex items-center gap-1"
                >
                  <Play className="h-3 w-3" />
                  {patient.services.some(s => updatingService === getPrescriptionServiceId(s)) ? 'Đang xử lý...' : 'Bắt đầu'}
                </Button>
              )}
            </div>
          );
        })()}

      </div>
    );
  };

  // const canUpdateStatus = (currentStatus: ServiceStatus, newStatus: ServiceStatus) => {
  //   const allowedTransitions: Record<ServiceStatus, ServiceStatus[]> = {
  //     'NOT_STARTED': ['PENDING', 'WAITING'],
  //     'PENDING': ['WAITING', 'SERVING', 'CANCELLED'],
  //     'WAITING': ['SERVING', 'CANCELLED'],
  //     'SERVING': ['WAITING_RESULT', 'COMPLETED', 'CANCELLED'],
  //     'WAITING_RESULT': ['COMPLETED', 'SERVING', 'CANCELLED'], // Can go back to SERVING for corrections
  //     'COMPLETED': [],
  //     'DELAYED': ['SERVING', 'CANCELLED'],
  //     'CANCELLED': []
  //   };

  //   return allowedTransitions[currentStatus]?.includes(newStatus) || false;
  // };

  return (
    <div className="container mx-auto px-8  py-6 space-y-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Stethoscope className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Xử lý dịch vụ</h1>
        </div>

        <div className="flex items-center gap-3 relative">
          <Button variant="outline" onClick={toggleTodaySessions}>
            Quản lý phiên làm việc
          </Button>
          {sessionsOpen && (
            <div className="absolute right-0 top-full mt-2 w-md max-h-96 overflow-auto bg-white border rounded-md shadow-lg z-20">
              <div className="px-4 py-2 border-b text-sm font-medium">Phiên hôm nay</div>
              {todaySessions.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">Không có phiên làm việc nào hôm nay</div>
              ) : (
                <div className="divide-y">
                  {todaySessions.map((ws) => (
                    <div key={ws.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{ws.booth?.room.roomName} - {ws.booth?.name}</div>
                        <Badge className="text-xs" variant={ws.status === 'IN_PROGRESS' ? 'default' : 'secondary'}>
                          {ws.status === 'IN_PROGRESS' ? 'Đang diễn ra' : ws.status === 'COMPLETED' ? 'Đã xong' : ws.status === 'PENDING' ? 'Chờ duyệt' : ws.status === 'APPROVED' ? 'Đã duyệt' : ws.status === 'CANCELED' ? 'Đã hủy' : ws.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatVNTime(ws.startTime)}
                        {' - '}
                        {formatVNTime(ws.endTime)}
                      </div>
                      {ws.status === 'APPROVED' && isOverdue(ws) && (
                        <div className="text-xs text-red-600 mt-1">Phiên làm việc đã quá hạn</div>
                      )}
                      {ws.services?.length > 0 && (
                        <div className="text-xs text-gray-600 mt-2 line-clamp-2">
                          {ws.services.map(s => s.service?.name || s.service.name).join(', ')}
                        </div>
                      )}
                      <div className="mt-2 flex gap-2">
                        {ws.status === 'APPROVED' && ws.id === getFirstStartableApproved(todaySessions)?.id && (
                          <Button size="sm" onClick={() => onStartSession(ws)} disabled={processingSessionId === ws.id}>
                            {processingSessionId === ws.id ? 'Đang xử lý...' : 'Bắt đầu'}
                          </Button>
                        )}
                        {ws.status === 'IN_PROGRESS' && (
                          <Button size="sm" variant="outline" onClick={() => onCompleteSession(ws)} disabled={processingSessionId === ws.id}>
                            {processingSessionId === ws.id ? 'Đang xử lý...' : 'Hoàn thành'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {workSession && (
            <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600">
                <div className="font-medium">Ca làm việc hiện tại:</div>
                <div>{workSession.booth.room.roomName} - {workSession.booth.name}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Work Session Info */}
      {workSession && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-green-600" />
              Thông tin ca làm việc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">Phòng</div>
                <div className="font-medium">{workSession.booth.room.roomName}</div>
                <div className="text-sm text-gray-500">{workSession.booth.room.roomCode}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Buồng</div>
                <div className="font-medium">{workSession.booth.name}</div>
                <div className="text-sm text-gray-500">{workSession.booth.boothCode}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Thời gian</div>
                <div className="font-medium">
                  {formatVNTime(workSession.startTime)} - {formatVNTime(workSession.endTime)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Prescription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="h-5 w-5 text-primary" />
            Quét phiếu chỉ định
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="prescriptionCode" className="pb-2.5">Mã phiếu chỉ định</Label>
              <Input
                id="prescriptionCode"
                placeholder="VD: PR-1756995889229-26DUNT hoặc PRE-..."
                value={prescriptionCode}
                onChange={(e) => {
                  setPrescriptionCode(e.target.value);
                  // Clear prescription when input is cleared
                  if (!e.target.value.trim()) {
                    setPrescription(null);
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleScanPrescription()}
              />
            </div>
            <Button
              onClick={() => setIsQrScannerOpen(true)}
              variant="outline"
              className="flex items-center gap-2"
              title=""
            >
              <QrCode className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleScanPrescription()}
              disabled={scanning}
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              {scanning ? 'Đang tìm...' : 'Tìm kiếm'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Prescription */}
      {prescription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-green-600" />
              Thông tin phiếu chỉ định
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prescription Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Mã phiếu</div>
                <div className="font-medium">{prescription.prescriptionCode}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Trạng thái</div>
                <Badge className={getStatusColor(prescription.status as ServiceStatus)}>
                  {getStatusText(prescription.status as ServiceStatus)}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-gray-600">Bệnh nhân</div>
                <div className="font-medium">{prescription.patientProfile.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Bác sĩ</div>
                <div className="font-medium">{prescription.doctor.name}</div>
              </div>
            </div>

            <Separator />

            {/* Services List */}
            <div className="space-y-3">
              <h3 className="font-medium">Dịch vụ ({prescription.services.length})</h3>
              {prescription.services.map((service) => (
                <div
                  key={getPrescriptionServiceId(service)}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Service Header with Status and Actions */}
                  <div className="flex items-center justify-between mb-3 p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(service.status)}
                      <Badge className={getStatusColor(service.status)}>
                        {getStatusText(service.status)}
                      </Badge>
                      <span className="text-sm text-gray-500">#{service.order}</span>
                      <span className="font-medium">{service.service.name}</span>
                  </div>

                  {/* Action Buttons */}
                    <div className="flex gap-2">
                      {(() => {
                        const actions = getActionButtons(service.status);
                        return (
                          <>
                            {actions.includes('start') && (
                      <Button
                        size="sm"
                                onClick={() => {
                                  handleServiceAction(service, 'start');
                                }}
                                disabled={updatingService === getPrescriptionServiceId(service)}
                                className="flex items-center gap-1 h-8"
                      >
                        <Play className="h-3 w-3" />
                        Bắt đầu
                      </Button>
                    )}

                            {actions.includes('complete') && (
                      <Button
                        size="sm"
                                onClick={() => {
                                  if (!service.id) {
                                    toast.error('Không tìm thấy ID dịch vụ. Vui lòng làm mới trang.');
                                    return;
                                  }
                                  handleUpdateServiceStatus(service.id, 'WAITING_RESULT', 'Chờ kết quả');
                                }}
                                disabled={updatingService === getPrescriptionServiceId(service)}
                                className="flex items-center gap-1 h-8"
                              >
                                <Clock className="h-3 w-3" />
                                Chờ kết quả
                      </Button>
                    )}

                            {actions.includes('uploadResults') && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    handleOpenResultsDialog(service, false);
                                  }}
                                  disabled={updatingService === getPrescriptionServiceId(service)}
                                  className="flex items-center gap-1 h-8"
                                >
                                  <FileCheck className="h-3 w-3" />
                                  Cập nhật kết quả
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    handleOpenResultsDialog(service, true);
                                  }}
                                  disabled={updatingService === getPrescriptionServiceId(service)}
                                  className="flex items-center gap-1 h-8 border-orange-300 text-orange-700 hover:bg-orange-50"
                                >
                                  <Clock className="h-3 w-3" />
                                  Hẹn lại
                                </Button>
                              </div>
                            )}

                            {/* Button to create new prescription for this service */}
                            {(service.status === 'NOT_STARTED' || service.status === 'WAITING' || service.status === 'SERVING' || service.status === 'PENDING' || service.status === 'WAITING_RESULT') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedServiceForPrescription(service);
                                  setCreatePrescriptionDialogOpen(true);
                                }}
                                disabled={updatingService === getPrescriptionServiceId(service)}
                                className="flex items-center gap-1 h-8 border-blue-300 text-blue-700 hover:bg-blue-50"
                              >
                                <FileText className="h-3 w-3" />
                                Tạo phiếu chỉ định
                              </Button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Service Details */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">{service.service.description}</p>
                    <p className="text-xs text-gray-500">{service.service.serviceCode}</p>
                  </div>

                  {/* Results */}
                  {service.results && service.results.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h5 className="font-medium text-sm mb-2">Kết quả:</h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {service.results.map((result, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-gray-400">•</span>
                            <span>{result}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waiting Queue (by patient) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-blue-600" />
              Hàng chờ hôm nay {queue ? `(${queue.totalCount})` : ''}
            </CardTitle>
            {queue && queue.patients.length > 0 && (() => {
              // Tính số lượng bệnh nhân trong hàng chờ thường (không phải WAITING_RESULT)
              const normalPatients = queue.patients.filter(p => 
                p.overallStatus !== 'WAITING_RESULT' && 
                !p.services.some(s => s.status === 'WAITING_RESULT')
              );
              const hasNormalPatients = normalPatients.length > 0;
              const firstNormalPatient = normalPatients[0];
              const isFirstServing = firstNormalPatient?.overallStatus === 'SERVING';
              
              return (
                <Button
                  onClick={handleCallNextPatient}
                  disabled={
                    callingNext || 
                    !hasNormalPatients ||
                    isFirstServing
                  }
                  className="flex items-center gap-2"
                  size="sm"
                  title={
                    !hasNormalPatients
                      ? 'Không có bệnh nhân trong hàng chờ thường'
                      : isFirstServing
                      ? 'Bệnh nhân đầu tiên đang được phục vụ, không thể gọi bệnh nhân tiếp theo'
                      : 'Gọi bệnh nhân tiếp theo'
                  }
                >
                  {callingNext ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Đang gọi...
                    </>
                  ) : (
                    <>
                      <PhoneCall className="h-4 w-4" />
                      Gọi bệnh nhân tiếp theo
                    </>
                  )}
                </Button>
              );
            })()}
          </div>
        </CardHeader>
        <CardContent>
          {!queue || queue.patients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Không có bệnh nhân trong hàng chờ</p>
            </div>
          ) : (() => {
            // Separate patients into two groups
            const normalPatients = queue.patients.filter(p => 
              p.overallStatus !== 'WAITING_RESULT' && 
              !p.services.some(s => s.status === 'WAITING_RESULT')
            );
            const waitingResultPatients = queue.patients.filter(p => 
              p.overallStatus === 'WAITING_RESULT' || 
              p.services.some(s => s.status === 'WAITING_RESULT')
            );

            // Sort normal patients: SERVING first, then PREPARING, SKIPPED, RETURNING, WAITING
            const statusOrder: Record<string, number> = {
              'SERVING': 1,
              'PREPARING': 2,
              'SKIPPED': 3,
              'RETURNING': 4,
              'WAITING': 5
            };
            normalPatients.sort((a, b) => {
              const orderA = statusOrder[a.overallStatus] || 999;
              const orderB = statusOrder[b.overallStatus] || 999;
              if (orderA !== orderB) return orderA - orderB;
              return a.queueOrder - b.queueOrder;
            });

            // Sort waiting result patients by queue order
            waitingResultPatients.sort((a, b) => a.queueOrder - b.queueOrder);

            const renderPatientCard = (p: typeof queue.patients[0]) => (
                <div key={p.patientProfileId} className="p-3 border rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                        {p.queueOrder}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{p.patientName}</div>
                        <div className="text-xs text-gray-500">{p.prescriptionCode}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = `/service-processing/patient-history/${p.patientProfileId}`;
                          const params = new URLSearchParams();
                          if (p.prescriptionCode) {
                            params.set('prescriptionCode', p.prescriptionCode);
                          }
                          // Add from parameter to track navigation source
                          params.set('from', 'service-processing');
                          const queryString = params.toString();
                          router.push(`${url}?${queryString}`);
                        }}
                        className="flex items-center gap-1 h-7 text-xs"
                        title="Xem lịch sử khám bệnh"
                      >
                        <History className="h-3 w-3" />
                        Lịch sử
                      </Button>
                      <Badge variant="secondary" className="text-xs">
                        {p.overallStatus}
                      </Badge>
                      {/* Skip button - only show for non-WAITING_RESULT patients and when there's more than 1 patient */}
                      {p.overallStatus !== 'WAITING_RESULT' && 
                       !p.services.some(s => s.status === 'WAITING_RESULT') &&
                       p.services.length > 0 && 
                       queue && queue.totalCount > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const firstService = p.services[0];
                            handleSkipPatient(firstService.prescriptionId, firstService.serviceId);
                          }}
                          disabled={
                            skippingPatient === `${p.services[0].prescriptionId}-${p.services[0].serviceId}` ||
                            (queue && queue.totalCount <= 1) ||
                            p.overallStatus === 'SERVING' ||
                            p.services.some(s => s.status === 'SERVING')
                          }
                          className="flex items-center gap-1 h-7 text-xs"
                          title={
                            p.overallStatus === 'SERVING' || p.services.some(s => s.status === 'SERVING')
                              ? 'Không thể bỏ qua bệnh nhân đang được phục vụ'
                              : queue && queue.totalCount <= 1
                              ? 'Không thể bỏ qua vì đây là bệnh nhân duy nhất trong hàng chờ'
                              : 'Bỏ qua bệnh nhân này'
                          }
                        >
                          {skippingPatient === `${p.services[0].prescriptionId}-${p.services[0].serviceId}` ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                              Đang xử lý...
                            </>
                          ) : (
                            <>
                              <SkipForward className="h-3 w-3" />
                              Bỏ qua
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    {p.services
                      .slice()
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map(s => `${s.order ? `#${s.order} ` : ''}${s.serviceName} (${s.status})`) 
                      .join(' • ')}
                  </div>
                  
                  {/* Action buttons for SERVING patients */}
                  {p.overallStatus === 'SERVING' && p.services.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2 flex-wrap">
                      {p.services
                        .filter(s => s.status === 'SERVING')
                        .map((service) => {
                          const serviceKey = service.id || `${service.prescriptionId}-${service.serviceId}`;
                          const isUpdating = updatingService === serviceKey || updatingService === `${service.prescriptionId}-${service.serviceId}`;
                          
                          return (
                            <div key={serviceKey} className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const idToUse = service.id || { prescriptionId: service.prescriptionId, serviceId: service.serviceId };
                                  await handleUpdateServiceStatus(idToUse, 'WAITING_RESULT', 'Chờ kết quả');
                                }}
                                disabled={isUpdating}
                                className="flex items-center gap-1 h-7 text-xs"
                              >
                                {isUpdating ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                                    Đang xử lý...
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-3 w-3" />
                                    Chờ kết quả
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  // Find full service data from myServices or prescription
                                  const fullService = myServices.find(s => 
                                    s.prescriptionId === service.prescriptionId && 
                                    s.serviceId === service.serviceId
                                  ) || prescription?.services.find(s => 
                                    s.serviceId === service.serviceId
                                  );
                                  
                                  if (fullService) {
                                    handleOpenResultsDialog(fullService, false);
                                  } else {
                                    // If not found, create a minimal service object with queue data
                                    const minimalService: ServiceWithPrescription = {
                                      id: service.id || undefined,
                                      prescriptionId: service.prescriptionId,
                                      serviceId: service.serviceId,
                                      service: {
                                        id: service.serviceId,
                                        serviceCode: '',
                                        name: service.serviceName,
                                        price: 0,
                                        description: '',
                                        timePerPatient: 0
                                      },
                                      status: service.status as ServiceStatus,
                                      order: service.order || 1,
                                      note: null,
                                      startedAt: null,
                                      completedAt: null,
                                      results: [],
                                      prescription: {
                                        id: service.prescriptionId,
                                        prescriptionCode: p.prescriptionCode,
                                        status: '',
                                        patientProfile: {
                                          id: p.patientProfileId,
                                          name: p.patientName,
                                          dateOfBirth: '',
                                          gender: 'OTHER'
                                        }
                                      }
                                    };
                                    handleOpenResultsDialog(minimalService, false);
                                  }
                                }}
                                disabled={isUpdating}
                                className="flex items-center gap-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                              >
                                {isUpdating ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                    Đang xử lý...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3 w-3" />
                                    Hoàn thành
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  // Find full service data from myServices or prescription
                                  const fullService = myServices.find(s => 
                                    s.prescriptionId === service.prescriptionId && 
                                    s.serviceId === service.serviceId
                                  ) || prescription?.services.find(s => 
                                    s.serviceId === service.serviceId
                                  );
                                  
                                  if (fullService) {
                                    setSelectedServiceForPrescription(fullService);
                                    setCreatePrescriptionDialogOpen(true);
                                  } else {
                                    // If not found, create a minimal service object with queue data
                                    const minimalService: ServiceWithPrescription = {
                                      id: service.id || undefined,
                                      prescriptionId: service.prescriptionId,
                                      serviceId: service.serviceId,
                                      service: {
                                        id: service.serviceId,
                                        serviceCode: '',
                                        name: service.serviceName,
                                        price: 0,
                                        description: '',
                                        timePerPatient: 0
                                      },
                                      status: service.status as ServiceStatus,
                                      order: service.order || 1,
                                      note: null,
                                      startedAt: null,
                                      completedAt: null,
                                      results: [],
                                      prescription: {
                                        id: service.prescriptionId,
                                        prescriptionCode: p.prescriptionCode,
                                        status: '',
                                        patientProfile: {
                                          id: p.patientProfileId,
                                          name: p.patientName,
                                          dateOfBirth: '',
                                          gender: 'OTHER'
                                        }
                                      }
                                    };
                                    setSelectedServiceForPrescription(minimalService);
                                    setCreatePrescriptionDialogOpen(true);
                                  }
                                }}
                                className="flex items-center gap-1 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                              >
                                <FileText className="h-3 w-3" />
                                Tạo phiếu chỉ định
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Action buttons for WAITING_RESULT patients */}
                  {(p.overallStatus === 'WAITING_RESULT' || p.services.some(s => s.status === 'WAITING_RESULT')) && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      {(() => {
                        const waitingResultServices = p.services.filter(s => s.status === 'WAITING_RESULT');
                        
                        // If only one service, show buttons directly
                        if (waitingResultServices.length === 1) {
                          const service = waitingResultServices[0];
                          return (
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  handleOpenResultsDialogFromQueue(
                                    p.patientProfileId,
                                    service.prescriptionId,
                                    service.serviceId,
                                    service.serviceName,
                                    false
                                  );
                                }}
                                className="flex items-center gap-1 h-7 text-xs flex-1"
                              >
                                <FileCheck className="h-3 w-3" />
                                Cập nhật kết quả
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  handleOpenResultsDialogFromQueue(
                                    p.patientProfileId,
                                    service.prescriptionId,
                                    service.serviceId,
                                    service.serviceName,
                                    true
                                  );
                                }}
                                className="flex items-center gap-1 h-7 text-xs flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                              >
                                <Clock className="h-3 w-3" />
                                Hẹn lại
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  // Find full service data from myServices or prescription
                                  const fullService = myServices.find(s => 
                                    s.prescriptionId === service.prescriptionId && 
                                    s.serviceId === service.serviceId
                                  ) || prescription?.services.find(s => 
                                    s.serviceId === service.serviceId
                                  );
                                  
                                  if (fullService) {
                                    setSelectedServiceForPrescription(fullService);
                                    setCreatePrescriptionDialogOpen(true);
                                  } else {
                                    // If not found, create a minimal service object with queue data
                                    const minimalService: ServiceWithPrescription = {
                                      id: service.id || undefined,
                                      prescriptionId: service.prescriptionId,
                                      serviceId: service.serviceId,
                                      service: {
                                        id: service.serviceId,
                                        serviceCode: '',
                                        name: service.serviceName,
                                        price: 0,
                                        description: '',
                                        timePerPatient: 0
                                      },
                                      status: service.status as ServiceStatus,
                                      order: service.order || 1,
                                      note: null,
                                      startedAt: null,
                                      completedAt: null,
                                      results: [],
                                      prescription: {
                                        id: service.prescriptionId,
                                        prescriptionCode: p.prescriptionCode,
                                        status: '',
                                        patientProfile: {
                                          id: p.patientProfileId,
                                          name: p.patientName,
                                          dateOfBirth: '',
                                          gender: 'OTHER'
                                        }
                                      }
                                    };
                                    setSelectedServiceForPrescription(minimalService);
                                    setCreatePrescriptionDialogOpen(true);
                                  }
                                }}
                                className="flex items-center gap-1 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                              >
                                <FileText className="h-3 w-3" />
                                Tạo phiếu chỉ định
                              </Button>
                            </div>
                          );
                        }
                        
                        // If multiple services, show dropdown + button
                        return (
                          <div className="space-y-2">
                            <Select
                              value={selectedPatientForResults?.patientProfileId === p.patientProfileId 
                                ? `${selectedPatientForResults.services[0]?.prescriptionId}-${selectedPatientForResults.services[0]?.serviceId}`
                                : undefined
                              }
                              onValueChange={(value) => {
                                const [prescriptionId, serviceId] = value.split('-');
                                const service = waitingResultServices.find(
                                  s => s.prescriptionId === prescriptionId && s.serviceId === serviceId
                                );
                                if (service) {
                                  setSelectedPatientForResults({
                                    patientProfileId: p.patientProfileId,
                                    services: [service]
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Chọn dịch vụ cần cập nhật kết quả" />
                              </SelectTrigger>
                              <SelectContent>
                                {waitingResultServices.map((service) => (
                                  <SelectItem 
                                    key={`${service.prescriptionId}-${service.serviceId}`}
                                    value={`${service.prescriptionId}-${service.serviceId}`}
                                  >
                                    {service.order ? `#${service.order} ` : ''}{service.serviceName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const selected = selectedPatientForResults?.patientProfileId === p.patientProfileId
                                    ? selectedPatientForResults.services[0]
                                    : null;
                                  if (selected) {
                                    handleOpenResultsDialogFromQueue(
                                      p.patientProfileId,
                                      selected.prescriptionId,
                                      selected.serviceId,
                                      selected.serviceName,
                                      false
                                    );
                                  } else {
                                    toast.error('Vui lòng chọn dịch vụ cần cập nhật kết quả');
                                  }
                                }}
                                disabled={selectedPatientForResults?.patientProfileId !== p.patientProfileId}
                                className="flex items-center gap-1 h-7 text-xs flex-1"
                              >
                                <FileCheck className="h-3 w-3" />
                                Cập nhật kết quả
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const selected = selectedPatientForResults?.patientProfileId === p.patientProfileId
                                    ? selectedPatientForResults.services[0]
                                    : null;
                                  if (selected) {
                                    handleOpenResultsDialogFromQueue(
                                      p.patientProfileId,
                                      selected.prescriptionId,
                                      selected.serviceId,
                                      selected.serviceName,
                                      true
                                    );
                                  } else {
                                    toast.error('Vui lòng chọn dịch vụ cần hẹn lại');
                                  }
                                }}
                                disabled={selectedPatientForResults?.patientProfileId !== p.patientProfileId}
                                className="flex items-center gap-1 h-7 text-xs flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                              >
                                <Clock className="h-3 w-3" />
                                Hẹn lại
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const selected = selectedPatientForResults?.patientProfileId === p.patientProfileId
                                    ? selectedPatientForResults.services[0]
                                    : null;
                                  if (selected) {
                                    // Find full service data from myServices or prescription
                                    const fullService = myServices.find(s => 
                                      s.prescriptionId === selected.prescriptionId && 
                                      s.serviceId === selected.serviceId
                                    ) || prescription?.services.find(s => 
                                      s.serviceId === selected.serviceId
                                    );
                                    
                                    if (fullService) {
                                      setSelectedServiceForPrescription(fullService);
                                      setCreatePrescriptionDialogOpen(true);
                                    } else {
                                      // If not found, create a minimal service object with queue data
                                      const minimalService: ServiceWithPrescription = {
                                        id: undefined,
                                        prescriptionId: selected.prescriptionId,
                                        serviceId: selected.serviceId,
                                        service: {
                                          id: selected.serviceId,
                                          serviceCode: '',
                                          name: selected.serviceName,
                                          price: 0,
                                          description: '',
                                          timePerPatient: 0
                                        },
                                        status: selected.status as ServiceStatus,
                                        order: selected.order || 1,
                                        note: null,
                                        startedAt: null,
                                        completedAt: null,
                                        results: [],
                                        prescription: {
                                          id: selected.prescriptionId,
                                          prescriptionCode: p.prescriptionCode,
                                          status: '',
                                          patientProfile: {
                                            id: p.patientProfileId,
                                            name: p.patientName,
                                            dateOfBirth: '',
                                            gender: 'OTHER'
                                          }
                                        }
                                      };
                                      setSelectedServiceForPrescription(minimalService);
                                      setCreatePrescriptionDialogOpen(true);
                                    }
                                  } else {
                                    toast.error('Vui lòng chọn dịch vụ cần tạo phiếu chỉ định');
                                  }
                                }}
                                disabled={selectedPatientForResults?.patientProfileId !== p.patientProfileId}
                                className="flex items-center gap-1 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                              >
                                <FileText className="h-3 w-3" />
                                Tạo phiếu chỉ định
                              </Button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
            );

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Column 1: Normal patients (SERVING, PREPARING, SKIPPED, RETURNING, WAITING) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default" className="text-xs">Hàng chờ thường</Badge>
                    <span className="text-xs text-gray-500">({normalPatients.length})</span>
                  </div>
                  {normalPatients.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      Không có bệnh nhân
                    </div>
                  ) : (
                    normalPatients.map(renderPatientCard)
                  )}
                </div>

                {/* Column 2: Waiting result patients */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs bg-cyan-100 text-cyan-800">Chờ kết quả</Badge>
                    <span className="text-xs text-gray-500">({waitingResultPatients.length})</span>
                  </div>
                  {waitingResultPatients.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      Không có bệnh nhân chờ kết quả
                    </div>
                  ) : (
                    waitingResultPatients.map(renderPatientCard)
                  )}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Update Results Dialog */}
      {selectedService && (
        <UpdateResultsDialog
          open={resultsDialogOpen}
          onOpenChange={setResultsDialogOpen}
          service={selectedService}
          patientProfileId={selectedPatientForResults?.patientProfileId || 
                           (selectedService as any).prescription?.patientProfile?.id ||
                           (selectedService as any).patientProfileId}
          onUpdate={handleResultsUpdate}
          shouldReschedule={shouldReschedule}
        />
      )}

      {/* Create Prescription Dialog */}
      {selectedServiceForPrescription && (() => {
        // Get patientProfileId from multiple sources
        const serviceFromMyServices = myServices.find(s => 
          s.id === selectedServiceForPrescription.id || 
          (s.prescriptionId === selectedServiceForPrescription.prescriptionId && 
           s.serviceId === selectedServiceForPrescription.serviceId)
        );
        
        // Try to get from queue if not found in myServices
        let resolvedPatientProfileId = serviceFromMyServices?.prescription?.patientProfile?.id || 
                                       selectedServiceForPrescription.prescription?.patientProfile?.id ||
                                       (prescription?.patientProfile?.id);
        
        // If still not found, try to get from queue
        if (!resolvedPatientProfileId && queue) {
          const queuePatient = queue.patients.find(p => 
            p.services.some(s => 
              s.prescriptionId === selectedServiceForPrescription.prescriptionId &&
              s.serviceId === selectedServiceForPrescription.serviceId
            )
          );
          if (queuePatient) {
            resolvedPatientProfileId = queuePatient.patientProfileId;
          }
        }
        
        return (
          <CreatePrescriptionDialog
            open={createPrescriptionDialogOpen}
            onOpenChange={(open) => {
              setCreatePrescriptionDialogOpen(open);
              if (!open) {
                setSelectedServiceForPrescription(null);
              }
            }}
            service={selectedServiceForPrescription}
            patientProfileId={resolvedPatientProfileId || ''}
            onSuccess={() => {
              // Reload services after creating prescription
              loadMyServices();
              // Reload queue
              serviceProcessingService.getWaitingQueue().then(setQueue).catch(console.error);
              // Reload prescription if currently viewing one
              if (prescription) {
                serviceProcessingService.scanPrescription(prescription.prescriptionCode)
                  .then(res => setPrescription(res.prescription))
                  .catch(console.error);
              }
            }}
          />
        );
      })()}

      {/* QR Scanner Dialog */}
      <Dialog open={isQrScannerOpen} onOpenChange={setIsQrScannerOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Quét mã QR phiếu chỉ định
            </DialogTitle>
            <DialogDescription>
              Đưa mã QR của phiếu chỉ định (PRE... hoặc PR-...) vào khung hình để quét tự động
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '1' }}>
              {/* Video element for BarcodeDetector */}
              <video
                ref={qrVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${usingHtml5Qrcode ? 'hidden' : ''}`}
                style={{ transform: 'scaleX(-1)' }}
              />
              
              {/* HTML5 QR Code reader container */}
              <div id="prescription-qr-reader" className="w-full h-full"></div>
              
              {/* Scanning overlay for BarcodeDetector mode */}
              {qrScanning && !usingHtml5Qrcode && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-white rounded-lg w-[80%] h-[80%] relative">
                    {/* Corner indicators */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
                  </div>
                </div>
              )}
              
              {!qrScanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center text-white">
                    <CameraOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Camera chưa sẵn sàng</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">{scanHint}</p>
              {scannerSupported === false && (
                <p className="text-xs text-red-600 mt-2">
                  Trình duyệt không hỗ trợ quét QR. Vui lòng sử dụng trình duyệt hiện đại hơn.
                </p>
              )}
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={async () => {
                  await stopQrScanner();
                  setIsQrScannerOpen(false);
                }}
              >
                Đóng
              </Button>
              {!qrScanning && (
                <Button
                  onClick={startQrScanner}
                  className="flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Khởi động lại
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
