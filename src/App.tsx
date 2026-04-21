import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import Logbook from './pages/Logbook';
import SupervisorDashboard from './pages/SupervisorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';
import Reviews from './pages/Reviews';
import Layout from './components/Layout';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

// Mock Auth Context (Simplified for this project)
export type Role = 'student' | 'field_supervisor' | 'academic_supervisor' | 'admin';

interface User {
  id: string;
  name: string;
  role: Role;
  photoURL?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Set up real-time listener for user document
        unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (doc) => {
          if (doc.exists()) {
            const userData = { id: firebaseUser.uid, ...doc.data() } as User;
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          } else {
            // Fallback for new users whose document might not be created yet
            const fallbackUser = { 
              id: firebaseUser.uid, 
              name: firebaseUser.displayName || 'User', 
              role: 'student' as Role,
              email: firebaseUser.email
            };
            setUser(fallbackUser as any);
            localStorage.setItem('user', JSON.stringify(fallbackUser));
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user doc:", error);
          // If permission denied, it might be because the doc doesn't exist yet
          // or rules are strict. We still want to allow basic access if authenticated.
          if (error.code === 'permission-denied') {
            const fallbackUser = { 
              id: firebaseUser.uid, 
              name: firebaseUser.displayName || 'User', 
              role: 'student' as Role,
              email: firebaseUser.email
            };
            setUser(fallbackUser as any);
            localStorage.setItem('user', JSON.stringify(fallbackUser));
          }
          setLoading(false);
        });
      } else {
        if (unsubscribeUser) {
          unsubscribeUser();
          unsubscribeUser = null;
        }
        setUser(null);
        localStorage.removeItem('user');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = async () => {
    await auth.signOut();
    setUser(null);
    localStorage.removeItem('user');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login onLogin={login} /> : <Navigate to="/" />} />
        
        <Route element={<Layout user={user} onLogout={logout} />}>
          <Route path="/" element={
            user?.role === 'student' ? <StudentDashboard /> :
            user?.role === 'admin' ? <AdminDashboard /> :
            <SupervisorDashboard />
          } />
          
          {/* Specific Routes for each role can be added here */}
          <Route path="/student" element={user?.role === 'student' ? <StudentDashboard /> : <Navigate to="/" />} />
          <Route path="/logbook" element={user?.role === 'student' ? <Logbook /> : <Navigate to="/" />} />
          <Route path="/supervisor" element={user?.role?.includes('supervisor') ? <SupervisorDashboard /> : <Navigate to="/" />} />
          <Route path="/reviews" element={user?.role?.includes('supervisor') ? <Reviews /> : <Navigate to="/" />} />
          <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="/user-management" element={user?.role === 'admin' ? <UserManagement /> : <Navigate to="/" />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
