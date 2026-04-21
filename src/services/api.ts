import axios from 'axios';

// Set default base URL for relative paths
if (typeof window !== 'undefined') {
  axios.defaults.baseURL = window.location.origin;
}

import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  serverTimestamp,
  getDoc,
  setDoc,
  getDocFromServer,
  onSnapshot,
  deleteDoc
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  getIdToken,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
export { RecaptchaVerifier, signInWithPhoneNumber };
import { db, auth, googleProvider } from '../lib/firebase';
export { db, auth };

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection Test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}

// Auth
export const login = async (credentials: any) => {
  const trimmedEmail = credentials.email.trim();
  const password = credentials.password; // Don't trim password

  try {
    const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    
    if (userDoc.exists()) {
      return { id: userCredential.user.uid, ...userDoc.data() };
    }
    
    // If Auth succeeds but Firestore profile is missing, create one (fallback)
    const userProfile = {
      uid: userCredential.user.uid,
      name: userCredential.user.displayName || 'User',
      email: trimmedEmail,
      role: 'student',
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
    return { id: userCredential.user.uid, ...userProfile };
  } catch (error: any) {
    console.warn('Firebase Auth login failed, trying backend fallback:', error.code || error.message);
    
    // Fallback to backend login for mock users or if Firebase Auth is not yet set up correctly
    try {
      const response = await axios.post('/api/auth/login', { email: trimmedEmail, password });
      if (response.data && response.data.user) {
        console.log('Backend login successful (Mock User)');
        return response.data.user;
      }
    } catch (backendError: any) {
      const backendMsg = backendError.response?.data?.message || backendError.message;
      console.error('Backend login fallback also failed:', backendMsg);
      console.error('Backend error status:', backendError.response?.status);
      
      // If backend explicitly says 401, it means the mock user was found but password was wrong,
      // or no mock user was found at all.
      if (backendError.response?.status === 401) {
        throw new Error('Invalid email or password. If you are using a mock account, please use "password123". If you haven\'t registered yet, please create an account first.');
      }
    }

    const errorCode = error.code || '';
    const errorMessage = error.message || '';
    console.error('Firebase Auth error details:', { errorCode, errorMessage });
    
    if (
      errorCode === 'auth/invalid-credential' || 
      errorCode === 'auth/user-not-found' || 
      errorCode === 'auth/wrong-password' ||
      errorMessage.includes('auth/invalid-credential') ||
      errorMessage.includes('auth/user-not-found') ||
      errorMessage.includes('auth/wrong-password')
    ) {
      throw new Error('Invalid email or password. If you are using a mock account, please use "password123". If you haven\'t registered yet, please create an account first.');
    } else if (errorCode === 'auth/user-disabled') {
      throw new Error('This account has been disabled. Please contact the administrator.');
    } else if (errorCode === 'auth/network-request-failed' || errorMessage.includes('network-request-failed')) {
      throw new Error('Network error: Please check your internet connection and try again.');
    }
    throw error;
  }
};

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      return { id: user.uid, ...userDoc.data() };
    }
    
    // Create profile if it doesn't exist
    const userProfile = {
      uid: user.uid,
      name: user.displayName || 'User',
      email: user.email,
      photoURL: user.photoURL,
      role: (user.email === 'vincentandama96@gmail.com' || user.email === 'andamavincent941@gmail.com') ? 'admin' : 'student',
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', user.uid), userProfile);
    return { id: user.uid, ...userProfile };
  } catch (error: any) {
    console.error('Google login error:', error);
    throw error;
  }
};

