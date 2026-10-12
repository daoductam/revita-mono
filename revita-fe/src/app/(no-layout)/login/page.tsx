"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Phone, Mail, ArrowRight, Loader2, ChevronLeft, Lock } from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/lib/hooks/useAuth"
import { getRedirectPathByRole } from "@/lib/utils/redirect"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("") // phone or email
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState("")
  const [isEmailMode, setIsEmailMode] = useState(false)
  const router = useRouter()

  const { login } = useAuth();

  // Load error message from sessionStorage on component mount
  useEffect(() => {
    const savedError = sessionStorage.getItem('login_error');
    if (savedError) {
      setError(savedError);
      sessionStorage.removeItem('login_error'); // Clear after showing
    }
  }, []);

  // Global error handler để bắt mọi lỗi có thể gây reload
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      // Lưu thông báo lỗi generic
      sessionStorage.setItem('login_error', 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      sessionStorage.setItem('login_error', 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // Ngăn chặn mọi hành động mặc định
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    
    setLoading(true)
    setError("")

    try {
      console.log('Calling login function...')
      const ok = await login({ identifier, password });
      console.log('Login result:', ok)
      
      if (ok) {
        // Get user data to determine redirect path
        const userStr = localStorage.getItem('auth_user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            const redirectPath = getRedirectPathByRole(user.role);
            console.log('Redirecting to:', redirectPath)
            router.push(redirectPath);
          } catch (error) {
            console.error('Error parsing user data:', error);
            router.push('/');
          }
        } else {
          router.push('/');
        }
      } else {
        // Login failed but no exception thrown
        const errorMessage = "Thông tin đăng nhập không chính xác";
        setError(errorMessage);
        // Lưu vào sessionStorage để hiển thị sau reload
        sessionStorage.setItem('login_error', errorMessage);
      }
    } catch (err: unknown) {
      console.error('Login error:', err)
      
      // Xử lý thông báo lỗi cụ thể từ API
      let errorMessage = "Thông tin đăng nhập không chính xác";
      
      if (err && typeof err === 'object' && 'response' in err) {
        const errorResponse = err as { response: { data: { message: string } } };
        const apiMessage = errorResponse.response.data.message;
        console.log('API error message:', apiMessage)
        
        if (apiMessage.toLowerCase().includes('invalid credentials') || 
            apiMessage.toLowerCase().includes('invalid') ||
            apiMessage.toLowerCase().includes('credentials')) {
          errorMessage = "Số điện thoại/email hoặc mật khẩu không chính xác";
        } else if (apiMessage.toLowerCase().includes('user not found')) {
          errorMessage = "Không tìm thấy tài khoản với thông tin này";
        } else if (apiMessage.toLowerCase().includes('password')) {
          errorMessage = "Mật khẩu không chính xác";
        } else {
          errorMessage = apiMessage;
        }
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = (err as { message: string }).message;
      }
      
      console.log('Setting error message:', errorMessage)
      setError(errorMessage);
      // Lưu vào sessionStorage để hiển thị sau reload
      sessionStorage.setItem('login_error', errorMessage);
      
      // Force update UI trước khi có thể bị reload
      setTimeout(() => {
        setError(errorMessage);
      }, 100);
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    setGoogleLoading(true)
    setError("")

    try {
      const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || `${window.location.origin}/api`).replace(/\/$/, "")
      const redirectUri = encodeURIComponent(`${window.location.origin}/login`)
      const googleAuthUrl = `${apiBaseUrl}/auth/google?redirect_uri=${redirectUri}`
      window.location.href = googleAuthUrl
    } catch (err) {
      console.error("Không thể khởi tạo đăng nhập Google:", err)
      setGoogleLoading(false)
      setError("Không thể khởi tạo đăng nhập Google")
    }
  }

  const toggleMode = () => {
    setIsEmailMode(!isEmailMode)
    setIdentifier("")
    setError("")
  }

  const handleBack = () => {
    router.push("/")
  }

  const handleForgotPassword = () => {
    // Navigate to forgot password page
    router.push("/forgot-password")
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-primary/5 via-white to-primary/10 flex items-center justify-center p-4">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="absolute top-6 left-6 inline-flex items-center text-gray-600 hover:text-gray-800 font-medium transition-colors bg-white/80 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm hover:shadow-md"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-2 p-2">
            <Image
              src="/logos/LogoRevita-v2-noneBG.png"
              alt="Revita Clinic Logo"
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 ">Chào mừng trở lại!</h1>
          {/* <p className="text-gray-600">Đăng nhập để tiếp tục sử dụng dịch vụ</p> */}
        </div>

        {/* Form Card */}
        <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-sm overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-primary via-primary/80 to-primary"></div>

          <CardHeader className="space-y-1 pb-6 pt-8">
            <CardTitle className="text-2xl font-semibold text-center text-gray-800">Đăng nhập</CardTitle>
            <CardDescription className="text-center text-gray-600">
              {isEmailMode ? "Nhập email và mật khẩu" : "Nhập số điện thoại và mật khẩu"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pb-2">
            <div className="space-y-6" onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }
            }}>
              {/* Identifier Input Field */}
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-sm font-medium text-gray-700">
                  {isEmailMode ? "Email" : "Số điện thoại"}
                </Label>
                <div className="relative group">
                  {isEmailMode ? (
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-primary w-5 h-5 transition-colors" />
                  ) : (
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-primary w-5 h-5 transition-colors" />
                  )}
                  <Input
                    id="identifier"
                    placeholder={isEmailMode ? "Nhập địa chỉ email của bạn" : "Nhập số điện thoại của bạn"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSubmit();
                      }
                    }}
                    type={isEmailMode ? "email" : "tel"}
                    className="pl-10 h-12 border-gray-200 focus:border-primary focus:ring-primary/20 transition-all duration-200"
                    required
                  />
                </div>
              </div>

              {/* Password Input Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Mật khẩu
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-primary w-5 h-5 transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Nhập mật khẩu của bạn"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSubmit();
                      }
                    }}
                    className="pl-10 h-12 border-gray-200 focus:border-primary focus:ring-primary/20 transition-all duration-200"
                    required
                  />
                </div>
              </div>

              {/* Toggle Mode Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-primary hover:text-primary/80 text-sm font-medium hover:underline transition-colors"
                >
                  {isEmailMode ? "Đăng nhập bằng số điện thoại" : "Đăng nhập bằng email"}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-in slide-in-from-top-2 shadow-lg">
                  <div className="flex items-start space-x-3">
                    <div className="shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-red-800 text-sm font-medium">{error}</p>
                      <p className="text-red-600 text-xs mt-1">Vui lòng kiểm tra lại thông tin đăng nhập</p>
                    </div>
                    <button
                      onClick={() => setError("")}
                      className="shrink-0 text-red-400 hover:text-red-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="button"
                onClick={handleSubmit}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl"
                disabled={loading || !identifier || !password}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              {/* Divider */}
              <div className="relative my-2.5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500 font-medium">hoặc</span>
                </div>
              </div>

              {/* Google Login Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full h-12 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 transform hover:scale-[1.02] shadow-sm hover:shadow-md bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Đang đăng nhập Google...
                  </>
                ) : (
                  <>
                    <Image src="/socials/google.svg" alt="Google" width={20} height={20} className="mr-3" />
                    <span className="font-medium text-gray-700">Đăng nhập với Google</span>
                  </>
                )}
              </Button>
            </div>

            {/* Forgot Password Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-primary hover:text-primary/80 text-sm font-medium hover:underline transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            {/* Footer */}
            <div className="text-center pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                Chưa có tài khoản?{" "}
                <a
                  href="/register"
                  className="text-primary hover:text-primary/80 font-semibold hover:underline transition-colors"
                >
                  Đăng ký ngay
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500 leading-relaxed">
            Bằng cách đăng nhập, bạn đồng ý với{" "}
            <a href="/terms" className="text-primary hover:underline">
              Điều khoản dịch vụ
            </a>{" "} <br />
            và{" "}
            <a href="/privacy" className="text-primary hover:underline">
              Chính sách bảo mật
            </a>{" "}
            của chúng tôi
          </p>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-primary/5 rounded-full blur-xl -z-10"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-primary/5 rounded-full blur-xl -z-10"></div>
      </div>
    </div>
  )
}
