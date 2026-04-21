import React, { useState, useEffect } from 'react';
import { Bell, X, Info, AlertTriangle, CheckCircle, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { getSystemNotifications } from '../services/api';
import { format } from 'date-fns';

interface Notification {
  id: number;
  title: string;
  message: string;
  target: string;
  createdAt: string;
  author: string;
}

interface NotificationCenterProps {
  userRole: string;
}

export default function NotificationCenter({ userRole }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastViewed, setLastViewed] = useState<number>(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await getSystemNotifications(userRole);
        const notificationsArray = Array.isArray(data) ? data : [];
        setNotifications(notificationsArray);
        
        // Calculate unread based on localStorage
        const savedLastViewed = localStorage.getItem(`lastViewedNotifications_${userRole}`);
        const lastViewedTime = savedLastViewed ? parseInt(savedLastViewed) : 0;
        setLastViewed(lastViewedTime);
        
        const unread = notificationsArray.filter((n: Notification) => new Date(n.createdAt).getTime() > lastViewedTime).length;
        setUnreadCount(unread);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userRole]);

  const handleToggle = () => {
    if (!isOpen) {
      const now = Date.now();
      setLastViewed(now);
      setUnreadCount(0);
      localStorage.setItem(`lastViewedNotifications_${userRole}`, now.toString());
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
        title="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 bg-indigo-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  <h3 className="font-bold text-sm">System Notifications</h3>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={cn(
                          "p-4 hover:bg-gray-50 transition-colors relative",
                          new Date(n.createdAt).getTime() > lastViewed && "bg-indigo-50/30"
                        )}
                      >
                        {new Date(n.createdAt).getTime() > lastViewed && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
                        )}
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                            <Info className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-gray-900 truncate">{n.title}</h4>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-3">{n.message}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] text-gray-400">
                                {format(new Date(n.createdAt), 'MMM dd, HH:mm')}
                              </span>
                              <span className="text-[10px] font-medium text-indigo-600">
                                By {n.author}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 italic">No notifications yet</p>
                  </div>
                )}
              </div>
              
              {notifications.length > 0 && (
                <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400">Showing last {notifications.length} notifications</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
