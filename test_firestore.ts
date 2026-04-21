import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { getFirestore } from 'firebase-admin/firestore';

async function test() {
  const targetProjectId = firebaseConfig.projectId;
  const app = admin.initializeApp({ projectId: targetProjectId, credential: admin.credential.applicationDefault() });
  
  let dbDefault = admin.firestore(app);
  let dbNamed = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  try {
     console.log(`[Named DB] Testing ${firebaseConfig.firestoreDatabaseId}...`);
     const docsNamed = await dbNamed.collection('users').limit(1).get();
     console.log('Success Named DB, docs:', docsNamed.size);
  } catch (e: any) {
     console.error('Error Named DB:', e.message);
  }

  try {
     console.log(`[Default DB] Testing...`);
     const docsDefault = await dbDefault.collection('users').limit(1).get();
     console.log('Success Default DB, docs:', docsDefault.size);
  } catch (e: any) {
     console.error('Error Default DB:', e.message);
  }
}
test();
