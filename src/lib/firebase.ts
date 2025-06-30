/*
CORRECT FIRESTORE RULES:

It's recommended to have these rules for your Firestore database for this app to work correctly.
This fixes the "Missing or insufficient permissions" error for new users and admins.
You can copy and paste these into your Firebase project settings:
Firestore Database -> Rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isUserAdmin(userId) {
      // Check if user document exists and if their role is 'Admin'
      return exists(/databases/$(database)/documents/users/$(userId)) &&
             get(/databases/$(database)/documents/users/$(userId)).data.role == 'Admin';
    }

    match /users/{userId} {
      allow create: if request.auth.uid == userId;

      // Users can read/update their own profile. Admins can read/update any profile.
      allow read, update: if request.auth.uid == userId || isUserAdmin(request.auth.uid);
      
      // Any authenticated user can list users. This is required for various dashboard/filter components.
      allow list: if request.auth != null;
    }
    
    match /reports/{reportId} {
      // Any authenticated user can create and read/list reports.
      allow read, list, create: if request.auth != null;

      // Admins can update any field. 
      // Other authenticated users can ONLY add comments (update the 'remarks' field).
      allow update: if request.auth != null && (
                      isUserAdmin(request.auth.uid) || 
                      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['remarks'])
                    );
      
      // Only admins can delete reports.
      allow delete: if isUserAdmin(request.auth.uid);
    }

    match /notifications/{notificationId} {
        // Allow users to create notifications. For higher security, this should be a Cloud Function.
        allow create: if request.auth != null;
        // Users can only read, list, and update (mark as read) their own notifications.
        allow read, list, update: if request.auth != null && request.auth.uid == resource.data.userId;
    }

    match /ra_entries/{entryId} {
        // Any authenticated user can read RA entries for the main dashboard.
        allow read, list: if request.auth != null;
        // Only admins can create, update, or delete RA entries.
        allow write, delete: if isUserAdmin(request.auth.uid);
    }

    match /pjp_plans/{planId} {
      function userIsOwner() {
        return request.auth.uid == resource.data.userId;
      }
      function userCanViewAll() {
        let userData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
        return userData.reportVisibility == 'All' || userData.role == 'Admin';
      }
      function userCanViewRegion() {
        let user = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
        return user.reportVisibility == 'Region' && user.region == resource.data.userRegion;
      }

      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;

      allow read, list: if request.auth != null && (
        userIsOwner() || userCanViewAll() || userCanViewRegion()
      );

      allow update, delete: if request.auth != null && (
        userIsOwner() || isUserAdmin(request.auth.uid)
      );
    }
  }
}
*/

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// We check for the existence of the API key and project ID to determine if Firebase is configured.
export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

if (isFirebaseConfigured) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} else {
    // This message will be displayed in the browser's developer console.
    // The UI will show a more user-friendly message.
    if (typeof window !== 'undefined') {
        console.error("Firebase configuration is incomplete. Please check your .env.local file is set up correctly.");
    }
}

export { app, db, auth };
