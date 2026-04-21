import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, 
  XCircle, 
  MessageSquare, 
  Search, 
  Filter, 
  ChevronRight, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Shield, 
  FileText, 
  Check,
  User,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { updateLog, db } from '../services/api';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function Reviews() {
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [pendingLogs, setPendingLogs] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [submittingLogs, setSubmittingLogs] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject' | null;
    logId: string | null;
  }>({
    isOpen: false,
    type: null,
    logId: null
  });

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(storedUser);
    
    if (!storedUser.id) {
      setLoading(false);
      return;
    }

    // Real-time listener for students assigned to this supervisor
    const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubscribeUsers = onSnapshot(studentsQuery, (snapshot) => {
      const studentUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let assignedStudents = studentUsers;
      if (storedUser.role === 'academic_supervisor') {
        assignedStudents = studentUsers.filter((s: any) => s.academicSupervisorId === storedUser.id);
      } else if (storedUser.role === 'field_supervisor') {
        // Field supervisors see students explicitly assigned to them OR matching their organization
        assignedStudents = studentUsers.filter((s: any) => 
          s.fieldSupervisorId === storedUser.id || 
          (s.organization && storedUser.organization && s.organization.toLowerCase() === storedUser.organization.toLowerCase())
        );
      }
      
      setStudents(assignedStudents);
    }, (err) => {
      console.error('Students snapshot error:', err);
      setError('Failed to load students.');
    });

    // Real-time listener for logs
    const unsubscribeLogs = onSnapshot(collection(db, 'logs'), (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllLogs(logsData);
      setLoading(false);
    }, (err) => {
      console.error('Logs snapshot error:', err);
      setError('Failed to load logs.');
      setLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, []);

  const isField = user?.role === 'field_supervisor';
  const isAcademic = user?.role === 'academic_supervisor';

  // Filter logs based on assigned students and current user role
  const filteredLogs = allLogs.filter(log => {
    const isAssignedStudent = students.some(s => s.id === log.studentId);
    if (!isAssignedStudent) return false;

    const matchesSearch = 
      log.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.activity?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterStatus === 'pending') {
      if (isField) return log.fieldStatus === 'pending' && matchesSearch;
      if (isAcademic) return log.academicStatus === 'pending' && matchesSearch;
      return log.status === 'pending' && matchesSearch;
    }

    return matchesSearch;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleApprove = (logId: string) => {
    const comment = feedbacks[logId];
    if (!comment || comment.trim().length < 1) {
      setError('Please provide feedback before approving.');
      return;
    }
    setConfirmModal({ isOpen: true, type: 'approve', logId });
  };

  const handleReject = (logId: string) => {
    const comment = feedbacks[logId];
    if (!comment || comment.trim().length < 1) {
      setError('Please provide feedback explaining the rejection.');
      return;
    }
    setConfirmModal({ isOpen: true, type: 'reject', logId });
  };

  const executeAction = async (logId: string, type: 'approve' | 'reject') => {
    setSubmittingLogs(prev => ({ ...prev, [logId]: true }));
    try {
      setError(null);
      let updateData: any = {};
      const feedback = feedbacks[logId];
      const grade = grades[logId] || '';

      if (isField) {
        updateData = {
          fieldStatus: type === 'approve' ? 'approved' : 'rejected',
          fieldSupervisor: user.name,
          fieldFeedback: feedback,
          status: type === 'approve' ? 'field_approved' : 'rejected'
        };
      } else if (isAcademic) {
        updateData = {
          academicStatus: type === 'approve' ? 'approved' : 'rejected',
          academicSupervisor: user.name,
          academicFeedback: feedback,
          academicGrade: grade,
          status: type === 'approve' ? 'approved' : 'rejected'
        };
      }

      await updateLog(logId, updateData);
      setSuccessMessage(`Log entry ${type}d successfully!`);
      
      // Clear feedback and grade for this log
      const newFeedbacks = { ...feedbacks };
      delete newFeedbacks[logId];
      setFeedbacks(newFeedbacks);
      
      const newGrades = { ...grades };
      delete newGrades[logId];
      setGrades(newGrades);
    } catch (err) {
      console.error(`Failed to ${type} log`, err);
      setError(`Failed to ${type} log. Please try again.`);
    } finally {
      setSubmittingLogs(prev => ({ ...prev, [logId]: false }));
      setConfirmModal({ isOpen: false, type: null, logId: null });
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Log Reviews</h1>
          <p className="text-gray-500 mt-1">
            Review and provide feedback on student logbook entries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
             <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <Clock className="w-6 h-6" />
             </div>
             <div>
                <p className="text-xs text-gray-500 font-medium">Pending Reviews</p>
                <p className="text-lg font-bold text-gray-900">
                  {filteredLogs.filter(l => isField ? l.fieldStatus === 'pending' : l.academicStatus === 'pending').length}
                </p>
             </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <Check className="w-5 h-5" />
            <p className="font-bold text-sm">{successMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className={cn(
                "p-6 text-center space-y-4",
                confirmModal.type === 'approve' ? "bg-green-50" : "bg-red-50"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
                  confirmModal.type === 'approve' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                )}>
                  {confirmModal.type === 'approve' ? <CheckCircle className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Confirm {confirmModal.type === 'approve' ? 'Approval' : 'Rejection'}
                </h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to {confirmModal.type} this log entry?
                </p>
              </div>
              <div className="p-6 flex gap-3">
                <button
                  onClick={() => setConfirmModal({ isOpen: false, type: null, logId: null })}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmModal.logId && executeAction(confirmModal.logId, confirmModal.type!)}
                  className={cn(
                    "flex-1 py-3 text-white rounded-xl font-bold",
                    confirmModal.type === 'approve' ? "bg-green-600" : "bg-red-600"
                  )}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFilterStatus('pending')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              filterStatus === 'pending' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            Pending Reviews
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              filterStatus === 'all' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            All Logs
          </button>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search student or activity..." 
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-6">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <motion.div
              key={log.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-lg">
                      {log?.studentName?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{log.studentName}</h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {log.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.createdAt?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      log.status === 'approved' ? "bg-green-100 text-green-600" :
                      log.status === 'rejected' ? "bg-red-100 text-red-600" :
                      "bg-amber-100 text-amber-600"
                    )}>
                      {log.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Detailed Activity</p>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-sm text-gray-700 leading-relaxed">{log.activity}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Target / Task</p>
                        <p className="text-xs text-gray-700">{log.targetTask || 'N/A'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Achievement</p>
                        <p className="text-xs text-gray-700">{log.achievement || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Challenges</p>
                        <p className="text-xs text-gray-700">{log.challenges || 'N/A'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Lesson Learnt</p>
                        <p className="text-xs text-gray-700">{log.lessonLearnt || 'N/A'}</p>
                      </div>
                    </div>

                    {isAcademic && log.fieldFeedback && (
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1 flex items-center gap-2">
                          <Shield className="w-3 h-3" />
                          Field Supervisor Feedback
                        </p>
                        <p className="text-sm text-indigo-900 italic">"{log.fieldFeedback}"</p>
                      </div>
                    )}

                    {/* Review Form */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          <MessageSquare className="w-3 h-3" />
                          Your Feedback
                        </p>
                        <span className="text-[10px] text-gray-400">Max 150 chars</span>
                      </div>
                      
                      {isAcademic && (
                        <input 
                          type="text"
                          placeholder="Grade (e.g. A, 85/100)"
                          className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          value={grades[log.id] || ''}
                          onChange={(e) => setGrades({ ...grades, [log.id]: e.target.value })}
                        />
                      )}

                      <textarea 
                        placeholder="Add your comments here..."
                        className="w-full p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] resize-none"
                        value={feedbacks[log.id] || ''}
                        onChange={(e) => setFeedbacks({ ...feedbacks, [log.id]: e.target.value })}
                      />

                      <div className="flex gap-3">
                        <button
                          onClick={() => handleReject(log.id)}
                          disabled={submittingLogs[log.id]}
                          className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(log.id)}
                          disabled={submittingLogs[log.id]}
                          className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-100"
                        >
                          {submittingLogs[log.id] ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-12 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No logs found</h3>
            <p className="text-gray-500 mt-2">
              {filterStatus === 'pending' 
                ? "You've reviewed all pending logs! Great job." 
                : "No log entries have been submitted by your students yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
