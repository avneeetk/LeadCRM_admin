// src/contexts/AuthContext.tsx

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'subuser';
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ----------------------------------------------------------------------
  // 🔹 AUTH STATE LISTENER
  // ----------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            // User must exist in Firestore (admin-created)
            await firebaseSignOut(auth);
            setUser(null);
            toast.error("Your account is not registered in the CRM.");
            setIsLoading(false);
            return;
          }

          const data = userSnap.data();

          // Check active/inactive
          if (data.active === false) {
            await firebaseSignOut(auth);
            setUser(null);
            toast.error("Your account is deactivated. Contact administrator.");
            setIsLoading(false);
            return;
          }

          // Set authenticated user state
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            name: data.name || firebaseUser.email!.split("@")[0],
            role: data.role || "subuser",
            active: data.active !== false,
          });

        } catch (error) {
          console.error("Auth error:", error);
          toast.error("Unable to fetch user profile.");
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ----------------------------------------------------------------------
  // 🔹 LOGIN FUNCTION
  // ----------------------------------------------------------------------
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      const credentials = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, "users", credentials.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await firebaseSignOut(auth);
        toast.error("Your account is not added to CRM yet.");
        setIsLoading(false);
        return false;
      }

      const data = snap.data();

      if (data.active === false) {
        await firebaseSignOut(auth);
        toast.error("Your account is inactive. Contact admin.");
        setIsLoading(false);
        return false;
      }

      return true;

    } catch (error: any) {
      console.error("Login failed:", error);

      let message = "Login failed. Please try again.";

      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        message = "Invalid email or password.";
      }
      if (error.code === "auth/too-many-requests") {
        message = "Too many attempts. Try again later.";
      }

      toast.error(message);
      setIsLoading(false);
      return false;
    }
  };

  // ----------------------------------------------------------------------
  // 🔹 LOGOUT FUNCTION
  // ----------------------------------------------------------------------
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Try again.");
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}