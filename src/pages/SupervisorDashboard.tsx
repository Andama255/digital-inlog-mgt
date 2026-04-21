import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Users, CheckCircle, XCircle, MessageSquare, Search, Filter, ChevronRight, User, Calendar, Clock, AlertCircle, X, Shield, FileText, Check, ArrowRight, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { updateLog, db } from '../services/api';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function SupervisorDashboard() {
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submittingLogs, setSubmittingLogs] = useState<Record<string, boolean>>({});
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

    // Real-time listener for students (filtered to avoid permission denied)
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
      setLoading(false);
    }, (err) => {
      console.error('Students snapshot error:', err);
      setError('Failed to load students. Please check your permissions.');
      setLoading(false);
    });

    // Real-time listener for logs
    const unsubscribeLogs = onSnapshot(collection(db, 'logs'), (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllLogs(logsData);
    }, (err) => {
      console.error('Logs snapshot error:', err);
      setError('Failed to load logs. Please check your permissions.');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, []);

  const isField = user?.role === 'field_supervisor';
  const isAcademic = user?.role === 'academic_supervisor';

  // Derived state for pending logs to ensure it only includes assigned students
  const pendingLogs = allLogs.filter(log => {
    const isAssignedStudent = students.some(s => s.id === log.studentId);
    if (!isAssignedStudent) return false;

    if (isField) return log.fieldStatus === 'pending';
    if (isAcademic) return log.academicStatus === 'pending';
    return log.status === 'pending';
  });

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleApprove = (logId: string) => {
    const comment = feedbacks[logId];
    if (!comment || comment.trim().length < 1 || comment.trim().length > 150) {
      setError(`Comment must be between 1 and 150 characters. Current length: ${comment?.length || 0}`);
      return;
    }
    setConfirmModal({ isOpen: true, type: 'approve', logId });
  };

  const handleReject = (logId: string) => {
    const comment = feedbacks[logId];
    if (!comment || comment.trim().length < 1 || comment.trim().length > 150) {
      setError(`Comment must be between 1 and 150 characters explaining the rejection. Current length: ${comment?.length || 0}`);
      return;
    }
    setConfirmModal({ isOpen: true, type: 'reject', logId });
  };

  const executeApprove = async (logId: string) => {
    setSubmittingLogs(prev => ({ ...prev, [logId]: true }));
    try {
      setError(null);
      
      let updateData: any = {};
      if (isField) {
        updateData = {
          fieldStatus: 'approved',
          fieldSupervisor: user.name,
          fieldFeedback: feedbacks[logId],
          status: 'field_approved' 
        };
      } else if (isAcademic) {
        updateData = {
          academicStatus: 'approved',
          academicSupervisor: user.name,
          academicFeedback: feedbacks[logId],
          academicGrade: grades[logId] || '',
          status: 'approved' 
        };
      } else {
        updateData = {
          status: 'approved',
          supervisor: user.name,
          feedback: feedbacks[logId]
        };
      }

      await updateLog(logId, updateData);
      setSuccessMessage('Log entry approved successfully!');
      setAllLogs(allLogs.map(log => log.id === logId ? { ...log, ...updateData } : log));
      
      const newFeedbacks = { ...feedbacks };
      delete newFeedbacks[logId];
      setFeedbacks(newFeedbacks);
      
      const newGrades = { ...grades };
      delete newGrades[logId];
      setGrades(newGrades);
    } catch (err) {
      console.error('Failed to approve log', err);
      setError('Failed to approve log. Please try again.');
    } finally {
      setSubmittingLogs(prev => ({ ...prev, [logId]: false }));
      setConfirmModal({ isOpen: false, type: null, logId: null });
    }
  };

  const executeReject = async (logId: string) => {
    setSubmittingLogs(prev => ({ ...prev, [logId]: true }));
    try {
      setError(null);
      
      let updateData: any = {};
      if (isField) {
        updateData = {
          fieldStatus: 'rejected',
          fieldSupervisor: user.name,
          fieldFeedback: feedbacks[logId],
          status: 'rejected'
        };
      } else if (isAcademic) {
        updateData = {
          academicStatus: 'rejected',
          academicSupervisor: user.name,
          academicFeedback: feedbacks[logId],
          status: 'rejected'
        };
      } else {
        updateData = {
          status: 'rejected',
          supervisor: user.name,
          feedback: feedbacks[logId]
        };
      }

      await updateLog(logId, updateData);
      setSuccessMessage('Log entry rejected successfully.');
      setAllLogs(allLogs.map(log => log.id === logId ? { ...log, ...updateData } : log));
      
      const newFeedbacks = { ...feedbacks };
      delete newFeedbacks[logId];
      setFeedbacks(newFeedbacks);
    } catch (err) {
      console.error('Failed to reject log', err);
      setError('Failed to reject log. Please try again.');
    } finally {
      setSubmittingLogs(prev => ({ ...prev, [logId]: false }));
      setConfirmModal({ isOpen: false, type: null, logId: null });
    }
  };

  const studentsWithPending = students.map(student => ({
    ...student,
    pendingLogsCount: allLogs.filter(l => {
      if (isField) return l.studentId === student.id && l.fieldStatus === 'pending';
      if (isAcademic) return l.studentId === student.id && l.academicStatus === 'pending';
      return l.studentId === student.id && l.status === 'pending';
    }).length
  }));

  const selectedStudentLogs = allLogs.filter(l => l.studentId === selectedStudent?.id);
  const approvedLogsCount = selectedStudentLogs.filter(l => l.status === 'approved').length;
  const attendanceRate = selectedStudentLogs.length > 0 ? Math.round((approvedLogsCount / selectedStudentLogs.length) * 100) : 0;
  const filteredStudents = studentsWithPending.filter(student => 
    student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
    student.accessNumber?.toLowerCase().includes(studentSearchQuery.toLowerCase())
  );

  const [savingRole, setSavingRole] = useState(false);
  const [roleInput, setRoleInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');

  // Supervisor Communication State
  const [supervisorFeedbacks, setSupervisorFeedbacks] = useState<any[]>([]);
  const [commInput, setCommInput] = useState('');
  const [submittingComm, setSubmittingComm] = useState(false);

  useEffect(() => {
    if (!selectedStudent) return;
    const commQuery = query(collection(db, 'supervisor_feedback'), where('studentId', '==', selectedStudent.id));
    const unsubscribeComm = onSnapshot(commQuery, (snapshot) => {
      const commsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSupervisorFeedbacks(commsData);
    });
    return () => unsubscribeComm();
  }, [selectedStudent]);

  const handleSendCommunication = async () => {
    // ... existing code ...
    if (!selectedStudent || !commInput.trim()) return;
    setSubmittingComm(true);
    try {
      const { addDoc, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'supervisor_feedback'), {
        studentId: selectedStudent.id,
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role, 
        message: commInput.trim(),
        createdAt: serverTimestamp()
      });
      setCommInput('');
      setSuccessMessage('Message sent successfully.');
    } catch (err: any) {
      console.error('Error sending communication:', err);
      setError('Failed to send message: ' + err.message);
    } finally {
      setSubmittingComm(false);
    }
  };

  const generateInternshipReport = async () => {
    if (!selectedStudent) return;
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const { format } = await import('date-fns');
      
      const doc = new jsPDF();
      const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');

      // Title
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229);
      doc.text('Internship Progress Report', 14, 22);

      // Student Info
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text(`Student Name: ${selectedStudent.name}`, 14, 35);
      doc.text(`Access Number: ${selectedStudent.accessNumber || 'N/A'}`, 14, 42);
      doc.text(`Assigned Role: ${selectedStudent.internshipRole || 'N/A'}`, 14, 49);
      doc.text(`Department: ${selectedStudent.department || 'N/A'}`, 14, 56);
      doc.text(`Generated By: ${user.name} (${isField ? 'Field Supervisor' : 'Academic Supervisor'})`, 14, 63);
      doc.text(`Date Generated: ${timestamp}`, 14, 70);

      // Statistics
      const studentLogs = allLogs.filter(l => l.studentId === selectedStudent.id);
      const approvedCount = studentLogs.filter(l => l.status === 'approved').length;
      
      autoTable(doc, {
        startY: 80,
        head: [['Metric', 'Value']],
        body: [
          ['Total Log Entries', String(studentLogs.length)],
          ['Approved Logs', String(approvedCount)],
          ['Days Logged', String(new Set(studentLogs.map(l => l.date)).size)]
        ],
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });

      // Daily Logs Table
      const finalY1 = (doc as any).lastAutoTable.finalY || 80;
      doc.setFontSize(14);
      doc.text('Logbook Entries', 14, finalY1 + 15);

      const logRows = studentLogs
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(log => [
          log.date,
          log.targetTask ? String(log.targetTask).substring(0, 40) + '...' : 'N/A',
          String(log.status).toUpperCase(),
          log.feedback ? String(log.feedback).substring(0, 40) + '...' : 'No Supervisor Comment'
        ]);

      autoTable(doc, {
        startY: finalY1 + 20,
        head: [['Date', 'Task/Target', 'Status', 'Supervisor Feedback']],
        body: logRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });

      // Supervisor Communication / Feedbacks
      const finalY2 = (doc as any).lastAutoTable.finalY || finalY1 + 20;
      doc.setFontSize(14);
      doc.text('Supervisor Communications', 14, finalY2 + 15);

      const commRows = supervisorFeedbacks
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .map(msg => [
          msg.createdAt ? format((msg.createdAt.seconds || msg.createdAt._seconds) ? new Date((msg.createdAt.seconds || msg.createdAt._seconds) * 1000) : new Date(), 'MMM dd, yyyy') : 'N/A',
          `${msg.authorName} (${msg.authorRole === 'field_supervisor' ? 'Field' : 'Academic'})`,
          String(msg.message)
        ]);

      if (commRows.length > 0) {
        autoTable(doc, {
          startY: finalY2 + 20,
          head: [['Date', 'Author', 'Message']],
          body: commRows,
          theme: 'striped',
          headStyles: { fillColor: [100, 116, 139] }
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('No communications recorded.', 14, finalY2 + 22);
      }

      doc.save(`Internship_Report_${selectedStudent.name.replace(/\s+/g, '_')}.pdf`);
      setSuccessMessage('Report generated successfully.');
    } catch (e: any) {
      console.error('Error generating report:', e);
      setError('Failed to generate report: ' + e.message);
    }
  };

  const handleUpdateStudentRole = async () => {
    if (!selectedStudent) return;
    setSavingRole(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', selectedStudent.id), {
        internshipRole: roleInput,
        department: departmentInput
      });
      setSuccessMessage('Student role and department updated successfully.');
      setSelectedStudent({ ...selectedStudent, internshipRole: roleInput, department: departmentInput });
      // Update in the students list
      setStudents(students.map(s => s.id === selectedStudent.id ? { ...s, internshipRole: roleInput, department: departmentInput } : s));
    } catch (err: any) {
      console.error('Error updating role:', err);
      setError('Failed to update student role: ' + err.message);
    } finally {
      setSavingRole(false);
    }
  };

  const openStudentProfile = (student: any) => {
    setSelectedStudent(student);
    setRoleInput(student.internshipRole || '');
    setDepartmentInput(student.department || '');
    setIsProfileModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isField ? 'Field Supervisor Dashboard' : isAcademic ? 'Academic Supervisor Dashboard' : 'Supervisor Dashboard'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isField ? 'Review daily/weekly logs and provide practical feedback.' : 
             isAcademic ? 'Monitor student progress and provide academic evaluation.' : 
             'Manage and review student internship progress.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            to="/reviews"
            className="hidden md:flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            Review Logs
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                <Users className="w-6 h-6" />
             </div>
             <div>
                <p className="text-xs text-gray-500 font-medium">Total Students</p>
                <p className="text-lg font-bold text-gray-900">{students.length}</p>
             </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
             <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <Clock className="w-6 h-6" />
             </div>
             <div>
                <p className="text-xs text-gray-500 font-medium">Pending Reviews</p>
                <p className="text-lg font-bold text-gray-900">{pendingLogs.length}</p>
             </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
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
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
            <p className="font-bold text-sm">{successMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className={cn(
                "p-6 text-center space-y-4",
                confirmModal.type === 'approve' ? "bg-green-50/50" : "bg-red-50/50"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
                  confirmModal.type === 'approve' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                )}>
                  {confirmModal.type === 'approve' ? <CheckCircle className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Confirm {confirmModal.type === 'approve' ? 'Approval' : 'Rejection'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    Are you sure you want to <strong>{confirmModal.type}</strong> this log entry? 
                    This action will be recorded and the student will be notified.
                  </p>
                </div>
              </div>
              <div className="p-6 bg-white flex gap-3">
                <button
                  onClick={() => setConfirmModal({ isOpen: false, type: null, logId: null })}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmModal.logId) {
                      if (confirmModal.type === 'approve') executeApprove(confirmModal.logId);
                      else executeReject(confirmModal.logId);
                    }
                  }}
                  disabled={confirmModal.logId ? submittingLogs[confirmModal.logId] : false}
                  className={cn(
                    "flex-1 py-3 px-4 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2",
                    confirmModal.type === 'approve' ? "bg-green-600 hover:bg-green-700 shadow-green-100" : "bg-red-600 hover:bg-red-700 shadow-red-100"
                  )}
                >
                  {confirmModal.logId && submittingLogs[confirmModal.logId] ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    confirmModal.type === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Student List */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">My Students</h2>
              <button className="text-indigo-600 text-sm font-bold hover:underline">View All</button>
            </div>
            <div className="p-4 space-y-2">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search students..." 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                />
              </div>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left group",
                      selectedStudent?.id === student.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "hover:bg-gray-50"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                      selectedStudent?.id === student.id ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600"
                    )}>
                      {student?.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-bold truncate", selectedStudent?.id === student.id ? "text-white" : "text-gray-900")}>{student.name}</p>
                      <div className="flex flex-col">
                        <p className={cn("text-[10px] truncate", selectedStudent?.id === student.id ? "text-indigo-100" : "text-gray-500")}>
                          {student.accessNumber}
                        </p>
                        {student.organization && (
                          <p className={cn("text-[10px] font-bold truncate uppercase tracking-tight", selectedStudent?.id === student.id ? "text-indigo-100" : "text-indigo-600")}>
                            {student.organization}
                          </p>
                        )}
                      </div>
                    </div>
                    {student.pendingLogsCount > 0 && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                        selectedStudent?.id === student.id ? "bg-white text-indigo-600" : "bg-amber-100 text-amber-600"
                      )}>
                        {student.pendingLogsCount}
                      </span>
                    )}
                    <ChevronRight className={cn("w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity", selectedStudent?.id === student.id ? "text-white" : "text-gray-300")} />
                  </button>
                ))
              ) : (
                <div className="p-8 text-center space-y-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-400">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">No students found</p>
                    <p className="text-xs text-gray-500">
                      {isAcademic 
                        ? "You haven't been assigned any students yet. Please contact the Admin." 
                        : "No students are currently registered."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Review Area */}
        <div className="lg:col-span-2 space-y-8">
          {pendingLogs.length > 0 ? (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold text-gray-900">Pending Log Approvals</h2>
                <span className="text-sm text-gray-500">{pendingLogs.length} logs to review</span>
              </div>
              
              <div className="space-y-4">
                {pendingLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                            {log?.studentName?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{log.studentName}</p>
                            <p className="text-xs text-gray-500">{log.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleApprove(log.id)}
                            disabled={submittingLogs[log.id]}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors disabled:opacity-50"
                            title="Approve"
                          >
                            {submittingLogs[log.id] ? (
                              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <CheckCircle className="w-6 h-6" />
                            )}
                          </button>
                          <button 
                            onClick={() => handleReject(log.id)}
                            disabled={submittingLogs[log.id]}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                            title="Reject"
                          >
                            {submittingLogs[log.id] ? (
                              <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <XCircle className="w-6 h-6" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {log.targetTask && (
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Target / Task</p>
                            <p className="text-sm text-gray-700">{log.targetTask}</p>
                          </div>
                        )}
                        {log.achievement && (
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Achievement</p>
                            <p className="text-sm text-gray-700">{log.achievement}</p>
                          </div>
                        )}
                        {log.challenges && (
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Challenges</p>
                            <p className="text-sm text-gray-700">{log.challenges}</p>
                          </div>
                        )}
                        {log.lessonLearnt && (
                          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Lesson Learnt</p>
                            <p className="text-sm text-gray-700">{log.lessonLearnt}</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Detailed Activity</p>
                        <p className="text-gray-700 leading-relaxed">{log.activity}</p>
                      </div>

                      {isAcademic && log.fieldFeedback && (
                        <div className="mt-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                          <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1 flex items-center gap-2">
                            <Shield className="w-3 h-3" />
                            Field Supervisor Feedback
                          </p>
                          <p className="text-sm text-indigo-900 italic">"{log.fieldFeedback}"</p>
                        </div>
                      )}
                      
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <p className="text-xs font-bold text-gray-500 flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" />
                            {isField ? 'Practical Feedback' : isAcademic ? 'Academic Feedback' : 'Supervisor Comment'} (1-150 chars)
                          </p>
                          <span className={cn(
                            "text-[10px] font-bold",
                            (feedbacks[log.id]?.length || 0) < 1 || (feedbacks[log.id]?.length || 0) > 150 ? "text-amber-500" : "text-green-600"
                          )}>
                            {feedbacks[log.id]?.length || 0} / 150
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-4">
                          {isAcademic && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Internship Grade / Evaluation</label>
                              <input 
                                type="text"
                                placeholder="e.g. A, Excellent, 85/100..."
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                value={grades[log.id] || ''}
                                onChange={(e) => setGrades({ ...grades, [log.id]: e.target.value })}
                              />
                            </div>
                          )}
                          
                          <div className="flex flex-col md:flex-row items-start gap-4">
                            <div className="flex-1 w-full relative">
                              <textarea 
                                placeholder={isField ? "Add practical/work-based comments..." : isAcademic ? "Add academic feedback..." : "Add a comment..."}
                                maxLength={150}
                                className={cn(
                                  "w-full p-4 bg-white border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[80px] resize-none",
                                  (feedbacks[log.id]?.length || 0) < 1 || (feedbacks[log.id]?.length || 0) > 150 ? "border-amber-200 bg-amber-50/30" : "border-gray-200"
                                )}
                                value={feedbacks[log.id] || ''}
                                onChange={(e) => setFeedbacks({ ...feedbacks, [log.id]: e.target.value })}
                              />
                            </div>
                            <button 
                              onClick={() => handleApprove(log.id)}
                              disabled={submittingLogs[log.id]}
                              className="w-full md:w-auto px-6 py-4 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {submittingLogs[log.id] ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              {submittingLogs[log.id] ? 'Processing...' : isAcademic ? 'Verify & Grade' : 'Approve'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border-2 border-dashed border-gray-200">
               <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-6">
                  <CheckCircle className="w-10 h-10" />
               </div>
               <h3 className="text-xl font-bold text-gray-900">All caught up!</h3>
               <p className="text-gray-500 mt-2 max-w-xs mx-auto">There are no pending log entries to review at this moment.</p>
            </div>
          )}

          {selectedStudent && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
               <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Student Overview: {selectedStudent.name}</h2>
                  <button 
                    onClick={() => openStudentProfile(selectedStudent)}
                    className="text-indigo-600 text-sm font-bold hover:underline"
                  >
                    View Full Profile
                  </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 p-4 rounded-xl">
                     <p className="text-xs text-gray-500 mb-1">Attendance Rate</p>
                     <p className="text-xl font-bold text-gray-900">{attendanceRate}%</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                     <p className="text-xs text-gray-500 mb-1">Logs Approved</p>
                     <p className="text-xl font-bold text-gray-900">{approvedLogsCount}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl">
                     <p className="text-xs text-gray-500 mb-1">Total Logs</p>
                     <p className="text-xl font-bold text-gray-900">{selectedStudentLogs.length}</p>
                  </div>
               </div>
            </section>
          )}
        </div>
      </div>
      {/* Student Profile Modal */}
      {isProfileModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center font-bold text-xl">
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
                  <p className="text-indigo-100 text-sm">{selectedStudent.accessNumber}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Detailed Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Shield className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-xs text-gray-500">Academic Supervisor</p>
                        <p className="text-sm font-bold text-gray-900">{selectedStudent.academicSupervisorName || 'Not Assigned'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-xs text-gray-500">Organization / Internship Place</p>
                        <p className="text-sm font-bold text-gray-900">{selectedStudent.organization || 'Not Set'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-xs text-gray-500">Internship Duration</p>
                        <p className="text-sm font-bold text-gray-900">{selectedStudent.internshipDuration || 'Not Set'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Placement Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-xs text-gray-500">Start Date</p>
                        <p className="text-sm font-bold text-gray-900">{selectedStudent.startDate || 'Not Set'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-xs text-gray-500">End Date</p>
                        <p className="text-sm font-bold text-gray-900">{selectedStudent.endDate || 'Not Set'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Assign Roles / Departments (Field Supervisor only) */}
                  {isField && (
                    <div className="mt-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                      <h4 className="text-sm font-bold text-indigo-900 mb-4">Assign Role & Department</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Department / Unit</label>
                          <input 
                            type="text"
                            value={departmentInput}
                            onChange={(e) => setDepartmentInput(e.target.value)}
                            placeholder="e.g. IT Support, HR..."
                            className="w-full mt-1 p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Internship Role</label>
                          <input 
                            type="text"
                            value={roleInput}
                            onChange={(e) => setRoleInput(e.target.value)}
                            placeholder="e.g. Frontend Developer Intern..."
                            className="w-full mt-1 p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                          />
                        </div>
                        <button
                          onClick={handleUpdateStudentRole}
                          disabled={savingRole}
                          className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {savingRole ? 'Saving...' : 'Save Assignments'}
                        </button>
                      </div>
                    </div>
                  )}

                  {!isField && (selectedStudent.internshipRole || selectedStudent.department) && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Assigned Role</h4>
                      <p className="text-sm text-gray-900"><span className="font-semibold">Department:</span> {selectedStudent.department || 'N/A'}</p>
                      <p className="text-sm text-gray-900"><span className="font-semibold">Role:</span> {selectedStudent.internshipRole || 'N/A'}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Log History */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Logbook History</h3>
                <div className="space-y-4">
                  {allLogs
                    .filter(log => log.studentId === selectedStudent.id)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(log => (
                      <div key={log.id} className="border border-gray-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-bold text-gray-900">{log.date}</span>
                          </div>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            log.status === 'approved' ? "bg-green-100 text-green-600" :
                            log.status === 'rejected' ? "bg-red-100 text-red-600" :
                            "bg-amber-100 text-amber-600"
                          )}>
                            {log.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          {log.targetTask && (
                            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                              <p className="text-[9px] font-bold text-gray-400 uppercase">Target / Task</p>
                              <p className="text-xs text-gray-700">{log.targetTask}</p>
                            </div>
                          )}
                          {log.achievement && (
                            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                              <p className="text-[9px] font-bold text-gray-400 uppercase">Achievement</p>
                              <p className="text-xs text-gray-700">{log.achievement}</p>
                            </div>
                          )}
                          {log.challenges && (
                            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                              <p className="text-[9px] font-bold text-gray-400 uppercase">Challenges</p>
                              <p className="text-xs text-gray-700">{log.challenges}</p>
                            </div>
                          )}
                          {log.lessonLearnt && (
                            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                              <p className="text-[9px] font-bold text-gray-400 uppercase">Lesson Learnt</p>
                              <p className="text-xs text-gray-700">{log.lessonLearnt}</p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-gray-400 uppercase">Detailed Activity</p>
                          <p className="text-sm text-gray-600 line-clamp-2">{log.activity}</p>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          {log.fieldFeedback && (
                            <div className="bg-indigo-50 p-3 rounded-xl flex gap-3">
                              <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase">Field Feedback</p>
                                <p className="text-xs text-indigo-900 italic">"{log.fieldFeedback}"</p>
                              </div>
                            </div>
                          )}
                          
                          {log.academicFeedback && (
                            <div className="bg-amber-50 p-3 rounded-xl flex gap-3 border border-amber-100">
                              <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-2">
                                  Academic Feedback
                                  {log.academicGrade && <span className="bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded text-[8px] font-black">GRADE: {log.academicGrade}</span>}
                                </p>
                                <p className="text-xs text-amber-900 italic">"{log.academicFeedback}"</p>
                              </div>
                            </div>
                          )}

                          {log.feedback && !log.fieldFeedback && !log.academicFeedback && (
                            <div className="bg-indigo-50 p-3 rounded-xl flex gap-3">
                              <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase">Supervisor Feedback</p>
                                <p className="text-xs text-indigo-900 italic">"{log.feedback}"</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              {/* Supervisor Communications */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-500" />
                  Supervisor Communication Log
                </h3>
                
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                  <div className="space-y-4 max-h-[300px] overflow-y-auto mb-4 pr-2">
                    {supervisorFeedbacks.length === 0 ? (
                      <p className="text-center text-sm text-gray-500 italic py-4">No communications recorded yet.</p>
                    ) : (
                      supervisorFeedbacks
                        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
                        .map(msg => (
                          <div key={msg.id} className={cn(
                            "p-3 rounded-xl max-w-[85%]",
                            msg.authorId === user.id ? "bg-indigo-600 text-white ml-auto" : "bg-white border border-gray-200 text-gray-800"
                          )}>
                            <div className="flex justify-between items-center gap-4 mb-1">
                              <span className={cn(
                                "text-[10px] font-bold uppercase",
                                msg.authorId === user.id ? "text-indigo-200" : "text-gray-400"
                              )}>
                                {msg.authorName} ({msg.authorRole === 'field_supervisor' ? 'Field' : 'Academic'})
                              </span>
                            </div>
                            <p className="text-sm">{msg.message}</p>
                          </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text"
                      className="flex-1 p-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-500"
                      placeholder="Add a progress note..."
                      value={commInput}
                      onChange={(e) => setCommInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendCommunication()}
                    />
                    <button
                      onClick={handleSendCommunication}
                      disabled={submittingComm || !commInput.trim()}
                      className="px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {submittingComm ? '...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <button
                onClick={generateInternshipReport}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Progress Report
              </button>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors"
              >
                Close Profile
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
