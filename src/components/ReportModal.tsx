import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Download, User, Calendar, BarChart2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  autoDownload?: boolean;
  data: {
    type: 'monthly' | 'individual';
    stats: any;
    logs: any[];
    user?: any;
  };
}

export default function ReportModal({ isOpen, onClose, title, data, autoDownload }: ReportModalProps) {
  if (!isOpen) return null;

  React.useEffect(() => {
    if (isOpen && autoDownload) {
      generatePDF();
    }
  }, [isOpen, autoDownload]);

  const generatePDF = () => {
    try {
      console.log('Generating PDF...');
      console.log('jsPDF:', jsPDF);
      console.log('autoTable:', autoTable);
      
      const doc = new jsPDF();
      const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');

      // Header
      doc.setFontSize(20);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text('System Activity Report', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128); // Gray-500
      doc.text(`Generated on: ${timestamp}`, 14, 30);
      doc.text(`Report Type: ${data.type === 'monthly' ? 'Monthly Overview' : 'Individual User Activity'}`, 14, 35);

      if (data.type === 'individual' && data.user) {
        doc.setFontSize(12);
        doc.setTextColor(31, 41, 55); // Gray-800
        doc.text(`User: ${data.user.name} (${data.user.email?.toLowerCase()})`, 14, 45);
        doc.text(`Role: ${data.user.role}`, 14, 51);
      }

      // Stats Section
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.text('Summary Statistics', 14, 65);
      
      const statsRows = Object.entries(data.stats).map(([key, value]) => [
        key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        String(value)
      ]);

      autoTable(doc, {
        startY: 70,
        head: [['Metric', 'Value']],
        body: statsRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });

      // Logs Section
      const finalY = (doc as any).lastAutoTable.finalY || 70;
      doc.setFontSize(14);
      doc.text('Activity Logs', 14, finalY + 15);

      const logRows = data.logs.map(log => [
        format(log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000) : new Date(log.createdAt), 'MMM dd, HH:mm'),
        log.activityType || 'N/A',
        log.description || 'No description',
        log.status || 'N/A'
      ]);

      autoTable(doc, {
        startY: finalY + 20,
        head: [['Date', 'Activity', 'Description', 'Status']],
        body: logRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });

      console.log('Saving PDF...');
      doc.save(`${data.type}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      console.log('PDF saved successfully.');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please check the console for details.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                <p className="text-xs text-gray-500">System generated report preview</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={generatePDF}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-xl transition-colors text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {/* User Info (if individual) */}
            {data.type === 'individual' && data.user && (
              <div className="bg-indigo-50 p-6 rounded-2xl flex items-center gap-6 border border-indigo-100">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-indigo-600">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{data.user.name}</h3>
                  <p className="text-sm text-gray-600">{data.user.email?.toLowerCase()}</p>
                  <span className="inline-block mt-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {data.user.role.replace('_', ' ')}
                  </span>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(data.stats).map(([key, value]: [string, any]) => (
                <div key={key} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </p>
                  <p className="text-2xl font-black text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            {/* Logs Table */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                Activity Logs
              </h3>
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Activity</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.logs.length > 0 ? (
                      data.logs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {format(log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000) : new Date(log.createdAt), 'MMM dd, HH:mm')}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold text-gray-900">{log.activityType || 'N/A'}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                            {log.description || 'No description'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                              log.status === 'approved' ? "bg-green-100 text-green-700" :
                              log.status === 'pending' ? "bg-amber-100 text-amber-700" :
                              "bg-gray-100 text-gray-700"
                            )}>
                              {log.status || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400 italic">
                          No activity logs found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-bold transition-all"
            >
              Close Preview
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
