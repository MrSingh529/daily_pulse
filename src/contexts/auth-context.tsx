
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut, User, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

interface AuthContextType {
  user: (UserProfile & User) | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<any>;
  loginWithGoogle: () => Promise<any>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const FirebaseNotConfigured = () => (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-2xl">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Firebase Not Configured</AlertTitle>
            <AlertDescription>
                <p>Your Firebase environment variables are not set. This app cannot connect to Firebase without them.</p>
                <p className="mt-4 font-semibold">For local development:</p>
                <p className="mt-2">Create a <code>.env.local</code> file in the root of your project and add the required Firebase variables.</p>
                <p className="mt-4 font-semibold">For deployment (e.g., Vercel):</p>
                <p className="mt-2">Go to your project settings on your hosting provider and add the following environment variables:</p>
                <pre className="mt-2 rounded-md bg-muted p-4 text-xs font-mono">
                    {`NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID`}
                </pre>
                 <p className="mt-2">After setting the variables, you may need to redeploy your project.</p>
            </AlertDescription>
        </Alert>
    </div>
);


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<(UserProfile & User) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
        setLoading(false);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db!, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userProfile = userDoc.data() as UserProfile;
          setUser({ ...firebaseUser, ...userProfile });
        } else {
          // New user, create a profile for them
          const newUserProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'New User',
            role: 'User', // Default role
            regions: ['HQ'],
            reportVisibility: 'Own', // Default visibility
            fcmTokens: [],
          };
          await setDoc(userDocRef, newUserProfile);
          setUser({ ...firebaseUser, ...newUserProfile });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const loginWithEmail = (email: string, password: string) => {
    if (!auth) return Promise.reject("Firebase not configured");
    return signInWithEmailAndPassword(auth, email, password);
  }

  const loginWithGoogle = () => {
    if (!auth) return Promise.reject("Firebase not configured");
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }
  
  const sendPasswordReset = (email: string) => {
    if (!auth) return Promise.reject("Firebase not configured");
    return sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    setUser(null);
    if (!auth) return;
    await signOut(auth);
  };

  if (!isFirebaseConfigured) {
    return <FirebaseNotConfigured />;
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithEmail, loginWithGoogle, sendPasswordReset, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
