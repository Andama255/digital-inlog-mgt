import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import axios from 'axios';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;
let firebaseApp: admin.app.App;

async function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    console.log(`[Server] Found ${admin.apps.length} existing Firebase apps. Cleaning up...`);
    await Promise.all(admin.apps.map(app => app?.delete()));
  }

  const envProjectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  const configProjectId = firebaseConfig.projectId;
  const targetProjectId = envProjectId || configProjectId;

  try {
    console.log(`[Server] Initializing Firebase Admin. Env Project: ${envProjectId}, Config Project: ${configProjectId}`);
    
    firebaseApp = admin.initializeApp({
      projectId: targetProjectId,
      credential: admin.credential.applicationDefault(),
    });
    
    console.log(`[Server] Firebase Admin initialized successfully. Project: ${firebaseApp.options.projectId}`);
    auth = firebaseApp.auth();
    
    // Verify Firestore connectivity (Non-blocking)
    let dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined;
    console.log(`[Server] Testing Firestore connectivity for database: ${dbId || '(default)'}`);
    
    // Use the admin.firestore() helper which is often more reliable
    db = admin.firestore(firebaseApp);
    if (dbId) {
      // If a specific database ID is provided, we need to use getFirestore from the sub-package
      // but we'll try to use the default one first if it works
      try {
        const namedDb = getFirestore(firebaseApp, dbId);
        await namedDb.collection('_health_check').limit(1).get();
        db = namedDb;
        console.log(`[Server] Successfully connected to named database: ${dbId}`);
      } catch (namedErr: any) {
        console.warn(`[Server] Failed to connect to named database "${dbId}": ${namedErr.message}. Falling back to (default).`);
        db = admin.firestore(firebaseApp);
        dbId = undefined;
      }
    }
    
    // Perform health check in background
    (async () => {
      try {
        await db.collection('_health_check').limit(1).get();
        console.log(`[Server] Firestore connectivity verified successfully.`);
      } catch (fsErr: any) {
        console.error(`[Server] Firestore connectivity test failed: ${fsErr.message}`);
      }
    })();
  } catch (e: any) {
    console.error(`[Server] Firebase Admin initialization failed: ${e.message}`);
    
    try {
      console.log('[Server] Falling back to zero-config initialization...');
      firebaseApp = admin.initializeApp();
      auth = firebaseApp.auth();
      db = admin.firestore();
      console.log(`[Server] Zero-config initialization successful. Project: ${firebaseApp.options.projectId || 'Default'}`);
    } catch (fallbackErr: any) {
      console.error(`[Server] All initialization attempts failed: ${fallbackErr.message}`);
    }
  }
}

await initializeFirebaseAdmin();

