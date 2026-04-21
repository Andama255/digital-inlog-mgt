import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, Clock, CheckCircle, MessageSquare, User, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { getLogs, getAttendance, markAttendance } from '../services/api';

export default function StudentDashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
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
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleMarkAttendance = async () => {
    if (!user?.id || isMarkingAttendance) return;
    setIsMarkingAttendance(true);
    try {
      const record = await markAttendance(user.id);
      if (record) {
        setAttendance([...attendance, record]);
      }
    } catch (err) {
      console.error('Failed to mark attendance', err);
    } finally {
      setIsMarkingAttendance(false);
    }
  };

  const todayAttendance = attendance.find(a => a.date === new Date().toISOString().split('T')[0]);
  const latestFeedbackLog = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).find(l => l.feedback || l.fieldFeedback || l.academicFeedback);
  const completionPercentage = Math.min(Math.round((logs.length / 60) * 100), 100);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back, {user?.name?.split(' ')[0]}!</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500">{(user?.studentEmail || user?.email)?.toLowerCase()}</p>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <p className="text-gray-500 font-medium">{user?.accessNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user?.academicSupervisorName && (
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-indigo-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Academic Supervisor</p>
                <p className="text-sm font-bold text-gray-900">{user.academicSupervisorName}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Summary & Recent Activity */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <section 
              onClick={!todayAttendance ? handleMarkAttendance : undefined}
              className={cn(
                "p-8 rounded-3xl shadow-sm border flex flex-col justify-between transition-all cursor-pointer",
                todayAttendance 
                  ? "bg-white border-gray-100" 
                  : "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700 active:scale-95"
              )}
            >
              <div>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                  todayAttendance ? "bg-green-50 text-green-600" : "bg-white/20 text-white"
                )}>
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className={cn("text-lg font-bold", todayAttendance ? "text-gray-900" : "text-white")}>Attendance</h3>
                <p className={cn("text-sm mt-1", todayAttendance ? "text-gray-500" : "text-indigo-100")}>
                  {todayAttendance ? "You are marked present for today." : "You haven't marked attendance yet."}
                </p>
              </div>
              <div className="mt-6">
                <span className={cn("text-2xl font-black", todayAttendance ? "text-green-600" : "text-white")}>
                  {isMarkingAttendance ? "Marking..." : (todayAttendance ? "Present" : "Mark Present")}
                </span>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Total Days</h3>
                <p className="text-gray-500 text-sm mt-1">Consistent reporting.</p>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-black text-indigo-600">{logs.length}</span>
                <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Days</span>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 mb-4">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Total Hours</h3>
                <p className="text-gray-500 text-sm mt-1">Estimated hours.</p>
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-black text-green-600">{logs.length * 8}</span>
                <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Hours</span>
              </div>
            </section>
          </div>

          <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
              <button 
                onClick={() => window.location.href = '/logbook'}
                className="text-indigo-600 text-sm font-bold hover:underline"
              >
                View Logbook
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {logs.slice(0, 3).length > 0 ? logs.slice(0, 3).map((log) => (
                <div key={log.id} className="p-6 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 flex-shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-gray-900">{new Date(log.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        log.status === 'approved' ? "bg-green-100 text-green-600" : 
                        log.status === 'field_approved' ? "bg-blue-100 text-blue-600" :
                        log.status === 'rejected' ? "bg-red-100 text-red-600" : 
                        "bg-amber-100 text-amber-600"
                      )}>
                        {log.status === 'field_approved' ? 'Field Approved' : log.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-1">{log.activity}</p>
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center text-gray-400 italic">
                  No recent activity found.
                </div>
              )}
            </div>
            {logs.length > 3 && (
              <div className="p-4 bg-gray-50 text-center">
                <button 
                  onClick={() => window.location.href = '/logbook'}
                  className="text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors"
                >
                  Show all {logs.length} entries
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Progress & Feedback */}
        <div className="space-y-8">
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Internship Progress</h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-3">
                   <span className="text-gray-500 font-medium">Overall Completion</span>
                   <span className="font-black text-indigo-600">{completionPercentage}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${completionPercentage}%` }}></div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-50">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-4">Milestones</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", logs.length >= 1 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-300")}>
                      <CheckCircle className="w-3 h-3" />
                    </div>
                    <span className={cn("text-sm font-medium", logs.length >= 1 ? "text-gray-900" : "text-gray-400")}>First log entry</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", logs.length >= 30 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-300")}>
                      <CheckCircle className="w-3 h-3" />
                    </div>
                    <span className={cn("text-sm font-medium", logs.length >= 30 ? "text-gray-900" : "text-gray-400")}>Halfway point (30 days)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", logs.length >= 60 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-300")}>
                      <CheckCircle className="w-3 h-3" />
                    </div>
                    <span className={cn("text-sm font-medium", logs.length >= 60 ? "text-gray-900" : "text-gray-400")}>Completion (60 days)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Latest Feedback
            </h2>
            <div className="space-y-4">
              {latestFeedbackLog ? (
                <div className="space-y-3">
                  {latestFeedbackLog.fieldFeedback && (
                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Field Feedback</p>
                      <p className="text-sm text-indigo-900 italic leading-relaxed">"{latestFeedbackLog.fieldFeedback}"</p>
                    </div>
                  )}
                  {latestFeedbackLog.academicFeedback && (
                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-600 uppercase mb-1 flex items-center justify-between">
                        Academic Feedback
                        {latestFeedbackLog.academicGrade && <span className="bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded text-[8px] font-black">GRADE: {latestFeedbackLog.academicGrade}</span>}
                      </p>
                      <p className="text-sm text-amber-900 italic leading-relaxed">"{latestFeedbackLog.academicFeedback}"</p>
                    </div>
                  )}
                  {latestFeedbackLog.feedback && !latestFeedbackLog.fieldFeedback && !latestFeedbackLog.academicFeedback && (
                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                      <p className="text-sm text-indigo-900 italic leading-relaxed">"{latestFeedbackLog.feedback}"</p>
                      <div className="mt-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-200 rounded-xl flex items-center justify-center text-xs font-bold text-indigo-700">
                          {latestFeedbackLog.supervisor?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-indigo-700">{latestFeedbackLog.supervisor || 'Supervisor'}</p>
                          <p className="text-[10px] text-indigo-400 font-medium">{new Date(latestFeedbackLog.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="w-6 h-6 text-gray-200" />
                  </div>
                  <p className="text-sm text-gray-400">No feedback received yet.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
