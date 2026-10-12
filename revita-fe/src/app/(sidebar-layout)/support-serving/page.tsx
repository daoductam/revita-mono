"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { receptionService, type PendingServicesResponse, type AssignNextServiceResponse } from '@/lib/services/reception.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { QrCode, Camera, CameraOff, AlertTriangle, User, Stethoscope, Download, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

export default function SupportServingPage() {
  const [prescriptionCode, setPrescriptionCode] = useState<string>("");
  const [pendingData, setPendingData] = useState<PendingServicesResponse | null>(null);
  const [assignResult, setAssignResult] = useState<AssignNextServiceResponse | null>(null);
  const [loadingPending, setLoadingPending] = useState<boolean>(false);
  const [loadingAssign, setLoadingAssign] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  
  // QR Scanner states
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [scannerSupported, setScannerSupported] = useState<boolean | null>(null);
  const [scanHint, setScanHint] = useState<string>('Đang khởi động camera...');
  const [usingHtml5Qrcode, setUsingHtml5Qrcode] = useState(false);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrMediaStreamRef = useRef<MediaStream | null>(null);
  const qrHtml5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const qrLastScanRef = useRef<string | null>(null);
  const qrLastScanTsRef = useRef<number>(0);
  const qrScanningRef = useRef(false);

  const canQuery = useMemo(() => prescriptionCode.trim().length > 0, [prescriptionCode]);

  const handleFetchPending = useCallback(async (code?: string) => {
    const codeToFetch = code || prescriptionCode.trim();
    if (!codeToFetch) return;
    setError("");
    setAssignResult(null);
    setSelectedServiceIds(new Set()); // Clear selections when fetching new data
    setLoadingPending(true);
    try {
      const data = await receptionService.getPendingServices(codeToFetch);
      setPendingData(data);
    } catch (e: unknown) {
      const errorResponse = e as { response?: { data?: { message?: string }; status?: number } };
      const rawMessage = errorResponse?.response?.data?.message || 'Không thể lấy thông tin phiếu chỉ định';
      
      // Parse error message to show friendly message if it's about no work sessions
      if (rawMessage.includes('No active work sessions found for services:')) {
        // Extract service IDs from error message
        const serviceIdsMatch = rawMessage.match(/services:\s*([^.]+)/);
        if (serviceIdsMatch) {
          const serviceIdsStr = serviceIdsMatch[1].trim();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const serviceIds = serviceIdsStr.split(',').map(id => id.trim());
          
          // Try to fetch service names from API or use IDs
          // For now, show a generic message since we don't have service data yet
          const friendlyMessage = `Hiện tại chưa có bác sĩ nào đang phục vụ dịch vụ này. Vui lòng kiểm tra lại phiên làm việc.`;
          setPendingData(null);
          setError(friendlyMessage);
          toast.error(friendlyMessage);
        } else {
          setPendingData(null);
          setError(rawMessage);
          toast.error(rawMessage);
        }
      } else {
      setPendingData(null);
        setError(rawMessage);
        toast.error(rawMessage);
      }
    } finally {
      setLoadingPending(false);
    }
  }, [prescriptionCode]);

  const handleAssignNext = useCallback(async () => {
    if (!pendingData?.prescriptionCode) return;
    
    // Check if any service is selected
    if (selectedServiceIds.size === 0) {
      toast.error('Vui lòng chọn ít nhất một dịch vụ để gán');
      return;
    }
    
    setError("");
    setLoadingAssign(true);
    try {
      const res = await receptionService.assignNextService({ 
        prescriptionCode: pendingData.prescriptionCode,
        prescriptionServiceIds: Array.from(selectedServiceIds)
      });
      setAssignResult(res);
      // Clear selected services after successful assignment
      setSelectedServiceIds(new Set());
      // Optionally refresh pending list after assignment
      try {
        const refreshed = await receptionService.getPendingServices(pendingData.prescriptionCode);
        setPendingData(refreshed);
      } catch {
        // ignore refresh failure
      }
    } catch (e: unknown) {
      const errorResponse = e as { response?: { data?: { message?: string } } };
      const rawMessage = errorResponse?.response?.data?.message || 'Không thể gán dịch vụ tiếp theo';
      
      // Parse error message to extract service IDs and show friendly message
      if (rawMessage.includes('No active work sessions found for services:')) {
        // Extract service IDs from error message
        const serviceIdsMatch = rawMessage.match(/services:\s*([^.]+)/);
        if (serviceIdsMatch && pendingData?.services) {
          const serviceIdsStr = serviceIdsMatch[1].trim();
          const serviceIds = serviceIdsStr.split(',').map(id => id.trim());
          
          // Map service IDs to service names
          const serviceNames = serviceIds
            .map(serviceId => {
              const service = pendingData.services.find(s => s.serviceId === serviceId);
              return service?.serviceName || serviceId;
            })
            .filter(Boolean);
          
          // Create friendly error message
          if (serviceNames.length > 0) {
            const serviceNamesText = serviceNames.join(', ');
            const friendlyMessage = `Hiện tại chưa có bác sĩ nào đang phục vụ ${serviceNamesText}`;
            setError(friendlyMessage);
            toast.error(friendlyMessage);
          } else {
            setError(rawMessage);
            toast.error(rawMessage);
          }
        } else {
          setError(rawMessage);
          toast.error(rawMessage);
        }
      } else {
        setError(rawMessage);
        toast.error(rawMessage);
      }
    } finally {
      setLoadingAssign(false);
    }
  }, [pendingData, selectedServiceIds]);

  // Handle PDF download
  const handleDownloadPDF = useCallback(async (result: AssignNextServiceResponse) => {
    if (!result.assignedServices || result.assignedServices.length === 0) return;

    try {
      const { default: pdfMake } = await import('pdfmake/build/pdfmake');
      const { default: pdfFonts } = await import('pdfmake/build/vfs_fonts');
      pdfMake.vfs = pdfFonts.vfs;

      const session = result.assignedServices[0]?.chosenSession;
      if (!session) return;

      const docDefinition = {
        pageMargins: [40, 40, 40, 40],
        content: [
          {
            text: 'THÔNG TIN GÁN DỊCH VỤ',
            style: 'title',
            alignment: 'center',
            margin: [0, 0, 0, 20]
          },
          {
            text: `Mã phiếu: ${pendingData?.prescriptionCode || 'N/A'}`,
            fontSize: 12,
            margin: [0, 0, 0, 20]
          },
          {
            text: 'Dịch vụ đã gán:',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10]
          },
          {
            ul: result.assignedServices.map((s) => `${s.serviceName || s.serviceId} - ${s.newStatus}`),
            margin: [0, 0, 0, 20]
          },
          {
            text: 'Thông tin phục vụ:',
            style: 'sectionHeader',
            margin: [0, 0, 0, 10]
          },
          {
            table: {
              widths: [120, '*'],
              body: [
                ...(session.doctorName ? [
                  ['Bác sĩ:', session.doctorName]
                ] : []),
                ...(session.technicianName ? [
                  ['Kỹ thuật viên:', session.technicianName]
                ] : []),
                ...(session.clinicRoomName ? [
                  ['Phòng khám:', `${session.clinicRoomName}${session.clinicRoomCode ? ` (${session.clinicRoomCode})` : ''}`]
                ] : []),
                ...(session.boothName ? [
                  ['Buồng khám:', `${session.boothName}${session.boothCode ? ` (${session.boothCode})` : ''}`]
                ] : []),
                ['Thời gian bắt đầu:', new Date(session.startTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })],
                ['Thời gian kết thúc:', new Date(session.endTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })]
              ]
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex % 2 === 0 ? '#f9fafb' : null),
              hLineColor: () => '#e5e7eb',
              vLineColor: () => '#e5e7eb'
            },
            margin: [0, 0, 0, 20]
          },
          {
            text: `In từ hệ thống Revita\nNgày in: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
            fontSize: 9,
            color: '#6b7280',
            alignment: 'center',
            margin: [0, 20, 0, 0]
          }
        ],
        styles: {
          title: { fontSize: 18, bold: true, color: '#111827' },
          sectionHeader: { fontSize: 14, bold: true, color: '#111827' }
        },
        defaultStyle: { fontSize: 11, color: '#111827' }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      const pdfDoc = pdfMake.createPdf(docDefinition);
      pdfDoc.download(`Thong-tin-gan-dich-vu-${pendingData?.prescriptionCode || 'N/A'}.pdf`);
      toast.success('Đã tải PDF thành công');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Không thể tạo PDF');
    }
  }, [pendingData]);

  // QR Scanner handlers
  const stopQrScanner = useCallback(async () => {
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

  const handleQrText = useCallback(async (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    
    console.log('[QR] Raw:', text);
    const upper = trimmed.toUpperCase();
    
    // Parse mã prescription code từ format: PRE:PRE-xxx|... hoặc PRE-xxx|... hoặc PR-xxx|...
    let prescriptionCodeParsed = trimmed;
    
    // Kiểm tra nếu có format PRE:PRE-xxx hoặc PRE:PR-xxx
    if (trimmed.includes(':')) {
      const parts = trimmed.split('|');
      // Lấy phần đầu tiên (PRE:PRE-xxx)
      const firstPart = parts[0] || '';
      if (firstPart.includes(':')) {
        // Tách theo dấu : để lấy mã prescription code
        const codeParts = firstPart.split(':');
        if (codeParts.length >= 2) {
          prescriptionCodeParsed = codeParts[1].trim();
        }
      }
    } else {
      // Nếu không có format đặc biệt, lấy phần đầu trước dấu |
      const codeParts = trimmed.split('|');
      prescriptionCodeParsed = codeParts[0]?.trim() || trimmed;
    }
    
    console.log('[QR] Parsed prescription code:', prescriptionCodeParsed);
    setScanHint(`Đã quét mã: ${prescriptionCodeParsed.slice(0, 24)}${prescriptionCodeParsed.length > 24 ? '...' : ''}`);
    
    // Kiểm tra nếu mã bắt đầu bằng PRE hoặc PR
    if (!upper.startsWith('PRE') && !upper.startsWith('PR-')) {
      toast.error('Mã QR không phải mã phiếu chỉ định (PRE... hoặc PR-...)');
      setScanHint('Mã QR không đúng định dạng');
      return;
    }
    
    // Điền mã vào input
    setPrescriptionCode(prescriptionCodeParsed);
    toast.success(`Đã quét mã: ${prescriptionCodeParsed}`);
    
    // Đóng scanner sau khi quét thành công
    setTimeout(async () => {
      setIsQrScannerOpen(false);
      await stopQrScanner();
      
      // Tự động tra cứu sau khi đóng scanner - truyền trực tiếp mã vào hàm
      setTimeout(async () => {
        await handleFetchPending(prescriptionCodeParsed);
      }, 300); // Small delay to ensure scanner is fully closed and state is updated
    }, 500);
  }, [stopQrScanner, handleFetchPending]);

  const startQrScanner = useCallback(async () => {
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
        console.warn('[QR] videoRef.current is null');
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
      
      console.log('[QR] Video ready');
      setScanHint('Camera đã sẵn sàng. Đưa mã QR vào khung...');

      // Try BarcodeDetector first
      interface BarcodeDetectorInterface {
        detect(image: HTMLVideoElement): Promise<Array<{ rawValue?: string; rawValueText?: string; raw?: string }>>;
      }
      
      const BD = (window as { BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorInterface }).BarcodeDetector;
      const isBarcodeDetectorSupported = typeof BD !== 'undefined';
      
      if (isBarcodeDetectorSupported) {
        console.log('[QR] Trying BarcodeDetector...');
        setScannerSupported(true);
        setUsingHtml5Qrcode(false);
        let detector: BarcodeDetectorInterface | null = null;
        try {
          detector = new BD({ formats: ['qr_code'] });
        } catch {
          try {
            detector = new BD();
          } catch (e) {
            console.log('[QR] BarcodeDetector init failed, will use fallback:', e);
          }
        }
        
        if (detector) {
          console.log('[QR] BarcodeDetector initialized');
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
                    console.log('[QR] Found QR code:', norm);
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
      console.log('[QR] Using html5-qrcode fallback...');
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
        
        const html5QrCode = new Html5Qrcode('support-qr-reader');
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
          console.log('[QR] Found QR code (html5-qrcode):', norm);
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
        console.log('[QR] html5-qrcode started successfully');
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
  useEffect(() => {
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

  return (
    <div className="p-4 space-y-4 px-8">
      <Card>
        <CardHeader>
          <CardTitle>Quầy hỗ trợ thực hiện dịch vụ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                placeholder="Nhập mã phiếu chỉ định (PRE... hoặc PR-...)"
                value={prescriptionCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setPrescriptionCode(e.target.value);
                  // Clear pending data when input is cleared
                  if (!e.target.value.trim()) {
                    setPendingData(null);
                    setAssignResult(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canQuery && !loadingPending) {
                    handleFetchPending();
                  }
                }}
              />
            </div>
            <Button onClick={() => handleFetchPending()} disabled={!canQuery || loadingPending}>
              {loadingPending ? 'Đang tải...' : 'Xem dịch vụ chờ'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsQrScannerOpen(true)}
              title="Quét QR code"
            >
              <QrCode className="h-4 w-4 mr-2" /> Quét QR
            </Button>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          {pendingData && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Mã phiếu: <span className="font-medium text-foreground">{pendingData.prescriptionCode}</span> · 
                Trạng thái: <span className="font-medium text-foreground">
                  {pendingData.status === 'PENDING' ? 'Chờ thực hiện' : 
                   pendingData.status === 'RESCHEDULED' ? 'Đã hẹn lại' : 
                   'Hỗn hợp'}
                </span> · 
                Tổng dịch vụ chờ: {pendingData.totalCount}
              </div>

              {/* Cảnh báo nếu có bác sĩ/kỹ thuật viên không làm việc */}
              {pendingData.services.some(s => s.isDoctorNotWorking || s.isTechnicianNotWorking) && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-800">Cảnh báo</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Có dịch vụ được hẹn lại với bác sĩ/kỹ thuật viên hiện không làm việc hôm nay. 
                        Vui lòng kiểm tra và liên hệ để bố trí lại.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Danh sách dịch vụ {pendingData.status === 'RESCHEDULED' ? 'ĐÃ HẸN LẠI' : pendingData.status === 'MIXED' ? 'CHỜ THỰC HIỆN & ĐÃ HẸN LẠI' : 'CHỜ THỰC HIỆN'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={pendingData.services.length > 0 && pendingData.services.every(s => selectedServiceIds.has(s.prescriptionServiceId))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                // Select all
                                setSelectedServiceIds(new Set(pendingData.services.map(s => s.prescriptionServiceId)));
                              } else {
                                // Deselect all
                                setSelectedServiceIds(new Set());
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>#</TableHead>
                        <TableHead>Tên dịch vụ</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Bác sĩ</TableHead>
                        <TableHead>Kỹ thuật viên</TableHead>
                        <TableHead>Service ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingData.services.map((s, idx: number) => {
                        const isRescheduled = s.status === 'RESCHEDULED';
                        const isWaitingResult = s.status === 'WAITING_RESULT';
                        const hasDoctor = s.doctorId && s.doctorName;
                        const hasTechnician = s.technicianId && s.technicianName;
                        const doctorNotWorking = s.isDoctorNotWorking === true;
                        const technicianNotWorking = s.isTechnicianNotWorking === true;
                        const isSelected = selectedServiceIds.has(s.prescriptionServiceId);
                        
                        // Get status text and color
                        let statusText = 'Chờ thực hiện';
                        let statusVariant: "default" | "secondary" | "destructive" | "outline" = "default";
                        let statusClassName = "";
                        
                        if (isRescheduled) {
                          statusText = 'Đã hẹn lại';
                          statusVariant = "secondary";
                          statusClassName = "bg-orange-100 text-orange-800 border-orange-200";
                        } else if (isWaitingResult) {
                          statusText = 'Chờ kết quả';
                          statusVariant = "secondary";
                          statusClassName = "bg-cyan-100 text-cyan-800 border-cyan-200";
                        }
                        
                        return (
                          <TableRow key={s.prescriptionServiceId}>
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  const newSet = new Set(selectedServiceIds);
                                  if (checked) {
                                    newSet.add(s.prescriptionServiceId);
                                  } else {
                                    newSet.delete(s.prescriptionServiceId);
                                  }
                                  setSelectedServiceIds(newSet);
                                }}
                              />
                            </TableCell>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>{s.serviceName}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={statusVariant}
                                className={statusClassName}
                              >
                                {statusText}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {hasDoctor ? (
                                <div className="flex items-center gap-1">
                                  <Stethoscope className="h-3 w-3 text-blue-600" />
                                  <span className="text-sm">{s.doctorName}</span>
                                  {doctorNotWorking && (
                                    <Badge variant="destructive" className="text-xs ml-1">
                                      <AlertTriangle className="h-2 w-2 mr-1" />
                                      Không làm việc
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">--</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {hasTechnician ? (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-green-600" />
                                  <span className="text-sm">{s.technicianName}</span>
                                  {technicianNotWorking && (
                                    <Badge variant="destructive" className="text-xs ml-1">
                                      <AlertTriangle className="h-2 w-2 mr-1" />
                                      Không làm việc
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">--</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.serviceId}</TableCell>
                          </TableRow>
                        );
                      })}
                      {pendingData.services.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                            Không có dịch vụ {pendingData.status === 'RESCHEDULED' ? 'đã hẹn lại' : 'chờ thực hiện'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleAssignNext} 
                  disabled={loadingAssign || selectedServiceIds.size === 0}
                >
                  {loadingAssign ? 'Đang gán...' : `Gán ${selectedServiceIds.size} dịch vụ đã chọn`}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {selectedServiceIds.size > 0 
                    ? `Đã chọn ${selectedServiceIds.size}/${pendingData.services.length} dịch vụ`
                    : 'Vui lòng chọn ít nhất một dịch vụ để gán'}
                </span>
              </div>

              {assignResult && assignResult.assignedServices && assignResult.assignedServices.length > 0 && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <CardTitle className="text-lg text-green-900">Gán dịch vụ thành công</CardTitle>
                      </div>
                      <Button
                        onClick={() => handleDownloadPDF(assignResult)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Tải PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Services assigned */}
                    <div>
                      <h3 className="font-semibold text-sm text-gray-700 mb-2">Dịch vụ đã gán:</h3>
                      <div className="space-y-2">
                        {assignResult.assignedServices.map((service, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{service.serviceName || service.serviceId}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Trạng thái: <Badge variant="outline" className="ml-1">{service.newStatus}</Badge>
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Session info */}
                    {assignResult.assignedServices[0]?.chosenSession && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="font-semibold text-sm text-gray-700 mb-3">Thông tin phục vụ:</h3>
                          <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
                            {assignResult.assignedServices[0].chosenSession.doctorName && (
                              <div className="flex items-start gap-3">
                                <Stethoscope className="h-4 w-4 text-gray-500 mt-0.5" />
                                <div>
                                  <p className="text-xs text-gray-500">Bác sĩ</p>
                                  <p className="font-medium text-gray-900">{assignResult.assignedServices[0].chosenSession.doctorName}</p>
                                </div>
                              </div>
                            )}
                            {assignResult.assignedServices[0].chosenSession.technicianName && (
                              <div className="flex items-start gap-3">
                                <User className="h-4 w-4 text-gray-500 mt-0.5" />
                                <div>
                                  <p className="text-xs text-gray-500">Kỹ thuật viên</p>
                                  <p className="font-medium text-gray-900">{assignResult.assignedServices[0].chosenSession.technicianName}</p>
                                </div>
                              </div>
                            )}
                            {assignResult.assignedServices[0].chosenSession.clinicRoomName && (
                              <div className="flex items-start gap-3">
                                <div className="h-4 w-4 text-gray-500 mt-0.5 flex items-center justify-center">🏥</div>
                                <div>
                                  <p className="text-xs text-gray-500">Phòng khám</p>
                                  <p className="font-medium text-gray-900">
                                    {assignResult.assignedServices[0].chosenSession.clinicRoomName}
                                    {assignResult.assignedServices[0].chosenSession.clinicRoomCode && (
                                      <span className="text-gray-500 ml-2">({assignResult.assignedServices[0].chosenSession.clinicRoomCode})</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            )}
                            {assignResult.assignedServices[0].chosenSession.boothName && (
                              <div className="flex items-start gap-3">
                                <div className="h-4 w-4 text-gray-500 mt-0.5 flex items-center justify-center">🚪</div>
                                <div>
                                  <p className="text-xs text-gray-500">Buồng khám</p>
                                  <p className="font-medium text-gray-900">
                                    {assignResult.assignedServices[0].chosenSession.boothName}
                                    {assignResult.assignedServices[0].chosenSession.boothCode && (
                                      <span className="text-gray-500 ml-2">({assignResult.assignedServices[0].chosenSession.boothCode})</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className="flex items-start gap-3 pt-2 border-t border-gray-200">
                              <div className="h-4 w-4 text-gray-500 mt-0.5 flex items-center justify-center">⏰</div>
                              <div>
                                <p className="text-xs text-gray-500">Thời gian phục vụ</p>
                                <p className="font-medium text-gray-900 text-sm">
                                  {new Date(assignResult.assignedServices[0].chosenSession.startTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} - {new Date(assignResult.assignedServices[0].chosenSession.endTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
              <div id="support-qr-reader" className="w-full h-full"></div>
              
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


