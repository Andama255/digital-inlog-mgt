import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, Search, Edit2, Trash2, AlertCircle, Download, X, Link as LinkIcon, Copy, Check, Camera, Filter as FilterIcon, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { getUsers, deleteUser, updateUser, sendGlobalNotification, sendIndividualNotification } from '../services/api';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { NATIONALITIES, COUNTRIES } from '../constants';
import { db } from '../lib/firebase';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUserForNotify, setSelectedUserForNotify] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isSendingNotify, setIsSendingNotify] = useState(false);
  const [notifyData, setNotifyData] = useState({ title: '', message: '' });
  const [copiedRole, setCopiedRole] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [assignmentData, setAssignmentData] = useState({ studentId: '', supervisorId: '', supervisorType: 'academic' });
  const [isAssigning, setIsAssigning] = useState(false);
  const [editFormData, setEditFormData] = useState({ 
    name: '', 
    firstName: '',
    surname: '',
    otherName: '',
    role: '',
    email: '',
    nationality: '',
    gender: '',
    photoURL: '',
    phoneNumber: '',
    department: '',
    organizationDepartment: '',
    academicSupervisor: '',
    internshipDuration: '',
    startDate: '',
    endDate: '',
    organization: ''
  });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState({
    name: '',
    email: '',
    role: 'student',
    organization: ''
  });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (storedUser.role !== 'admin') {
      setLoading(false);
      return;
    }

    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData.filter((u: any) => !u.deleted));
      setLoading(false);
    }, (error) => {
      console.error('Users snapshot error:', error);
      setLoading(false);
    });

    return () => unsubscribeUsers();
  }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 10000); // Give 10 seconds for errors
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        setErrorMessage('Image size too large. Please choose an image under 500KB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setEditFormData(prev => ({ ...prev, photoURL: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmDeleteUser = (id: string) => {
    setUserToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(userToDelete);
    try {
      const response = await deleteUser(userToDelete);
      setSuccessMessage(typeof response === 'string' ? response : 'User deleted successfully!');
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      setErrorMessage(null); // Clear any previous error
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      setErrorMessage(err.message || 'Failed to delete user. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditFormData({ 
      name: user.name || '', 
      firstName: user.firstName || '',
      surname: user.surname || '',
      otherName: user.otherName || '',
      role: user.role || 'student',
      email: user.email || '',
      nationality: user.nationality || '',
      gender: user.gender || '',
      photoURL: user.photoURL || '',
      phoneNumber: user.phoneNumber || '',
      department: user.department || '',
      organizationDepartment: user.organizationDepartment || '',
      academicSupervisor: user.academicSupervisor || '',
      internshipDuration: user.internshipDuration || '',
      startDate: user.startDate || '',
      endDate: user.endDate || '',
      organization: user.organization || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: any) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      await updateUser(editingUser.id, editFormData);
      setSuccessMessage('User updated successfully!');
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Failed to update user', err);
    }
  };

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Role', 'Access Number', 'Nationality', 'Gender', 'Phone', 'Department', 'Org Dept', 'Organization/Place', 'Supervisor'];
    const csvContent = [
      headers.join(','),
      ...users.map(u => [
        u.name, 
        u.email, 
        u.role, 
        u.accessNumber || '', 
        u.nationality || '', 
        u.gender || '', 
        u.phoneNumber || '', 
        u.department || '', 
        u.organizationDepartment || '',
        u.organization || '', 
        u.academicSupervisorName || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyData.title || !notifyData.message) return;
    
    setIsSendingNotify(true);
    try {
      if (selectedUserForNotify) {
        await sendIndividualNotification(selectedUserForNotify.id, notifyData.message, notifyData.title);
        setSuccessMessage(`Notification sent to ${selectedUserForNotify.name}!`);
      } else {
        await sendGlobalNotification(notifyData.message, notifyData.title);
        setSuccessMessage('Global notification sent successfully!');
      }
      setIsNotifyModalOpen(false);
      setNotifyData({ title: '', message: '' });
      setSelectedUserForNotify(null);
    } catch (err) {
      console.error('Failed to send notification', err);
      setErrorMessage('Failed to send notification. Please try again.');
    } finally {
      setIsSendingNotify(false);
    }
  };

  const copyRegistrationLink = (role: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/login?role=${role}`;
    navigator.clipboard.writeText(link);
    setCopiedRole(role);
    setTimeout(() => setCopiedRole(null), 2000);
  };

  const generateInviteLink = () => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    params.set('role', inviteData.role);
    if (inviteData.email) params.set('email', inviteData.email);
    if (inviteData.name) params.set('name', inviteData.name);
    if (inviteData.organization) params.set('organization', inviteData.organization);
    
    const link = `${baseUrl}/login?${params.toString()}`;
    setGeneratedLink(link);
    navigator.clipboard.writeText(link);
    setSuccessMessage('Invite link generated and copied to clipboard!');
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.accessNumber?.toLowerCase().includes(searchLower) ||
      user.organization?.toLowerCase().includes(searchLower);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesDeleted = !user.deleted;
    return matchesSearch && matchesRole && matchesDeleted;
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage system users, roles, and access permissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setSelectedUserForNotify(null);
              setIsNotifyModalOpen(true);
            }}
            className="bg-amber-50 text-amber-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-amber-100 hover:bg-amber-100 transition-colors"
          >
            <Bell className="w-4 h-4" />
            Notify All
          </button>
          <button 
            onClick={handleExport}
            className="bg-white text-gray-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Reports
          </button>
          <button 
            onClick={() => {
              setGeneratedLink(null);
              setInviteData({ name: '', email: '', role: 'student', organization: '' });
              setIsInviteModalOpen(true);
            }}
            className="bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-indigo-100 hover:bg-indigo-100 transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
            Invite User
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
          >
            <UserPlus className="w-4 h-4" />
            Add New User
          </button>
        </div>
      </header>

      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
            <p className="font-bold text-sm">{successMessage}</p>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <p className="font-bold text-sm flex-1">{errorMessage}</p>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(errorMessage || '');
                setSuccessMessage('Error details copied to clipboard');
              }}
              className="ml-2 bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-[10px] uppercase font-bold transition-colors"
            >
              Copy
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-gray-900">Active Users</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select 
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="field_supervisor">Field Supervisors</option>
                <option value="academic_supervisor">Academic Supervisors</option>
                <option value="admin">Administrators</option>
              </select>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Contact & Nationality</th>
                <th className="px-6 py-4 hidden md:table-cell">Internship Place / Org</th>
                <th className="px-6 py-4">Academic Supervisor</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm overflow-hidden">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          user?.name?.charAt(0) || '?'
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email?.toLowerCase()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-1 rounded-full",
                      user.role === 'admin' ? "bg-purple-100 text-purple-600" :
                      user.role === 'student' ? "bg-blue-100 text-blue-600" :
                      "bg-indigo-100 text-indigo-600"
                    )}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-900">{user.phoneNumber || 'No Phone'}</span>
                      <span className="text-[10px] text-gray-500">{user.nationality || 'No Nationality'}</span>
                      {user.accessNumber && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded w-fit font-mono">{user.accessNumber}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <div className="text-xs text-gray-600">
                      <span className="font-bold text-gray-900">{user.organization || 'N/A'}</span>
                      {(user.department || user.organizationDepartment) && (
                        <span className="block text-[10px] text-gray-400">
                          {user.department || user.organizationDepartment}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.role === 'student' ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-indigo-600">{user.academicSupervisorName || 'Not Assigned'}</span>
                        {user.academicSupervisorId && <span className="text-[9px] text-gray-400">ID: {user.academicSupervisorId.slice(0, 8)}...</span>}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setSelectedUserForNotify(user);
                          setIsNotifyModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                        title="Send Notification"
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEditClick(user)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Edit User"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => confirmDeleteUser(user.id)}
                        disabled={isDeleting === user.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50/30 text-center text-xs text-gray-500">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </section>

      {/* Assign Supervisor Section */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Assign Supervisors</h2>
              <p className="text-xs text-gray-500">Connect students with their academic or field supervisors.</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Student</label>
              <select 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={assignmentData.studentId}
                onChange={(e) => setAssignmentData({ ...assignmentData, studentId: e.target.value })}
              >
                <option value="">Choose a student...</option>
                {users.filter(u => u.role === 'student').map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.accessNumber || 'No Access Number'})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Supervisor Type</label>
              <select 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={assignmentData.supervisorType}
                onChange={(e) => setAssignmentData({ ...assignmentData, supervisorType: e.target.value, supervisorId: '' })}
              >
                <option value="academic">Academic Supervisor</option>
                <option value="field">Field Supervisor</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Supervisor</label>
              <select 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={assignmentData.supervisorId}
                onChange={(e) => setAssignmentData({ ...assignmentData, supervisorId: e.target.value })}
              >
                <option value="">Choose a supervisor...</option>
                {users.filter(u => u.role === (assignmentData.supervisorType === 'academic' ? 'academic_supervisor' : 'field_supervisor')).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.department || s.organization || 'No Dept/Org'})</option>
                ))}
              </select>
            </div>
            <button 
              onClick={async () => {
                if (!assignmentData.studentId || !assignmentData.supervisorId) {
                  setErrorMessage('Please select both a student and a supervisor.');
                  return;
                }

                setIsAssigning(true);
                const student = users.find(u => u.id === assignmentData.studentId);
                const supervisor = users.find(u => u.id === assignmentData.supervisorId);

                try {
                  const updatePayload = assignmentData.supervisorType === 'academic' 
                    ? {
                        academicSupervisorId: assignmentData.supervisorId,
                        academicSupervisorName: supervisor.name
                      }
                    : {
                        fieldSupervisorId: assignmentData.supervisorId,
                        fieldSupervisorName: supervisor.name
                      }

                  await updateUser(assignmentData.studentId, updatePayload);
                  setSuccessMessage(`Assigned ${supervisor.name} as ${assignmentData.supervisorType} supervisor to ${student.name}`);
                  setAssignmentData({ studentId: '', supervisorId: '', supervisorType: assignmentData.supervisorType });
                } catch (err) {
                  console.error('Failed to assign supervisor', err);
                  setErrorMessage('Failed to assign supervisor. Please try again.');
                } finally {
                  setIsAssigning(false);
                }
              }}
              disabled={isAssigning}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAssigning ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {isAssigning ? 'Assigning...' : 'Assign Now'}
            </button>
          </div>
        </div>
      </section>

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
              <h2 className="text-xl font-bold">Edit User Profile</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-indigo-100">
                    {editFormData.photoURL ? (
                      <img src={editFormData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-10 h-10 text-gray-300" />
                    )}
                  </div>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 p-2 bg-white rounded-lg shadow-lg border border-gray-100 text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Update Profile Picture</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">First Name</label>
                  <input 
                    type="text" 
                    required
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editFormData.firstName}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Surname</label>
                  <input 
                    type="text" 
                    required
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editFormData.surname}
                    onChange={(e) => setEditFormData({ ...editFormData, surname: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Other Name</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editFormData.otherName}
                    onChange={(e) => setEditFormData({ ...editFormData, otherName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email (Read Only)</label>
                  <input 
                    type="email" 
                    disabled
                    className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl outline-none cursor-not-allowed text-gray-500"
                    value={editFormData.email}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nationality</label>
                  <select 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editFormData.nationality}
                    onChange={(e) => setEditFormData({ ...editFormData, nationality: e.target.value })}
                  >
                    <option value="">Select Nationality</option>
                    {NATIONALITIES.map((nat) => (
                      <option key={nat} value={nat}>{nat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gender</label>
                  <select 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editFormData.gender}
                    onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                  <select 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  >
                    <option value="student">Student</option>
                    <option value="field_supervisor">Field Supervisor</option>
                    <option value="academic_supervisor">Academic Supervisor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Organization Department</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. IT Department"
                    value={editFormData.organizationDepartment}
                    onChange={(e) => setEditFormData({ ...editFormData, organizationDepartment: e.target.value })}
                  />
                </div>
              </div>

              {(editFormData.role === 'field_supervisor' || editFormData.role === 'academic_supervisor' || editFormData.role === 'student') && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    {editFormData.role === 'student' ? 'Internship Place' : 
                     editFormData.role === 'field_supervisor' ? 'Organization' : 'Institution'}
                  </label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editFormData.organization}
                    onChange={(e) => setEditFormData({ ...editFormData, organization: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                <input 
                  type="tel" 
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="+256..."
                  value={editFormData.phoneNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                />
              </div>

              {editFormData.role === 'student' && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date</label>
                      <input 
                        type="date" 
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editFormData.startDate}
                        onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Date</label>
                      <input 
                        type="date" 
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editFormData.endDate}
                        onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-6 flex gap-3 sticky bottom-0 bg-white">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add User Info Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
              <h2 className="text-xl font-bold">Add New User</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                <UserPlus className="w-10 h-10 text-indigo-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900">User Registration</h3>
                <p className="text-gray-500 leading-relaxed">
                  To ensure security, users must register their own accounts using their email or Google account.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left space-y-4">
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-indigo-600" />
                    Share Registration Links
                  </p>
                  <div className="space-y-2">
                    {[
                      { id: 'student', label: 'Student' },
                      { id: 'field_supervisor', label: 'Field Supervisor' },
                      { id: 'academic_supervisor', label: 'Academic Supervisor' }
                    ].map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200">
                        <span className="text-xs font-medium text-gray-600">{r.label}</span>
                        <button
                          onClick={() => copyRegistrationLink(r.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-all",
                            copiedRole === r.id 
                              ? "bg-green-100 text-green-600" 
                              : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                          )}
                        >
                          {copiedRole === r.id ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Link
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                Understood
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Global Notification Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <LinkIcon className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Invite New User</h2>
                </div>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Generate a personalized registration link to share with a specific user. This will pre-fill their details for a smoother onboarding experience.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. John Doe"
                      value={inviteData.name}
                      onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address / Access Number</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. john@example.com or AR6159"
                      value={inviteData.email}
                      onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assigned Role</label>
                    <select 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={inviteData.role}
                      onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                    >
                      <option value="student">Student</option>
                      <option value="field_supervisor">Field Supervisor</option>
                      <option value="academic_supervisor">Academic Supervisor</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Organization / Institution</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. UCU IT Dept"
                      value={inviteData.organization}
                      onChange={(e) => setInviteData({ ...inviteData, organization: e.target.value })}
                    />
                  </div>
                </div>

                {generatedLink && (
                  <div className="p-4 bg-green-50 border border-green-100 rounded-2xl space-y-2">
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Generated Link</p>
                    <div className="flex items-center gap-2">
                      <input 
                        readOnly
                        value={generatedLink}
                        className="flex-1 bg-white border border-green-200 rounded-lg p-2 text-[10px] font-mono outline-none"
                      />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(generatedLink);
                          setSuccessMessage('Link copied!');
                        }}
                        className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                  <button 
                    onClick={generateInviteLink}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <LinkIcon className="w-4 h-4" />
                    Generate & Copy
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isNotifyModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 bg-amber-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-6 h-6" />
                  <div>
                    <h2 className="text-xl font-bold">
                      {selectedUserForNotify ? 'Send Individual Notification' : 'Global Notification'}
                    </h2>
                    {selectedUserForNotify && (
                      <p className="text-xs text-amber-100 mt-1">To: {selectedUserForNotify.name}</p>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsNotifyModalOpen(false);
                    setSelectedUserForNotify(null);
                  }} 
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSendNotification} className="p-6 space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    {selectedUserForNotify 
                      ? `This message will be sent only to ${selectedUserForNotify.name}.`
                      : "This message will be sent to all active users in the system."}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notification Title</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="e.g. Important Update"
                      value={notifyData.title}
                      onChange={(e) => setNotifyData({ ...notifyData, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Message Content</label>
                    <textarea 
                      required
                      rows={4}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                      placeholder="Enter your message here..."
                      value={notifyData.message}
                      onChange={(e) => setNotifyData({ ...notifyData, message: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsNotifyModalOpen(false);
                      setSelectedUserForNotify(null);
                    }}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSendingNotify}
                    className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSendingNotify ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4" />
                        {selectedUserForNotify ? 'Send to User' : 'Send to All'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Delete User?</h2>
                <p className="text-gray-500 mb-6">
                  This will permanently remove the user from both the database and the Authentication system, allowing them to re-register if needed.
                </p>

                {errorMessage && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col items-start gap-3 text-left max-h-40 overflow-y-auto">
                    <div className="flex items-start gap-3 w-full">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 font-medium leading-relaxed flex-1 break-words">
                        {errorMessage}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Full Error Details:', errorMessage);
                          // No alert needed, it's already in the scrollable box
                        }}
                        className="text-[10px] text-red-400 hover:text-red-600 underline uppercase tracking-wider font-bold"
                      >
                        Log to Console
                      </button>
                      <span className="text-[10px] text-red-200">|</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(errorMessage || '');
                          setSuccessMessage('Error copied to clipboard');
                        }}
                        className="text-[10px] text-red-400 hover:text-red-600 underline uppercase tracking-wider font-bold"
                      >
                        Copy Error
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setUserToDelete(null);
                    }}
                    className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteUser}
                    disabled={isDeleting !== null}
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isDeleting !== null ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete User'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
