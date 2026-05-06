
'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, GraduationCap, FileCheck, Layers, Loader2, Github } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GithubAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("bos_convenor");

  useEffect(() => {
    if (user && !userLoading) {
      router.push('/dashboard');
    }
  }, [user, userLoading, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Sign-in Failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
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
        // Default role for new GitHub users is bos_convenor unless configured otherwise
        const userData = {
          displayName: result.user.displayName || result.user.email?.split('@')[0] || 'Academic User',
          email: result.user.email || '',
          role: 'bos_convenor' as UserRole,
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, userData);
        toast({
          title: "Profile Created",
          description: "Welcome to Academia Flow. Your account has been initialized.",
        });
      }
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "GitHub Authentication Failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, 'users', result.user.uid);
      
      const userData = {
        displayName: displayName || email.split('@')[0],
        email: email,
        role: role,
        createdAt: serverTimestamp(),
      };

      setDoc(userRef, userData, { merge: true })
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'write',
            requestResourceData: userData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
      
      toast({
        title: "Account Created",
        description: `Welcome! You have been registered as a ${role.replace('_', ' ')}.`,
      });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Registration Failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (userLoading || (user && !userLoading)) {
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
              <CardTitle className="text-2xl text-center font-headline">Secure Access</CardTitle>
              <CardDescription className="text-center">
                Manage your academic credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <div className="space-y-4">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="name@university.edu" 
                          required 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input 
                          id="password" 
                          type="password" 
                          required 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full h-11" 
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
                      </Button>
                    </form>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full h-11 gap-2" 
                      onClick={handleGithubSignIn}
                      disabled={isLoading}
                    >
                      <Github className="w-4 h-4" />
                      GitHub
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Full Name</Label>
                      <Input 
                        id="reg-name" 
                        placeholder="Dr. Sarah Smith" 
                        required 
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">University Email</Label>
                      <Input 
                        id="reg-email" 
                        type="email" 
                        placeholder="name@university.edu" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <Input 
                        id="reg-password" 
                        type="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-role">Academic Role</Label>
                      <Select value={role} onValueChange={(val: UserRole) => setRole(val)}>
                        <SelectTrigger id="reg-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bos_convenor">BoS Convenor</SelectItem>
                          <SelectItem value="dean_faculty">Dean of Faculty</SelectItem>
                          <SelectItem value="dean_academics">Dean Academics</SelectItem>
                          <SelectItem value="admin">System Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-11" 
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              <div className="text-center text-sm text-muted-foreground pt-6">
                Access is restricted to authorized academic personnel.
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