// Test Firestore connection
(async () => {
  console.log(`[Server] Starting connection tests...`);
  console.log(`[Server] Admin Options: ${JSON.stringify(firebaseApp.options)}`);
  console.log(`[Server] Database ID: ${firebaseConfig.firestoreDatabaseId}`);
  
  // Test Auth
  try {
    const listResult = await auth.listUsers(1);
    console.log(`[Server] Auth connection successful. Found ${listResult.users.length} users.`);
  } catch (e: any) {
    console.error(`[Server] Auth connection failed: ${e.message}`);
    if (e.message.includes('identitytoolkit.googleapis.com') || e.code === 'auth/operation-not-allowed') {
      console.error('================================================================================');
      console.error('CRITICAL: Identity Toolkit API is disabled or not configured.');
      console.error(`Please visit: https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${firebaseConfig.projectId}`);
      console.error('And ensure Firebase Authentication is enabled in the Firebase Console.');
      console.error('================================================================================');
    }
  }

  // Test Named Firestore
  try {
    const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined;
    const testDb = getFirestore(firebaseApp, dbId);
    const namedSnapshot = await testDb.collection('users').limit(1).get();
    console.log(`[Server] Firestore DB connection successful. Found ${namedSnapshot.size} users.`);
  } catch (e: any) {
    console.error(`[Server] Firestore DB connection failed: ${e.message}`);
    if (e.code === 7 || e.message.includes('PERMISSION_DENIED')) {
      console.error('================================================================================');
      console.error('CRITICAL: Permission Denied on Firestore database.');
      console.error(`Database ID: ${firebaseConfig.firestoreDatabaseId}`);
      console.error('This usually means the Service Account lacks "Cloud Datastore User" permissions.');
      console.error('Or the database ID is incorrect for this project.');
      console.error('================================================================================');
    } else if (e.code === 5 || e.message.includes('NOT_FOUND')) {
      console.error('================================================================================');
      console.error('CRITICAL: Firestore database not found.');
      console.error(`Database ID: ${firebaseConfig.firestoreDatabaseId}`);
      console.error('Ensure the database exists and the ID matches exactly.');
      console.error('================================================================================');
    }
  }
})();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', async (req, res) => {
    let firestoreStatus = 'unknown';
    try {
      if (db) {
        await db.collection('_health_check').limit(1).get();
        firestoreStatus = 'connected';
      }
    } catch (e) {
      firestoreStatus = 'error';
    }
    
    res.json({ 
      status: 'ok', 
      firestore: firestoreStatus,
      timestamp: new Date().toISOString() 
    });
  });

  // --- Mock Database ---
  let users = [
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'student', password: 'password123', accessNumber: 'AR6006', phoneNumber: '+256700000001' },
    { id: '2', name: 'Supervisor Smith', email: 'smith@agency.com', role: 'field_supervisor', password: 'password123', phoneNumber: '+256700000002' },
    { id: '3', name: 'Dr. Academic', email: 'academic@uni.edu', role: 'academic_supervisor', password: 'password123', phoneNumber: '+256700000003' },
    { id: '4', name: 'Jane Admin', email: 'admin@system.com', role: 'admin', password: 'password123', phoneNumber: '+256700000004' },
    { id: '5', name: 'Vincent Andama', email: 'vincentandama96@gmail.com', role: 'admin', password: 'password123', phoneNumber: '+256700000005' },
    { id: '6', name: 'Vincent Andama (Alt)', email: 'andamavincent941@gmail.com', role: 'admin', password: 'password123', phoneNumber: '+256700000006' },
    { id: '7', name: 'Student User', email: 'ar6343@students.ucu.ac.ug', role: 'student', password: 'password123', accessNumber: 'AR6343', phoneNumber: '+256700000007' },
    { id: '8', name: 'Student Test', email: 'ar6159@students.ucu.ac.ug', role: 'student', password: 'password123', accessNumber: 'AR6159', phoneNumber: '+256700000008' },
  ];
  console.log(`[Server] Initialized with ${users.length} mock users.`);

  let logs: any[] = [
    { id: 1, studentId: '1', date: '2026-03-30', activity: 'Developed the frontend layout for the dashboard using React and Tailwind CSS.', status: 'approved', supervisor: 'Supervisor Smith', feedback: 'Excellent work on the UI components.' },
    { id: 2, studentId: '1', date: '2026-03-29', activity: 'Integrated API endpoints for user authentication and role-based access control.', status: 'pending', supervisor: 'Supervisor Smith' },
  ];

  let attendance = [
    { id: 1, studentId: '1', date: '2026-03-31', status: 'present' },
    { id: 2, studentId: '1', date: '2026-03-30', status: 'present' },
  ];

  let sent_notifications: any[] = [];

  let notifications: any[] = [
    { 
      id: 1, 
      title: 'System Maintenance', 
      message: 'The system will be down for maintenance on Sunday from 2:00 AM to 4:00 AM.', 
      target: 'all', 
      createdAt: new Date().toISOString(),
      author: 'Admin'
    },
    { 
      id: 2, 
      title: 'Logbook Submission Deadline', 
      message: 'Please ensure all your weekly logs are submitted by Friday 5:00 PM.', 
      target: 'student', 
      createdAt: new Date().toISOString(),
      author: 'Admin'
    }
  ];

  // --- Debug Route ---
  app.get('/api/debug/firebase', async (req, res) => {
    const results: any = {
      config: {
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
      },
      admin: {
        projectId: admin.app().options.projectId,
        apps: admin.apps.length,
        appName: admin.app().name,
      },
      env: {
        NODE_ENV: process.env.NODE_ENV,
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'SET' : 'NOT SET',
      }
    };

    try {
      await auth.listUsers(1);
      results.auth = 'OK';
    } catch (e: any) {
      results.auth = `Error: ${e.message}`;
    }

    try {
      const defaultDb = getFirestore(admin.app());
      await defaultDb.collection('users').limit(1).get();
      results.firestoreDefault = 'OK';
    } catch (e: any) {
      results.firestoreDefault = `Error: ${e.message}`;
    }

    try {
      await db.collection('users').limit(1).get();
      results.firestoreNamed = 'OK';
    } catch (e: any) {
      results.firestoreNamed = `Error: ${e.message}`;
    }

    res.json(results);
  });

  // --- API Routes ---

  // User Deletion (Hard Delete from Auth and Firestore)
  app.delete('/api/users/:uid', async (req, res) => {
    const { uid } = req.params;
    const authHeader = req.headers.authorization;

    console.log(`[Admin API] Deletion request received for UID: ${uid}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Admin API] Missing or invalid authorization header');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
      // Verify the requester is an admin
      const decodedToken = await auth.verifyIdToken(idToken);
      const requesterUid = decodedToken.uid;
      console.log(`[Admin API] Requester UID: ${requesterUid}, Email: ${decodedToken.email}`);
      
      const requesterDoc = await db.collection('users').doc(requesterUid).get();
      const requesterData = requesterDoc.data();

      let isAdmin = false;
      if (requesterData && requesterData.role === 'admin') {
        isAdmin = true;
        console.log(`[Admin API] Requester ${requesterUid} verified as admin via Firestore role`);
      } else if (decodedToken.email === 'vincentandama96@gmail.com' || decodedToken.email === 'andamavincent941@gmail.com') {
        isAdmin = true;
        console.log(`[Admin API] Requester ${requesterUid} verified as admin via hardcoded email fallback (${decodedToken.email})`);
        if (!decodedToken.email_verified) {
          console.warn('[Admin API] Warning: Admin email is not verified, but allowing access anyway for the primary admin.');
        }
      }

      if (!isAdmin) {
        console.error(`[Admin API] Forbidden: Requester ${requesterUid} (${decodedToken.email}) is not an admin. Role in DB: ${requesterData?.role}`);
        return res.status(403).json({ message: `Forbidden: Admin access required. Your current role is ${requesterData?.role || 'none'}` });
      }

      // 1. Delete from Firebase Auth
      console.log(`[Admin API] Attempting to delete user ${uid} from Firebase Auth...`);
      try {
        await auth.deleteUser(uid);
        console.log(`[Admin API] User ${uid} deleted from Firebase Auth`);
      } catch (authError: any) {
        // If user already deleted from Auth, just log and continue to Firestore
        if (authError.code === 'auth/user-not-found') {
          console.warn(`[Admin API] User ${uid} not found in Auth, likely already deleted.`);
        } else if (authError.code === 'auth/insufficient-permission' || authError.message.includes('PERMISSION_DENIED')) {
          console.error('[Admin API] CRITICAL: Service account lacks Auth Admin permissions.');
          throw new Error(`Auth deletion failed: Permission Denied. Ensure the Service Account has "Firebase Authentication Admin" role. Original error: ${authError.message}`);
        } else {
          console.error(`[Admin API] Auth deletion failed for ${uid}:`, authError.message);
          throw authError;
        }
      }

      // 2. Delete from Firestore
      console.log(`[Admin API] Attempting to delete user ${uid} from Firestore...`);
      try {
        // Try to delete from the current db instance
        await db.collection('users').doc(uid).delete();
        console.log(`[Admin API] User ${uid} deleted from primary Firestore instance`);
      } catch (firestoreError: any) {
        console.warn(`[Admin API] Firestore delete failed for ${uid}:`, firestoreError.message);
        
        // If it was a permission error, try both (default) and the named database
        const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined;
        
        if (firestoreError.code === 7 || firestoreError.message.includes('PERMISSION_DENIED')) {
          console.log(`[Admin API] Permission Denied. Attempting multi-database deletion strategy...`);
          
          let deleted = false;
          
          // Try (default) database
          try {
            console.log(`[Admin API] Trying (default) database...`);
            const defaultDb = admin.firestore(firebaseApp);
            await defaultDb.collection('users').doc(uid).delete();
            console.log(`[Admin API] User ${uid} deleted from (default) Firestore instance`);
            deleted = true;
          } catch (defaultErr: any) {
            console.warn(`[Admin API] (default) database delete failed:`, defaultErr.message);
          }
          
          // Try named database if it exists and we haven't succeeded yet
          if (!deleted && dbId) {
            try {
              console.log(`[Admin API] Trying named database: ${dbId}...`);
              const namedDb = getFirestore(firebaseApp, dbId);
              await namedDb.collection('users').doc(uid).delete();
              console.log(`[Admin API] User ${uid} deleted from named Firestore instance: ${dbId}`);
              deleted = true;
            } catch (namedErr: any) {
              console.warn(`[Admin API] Named database delete failed:`, namedErr.message);
            }
          }
          
          if (!deleted) {
            console.error(`[Admin API] All Firestore deletion attempts failed for ${uid}`);
            throw new Error(`Firestore deletion failed: Permission Denied on all attempted database instances. Please ensure the Service Account has "Cloud Datastore User" or "Firebase Firestore Admin" role.`);
          }
        } else {
          throw new Error(`Auth delete may have succeeded, but Firestore delete failed: ${firestoreError.message}`);
        }
      }

      res.json({ message: 'User successfully deleted from Auth and Firestore' });
    } catch (error: any) {
      console.error('[Admin API] Error deleting user:', error);
      // Return a more descriptive error message to the frontend
      const errorMessage = error.message || 'Unknown error';
      res.status(500).json({ 
        message: `Failed to delete user: ${errorMessage}`,
        error: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Cleanup Route (Permanently delete all soft-deleted users)
  app.post('/api/admin/cleanup-deleted', async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      const requesterUid = decodedToken.uid;
      const requesterDoc = await db.collection('users').doc(requesterUid).get();
      const requesterData = requesterDoc.data();

      if (requesterData?.role !== 'admin' && decodedToken.email !== 'vincentandama96@gmail.com' && decodedToken.email !== 'andamavincent941@gmail.com') {
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
      }

      console.log('[Admin API] Starting cleanup of soft-deleted and orphaned users...');
      
      const results = {
        total: 0,
        success: 0,
        failed: 0,
        errors: [] as string[]
      };

      // 1. Cleanup users marked as 'deleted' in Firestore
      const deletedUsersSnapshot = await db.collection('users').where('deleted', '==', true).get();
      results.total += deletedUsersSnapshot.size;

      for (const doc of deletedUsersSnapshot.docs) {
        const uid = doc.id;
        try {
          // Delete from Auth
          try {
            await auth.deleteUser(uid);
          } catch (authErr: any) {
            console.warn(`[Admin API] Cleanup: User ${uid} not in Auth:`, authErr.message);
          }
          // Delete from Firestore
          await doc.ref.delete();
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`${uid}: ${err.message}`);
        }
      }

      // 2. Cleanup orphaned Auth users (in Auth but no Firestore doc)
      try {
        const listUsersResult = await auth.listUsers(1000);
        for (const userRecord of listUsersResult.users) {
          const uid = userRecord.uid;
          
          // Skip the requester and the default admin email
          if (uid === requesterUid || userRecord.email === 'vincentandama96@gmail.com' || userRecord.email === 'andamavincent941@gmail.com') {
            continue;
          }

          const userDoc = await db.collection('users').doc(uid).get();
          if (!userDoc.exists) {
            console.log(`[Admin API] Found orphaned Auth user: ${uid} (${userRecord.email}). Deleting...`);
            try {
              await auth.deleteUser(uid);
              results.success++;
              results.total++;
            } catch (err: any) {
              results.failed++;
              results.errors.push(`Orphaned ${uid}: ${err.message}`);
            }
          }
        }
      } catch (listErr: any) {
        console.error('[Admin API] Error listing users for cleanup:', listErr.message);
        results.errors.push(`Error listing users: ${listErr.message}`);
      }

      res.json({ 
        message: `Cleanup complete. Processed ${results.total} users. Success: ${results.success}, Failed: ${results.failed}`,
        results 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cleanup Logs and Attendance (Delete all or orphaned)
  app.post('/api/admin/cleanup-logs', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      const requesterUid = decodedToken.uid;
      const requesterDoc = await db.collection('users').doc(requesterUid).get();
      const requesterData = requesterDoc.data();

      if (requesterData?.role !== 'admin' && decodedToken.email !== 'vincentandama96@gmail.com' && decodedToken.email !== 'andamavincent941@gmail.com') {
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
      }

      console.log('[Admin API] Starting cleanup of logs and attendance...');
      
      const results = {
        logsDeleted: 0,
        attendanceDeleted: 0,
        errors: [] as string[]
      };

      // 1. Delete all logs (as requested to start fresh)
      const logsSnapshot = await db.collection('logs').get();
      for (const doc of logsSnapshot.docs) {
        try {
          await doc.ref.delete();
          results.logsDeleted++;
        } catch (err: any) {
          results.errors.push(`Log ${doc.id}: ${err.message}`);
        }
      }

      // 2. Delete all attendance
      const attendanceSnapshot = await db.collection('attendance').get();
      for (const doc of attendanceSnapshot.docs) {
        try {
          await doc.ref.delete();
          results.attendanceDeleted++;
        } catch (err: any) {
          results.errors.push(`Attendance ${doc.id}: ${err.message}`);
        }
      }

      // Also clear mock data in memory
      logs.length = 0;
      attendance.length = 0;

      res.json({ message: 'Logs and attendance cleared successfully', results });
    } catch (error: any) {
      console.error('[Admin API] Logs cleanup error:', error);
      res.status(500).json({ message: 'Cleanup failed', error: error.message });
    }
  });

  // Clear only pending logs
  app.post('/api/admin/clear-pending-logs', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      const requesterUid = decodedToken.uid;
      const requesterDoc = await db.collection('users').doc(requesterUid).get();
      const requesterData = requesterDoc.data();

      if (requesterData?.role !== 'admin' && decodedToken.email !== 'vincentandama96@gmail.com' && decodedToken.email !== 'andamavincent941@gmail.com') {
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
      }

      console.log('[Admin API] Clearing pending logs...');
      
      const results = {
        pendingLogsDeleted: 0,
        errors: [] as string[]
      };

      // 1. Delete pending logs from Firestore
      const pendingLogsSnapshot = await db.collection('logs').where('status', '==', 'pending').get();
      for (const doc of pendingLogsSnapshot.docs) {
        try {
          await doc.ref.delete();
          results.pendingLogsDeleted++;
        } catch (err: any) {
          results.errors.push(`Log ${doc.id}: ${err.message}`);
        }
      }

      // 2. Clear pending logs from memory
      // We need to use splice or filter to update the existing array reference if it's shared
      const remainingLogs = logs.filter(l => l.status !== 'pending');
      logs.length = 0;
      logs.push(...remainingLogs);

      res.json({ message: 'Pending logs cleared', results });
    } catch (error: any) {
      console.error('[Admin API] Clear pending logs error:', error);
      res.status(500).json({ message: 'Failed to clear pending logs', error: error.message });
    }
  });

  // Password Reset via Phone OTP
  app.post('/api/auth/reset-password-phone', async (req, res) => {
    const { phoneIdToken, email, newPassword } = req.body;
    console.log(`[Reset API] Received reset request for email: "${email}"`);

    if (!phoneIdToken || !email || !newPassword) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
      // 1. Verify the Phone ID Token (this proves the user owns the phone number)
      const decodedPhoneToken = await auth.verifyIdToken(phoneIdToken);
      const verifiedPhoneNumber = decodedPhoneToken.phone_number;
      console.log(`[Reset API] Verified phone number from token: ${verifiedPhoneNumber}`);

      if (!verifiedPhoneNumber) {
        return res.status(400).json({ message: 'Invalid phone token: No phone number found' });
      }

      // 2. Find the user in Firestore by email or access number
      const input = email.trim().toLowerCase();
      let userDoc: any = null;

      // Try the primary database
      try {
        const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined;
        console.log(`[Reset API] Querying primary database: ${dbId || '(default)'}`);
        const currentDb = getFirestore(firebaseApp, dbId);
        const usersRef = currentDb.collection('users');
        const emailQuery = await usersRef.where('email', '==', input).get();
        if (!emailQuery.empty) {
          userDoc = emailQuery.docs[0];
          console.log(`[Reset API] Found user in primary database by email: ${input}`);
        } else {
          const accessQuery = await usersRef.where('accessNumber', '==', email.trim().toUpperCase()).get();
          if (!accessQuery.empty) {
            userDoc = accessQuery.docs[0];
            console.log(`[Reset API] Found user in primary database by access number: ${email.trim().toUpperCase()}`);
          }
        }
      } catch (primaryError: any) {
        console.warn(`[Reset API] Primary database lookup failed (Code: ${primaryError.code}): ${primaryError.message}`);
        // Fallback for PERMISSION_DENIED (7) or NOT_FOUND (5)
        if (primaryError.code === 7 || primaryError.code === 5 || primaryError.message.includes('PERMISSION_DENIED') || primaryError.message.includes('NOT_FOUND')) {
          console.log('[Reset API] Attempting fallback to default database...');
          try {
            const defaultDb = getFirestore(firebaseApp);
            const usersRef = defaultDb.collection('users');
            const emailQuery = await usersRef.where('email', '==', input).get();
            if (!emailQuery.empty) {
              userDoc = emailQuery.docs[0];
              console.log(`[Reset API] Found user in default database by email: ${input}`);
            } else {
              const accessQuery = await usersRef.where('accessNumber', '==', email.trim().toUpperCase()).get();
              if (!accessQuery.empty) {
                userDoc = accessQuery.docs[0];
                console.log(`[Reset API] Found user in default database by access number: ${email.trim().toUpperCase()}`);
              }
            }
          } catch (fallbackError: any) {
            console.error(`[Reset API] Fallback database lookup failed: ${fallbackError.message}`);
            
            // Try Firebase Auth as another fallback
            try {
              const isEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
              if (isEmail(input)) {
                console.log(`[Reset API] Checking Firebase Auth for email: ${input}`);
                const authUser = await auth.getUserByEmail(input);
                if (authUser) {
                  console.log(`[Reset API] Found user in Firebase Auth: ${authUser.uid}`);
                  userDoc = { data: () => ({ phoneNumber: authUser.phoneNumber, email: authUser.email }), id: authUser.uid };
                }
              } else {
                console.log(`[Reset API] Skipping Firebase Auth check: "${input}" is not a valid email format.`);
              }
            } catch (authErr: any) {
              console.log(`[Reset API] Firebase Auth check failed: ${authErr.message}`);
            }

            if (!userDoc) {
              // Final fallback to mock users
              console.log(`[Reset API] Using mock users as final fallback for "${input}"...`);
              const mockUser = users.find(u => u.email === input || u.accessNumber === email.trim().toUpperCase());
              if (mockUser) {
                console.log(`[Reset API] Found mock user: ${mockUser.email}`);
                userDoc = { data: () => mockUser, id: mockUser.id };
              } else {
                console.log(`[Reset API] Mock user not found for "${input}". Available mock emails: ${users.map(u => u.email).join(', ')}`);
              }
            }
          }
        } else {
          throw primaryError;
        }
      }

      if (!userDoc) {
        return res.status(404).json({ message: 'No account found with this email or access number' });
      }

      const userData = userDoc.data();
      const storedPhoneNumber = userData.phoneNumber;

      // 3. Verify the phone number matches what's in the database (if available)
      if (storedPhoneNumber) {
        // Normalize both for comparison (remove spaces, etc.)
        const normalize = (p: string) => p.replace(/\s+/g, '').replace(/[()\-]/g, '');
        if (normalize(storedPhoneNumber) !== normalize(verifiedPhoneNumber)) {
          console.error(`[Reset API] Phone mismatch. Stored: ${storedPhoneNumber}, Verified: ${verifiedPhoneNumber}`);
          return res.status(403).json({ message: 'The verified phone number does not match the one on record for this account.' });
        }
      } else {
        console.log('[Reset API] No phone number on record to compare against, relying on token verification only.');
      }

      // 4. Update the user's password
      const uid = userDoc.id;
      
      // Try to update Firebase Auth first
      try {
        await auth.updateUser(uid, {
          password: newPassword
        });
        console.log(`[Reset API] Password successfully reset for user ${uid} via phone verification in Firebase Auth`);
      } catch (authError: any) {
        console.warn(`[Reset API] Firebase Auth update failed (Code: ${authError.code}): ${authError.message}`);
        // If user not found in Auth, it might be a mock user
        if (authError.code === 'auth/user-not-found' || authError.message.includes('user-not-found')) {
          console.log('[Reset API] User not found in Auth, checking mock users...');
          const mockUserIndex = users.findIndex(u => u.id === uid || u.email === input);
          if (mockUserIndex !== -1) {
            users[mockUserIndex].password = newPassword;
            console.log(`[Reset API] Password successfully reset for mock user ${users[mockUserIndex].email}`);
          } else {
            throw authError; // Re-throw if not even in mock
          }
        } else {
          throw authError;
        }
      }

      // 5. Update Firestore if possible
      try {
        const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined;
        const currentDb = getFirestore(firebaseApp, dbId);
        await currentDb.collection('users').doc(uid).update({ password: newPassword });
      } catch (e) {
        // Ignore firestore update errors if auth/mock update worked
        console.warn('[Reset API] Could not update password in Firestore, but Auth/Mock update succeeded');
      }

      res.json({ message: 'Password successfully reset. You can now login with your new password.' });

    } catch (error: any) {
      console.error('[Reset API] Error resetting password via phone:', error);
      res.status(500).json({ message: `Failed to reset password: ${error.message}` });
    }
  });

  // Identify User for Reset (Public endpoint)
  app.post('/api/auth/identify', async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ message: 'Identifier is required' });

    console.log(`[Auth API] Identification request for: "${identifier}"`);

    try {
      const input = identifier.trim().toLowerCase();
      const searchTerms = new Set<string>();
      searchTerms.add(input);
      searchTerms.add(identifier.trim());
      searchTerms.add(identifier.trim().toUpperCase());
      
      // Aggressive cleaning (remove all spaces)
      const noSpaces = identifier.replace(/\s+/g, '');
      searchTerms.add(noSpaces.toLowerCase());
      searchTerms.add(noSpaces.toUpperCase());
      
      // Handle UCU Student patterns
      const ucuMatch = noSpaces.toLowerCase().match(/^([a-z]{2})(\d{4,})$/);
      if (ucuMatch) {
        const prefix = ucuMatch[1];
        const digits = ucuMatch[2];
        searchTerms.add(`${prefix}${digits}@students.ucu.ac.ug`);
        searchTerms.add(`${prefix.toUpperCase()}${digits}`);
      } else if (noSpaces.toLowerCase().endsWith('@students.ucu.ac.ug')) {
        const prefix = noSpaces.toLowerCase().split('@')[0];
        searchTerms.add(prefix);
        searchTerms.add(prefix.toUpperCase());
      }

      const finalSearchTerms = Array.from(searchTerms);
      console.log(`[Auth API] Search terms:`, finalSearchTerms);

      const learnAccount = async (authUser: any) => {
        // Auto-Learning: Create Firestore document if it doesn't exist
        const userDataToLearn: any = {
          uid: authUser.uid,
          email: authUser.email || null,
          name: authUser.displayName || 'User',
          phoneNumber: authUser.phoneNumber || null,
          role: 'student', // Default to student for auto-learned accounts
          createdAt: new Date().toISOString(),
          learnedAt: new Date().toISOString()
        };

        // Try to derive access number from email
        if (authUser.email) {
          const emailPrefix = authUser.email.split('@')[0];
          if (emailPrefix && /^[a-z]{2}\d{4,}$/i.test(emailPrefix)) {
            userDataToLearn.accessNumber = emailPrefix.toUpperCase();
          }
        }

        try {
          const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined;
          const currentDb = getFirestore(firebaseApp, dbId);
          await currentDb.collection('users').doc(authUser.uid).set(userDataToLearn, { merge: true });
          console.log(`[Auth API] Successfully learned account into Firestore: ${authUser.email || authUser.phoneNumber}`);
        } catch (learnErr: any) {
          console.warn(`[Auth API] Failed to learn account into Firestore: ${learnErr.message}`);
        }

        return { data: () => userDataToLearn, id: authUser.uid };
      };

      let userDoc: any = null;

      // Helper to find user in a specific DB
      const findUser = async (dbInstance: any) => {
        const usersRef = dbInstance.collection('users');
        for (const term of finalSearchTerms) {
          // Try email match
          const emailQuery = await usersRef.where('email', '==', term).get();
          if (!emailQuery.empty) {
            console.log(`[Auth API] Found user in Firestore by email: ${term}`);
            return emailQuery.docs[0];
          }
          // Try accessNumber match
          const accessQuery = await usersRef.where('accessNumber', '==', term).get();
          if (!accessQuery.empty) {
            console.log(`[Auth API] Found user in Firestore by accessNumber: ${term}`);
            return accessQuery.docs[0];
          }
          // Try phoneNumber match
          const phoneQuery = await usersRef.where('phoneNumber', '==', term).get();
          if (!phoneQuery.empty) {
            console.log(`[Auth API] Found user in Firestore by phoneNumber: ${term}`);
            return phoneQuery.docs[0];
          }
          
          // Try phone match with variations (e.g. if term is 07... and db has +2567...)
          if (term.startsWith('0') && term.length >= 9) {
            const withCode = '+256' + term.substring(1);
            const phoneQuery2 = await usersRef.where('phoneNumber', '==', withCode).get();
            if (!phoneQuery2.empty) {
              console.log(`[Auth API] Found user in Firestore by phone variation: ${withCode}`);
              return phoneQuery2.docs[0];
            }
          }
        }
        return null;
      };

      // 1. Try Primary DB
      try {
        const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined;
        userDoc = await findUser(getFirestore(firebaseApp, dbId));
      } catch (e: any) {
        if (e.code === 7 || e.message.includes('PERMISSION_DENIED')) {
          console.error(`[Auth API] Primary DB lookup failed: PERMISSION_DENIED. Check Service Account permissions for database ${firebaseConfig.firestoreDatabaseId}`);
        } else {
          console.warn(`[Auth API] Primary DB lookup failed: ${e.message}`);
        }
      }

      // 2. Try Default DB if not found (only if it's different from primary)
      if (!userDoc && firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
        try {
          console.log('[Auth API] Trying fallback to (default) database...');
          userDoc = await findUser(getFirestore(firebaseApp));
        } catch (e: any) {
          if (e.code === 5 || e.message.includes('NOT_FOUND')) {
            console.log(`[Auth API] Default DB lookup failed: NOT_FOUND (Expected if project only has named database)`);
          } else {
            console.warn(`[Auth API] Default DB lookup failed: ${e.message}`);
          }
        }
      }

      if (!userDoc) {
        try {
          for (const term of finalSearchTerms) {
            // Check for Email
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term)) {
              console.log(`[Auth API] Checking Firebase Auth for email: ${term}`);
              const authUser = await auth.getUserByEmail(term);
              if (authUser) {
                console.log(`[Auth API] Found user in Firebase Auth by email: ${term}. Learning account...`);
                userDoc = await learnAccount(authUser);
                break;
              }
            }
            
            // Check for Phone Number
            if (/^\+?[1-9]\d{1,14}$/.test(term.replace(/\s+/g, ''))) {
              const cleanPhone = term.replace(/\s+/g, '');
              console.log(`[Auth API] Checking Firebase Auth for phone: ${cleanPhone}`);
              try {
                const authUser = await auth.getUserByPhoneNumber(cleanPhone);
                if (authUser) {
                  console.log(`[Auth API] Found user in Firebase Auth by phone: ${cleanPhone}. Learning account...`);
                  userDoc = await learnAccount(authUser);
                  break;
                }
              } catch (phoneErr: any) {
                // If not found by phone, try with +256 prefix if it starts with 0
                if (cleanPhone.startsWith('0') && cleanPhone.length >= 9) {
                  const withCode = '+256' + cleanPhone.substring(1);
                  console.log(`[Auth API] Checking Firebase Auth for phone variation: ${withCode}`);
                  try {
                    const authUser2 = await auth.getUserByPhoneNumber(withCode);
                    if (authUser2) {
                      console.log(`[Auth API] Found user in Firebase Auth by phone variation: ${withCode}. Learning account...`);
                      userDoc = await learnAccount(authUser2);
                      break;
                    }
                  } catch (e2) {}
                }
              }
            }
          }
        } catch (e: any) {
          if (e.message.includes('identitytoolkit.googleapis.com')) {
            console.error('[Auth API] Firebase Auth lookup failed: Identity Toolkit API is disabled. Please enable it in the Google Cloud Console.');
          } else {
            console.log(`[Auth API] Firebase Auth lookup failed: ${e.message}`);
          }
        }
      }

      // 4. Try Mock Users if not found
      if (!userDoc) {
        console.log(`[Auth API] Checking mock users...`);
        const mockUser = users.find(u => {
          const uEmail = u.email.toLowerCase();
          const uAccess = u.accessNumber ? u.accessNumber.toUpperCase() : null;
          const uAccessLower = u.accessNumber ? u.accessNumber.toLowerCase() : null;
          
          return finalSearchTerms.some(term => 
            term.toLowerCase() === uEmail || 
            (uAccess && term.toUpperCase() === uAccess) ||
            (uAccessLower && term.toLowerCase() === uAccessLower)
          );
        });
        
        if (mockUser) {
          console.log(`[Auth API] Found mock user: ${mockUser.email}`);
          userDoc = { data: () => mockUser, id: mockUser.id };
        }
      }

      if (!userDoc) {
        console.warn(`[Auth API] No user found for identifier: ${identifier}`);
        return res.status(404).json({ message: 'No account found with this email or access number' });
      }

      const userData = userDoc.data();
      
      // Metadata Enrichment: If found in Firestore but missing accessNumber, try to derive it
      if (!userData.accessNumber && userData.email) {
        const emailPrefix = userData.email.split('@')[0];
        if (emailPrefix && /^[a-z]{2}\d{4,}$/i.test(emailPrefix)) {
          const derivedAccess = emailPrefix.toUpperCase();
          console.log(`[Auth API] Enriching metadata: Derived accessNumber ${derivedAccess} for ${userData.email}`);
          try {
            const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined;
            const currentDb = getFirestore(firebaseApp, dbId);
            await currentDb.collection('users').doc(userDoc.id).update({ accessNumber: derivedAccess });
            userData.accessNumber = derivedAccess;
          } catch (enrichErr: any) {
            console.warn(`[Auth API] Metadata enrichment failed: ${enrichErr.message}`);
          }
        }
      }

      console.log(`[Auth API] Successfully identified user: ${userData.email}`);
      res.json({ 
        email: userData.email, 
        phoneNumber: userData.phoneNumber || null,
        name: userData.name || 'User'
      });
    } catch (error: any) {
      console.error('[Auth API] Identification error:', error);
      res.status(500).json({ message: 'Internal server error during identification' });
    }
  });

  // Get Phone Number for Reset (Public endpoint, but only returns phone if user exists)
  app.post('/api/auth/get-phone-number', async (req, res) => {
    const { identifier } = req.body;
    console.log(`[Auth API] Received request for identifier: "${identifier}"`);

    if (!identifier) {
      return res.status(400).json({ message: 'Identifier is required' });
    }

    try {
      const input = identifier.trim().toLowerCase();
      let userDoc: any = null;

      // Try the primary database
      try {
        const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' ? firebaseConfig.firestoreDatabaseId : undefined;
        console.log(`[Auth API] Querying primary database: ${dbId || '(default)'}`);
        const currentDb = getFirestore(firebaseApp, dbId);
        const usersRef = currentDb.collection('users');
        const emailQuery = await usersRef.where('email', '==', input).get();
        if (!emailQuery.empty) {
          userDoc = emailQuery.docs[0];
          console.log(`[Auth API] Found user in primary database by email: ${input}`);
        } else {
          const accessQuery = await usersRef.where('accessNumber', '==', identifier.trim().toUpperCase()).get();
          if (!accessQuery.empty) {
            userDoc = accessQuery.docs[0];
            console.log(`[Auth API] Found user in primary database by access number: ${identifier.trim().toUpperCase()}`);
          }
        }
      } catch (primaryError: any) {
        console.warn(`[Auth API] Primary database lookup failed (Code: ${primaryError.code}): ${primaryError.message}`);
        // Fallback for PERMISSION_DENIED (7) or NOT_FOUND (5)
        if (primaryError.code === 7 || primaryError.code === 5 || primaryError.message.includes('PERMISSION_DENIED') || primaryError.message.includes('NOT_FOUND')) {
          console.log('[Auth API] Attempting fallback to default database...');
          try {
            const defaultDb = getFirestore(firebaseApp);
            const usersRef = defaultDb.collection('users');
            const emailQuery = await usersRef.where('email', '==', input).get();
            if (!emailQuery.empty) {
              userDoc = emailQuery.docs[0];
              console.log(`[Auth API] Found user in default database by email: ${input}`);
            } else {
              const accessQuery = await usersRef.where('accessNumber', '==', identifier.trim().toUpperCase()).get();
              if (!accessQuery.empty) {
                userDoc = accessQuery.docs[0];
                console.log(`[Auth API] Found user in default database by access number: ${identifier.trim().toUpperCase()}`);
              }
            }
          } catch (fallbackError: any) {
            console.error(`[Auth API] Fallback database lookup failed: ${fallbackError.message}`);
            
            // Try Firebase Auth as another fallback
            try {
              const isEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
              if (isEmail(input)) {
                console.log(`[Auth API] Checking Firebase Auth for email: ${input}`);
                const authUser = await auth.getUserByEmail(input);
                if (authUser && authUser.phoneNumber) {
                  console.log(`[Auth API] Found user in Firebase Auth with phone number: ${authUser.phoneNumber}`);
                  userDoc = { data: () => ({ phoneNumber: authUser.phoneNumber, email: authUser.email }), id: authUser.uid };
                }
              } else {
                console.log(`[Auth API] Skipping Firebase Auth check: "${input}" is not a valid email format.`);
              }
            } catch (authErr: any) {
              console.log(`[Auth API] Firebase Auth check failed: ${authErr.message}`);
            }

            if (!userDoc) {
              // Final fallback to mock users
              console.log(`[Auth API] Using mock users as final fallback for "${input}"...`);
              const mockUser = users.find(u => u.email === input || u.accessNumber === identifier.trim().toUpperCase());
              if (mockUser) {
                console.log(`[Auth API] Found mock user: ${mockUser.email}`);
                userDoc = { data: () => mockUser, id: mockUser.id };
              } else {
                console.log(`[Auth API] Mock user not found for "${input}". Available mock emails: ${users.map(u => u.email).join(', ')}`);
              }
            }
          }
        } else {
          throw primaryError;
        }
      }

      if (!userDoc) {
        return res.status(404).json({ message: 'No account found with this email or access number' });
      }

      const userData = userDoc.data();
      if (!userData.phoneNumber) {
        return res.status(400).json({ message: 'No phone number is registered for this account. Please use email reset.' });
      }

      // Return the phone number
      res.json({ phoneNumber: userData.phoneNumber });
    } catch (error: any) {
      console.error('[Auth API] Error fetching phone number:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Send Password Reset Email (Backend implementation)
  app.post('/api/auth/reset-password', async (req, res) => {
    const { email } = req.body;
    console.log(`[Auth API] Received password reset request for: "${email}"`);

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    try {
      // Trigger Firebase Password Reset Email via REST API
      // This uses the standard Firebase email templates and sender
      const apiKey = firebaseConfig.apiKey;
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`;
      
      await axios.post(url, {
        requestType: 'PASSWORD_RESET',
        email: email.trim()
      });

      console.log(`[Auth API] Password reset email triggered successfully for: ${email}`);
      res.json({ message: 'Password reset email sent successfully' });
    } catch (error: any) {
      const errorData = error.response?.data?.error;
      console.error('[Auth API] Password reset error:', errorData || error.message);
      
      let message = 'Failed to send password reset email';
      if (errorData?.message === 'EMAIL_NOT_FOUND') {
        message = 'No account found with this email address.';
      } else if (errorData?.message === 'USER_DISABLED') {
        message = 'This account has been disabled.';
      }
      
      res.status(error.response?.status || 500).json({ message });
    }
  });

  // --- API Routes (Mimicking Django REST Framework) ---

  // Auth
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const identifier = (email || '').trim().toLowerCase();
    const trimmedPassword = (password || '').trim();
    const maskedPassword = trimmedPassword ? trimmedPassword.substring(0, 1) + '*'.repeat(trimmedPassword.length - 1) : 'EMPTY';
    console.log(`[Auth API] Backend login attempt for: "${identifier}" (Total users in mock DB: ${users.length})`);
    
    const user = users.find(u => {
      const uEmail = (u.email || '').toLowerCase().trim();
      const uAccess = u.accessNumber ? u.accessNumber.toUpperCase().trim() : null;
      
      const emailMatch = uEmail === identifier || identifier === uEmail || identifier.includes(uEmail) || uEmail.includes(identifier);
      const accessMatch = uAccess && (
        uAccess === identifier.toUpperCase() || 
        identifier.toUpperCase().includes(uAccess) ||
        uAccess.includes(identifier.toUpperCase())
      );
      
      const isMatch = (emailMatch || accessMatch) && (u.password === password || u.password === trimmedPassword);
      
      // DEBUG LOGGING
      if (emailMatch || accessMatch) {
        console.log(`[Auth API] DEBUG: Potential match found for "${identifier}"`);
        console.log(`[Auth API] DEBUG: Mock User Email: "${uEmail}"`);
        console.log(`[Auth API] DEBUG: Mock User Access: "${uAccess}"`);
        console.log(`[Auth API] DEBUG: Email Match: ${emailMatch}, Access Match: ${accessMatch}`);
        console.log(`[Auth API] DEBUG: Password Match: ${isMatch} (Received: "${maskedPassword}", Expected: "${u.password ? u.password.substring(0, 1) + '...' : 'NONE'}")`);
      }
      
      return isMatch;
    });

    if (user) {
      console.log(`[Auth API] Backend login successful for: "${identifier}"`);
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } else {
      console.warn(`[Auth API] Backend login failed for: "${identifier}" - Invalid credentials`);
      console.log(`[Auth API] DEBUG: Available mock emails: ${users.map(u => u.email).join(', ')}`);
      res.status(401).json({ message: 'Invalid credentials' });
    }
  });

  // Logs
  app.get('/api/logs', (req, res) => {
    const { studentId } = req.query;
    let filteredLogs = logs;
    if (studentId) {
      filteredLogs = logs.filter(l => l.studentId === studentId);
    }
    
    // Join with user names
    const logsWithNames = filteredLogs.map(log => {
      const student = users.find(u => u.id === log.studentId);
      return {
        ...log,
        student: student ? student.name : 'Unknown Student',
        time: '09:00 AM' // Mock time since it's used in UI
      };
    });
    
    res.json(logsWithNames);
  });

  app.get('/api/attendance', (req, res) => {
    const { studentId } = req.query;
    let filteredAttendance = attendance;
    if (studentId) {
      filteredAttendance = attendance.filter(a => a.studentId === studentId);
    }
    res.json(filteredAttendance);
  });

  app.post('/api/attendance', (req, res) => {
    const record = { id: Date.now(), ...req.body, timestamp: new Date().toISOString() };
    attendance.push(record);
    res.json(record);
  });

  app.get('/api/sent_notifications', (req, res) => {
    const { adminId } = req.query;
    let filtered = sent_notifications;
    if (adminId) {
      filtered = sent_notifications.filter(n => n.senderId === adminId);
    }
    res.json(filtered);
  });

  app.post('/api/sent_notifications', (req, res) => {
    const record = { id: Date.now(), ...req.body, timestamp: new Date().toISOString() };
    sent_notifications.push(record);
    res.json(record);
  });

  app.post('/api/logs', (req, res) => {
    const log = { id: Date.now(), ...req.body, status: 'pending' };
    logs.push(log);
    res.status(201).json(log);
  });

  app.patch('/api/logs/:id', (req, res) => {
    const { id } = req.params;
    const { status, supervisor, feedback } = req.body;
    const logIndex = logs.findIndex(l => l.id === parseInt(id));
    if (logIndex !== -1) {
      logs[logIndex] = { ...logs[logIndex], status, supervisor, feedback };
      res.json(logs[logIndex]);
    } else {
      res.status(404).json({ message: 'Log not found' });
    }
  });

  // Users (Admin)
  app.get('/api/users', (req, res) => {
    res.json(users.map(({ password, ...u }) => u));
  });

  app.post('/api/users', (req, res) => {
    const user = { id: String(Date.now()), ...req.body };
    users.push(user);
    res.status(201).json(user);
  });

  // Notifications
  app.get('/api/notifications', (req, res) => {
    try {
      const { role } = req.query;
      console.log(`[API] GET /api/notifications - role: ${role || 'all'}`);
      if (role) {
        const filtered = notifications.filter(n => n.target === 'all' || n.target === role);
        res.json(filtered);
      } else {
        res.json(notifications);
      }
    } catch (err: any) {
      console.error('[API] Error in GET /api/notifications:', err.message);
      res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  });

  app.post('/api/notifications', (req, res) => {
    const notification = { 
      id: Date.now(), 
      ...req.body, 
      createdAt: new Date().toISOString() 
    };
    notifications.unshift(notification);
    res.status(201).json(notification);
  });

  app.post('/api/notifications/individual', (req, res) => {
    const notification = { id: Date.now(), ...req.body, read: false, deleted: false, createdAt: new Date().toISOString() };
    // In a real app we'd have a separate collection or filter
    res.json(notification);
  });

  app.patch('/api/notifications/:id', (req, res) => {
    const { id } = req.params;
    const update = req.body;
    // In a real app we'd update the notifications array
    res.json({ success: true });
  });

  app.delete('/api/notifications/:id', (req, res) => {
    const { id } = req.params;
    const index = notifications.findIndex(n => n.id === parseInt(id));
    if (index !== -1) {
      notifications.splice(index, 1);
      res.status(204).send();
    } else {
      res.status(404).json({ message: 'Notification not found' });
    }
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
