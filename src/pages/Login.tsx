import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, User, Lock, ArrowRight, ShieldCheck, UserCheck, GraduationCap, AlertCircle, Eye, EyeOff, CheckCircle, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Role } from '../App';

interface LoginProps {
  onLogin: (user: any) => void;
}

import { login as apiLogin, register as apiRegister, logout as apiLogout, resetPassword, resetPasswordViaPhone, normalizeAccessNumber, auth, RecaptchaVerifier, signInWithPhoneNumber, getPhoneNumber, identifyUser, loginWithGoogle } from '../services/api';
import { COUNTRIES, NATIONALITIES } from '../constants';

declare global {
  interface Window {
    recaptchaVerifier: any;
    confirmationResult: any;
  }
}

export default function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [otherName, setOtherName] = useState('');
  const [nationality, setNationality] = useState('');
  const [gender, setGender] = useState('');
  const [accessNumber, setAccessNumber] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [internshipPlace, setInternshipPlace] = useState('');
  const [department, setDepartment] = useState('');
  const [organizationDepartment, setOrganizationDepartment] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+256');
  const [role, setRole] = useState<Role>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetMethod, setResetMethod] = useState<'email' | 'phone' | null>(null);
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetInitiated, setResetInitiated] = useState(false);
  const [identifiedUser, setIdentifiedUser] = useState<{ email: string; phoneNumber: string | null; name: string } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const maskEmail = (email: string) => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.substring(0, 2)}******@${domain}`;
  };

  const capitalizeWords = (str: string) => {
    if (!str) return '';
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  useEffect(() => {
    const roleParam = searchParams.get('role');
    const emailParam = searchParams.get('email');
    const nameParam = searchParams.get('name');
    const orgParam = searchParams.get('organization');

    if (roleParam && ['student', 'field_supervisor', 'academic_supervisor', 'admin'].includes(roleParam)) {
      setIsLogin(false);
      setRole(roleParam as Role);
    }

    if (emailParam) {
      setEmail(emailParam);
      if (roleParam === 'student') {
        setStudentEmail(emailParam);
      }
    }

    if (nameParam) {
      const parts = nameParam.split(' ');
      if (parts.length >= 2) {
        setFirstName(parts[0]);
        setSurname(parts.slice(1).join(' '));
      } else {
        setFirstName(nameParam);
      }
    }

    if (orgParam) {
      if (roleParam === 'student') {
        setInternshipPlace(orgParam);
      } else {
        setOrganization(orgParam);
      }
    }
  }, [searchParams]);

  const handleIdentifyUser = async () => {
    const identifier = email.trim();
    if (!identifier) {
      setError('Please enter your email or access number.');
      return;
    }

    setLoading(true);
    setError(null);
    setIdentifiedUser(null);

    try {
      const user = await identifyUser(identifier);
      setIdentifiedUser(user);
      setSuccess(`Account identified for ${user.name}.`);
    } catch (err: any) {
      setError(err.message || 'No account found with this email or access number.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (method: 'email' | 'phone') => {
    if (!identifiedUser) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    setResetMethod(method);

    try {
      if (method === 'email') {
        await resetPassword(identifiedUser.email);
        setSuccess(`Password reset email sent to ${maskEmail(identifiedUser.email)}! Please check your inbox and spam folder.`);
        setResendCooldown(60);
        setResetInitiated(true);
      } else {
        // Phone Reset Flow
        if (!identifiedUser.phoneNumber) {
          throw new Error('No phone number is registered for this account. Please use email reset.');
        }

        // Setup Recaptcha if not already done
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': () => {}
          });
        }

        // Send OTP
        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await signInWithPhoneNumber(auth, identifiedUser.phoneNumber, appVerifier);
        window.confirmationResult = confirmationResult;
        setVerificationId(confirmationResult.verificationId);
        setSuccess(`OTP sent to your registered phone number: ${identifiedUser.phoneNumber.replace(/(\d{3})\d+(\d{3})/, '$1******$2')}`);
        setResetInitiated(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) {
      setError('Please enter the OTP sent to your phone.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await window.confirmationResult.confirm(otp);
      const idToken = await result.user.getIdToken();
      // Store token and show new password form
      setVerificationId(idToken); // Reuse state to store the verified token
      setShowNewPasswordForm(true);
      setSuccess('Phone number verified! Please enter your new password.');
    } catch (err: any) {
      setError('Invalid OTP. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?])[A-Za-z\d@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]{8,15}$/;
    if (!passwordRegex.test(newPassword)) {
      setError('Password must be 8-15 characters long and include uppercase, lowercase, numbers, and special symbols.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const message = await resetPasswordViaPhone(verificationId!, email, newPassword);
      setSuccess(message);
      setShowNewPasswordForm(false);
      setResetMethod(null);
      setVerificationId(null);
      setOtp('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const identifier = email.trim();
      const normalizedEmail = normalizeAccessNumber(identifier);
      const rawPassword = password; // Don't trim password
      
      // Basic validation for Access Number if student
      if (!isLogin && role === 'student') {
        const accessMatch = identifier.toLowerCase().match(/^ar\d{4,}(@students\.ucu\.ac\.ug)?$/);
        if (!accessMatch) {
          throw new Error('Invalid Access Number format. Use AR followed by at least 4 digits (e.g., AR6159).');
        }
      }
      
      // Password validation for registration
      if (!isLogin) {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?])[A-Za-z\d@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]{8,15}$/;
        if (!passwordRegex.test(rawPassword)) {
          throw new Error('Password must be 8-15 characters long and include uppercase, lowercase, numbers, and special symbols.');
        }
      }

      if (isLogin) {
        const user = await apiLogin({ email: normalizedEmail, password: rawPassword });
        onLogin(user);
        navigate('/');
      } else {
        const fullName = `${firstName} ${surname}${otherName ? ' ' + otherName : ''}`.trim();
        await apiRegister({ 
          email: normalizedEmail, 
          password: rawPassword, 
          name: fullName, 
          firstName,
          surname,
          otherName,
          role, 
          nationality,
          gender,
          accessNumber: identifier.split('@')[0].toUpperCase(),
          studentEmail: role === 'student' ? studentEmail : normalizedEmail,
          organization: role === 'student' ? internshipPlace : organization,
          department,
          organizationDepartment,
          phoneNumber: `${countryCode}${phoneNumber}`
        });
        
        // After registration, log the user out immediately to ensure they log in manually
        // This implements proper authorization flow as requested
        await apiLogout();
        
        // Switch to login view and show success message
        setIsLogin(true);
        setPassword(''); // Clear password for security
        setSuccess('Registration successful! Please login with your new credentials.');
        
        // Scroll to top to see the success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      let message = err.message || 'Authentication failed.';
      
      // Fallback check for raw Firebase error strings
      if (message.includes('auth/invalid-credential') || message.includes('auth/user-not-found') || message.includes('auth/wrong-password')) {
        message = 'Invalid email or password. Please check your credentials and try again.';
      } else if (message.includes('auth/email-already-in-use') || message.includes('email-already-in-use')) {
        message = 'An account with this email already exists. Please try logging in instead.';
      } else if (message.includes('auth/operation-not-allowed')) {
        message = 'Email/Password registration is currently disabled. Please enable it in the Firebase Console or use Google Login.';
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await loginWithGoogle();
      onLogin(user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Google login failed.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'student', label: 'Student', icon: GraduationCap },
    { id: 'field_supervisor', label: 'Field Supervisor', icon: UserCheck },
    { id: 'academic_supervisor', label: 'Academic Supervisor', icon: UserCheck },
    { id: 'admin', label: 'Administrator', icon: ShieldCheck },
  ];

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 bg-cover bg-center bg-no-repeat relative overflow-hidden"
    >
      <motion.div 
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 10, ease: "linear" }}
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=2070")',
          backgroundAttachment: 'fixed'
        }}
      />
      
      {/* Darker overlay for better readability */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/20 relative z-10"
      >
        <div className="p-8 bg-indigo-600 text-white text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">InternLog</h1>
          <p className="text-indigo-100 text-sm mt-1">Digital Internship Logbook Management System</p>
        </div>

            <div className="p-8">
              <div className="flex gap-4 mb-8 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setIsLogin(true)}
                  className={cn(
                    "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                    isLogin ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Login
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={cn(
                    "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                    !isLogin ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Register
                </button>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">{isLogin ? 'Login' : 'Create Account'}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {isLogin ? 'Welcome back to InternLog' : 'Join the UCU IT Department internship portal'}
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">{error}</span>
                  </div>
                  {error.includes('Invalid email or password') && (
                    <div className="flex flex-col gap-2 mt-1 pl-6">
                      <p className="text-xs opacity-80">Not registered? <button onClick={() => setIsLogin(false)} className="underline font-bold">Create an account</button></p>
                      <p className="text-xs opacity-80">Forgot your password? <button onClick={() => setIsForgotPassword(true)} className="underline font-bold">Reset it here</button></p>
                    </div>
                  )}
                </div>
              )}

              {success && (
                <div className="mb-6 p-3 bg-green-50 border border-green-100 text-green-600 text-sm rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {success}
                </div>
              )}

              {isForgotPassword ? (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Reset Password</h2>
                    {!resetInitiated ? (
                      <p className="text-sm text-gray-500 mt-1">Enter your email or access number to identify your account</p>
                    ) : (
                      <p className="text-sm text-green-600 font-medium mt-1">Reset process started successfully!</p>
                    )}
                  </div>

                  {resetInitiated && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-6 bg-green-50 rounded-2xl border border-green-100 text-center space-y-4"
                    >
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-bold text-gray-900">Check Your {resetMethod === 'email' ? 'Email' : 'Phone'}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {success}
                        </p>
                      </div>
                      {resetMethod === 'email' && (
                        <button
                          onClick={() => handleResetPassword('email')}
                          disabled={resendCooldown > 0}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:text-gray-400"
                        >
                          {resendCooldown > 0 ? `Resend link in ${resendCooldown}s` : "Didn't receive the link? Resend"}
                        </button>
                      )}
                    </motion.div>
                  )}

                  {!resetInitiated && (
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="Email or Access Number"
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={!!identifiedUser}
                      />
                    </div>
                  )}

                  {!identifiedUser && !resetInitiated ? (
                    <button
                      onClick={handleIdentifyUser}
                      disabled={loading}
                      className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                    >
                      {loading ? "Identifying..." : "Identify Account"}
                      {!loading && <ArrowRight className="w-5 h-5" />}
                    </button>
                  ) : (
                    identifiedUser && !resetInitiated && (
                      <div className="space-y-4">
                        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Account Found</p>
                          <p className="text-sm font-bold text-gray-900">{identifiedUser.name}</p>
                          <p className="text-xs text-gray-600">{maskEmail(identifiedUser.email)}</p>
                          {identifiedUser.phoneNumber && (
                            <p className="text-xs text-gray-600 mt-1">Phone: {identifiedUser.phoneNumber.replace(/(\d{3})\d+(\d{3})/, '$1******$2')}</p>
                          )}
                        </div>

                        {identifiedUser.email.endsWith('@students.ucu.ac.ug') && (
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                            <p className="text-[10px] text-amber-700 leading-relaxed">
                              <strong>Tip:</strong> As a student, your reset link will be sent to your <strong>UCU Student Email</strong>. Please ensure you can access it via the student portal.
                            </p>
                          </div>
                        )}

                        {!verificationId && !showNewPasswordForm && (
                          <div className="grid grid-cols-1 gap-3">
                            <button
                              onClick={() => handleResetPassword('email')}
                              disabled={loading || resendCooldown > 0}
                              className="w-full py-3 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Send Reset Link to Email'}
                            </button>
                            {identifiedUser.phoneNumber && (
                              <button
                                onClick={() => handleResetPassword('phone')}
                                disabled={loading}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                              >
                                Send OTP to Phone
                              </button>
                            )}
                          </div>
                        )}

                        {verificationId && !showNewPasswordForm && (
                          <div className="space-y-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                            <p className="text-xs font-medium text-indigo-900">Enter the 6-digit OTP sent to your phone</p>
                            <input
                              type="text"
                              placeholder="Enter OTP"
                              className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center tracking-widest font-bold"
                              value={otp}
                              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            />
                            <button 
                              type="button"
                              onClick={handleVerifyOtp}
                              className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                            >
                              Verify OTP
                            </button>
                          </div>
                        )}

                        {showNewPasswordForm && (
                          <div className="space-y-3 p-4 bg-green-50 rounded-xl border border-green-100">
                            <p className="text-xs font-medium text-green-900">Enter your new password</p>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="password"
                                placeholder="New Password"
                                className="w-full pl-10 pr-4 py-2 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                              />
                            </div>
                            <button 
                              type="button"
                              onClick={handleSetNewPassword}
                              className="w-full py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                            >
                              Update Password
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  <button
                    onClick={() => {
                      setIsForgotPassword(false);
                      setResetInitiated(false);
                      setIdentifiedUser(null);
                      setError(null);
                      setSuccess(null);
                      setVerificationId(null);
                      setShowNewPasswordForm(false);
                    }}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-4">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Register As
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {roles.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id as Role)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                          role === r.id 
                            ? "border-indigo-600 bg-indigo-50 text-indigo-600" 
                            : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200"
                        )}
                      >
                        <r.icon className="w-6 h-6" />
                        <span className="text-xs font-semibold">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="First Name"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        value={firstName}
                        onChange={(e) => setFirstName(capitalizeWords(e.target.value))}
                      />
                    </div>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        placeholder="Surname"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        value={surname}
                        onChange={(e) => setSurname(capitalizeWords(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Other Name (Optional)"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                      value={otherName}
                      onChange={(e) => setOtherName(capitalizeWords(e.target.value))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <select
                        required
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                      >
                        <option value="">Select Nationality</option>
                        {NATIONALITIES.map((nat) => (
                          <option key={nat} value={nat}>{nat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="relative">
                      <select
                        required
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-indigo-600 uppercase tracking-widest px-1">
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        className="w-32 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-xs"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.name} value={c.code}>
                            {c.code} ({c.name})
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        required
                        placeholder="Phone Number"
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  {(role === 'field_supervisor' || role === 'academic_supervisor' || role === 'student') && (
                    <div className="space-y-4 pt-2">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest px-1">
                        {role === 'student' ? 'Internship Details' : 'Professional Info'}
                      </p>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder={
                            role === 'student' ? "Internship Place" :
                            role === 'field_supervisor' ? "Organization / Company Name" : 
                            "University / Institution Name"
                          }
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                          value={role === 'student' ? internshipPlace : organization}
                          onChange={(e) => role === 'student' ? setInternshipPlace(capitalizeWords(e.target.value)) : setOrganization(capitalizeWords(e.target.value))}
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder={role === 'student' ? "Organization Department" : "Department"}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                          value={role === 'student' ? organizationDepartment : department}
                          onChange={(e) => role === 'student' ? setOrganizationDepartment(capitalizeWords(e.target.value)) : setDepartment(capitalizeWords(e.target.value))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {!isLogin && role === 'student' && (
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="Student Email Address"
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                  />
                </div>
              )}
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder={isLogin ? "Email or Access Number" : (role === 'student' ? "Access Number (e.g. AR6159)" : "Email Address")}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Password"
                    className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {isLogin && (
                  <div className="space-y-4 pt-2">
                    <div className="relative flex items-center justify-center py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <span className="relative px-4 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-widest">Or continue with</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                      Login with Google
                    </button>
                  </div>
                )}

                {!isLogin && (
                  <div className="p-3 bg-indigo-50/50 rounded-xl space-y-2">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Password Requirements</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div className={cn("flex items-center gap-1.5 text-[10px]", password.length >= 8 && password.length <= 15 ? "text-green-600" : "text-gray-400")}>
                        <div className={cn("w-1 h-1 rounded-full", password.length >= 8 && password.length <= 15 ? "bg-green-600" : "bg-gray-300")} />
                        8-15 Characters
                      </div>
                      <div className={cn("flex items-center gap-1.5 text-[10px]", /[A-Z]/.test(password) ? "text-green-600" : "text-gray-400")}>
                        <div className={cn("w-1 h-1 rounded-full", /[A-Z]/.test(password) ? "bg-green-600" : "bg-gray-300")} />
                        Uppercase Letter
                      </div>
                      <div className={cn("flex items-center gap-1.5 text-[10px]", /[a-z]/.test(password) ? "text-green-600" : "text-gray-400")}>
                        <div className={cn("w-1 h-1 rounded-full", /[a-z]/.test(password) ? "bg-green-600" : "bg-gray-300")} />
                        Lowercase Letter
                      </div>
                      <div className={cn("flex items-center gap-1.5 text-[10px]", /\d/.test(password) ? "text-green-600" : "text-gray-400")}>
                        <div className={cn("w-1 h-1 rounded-full", /\d/.test(password) ? "bg-green-600" : "bg-gray-300")} />
                        Number
                      </div>
                      <div className={cn("flex items-center gap-1.5 text-[10px]", /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? "text-green-600" : "text-gray-400")}>
                        <div className={cn("w-1 h-1 rounded-full", /[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? "bg-green-600" : "bg-gray-300")} />
                        Special Symbol
                      </div>
                    </div>
                  </div>
                )}
              {isLogin && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div id="recaptcha-container"></div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {loading ? (isLogin ? "Logging in..." : "Registering...") : (isLogin ? "Login" : "Register")}
              {!loading && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                @2026DILBMS
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  </div>
);
}
