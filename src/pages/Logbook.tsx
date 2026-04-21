import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Calendar, Clock, CheckCircle, MessageSquare, Send, User, ClipboardList, Shield, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { getLogs, createLog, getAttendance } from '../services/api';

export default function Logbook() {
  const [logs, setLogs] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [newLog, setNewLog] = useState({
    targetTask: '',
    achievement: '',
    challenges: '',
    lessonLearnt: '',
    activity: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        setUser(storedUser);
        if (storedUser.id) {
          const [logsData, attendanceData] = await Promise.all([
            getLogs(storedUser.id),
            getAttendance(storedUser.id)
          ]);
          setLogs(logsData || []);
          setAttendance(attendanceData || []);
        }
      } catch (err) {
        console.error('Failed to fetch logbook data', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const todayAttendance = attendance.find(a => a.date === new Date().toISOString().split('T')[0]);

  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.activity.trim() || !user?.id) return;

    if (!todayAttendance) {
      alert("You must mark yourself as present today before submitting a log entry. Please go to the Dashboard to mark your attendance.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const log = await createLog({
        studentId: user.id,
        studentName: user.name,
        date: new Date().toISOString().split('T')[0],
        ...newLog,
        supervisor: 'Pending Review'
      });
      if (log) {
        setLogs([log, ...logs]);
        setNewLog({
          targetTask: '',
          achievement: '',
          challenges: '',
          lessonLearnt: '',
          activity: ''
        });
      }
    } catch (err) {
      console.error('Failed to create log', err);
    } finally {
      setIsSubmitting(false);
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
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-indigo-600" />
          Daily Logbook
        </h1>
        <p className="text-gray-500 mt-1">Record your daily activities and track your learning progress.</p>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {/* Log Entry Form */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-indigo-50/30">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              New Daily Entry
            </h2>
          </div>
          <div className="p-8">
            <form onSubmit={handleSubmitLog} className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2 font-medium">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span>Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Target / Task</label>
                  <input
                    type="text"
                    placeholder="What was your target for today?"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    value={newLog.targetTask}
                    onChange={(e) => setNewLog({ ...newLog, targetTask: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Achievement</label>
                  <input
                    type="text"
                    placeholder="What did you achieve?"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    value={newLog.achievement}
                    onChange={(e) => setNewLog({ ...newLog, achievement: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Challenges</label>
                  <input
                    type="text"
                    placeholder="Any challenges faced?"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    value={newLog.challenges}
                    onChange={(e) => setNewLog({ ...newLog, challenges: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Lesson Learnt</label>
                  <input
                    type="text"
                    placeholder="What did you learn today?"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    value={newLog.lessonLearnt}
                    onChange={(e) => setNewLog({ ...newLog, lessonLearnt: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Detailed Activity Description</label>
                <textarea
                  required
                  placeholder="Describe your activities in detail..."
                  className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                  value={newLog.activity}
                  onChange={(e) => setNewLog({ ...newLog, activity: e.target.value })}
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Log Entry"}
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Log History */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold text-gray-900">Log History</h2>
            <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{logs.length} Entries</span>
          </div>
          
          <div className="space-y-6">
            {logs.length > 0 ? logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8"
              >
                <div className="flex-shrink-0 flex flex-col items-center gap-2 md:w-24">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{log.date.split('-')[2]}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{new Date(log.date).toLocaleString('default', { month: 'short' })}</p>
                  </div>
                </div>
                
                <div className="flex-1 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      <Clock className="w-4 h-4" />
                      <span>
                        Submitted on {log.date}
                        {log.createdAt && log.createdAt.seconds && ` at ${new Date(log.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    </div>
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                      log.status === 'approved' ? "bg-green-50 text-green-600 border-green-100" : 
                      log.status === 'rejected' ? "bg-red-50 text-red-600 border-red-100" : 
                      "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {log.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Target / Task</p>
                      <p className="text-sm font-medium text-gray-700">{log.targetTask || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Achievement</p>
                      <p className="text-sm font-medium text-gray-700">{log.achievement || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Challenges</p>
                      <p className="text-sm font-medium text-gray-700">{log.challenges || 'None reported'}</p>
                    </div>
                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Lesson Learnt</p>
                      <p className="text-sm font-medium text-gray-700">{log.lessonLearnt || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Activity Details</p>
                    <p className="text-gray-700 leading-relaxed text-sm">{log.activity}</p>
                  </div>
                  
                  {log.fieldFeedback && (
                    <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-3">
                      <p className="text-xs font-bold text-indigo-600 flex items-center gap-2 uppercase tracking-wider">
                        <MessageSquare className="w-4 h-4" />
                        Field Supervisor Feedback
                      </p>
                      <p className="text-sm text-indigo-900 italic leading-relaxed">"{log.fieldFeedback}"</p>
                    </div>
                  )}

                  {log.academicFeedback && (
                    <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 space-y-3">
                      <p className="text-xs font-bold text-amber-600 flex items-center gap-2 uppercase tracking-wider">
                        <Shield className="w-4 h-4" />
                        Academic Supervisor Feedback
                      </p>
                      <p className="text-sm text-amber-900 italic leading-relaxed">"{log.academicFeedback}"</p>
                      {log.academicGrade && (
                        <div className="pt-2 border-t border-amber-100 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Internship Grade</span>
                          <span className="text-sm font-black text-amber-700">{log.academicGrade}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {log.feedback && !log.fieldFeedback && !log.academicFeedback && (
                    <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-3">
                      <p className="text-xs font-bold text-indigo-600 flex items-center gap-2 uppercase tracking-wider">
                        <MessageSquare className="w-4 h-4" />
                        Supervisor Feedback
                      </p>
                      <p className="text-sm text-indigo-900 italic leading-relaxed">"{log.feedback}"</p>
                    </div>
                  )}

                  <div className="pt-6 border-t border-gray-50 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                      <span>Reviewer: {log.supervisor}</span>
                    </div>
                    {log.status === 'approved' && (
                      <div className="flex items-center gap-2 text-xs text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                        <CheckCircle className="w-4 h-4" />
                        <span>VERIFIED ENTRY</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="p-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 text-center space-y-4">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                  <ClipboardList className="w-10 h-10 text-gray-300" />
                </div>
                <div className="max-w-xs mx-auto">
                  <p className="text-lg font-bold text-gray-900">No logs found</p>
                  <p className="text-sm text-gray-400">Your daily activity records will appear here once you submit your first entry.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
