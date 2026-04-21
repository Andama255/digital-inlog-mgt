import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Mail, Phone, MapPin, GraduationCap, Calendar, Save, Camera, ArrowLeft, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import { getUser, updateUser, getUsers } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { NATIONALITIES } from '../constants';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    surname: '',
    otherName: '',
    email: '',
    accessNumber: '',
    studentEmail: '',
    nationality: '',
    gender: '',
    phoneNumber: '',
    department: '',
    academicSupervisorId: '',
    academicSupervisorName: '',
    fieldSupervisorId: '',
    fieldSupervisorName: '',
    internshipDuration: '',
    startDate: '',
    endDate: '',
    photoURL: '',
    organization: '',
    organizationDepartment: ''
  });

  const [supervisors, setSupervisors] = useState<any[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSupervisors = async () => {
      try {
        const allUsers = await getUsers();
        const sups = allUsers?.filter((u: any) => u.role === 'academic_supervisor' || u.role === 'field_supervisor') || [];
        setSupervisors(sups);
      } catch (err) {
        console.error('Error fetching supervisors:', err);
      }
    };
    fetchSupervisors();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      if (auth.currentUser) {
        try {
          const userData = await getUser(auth.currentUser.uid) as any;
          if (userData) {
            setUser(userData);
            setFormData({
              firstName: userData.firstName || '',
              surname: userData.surname || '',
              otherName: userData.otherName || '',
              email: userData.email || '',
              accessNumber: userData.accessNumber || '',
              studentEmail: userData.studentEmail || '',
              nationality: userData.nationality || '',
              gender: userData.gender || '',
              phoneNumber: userData.phoneNumber || '',
              department: userData.department || '',
              academicSupervisorId: userData.academicSupervisorId || '',
              academicSupervisorName: userData.academicSupervisorName || '',
              fieldSupervisorId: userData.fieldSupervisorId || '',
              fieldSupervisorName: userData.fieldSupervisorName || '',
              internshipDuration: userData.internshipDuration || '',
              startDate: userData.startDate || '',
              endDate: userData.endDate || '',
              photoURL: userData.photoURL || '',
              organization: userData.organization || '',
              organizationDepartment: userData.organizationDepartment || ''
            });
          }
        } catch (err) {
          console.error('Error fetching user:', err);
          setError('Failed to load profile data.');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0) {
          const weeks = Math.floor(diffDays / 7);
          const months = Math.floor(diffDays / 30);
          
          let durationStr = '';
          if (months > 0) {
            durationStr = `${months} month${months > 1 ? 's' : ''}`;
            const remainingWeeks = Math.floor((diffDays % 30) / 7);
            if (remainingWeeks > 0) durationStr += `, ${remainingWeeks} week${remainingWeeks > 1 ? 's' : ''}`;
          } else if (weeks > 0) {
            durationStr = `${weeks} week${weeks > 1 ? 's' : ''}`;
            const remainingDays = diffDays % 7;
            if (remainingDays > 0) durationStr += `, ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
          } else {
            durationStr = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
          }
          
          setFormData(prev => ({ ...prev, internshipDuration: durationStr }));
        }
      }
    }
  }, [formData.startDate, formData.endDate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for base64 in Firestore
        setError('Image size too large. Please choose an image under 500KB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoURL: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photoURL: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const fullName = `${formData.firstName} ${formData.surname}${formData.otherName ? ' ' + formData.otherName : ''}`.trim();
      await updateUser(auth.currentUser.uid, {
        ...formData,
        name: fullName
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
            <p className="text-gray-500">Manage your personal and internship information.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Profile Header Card */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-indigo-600 to-violet-600"></div>
          <div className="relative pt-12 flex flex-col md:flex-row items-center gap-8">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl bg-white p-1 shadow-xl">
                <div className="w-full h-full rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
                  {formData.photoURL ? (
                    <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16 text-gray-300" />
                  )}
                </div>
              </div>
              <input 
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              <div className="absolute -bottom-2 -right-2 flex flex-col gap-2">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 bg-white rounded-xl shadow-lg border border-gray-100 text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2 group/btn"
                  title={formData.photoURL ? "Change Profile Picture" : "Add Profile Picture"}
                >
                  <Camera className="w-5 h-5" />
                  <span className="max-w-0 overflow-hidden group-hover/btn:max-w-xs transition-all duration-300 text-xs font-bold whitespace-nowrap">
                    {formData.photoURL ? "Change Profile Picture" : "Add Profile Picture"}
                  </span>
                </button>
                {formData.photoURL && (
                  <button 
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-2 bg-white rounded-xl shadow-lg border border-gray-100 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 group/remove"
                    title="Remove Profile Picture"
                  >
                    <X className="w-5 h-5" />
                    <span className="max-w-0 overflow-hidden group-hover/remove:max-w-xs transition-all duration-300 text-xs font-bold whitespace-nowrap">
                      Remove Profile Picture
                    </span>
                  </button>
                )}
              </div>
            </div>
            <div className="text-center md:text-left space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">{user?.name || 'User Name'}</h2>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-wider">
                  {user?.role || 'Role'}
                </span>
                <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-xs font-bold tracking-wider flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {user?.email?.toLowerCase()}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Basic Information */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">First Name</label>
              <input
                type="text"
                disabled
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Surname</label>
              <input
                type="text"
                disabled
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500"
                value={formData.surname}
                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Other Name</label>
              <input
                type="text"
                disabled
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500"
                value={formData.otherName}
                onChange={(e) => setFormData({ ...formData, otherName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nationality</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500 appearance-none"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                >
                  <option value="">Select Nationality</option>
                  {NATIONALITIES.map((nat) => (
                    <option key={nat} value={nat}>{nat}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gender</label>
              <select
                disabled
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500 appearance-none"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Phone className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Contact Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {user?.role === 'student' ? 'Access Number' : 'Email Address (Login)'}
              </label>
              <div className="relative">
                {user?.role === 'student' ? (
                  <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                ) : (
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                )}
                <input
                  type="text"
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500"
                  value={user?.role === 'student' ? formData.accessNumber : formData.email}
                />
              </div>
            </div>
            {user?.role === 'student' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Student Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    disabled
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500"
                    value={formData.studentEmail}
                    onChange={(e) => setFormData({ ...formData, studentEmail: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Internship Details */}
        {user?.role !== 'admin' && (
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Internship Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {user?.role === 'student' ? 'Internship Place' : 
                   user?.role === 'field_supervisor' ? 'Organization' : 'Institution'}
                </label>
                <input
                  type="text"
                  disabled
                  className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {user?.role === 'student' ? 'Organization Department' : 'Department'}
                </label>
                <input
                  type="text"
                  disabled
                  className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500"
                  value={user?.role === 'student' ? formData.organizationDepartment : formData.department}
                  onChange={(e) => {
                    if (user?.role === 'student') {
                      setFormData({ ...formData, organizationDepartment: e.target.value });
                    } else {
                      setFormData({ ...formData, department: e.target.value });
                    }
                  }}
                />
              </div>
              {user?.role === 'student' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Academic Supervisor</label>
                    <select
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={formData.academicSupervisorId}
                      onChange={(e) => {
                        const sup = supervisors.find(s => s.id === e.target.value);
                        setFormData({ 
                          ...formData, 
                          academicSupervisorId: e.target.value,
                          academicSupervisorName: sup ? sup.name : ''
                        });
                      }}
                    >
                      <option value="">Select Academic Supervisor</option>
                      {supervisors.filter(s => s.role === 'academic_supervisor').map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.department || 'No Dept'})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Field Supervisor</label>
                    <select
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={formData.fieldSupervisorId}
                      onChange={(e) => {
                        const sup = supervisors.find(s => s.id === e.target.value);
                        setFormData({ 
                          ...formData, 
                          fieldSupervisorId: e.target.value,
                          fieldSupervisorName: sup ? sup.name : ''
                        });
                      }}
                    >
                      <option value="">Select Field Supervisor</option>
                      {supervisors.filter(s => s.role === 'field_supervisor').map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.organization || 'No Org'})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Internship Duration (Auto-calculated)</label>
                    <input
                      type="text"
                      disabled
                      className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl cursor-not-allowed text-gray-500 font-bold"
                      value={formData.internshipDuration || 'Select dates to calculate'}
                    />
                  </div>
                </>
              ) : user?.role === 'academic_supervisor' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Academic Supervisor Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={formData.academicSupervisorName}
                      onChange={(e) => setFormData({ ...formData, academicSupervisorName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={formData.internshipDuration}
                      onChange={(e) => setFormData({ ...formData, internshipDuration: e.target.value })}
                    />
                  </div>
                </>
              ) : null}
              {user?.role !== 'field_supervisor' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Feedback Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-100 text-green-600 rounded-2xl text-sm font-medium">
            Profile updated successfully!
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-2xl transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