export const register = async (userData: any) => {
  try {
    const { email, password, ...profileData } = userData;
    const trimmedEmail = email.trim();
    
    const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    const userProfile = {
      uid: userCredential.user.uid,
      email: trimmedEmail,
      ...profileData,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
    return { id: userCredential.user.uid, ...userProfile };
  } catch (error: any) {
    const errorCode = error.code || '';
    const errorMessage = error.message || String(error);
    
    if (errorCode === 'auth/email-already-in-use' || 
        errorMessage.includes('auth/email-already-in-use') ||
        errorMessage.includes('email-already-in-use')) {
      throw new Error('An account with this email already exists. Please try logging in instead.');
    }
    
    console.error('Registration error:', error);
    throw error;
  }
};

export const getUser = async (uid: string) => {
  const path = `users/${uid}`;
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const logout = async () => {
  await signOut(auth);
};

export const resetPassword = async (email: string) => {
  try {
    const response = await axios.post('/api/auth/reset-password', { email: email.trim() });
    return response.data;
  } catch (error: any) {
    console.error('Password reset error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to send password reset email');
  }
};

export const resetPasswordViaPhone = async (phoneIdToken: string, email: string, newPassword: string) => {
  try {
    const response = await axios.post('/api/auth/reset-password-phone', {
      phoneIdToken,
      email,
      newPassword
    });
    return response.data.message;
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    console.error('Phone password reset error:', msg);
    throw new Error(msg);
  }
};

export const getPhoneNumber = async (identifier: string) => {
  try {
    const response = await axios.post('/api/auth/get-phone-number', { identifier });
    return response.data.phoneNumber;
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    console.error('Get phone number error:', msg);
    throw new Error(msg);
  }
};

export const identifyUser = async (identifier: string) => {
  try {
    const response = await axios.post('/api/auth/identify', { identifier });
    return response.data; // { email, phoneNumber, name }
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    console.error('Identification error:', msg);
    throw new Error(msg);
  }
};

// Logs
export const getLogs = async (studentId?: string) => {
  const path = 'logs';
  try {
    let q = query(collection(db, path));
    if (studentId) {
      q = query(collection(db, path), where('studentId', '==', studentId));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// Attendance
export const getAttendance = async (studentId: string) => {
  const path = 'attendance';
  try {
    const q = query(collection(db, path), where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error: any) {
    console.warn('Firestore attendance fetch failed, trying backend fallback:', error.message);
    try {
      const response = await axios.get('/api/attendance', { params: { studentId } });
      return response.data;
    } catch (backendError) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }
};

export const markAttendance = async (studentId: string, status: string = 'present') => {
  const path = 'attendance';
  try {
    const date = new Date().toISOString().split('T')[0];
    const docRef = await addDoc(collection(db, path), {
      studentId,
      date,
      status,
      timestamp: serverTimestamp()
    });
    return { id: docRef.id, studentId, date, status };
  } catch (error: any) {
    console.warn('Firestore mark attendance failed, trying backend fallback:', error.message);
    try {
      const response = await axios.post('/api/attendance', { studentId, status, date: new Date().toISOString().split('T')[0] });
      return response.data;
    } catch (backendError) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
};

export const createLog = async (logData: any) => {
  const path = 'logs';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...logData,
      createdAt: serverTimestamp(),
      status: 'pending',
      fieldStatus: 'pending',
      academicStatus: 'pending',
      fieldFeedback: '',
      academicFeedback: '',
      academicGrade: ''
    });
    const newDoc = await getDoc(docRef);
    return { id: docRef.id, ...newDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Notifications
export const getNotifications = (userId: string, callback: (notifications: any[]) => void) => {
  const path = 'notifications';
  const q = query(
    collection(db, path),
    where('userId', '==', userId),
    where('deleted', '==', false)
  );
  
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort by timestamp descending
    notifications.sort((a: any, b: any) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });
    callback(notifications);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const createNotification = async (notificationData: any) => {
  const path = 'notifications';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...notificationData,
      read: false,
      deleted: false,
      timestamp: serverTimestamp(),
      senderId: auth.currentUser?.uid || 'system'
    });
    return docRef.id;
  } catch (error: any) {
    console.warn('Firestore createNotification failed, trying backend fallback:', error.message);
    try {
      const response = await axios.post('/api/notifications/individual', {
        ...notificationData,
        senderId: auth.currentUser?.uid || 'system'
      });
      return response.data.id;
    } catch (backendError) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
};

export const markNotificationAsRead = async (id: string) => {
  const path = `notifications/${id}`;
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (error: any) {
    console.warn('Firestore markNotificationAsRead failed, trying backend fallback:', error.message);
    try {
      await axios.patch(`/api/notifications/${id}`, { read: true });
    } catch (backendError) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};

export const deleteNotification = async (id: string) => {
  const path = `notifications/${id}`;
  try {
    await updateDoc(doc(db, 'notifications', id), { deleted: true });
  } catch (error: any) {
    console.warn('Firestore deleteNotification failed, trying backend fallback:', error.message);
    try {
      await axios.patch(`/api/notifications/${id}`, { deleted: true });
    } catch (backendError) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
};

export const sendGlobalNotification = async (message: string, title: string = 'Admin Notification', metadata: any = {}) => {
  try {
    const currentUser = auth.currentUser;
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const notificationPromises = usersSnapshot.docs.map(userDoc => {
      const userData = userDoc.data();
      // Exclude the sender and deleted users
      if (!userData.deleted && userDoc.id !== currentUser?.uid) {
        return createNotification({
          userId: userDoc.id,
          title,
          message,
          type: 'admin_alert',
          ...metadata
        });
      }
      return Promise.resolve();
    });
    await Promise.all(notificationPromises);
    
    // Also record this in a 'sent_history' collection for the admin
    if (currentUser) {
      await addDoc(collection(db, 'sent_notifications'), {
        senderId: currentUser.uid,
        title,
        message,
        recipientType: 'all',
        timestamp: serverTimestamp(),
        ...metadata
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send global notification:', error);
    throw error;
  }
};

export const sendIndividualNotification = async (userId: string, message: string, title: string = 'Direct Message', metadata: any = {}) => {
  try {
    const currentUser = auth.currentUser;
    await createNotification({
      userId,
      title,
      message,
      type: 'admin_alert',
      ...metadata
    });

    // Record in history
    if (currentUser) {
      await addDoc(collection(db, 'sent_notifications'), {
        senderId: currentUser.uid,
        recipientId: userId,
        title,
        message,
        recipientType: 'individual',
        timestamp: serverTimestamp(),
        ...metadata
      });
    }
    return true;
  } catch (error) {
    console.error('Failed to send individual notification:', error);
    throw error;
  }
};

export const getSentNotifications = async (adminId: string) => {
  const path = 'sent_notifications';
  try {
    const q = query(
      collection(db, path),
      where('senderId', '==', adminId)
    );
    const snapshot = await getDocs(q);
    const sent = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort by timestamp descending
    sent.sort((a: any, b: any) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });
    return sent;
  } catch (error: any) {
    console.warn('Firestore sent_notifications fetch failed, trying backend fallback:', error.message);
    try {
      const response = await axios.get('/api/sent_notifications', { params: { adminId } });
      return response.data;
    } catch (backendError) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }
};

export const updateLog = async (id: string, data: any) => {
  const path = `logs/${id}`;
  try {
    const docRef = doc(db, 'logs', id);
    const oldDoc = await getDoc(docRef);
    const oldData = oldDoc.data();
    
    await updateDoc(docRef, data);
    const updatedDoc = await getDoc(docRef);
    const updatedData = updatedDoc.data();

    // Automated Notification for status change
    if (data.status && data.status !== oldData?.status) {
      const statusLabel = data.status === 'approved' ? 'Approved' : 'Rejected';
      await createNotification({
        userId: updatedData?.studentId,
        title: `Logbook Entry ${statusLabel}`,
        message: `Your log entry for ${updatedData?.date} has been ${data.status} by your supervisor.${data.feedback ? ' Feedback: ' + data.feedback : ''}`,
        type: 'log_status',
        logId: id
      });
    }

    // Field status notification
    if (data.fieldStatus && data.fieldStatus !== oldData?.fieldStatus) {
      const statusLabel = data.fieldStatus === 'approved' ? 'Approved' : 'Rejected';
      await createNotification({
        userId: updatedData?.studentId,
        title: `Field Supervisor Review: ${statusLabel}`,
        message: `Your log entry for ${updatedData?.date} has been ${data.fieldStatus} by your Field Supervisor.${data.fieldFeedback ? ' Feedback: ' + data.fieldFeedback : ''}`,
        type: 'log_status',
        logId: id
      });
    }

    // Academic status notification
    if (data.academicStatus && data.academicStatus !== oldData?.academicStatus) {
      await createNotification({
        userId: updatedData?.studentId,
        title: `Academic Supervisor Review`,
        message: `Your log entry for ${updatedData?.date} has been reviewed by your Academic Supervisor.${data.academicGrade ? ' Grade: ' + data.academicGrade : ''}`,
        type: 'log_status',
        logId: id
      });
    }

    return { id, ...updatedData };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

// Users
export const getUsers = async () => {
  const path = 'users';
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const createUser = async (userData: any) => {
  const path = 'users';
  try {
    const { id, ...data } = userData;
    await setDoc(doc(db, path, id), data);
    return { id, ...data };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateUser = async (id: string, data: any) => {
  const path = `users/${id}`;
  try {
    const docRef = doc(db, 'users', id);
    await updateDoc(docRef, data);
    const updatedDoc = await getDoc(docRef);
    return { id, ...updatedDoc.data() };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteUser = async (uid: string) => {
  const path = `users/${uid}`;
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const idToken = await getIdToken(currentUser);
    console.log(`[API Service] Attempting hard delete for user ${uid}...`);

    // 1. Try the backend hard delete first
    try {
      const response = await axios.delete(`/api/users/${uid}`, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      console.log(`[API Service] Hard delete successful:`, response.data.message);
      return response.data.message || 'User permanently deleted from system.';
    } catch (backendError: any) {
      const backendMsg = backendError.response?.data?.message || backendError.message;
      console.error('[API Service] Backend hard delete failed:', backendMsg);
      
      // If it's a permission error, try a soft delete as fallback
      const isPermissionError = 
        backendMsg.includes('Permission Denied') || 
        backendMsg.includes('PERMISSION_DENIED') || 
        backendMsg.includes('insufficient permissions') ||
        backendMsg.includes('status: 7');

      if (isPermissionError) {
        console.warn('[API Service] Hard delete failed due to permissions. Attempting soft delete fallback...');
        try {
          const userRef = doc(db, 'users', uid);
          await updateDoc(userRef, { 
            deleted: true, 
            deletedAt: new Date().toISOString(),
            deletedBy: currentUser.uid
          });
          return 'Hard delete failed (Permission Denied), but user has been soft-deleted from the dashboard. Their Auth account still exists.';
        } catch (softError: any) {
          console.error('[API Service] Soft delete fallback also failed:', softError.message, softError);
          
          // Final attempt: try direct deleteDoc (will only work if firestore.rules allow it)
          try {
            console.warn('[API Service] Attempting direct deleteDoc as final fallback...');
            await deleteDoc(doc(db, 'users', uid));
            return 'Hard delete failed, but user was removed from Firestore via direct client-side delete.';
          } catch (finalError: any) {
            console.error('[API Service] All deletion attempts failed:', finalError.message, finalError);
          }
        }
      }
      
      throw new Error(`Hard delete failed: ${backendMsg}. The user's Auth account still exists, which prevents re-registration with the same email.`);
    }
  } catch (error: any) {
    console.error('Delete user error:', error);
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const cleanupSoftDeletedUsers = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const idToken = await getIdToken(currentUser);
    console.log('[API Service] Requesting cleanup of soft-deleted users...');

    const response = await axios.post('/api/admin/cleanup-deleted', {}, {
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });
    return response.data.message;
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message;
    console.error('Cleanup error:', msg);
    throw new Error(`Cleanup failed: ${msg}`);
  }
};

export const normalizeAccessNumber = (input: string): string => {
  let trimmed = input.trim().toLowerCase();
  
  // If it looks like "Name email@example.com", extract just the email
  const emailMatch = trimmed.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    trimmed = emailMatch[0];
  }

  // Match ar1234 or ar1234@students.ucu.ac.ug (allow 4 or more digits)
  const match = trimmed.match(/^(ar\d{4,})(@students\.ucu\.ac\.ug)?$/);
  if (match) {
    return `${match[1]}@students.ucu.ac.ug`;
  }
  return trimmed; // Return as is if it doesn't match (might be a supervisor email)
};

// System Notifications API (Broadcasts)
export const getSystemNotifications = async (role?: string) => {
  try {
    console.log(`[API Service] Fetching system notifications for role: ${role || 'none'}`);
    const queryParams = role ? `?role=${role}` : '';
    const response = await fetch(`/api/notifications${queryParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    console.error('Error fetching system notifications:', error);
    throw error;
  }
};

export const createSystemNotification = async (notification: { title: string; message: string; target: string; author: string }) => {
  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    console.error('Error creating system notification:', error);
    throw error;
  }
};

export const deleteSystemNotification = async (id: number) => {
  try {
    const response = await fetch(`/api/notifications/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error: any) {
    console.error('Error deleting system notification:', error);
    throw error;
  }
};

export { onAuthStateChanged };
