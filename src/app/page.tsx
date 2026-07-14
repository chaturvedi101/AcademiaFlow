'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, GraduationCap, FileCheck, Layers, Loader2, Github, Lock, Mail, Users, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { 
  signInWithEmailAndPassword, 
  GithubAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  signInAnonymously
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { UserRole } from "@/lib/types";

export default function Home() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Centralized Navigation Observer: Handles redirection after any auth state change
  useEffect(() => {
    if (user && !userLoading) {
      if (user.isAnonymous) {
        router.push('/explorer');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, userLoading, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Sign-in Failed",
        description: error.message,
      });
      setIsLoading(false);
    }
  };

  const handleGuestAccess = async () => {
    setIsLoading(true);
    try {
      await signInAnonymously(auth);
      // Navigation is handled automatically by the useEffect observer above
    } catch (error: any) {
      console.error("Guest Auth Error:", error);
      let errorMessage = error.message;
      
      // Diagnostic guidance for the 'operation-not-allowed' error
      if (error.code === 'auth/operation-not-allowed') {
        errorMessage = "Anonymous authentication is currently disabled. Please go to the Firebase Console > Authentication > Sign-in method and enable the 'Anonymous' provider to allow guest access.";
      }

      toast({
        variant: 'destructive',
        title: "Guest Entrance Failed",
        description: errorMessage,
      });
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: "Input Required",
        description: "Please enter your institutional email first to receive a reset link.",
      });
      return;
    }

    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Reset Link Sent",
        description: "Please check your institutional inbox for password recovery instructions.",
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Recovery Failed",
        description: error.message,
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleGithubSignIn = async () => {
    setIsLoading(true);
    const provider = new GithubAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const userData = {
          displayName: result.user.displayName || result.user.email?.split('@')[0] || 'Academic User',
          email: result.user.email || '',
          role: 'bos_convenor' as UserRole,
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, userData);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "GitHub Authentication Failed",
        description: error.message,
      });
      setIsLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-20 h-20 bg-primary rounded-2xl shadow-lg border-4 border-white shrink-0">
              <span className="text-white font-headline font-black text-3xl tracking-tighter">RTU</span>
            </div>
            <div>
              <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Academia Flow</h1>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Rajasthan Technical University</p>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl font-headline font-bold leading-tight">
              Institutional Academic Management for <span className="text-accent">NEP 2020</span>.
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg">
              Authorized platform for Rajasthan Technical University to manage schemes, syllabi, 
              and AICTE compliance with centralized BoS coordination.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <FeatureCard 
              icon={<GraduationCap className="text-accent" />}
              title="RTU Schemes"
              desc="Approved curriculum search"
            />
            <FeatureCard 
              icon={<FileCheck className="text-accent" />}
              title="AICTE Compliant"
              desc="Verified technical tiers"
            />
            <FeatureCard 
              icon={<Layers className="text-accent" />}
              title="Equivalence Engine"
              desc="Manage transition mappings"
            />
            <FeatureCard icon={<ShieldCheck className="text-accent" />} title="Secure RBAC" desc="Hierarchy & Audit Logs" />
          </div>
        </div>

        <div className="flex justify-center">
          <Card className="w-full max-w-md shadow-2xl border-primary/10 overflow-hidden">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/5 rounded-full">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl text-center font-headline">Institutional Portal</CardTitle>
              <CardDescription className="text-center">
                Authorized Faculty & Public Guest Access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Institutional Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@rtu.ac.in" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button 
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isResetting}
                      className="text-[10px] font-bold text-accent hover:underline uppercase tracking-tight disabled:opacity-50"
                    >
                      {isResetting ? "Sending..." : "Forgot Password?"}
                    </button>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base shadow-lg shadow-primary/20" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-5 w-4 animate-spin" /> : "Faculty Sign In"}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold text-muted-foreground"><span className="bg-background px-2">Public Access</span></div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Button variant="secondary" className="h-12 w-full gap-2 border-primary/10 shadow-sm" onClick={handleGuestAccess} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-5 h-5 text-primary" />}
                  Institutional Guest Explorer
                </Button>
                <Button variant="outline" type="button" className="w-full h-11 gap-2 text-sm border-dashed" onClick={handleGithubSignIn} disabled={isLoading}>
                  <Github className="w-4 h-4" /> GitHub SSO
                </Button>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-[10px] text-blue-800 leading-tight">
                <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
                <p>
                  <b>Guest Access:</b> Browse approved curricula and L-T-P patterns without an institutional account.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-2">{icon}</div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
