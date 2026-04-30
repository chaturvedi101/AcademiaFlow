
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, GraduationCap, FileCheck, Layers, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // Create a default profile if it's the first time login
        await setDoc(userRef, {
          displayName: result.user.displayName,
          email: result.user.email,
          role: 'bos_convenor', // Default role for new users
          photoURL: result.user.photoURL,
          createdAt: new Date(),
        });
        toast({
          title: "Account Created",
          description: "Welcome to Academia Flow! You have been assigned the BoS Convenor role.",
        });
      }
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Sign-in Failed",
        description: error.message,
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  if (user && !userLoading) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-headline font-bold text-primary tracking-tight">Academia Flow</h1>
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl font-headline font-bold leading-tight">
              Enterprise Academic Management for <span className="text-accent">NEP 2020</span>.
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg">
              A robust platform for technical universities to manage schemes, syllabi, 
              and AICTE compliance with advanced RBAC and audit tracking.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <FeatureCard 
              icon={<GraduationCap className="text-accent" />}
              title="Scheme Lifecycle"
              desc="Draft to Approval workflow"
            />
            <FeatureCard 
              icon={<FileCheck className="text-accent" />}
              title="AICTE Compliant"
              desc="Automatic credit validation"
            />
            <FeatureCard 
              icon={<Layers className="text-accent" />}
              title="Equivalence Engine"
              desc="Manage transition mappings"
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-accent" />}
              title="RBAC & Audit"
              desc="Secure hierarchy & logs"
            />
          </div>
        </div>

        <div className="flex justify-center">
          <Card className="w-full max-w-md shadow-2xl border-primary/10">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center font-headline">Secure Login</CardTitle>
              <CardDescription className="text-center">
                Access your academic management portal using Google
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleSignIn} 
                disabled={isSigningIn || userLoading}
                className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "Sign In with Google"
                )}
              </Button>
              <div className="text-center text-sm text-muted-foreground pt-4">
                Access is restricted to authorized university domains.
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
