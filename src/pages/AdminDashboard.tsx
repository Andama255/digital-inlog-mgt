import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Shield, FileText, AlertCircle, BarChart3, PieChart as PieChartIcon, TrendingUp, User, ChevronDown, Download, Eye, Info, Bell, Send, Trash2, Megaphone } from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getSystemNotifications, createSystemNotification, deleteSystemNotification, auth } from '../services/api';
import ReportModal from '../components/ReportModal';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [newNotification, setNewNotification] = useState({ title: '', message: '', target: 'all' });
  const [isSending, setIsSending] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleCleanupLogs = async () => {
    if (!window.confirm('Are you sure you want to delete ALL logs and attendance records? This action cannot be undone.')) {
      return;
    }

    setIsCleaning(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/cleanup-logs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Cleanup failed');
      }

      const result = await response.json();
      alert(`Cleanup successful! Deleted ${result.results.logsDeleted} logs and ${result.results.attendanceDeleted} attendance records.`);
    } catch (error: any) {
      console.error('Cleanup error:', error);
      alert('Failed to cleanup logs: ' + error.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleClearPendingLogs = async () => {
    if (!window.confirm('Are you sure you want to clear ALL pending log approvals? This will delete all logs that have not yet been approved.')) {
      return;
    }

    setIsCleaning(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/clear-pending-logs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to clear pending logs');
      }

      const result = await response.json();
      alert(`Successfully cleared ${result.results.pendingLogsDeleted} pending logs.`);
    } catch (error: any) {
      console.error('Clear pending logs error:', error);
      alert('Failed to clear pending logs: ' + error.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotification.title || !newNotification.message) return;

    setIsSending(true);
    try {
      const author = auth.currentUser?.displayName || auth.currentUser?.email || 'Admin';
      await createSystemNotification({ ...newNotification, author });
      setNewNotification({ title: '', message: '', target: 'all' });
      await fetchNotifications();
    } catch (error) {
      console.error('Error sending notification:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Report State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [autoDownload, setAutoDownload] = useState(false);
  const [selectedUserForReport, setSelectedUserForReport] = useState<string>('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Audit Logs State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    setIsAuditModalOpen(true);
    try {
      const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
      const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAuditLogs(data);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      alert('Could not fetch audit logs.');
      setIsAuditModalOpen(false);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    // Real-time Users Listener
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData.filter((u: any) => !u.deleted));
      setLoading(false);
    }, (error) => {
      console.error('Users snapshot error:', error);
      setLoading(false);
    });

    // Real-time Logs Listener
    const logsQuery = query(collection(db, 'logs'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logsData);
    }, (error) => {
      console.error('Logs snapshot error:', error);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const [systemHealth, setSystemHealth] = useState({ api: 'checking', db: 'checking' });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setSystemHealth({ 
          api: response.ok ? 'ONLINE' : 'ERROR', 
          db: data.firestore === 'connected' ? 'CONNECTED' : 'ERROR' 
        });
      } catch (err) {
        setSystemHealth({ api: 'OFFLINE', db: 'OFFLINE' });
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await getSystemNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    }
  };

  const handleDeleteNotification = async (id: number) => {
    try {
      await deleteSystemNotification(id);
      await fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleMonthlyReport = (downloadDirectly = false) => {
    console.log('handleMonthlyReport called, downloadDirectly:', downloadDirectly);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const monthlyLogs = logs.filter(log => {
      const logDate = log.createdAt?.seconds 
        ? new Date(log.createdAt.seconds * 1000) 
        : new Date(log.createdAt);
      return logDate >= monthStart && logDate <= monthEnd;
    });

    const stats = {
      totalLogs: monthlyLogs.length,
      approvedLogs: monthlyLogs.filter(l => l.status === 'approved').length,
      pendingLogs: monthlyLogs.filter(l => l.status === 'pending').length,
      activeStudents: new Set(monthlyLogs.map(l => l.studentId)).size
    };

    const data = {
      type: 'monthly',
      stats,
      logs: monthlyLogs.slice(0, 50)
    };

    setReportData(data);
    setAutoDownload(downloadDirectly);
    setIsReportModalOpen(true);
  };

  const handleIndividualReport = (userId: string, downloadDirectly = false) => {
    console.log('handleIndividualReport called, userId:', userId, 'downloadDirectly:', downloadDirectly);
    const user = users.find(u => u.id === userId);
    if (!user) {
      console.warn('User not found for report:', userId);
      return;
    }

    const userLogs = logs.filter(l => l.studentId === userId || l.supervisorId === userId);

    const stats = {
      totalActivities: userLogs.length,
      approvedActivities: userLogs.filter(l => l.status === 'approved').length,
      pendingActivities: userLogs.filter(l => l.status === 'pending').length,
      lastActive: userLogs.length > 0 ? format(new Date(userLogs[0].createdAt?.seconds * 1000 || userLogs[0].createdAt), 'MMM dd, yyyy') : 'Never'
    };

    setReportData({
      type: 'individual',
      stats,
      logs: userLogs.slice(0, 50),
      user
    });
    setAutoDownload(downloadDirectly);
    setIsReportModalOpen(true);
    setShowUserDropdown(false);
  };

  const stats = [
    { label: 'Total Students', value: users.filter(u => u.role === 'student').length.toString(), icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Active Supervisors', value: users.filter(u => u.role.includes('supervisor')).length.toString(), icon: Shield, color: 'bg-indigo-100 text-indigo-600' },
    { label: 'Pending Approvals', value: logs.filter(l => l.status === 'pending').length.toString(), icon: AlertCircle, color: 'bg-amber-100 text-amber-600' },
    { label: 'Logs Submitted', value: logs.length.toLocaleString(), icon: FileText, color: 'bg-green-100 text-green-600' },
  ];

  // Chart Data Processing
  const roleData = [
    { name: 'Students', value: users.filter(u => u.role === 'student').length },
    { name: 'Field Sup.', value: users.filter(u => u.role === 'field_supervisor').length },
    { name: 'Academic Sup.', value: users.filter(u => u.role === 'academic_supervisor').length },
    { name: 'Admins', value: users.filter(u => u.role === 'admin').length },
  ].filter(d => d.value > 0);

  const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b'];

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), i);
    return format(date, 'MMM dd');
  }).reverse();

  const activityData = last7Days.map(day => {
    const count = logs.filter(log => {
      if (!log.createdAt) return false;
      const logDate = log.createdAt?.seconds 
        ? new Date(log.createdAt.seconds * 1000) 
        : new Date(log.createdAt);
      return format(logDate, 'MMM dd') === day;
    }).length;
    return { name: day, logs: count };
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
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of system activity and user distribution.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Log Activity (Last 7 Days)
            </h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorLogs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="logs" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorLogs)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-indigo-600" />
              User Distribution
            </h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {roleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => <span className="text-xs font-medium text-gray-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-indigo-600" />
              System Notifications
            </h2>
            
            <form onSubmit={handleSendNotification} className="mb-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
              <h3 className="text-sm font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send New Notification
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Notification Title"
                    className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={newNotification.title}
                    onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                    required
                  />
                  <select
                    className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={newNotification.target}
                    onChange={(e) => setNewNotification({ ...newNotification, target: e.target.value })}
                  >
                    <option value="all">Target: All Users</option>
                    <option value="student">Target: Students Only</option>
                    <option value="field_supervisor">Target: Field Supervisors</option>
                    <option value="academic_supervisor">Target: Academic Supervisors</option>
                  </select>
                </div>
                <textarea
                  placeholder="Notification Message..."
                  rows={3}
                  className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
                  value={newNotification.message}
                  onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                  required
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSending}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSending ? 'Sending...' : 'Send Notification'}
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Recent Notifications</h3>
              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start justify-between gap-4 group">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-indigo-600">
                          <Bell className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-bold text-gray-900">{n.title}</h4>
                            <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full font-bold uppercase">
                              {n.target}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">{n.message}</p>
                          <div className="flex items-center gap-3 text-[10px] text-gray-400">
                            <span>{format(new Date(n.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                            <span>•</span>
                            <span>By {n.author}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteNotification(n.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Delete Notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No notifications sent yet.</p>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              System Health
            </h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className={cn("w-2 h-2 rounded-full", systemHealth.api === 'ONLINE' ? "bg-green-500" : "bg-red-500")}></div>
                   <span className="text-sm text-gray-600">API Server</span>
                </div>
                <span className={cn("text-xs font-bold", systemHealth.api === 'ONLINE' ? "text-green-600" : "text-red-600")}>{systemHealth.api}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className={cn("w-2 h-2 rounded-full", systemHealth.db === 'CONNECTED' ? "bg-green-500" : "bg-red-500")}></div>
                   <span className="text-sm text-gray-600">Database (Firestore)</span>
                </div>
                <span className={cn("text-xs font-bold", systemHealth.db === 'CONNECTED' ? "text-green-600" : "text-red-600")}>{systemHealth.db}</span>
              </div>
              <div className="flex items-center justify-between group relative">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                   <span className="text-sm text-gray-600">Mail Service</span>
                   <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-0 -top-12 bg-gray-900 text-white text-[10px] p-2 rounded-lg w-48 z-20 pointer-events-none shadow-xl">
                      <p className="font-bold mb-1 flex items-center gap-1"><Info className="w-3 h-3" /> Status: Delayed</p>
                      <p className="text-gray-400">The mail service is currently in queue-only mode. Outgoing notifications are processed with a 5-10 minute delay to ensure delivery reliability.</p>
                   </div>
                </div>
                <span className="text-xs font-bold text-amber-600">DELAYED</span>
              </div>
            </div>
          </section>

          <section className="bg-indigo-900 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
             <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-2">System Backup</h2>
                <p className="text-indigo-200 text-sm mb-6">Last automatic backup was completed 4 hours ago. Your data is safe and redundant.</p>
                <button className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-colors border border-white/20">
                  Run Manual Backup
                </button>
             </div>
             <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          </section>
        </div>

        <div className="lg:col-span-1">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Quick Actions</h2>
            <div className="space-y-6">
              {/* System Reports */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">System Reports</p>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => handleMonthlyReport(false)}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-indigo-50 rounded-2xl transition-all group border border-transparent hover:border-indigo-100"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-gray-400 group-hover:text-indigo-600">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-600">Monthly Summary</p>
                      <p className="text-[10px] text-gray-500">View overall activity</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Individual Reports */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Individual Reports</p>
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <select 
                      value={selectedUserForReport}
                      onChange={(e) => setSelectedUserForReport(e.target.value)}
                      className="w-full p-4 bg-gray-50 border border-transparent hover:border-indigo-100 rounded-2xl text-sm font-medium appearance-none cursor-pointer transition-all pr-10"
                    >
                      <option value="">Select a student...</option>
                      {users.filter(u => u.role === 'student').map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleIndividualReport(selectedUserForReport, false)}
                      disabled={!selectedUserForReport}
                      className="flex items-center justify-center gap-2 p-3 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all disabled:opacity-50"
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                    <button 
                      onClick={() => handleIndividualReport(selectedUserForReport, true)}
                      disabled={!selectedUserForReport}
                      className="flex items-center justify-center gap-2 p-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" /> PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* System Maintenance */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">System Maintenance</p>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={fetchAuditLogs}
                    disabled={loadingAudit}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-indigo-50 rounded-2xl transition-all group border border-transparent hover:border-indigo-100"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-gray-400 group-hover:text-indigo-600">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-600">
                        {loadingAudit ? 'Loading...' : 'Audit Logs'}
                      </p>
                      <p className="text-[10px] text-gray-500">Track system changes</p>
                    </div>
                  </button>
                  <button 
                    onClick={handleClearPendingLogs}
                    disabled={isCleaning}
                    className="w-full flex items-center gap-4 p-4 bg-amber-50 hover:bg-amber-100 rounded-2xl transition-all group border border-transparent hover:border-amber-200 disabled:opacity-50"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-amber-400 group-hover:text-amber-600">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-amber-900 group-hover:text-amber-600">
                        {isCleaning ? 'Cleaning...' : 'Clear Pending Approvals'}
                      </p>
                      <p className="text-[10px] text-amber-500">Delete only unapproved logs</p>
                    </div>
                  </button>
                  <button 
                    onClick={handleCleanupLogs}
                    disabled={isCleaning}
                    className="w-full flex items-center gap-4 p-4 bg-red-50 hover:bg-red-100 rounded-2xl transition-all group border border-transparent hover:border-red-200 disabled:opacity-50"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-red-400 group-hover:text-red-600">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-red-900 group-hover:text-red-600">
                        {isCleaning ? 'Cleaning...' : 'Clear All Logs'}
                      </p>
                      <p className="text-[10px] text-red-500">Wipe all student records</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {reportData && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setAutoDownload(false);
          }}
          autoDownload={autoDownload}
          title={reportData.type === 'monthly' ? 'Monthly Activity Report' : `Activity Report: ${reportData.user?.name}`}
          data={reportData}
        />
      )}

      {/* Audit Logs Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">System Audit Logs</h2>
                  <p className="text-sm text-gray-500 font-medium">Tracking administrative actions across the platform</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAuditModalOpen(false)}
                className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
              >
                &times;
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium text-lg">No audit actions recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log: any) => (
                    <div key={log.id} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 font-bold text-[10px] uppercase tracking-wider rounded-lg">
                          {log.action}
                        </span>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                          {log.createdAt ? format(log.createdAt.seconds ? new Date(log.createdAt.seconds * 1000) : new Date(log.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{log.details}</p>
                      <div className="text-xs text-gray-400 font-medium mt-2 flex items-center gap-1 border-t border-gray-200 pt-2">
                        <User className="w-3 h-3" />
                        By: <span className="text-gray-600">{log.authorEmail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
