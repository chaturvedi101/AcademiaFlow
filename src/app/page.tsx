'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, GraduationCap, FileCheck, Layers, Loader2, Github, Info } from "lucide-react";
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
import { UserRole } from "@/lib/types";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

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

  const rtuLogo = PlaceHolderImages.find(img => img.id === 'rtu-logo');

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
        const userData = {
          displayName: result.user.displayName || result.user.email?.split('@')[0] || 'Academic User',
          email: result.user.email || '',
          role: 'bos_convenor' as UserRole,
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, userData);
        toast({
          title: "Profile Created",
          description: "Welcome! Your academic account has been initialized.",
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

      await setDoc(userRef, userData, { merge: true });
      
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
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 bg-white rounded-2xl shadow-sm p-1 border border-border/50">
              <Image 
                src={rtuLogo?.imageUrl || "https://picsum.photos/seed/rtu/200/200"}
                alt="RTU Logo"
                width={200}
                height={200}
                className="object-contain p-2"
                data-ai-hint={rtuLogo?.imageHint || "RTU Logo"}
              />
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
            <FeatureCheck icon={<ShieldCheck className="text-accent" />} title="Secure RBAC" desc="Hierarchy & Audit Logs" />
          </div>

          <Card className="bg-primary/5 border-primary/10">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Info className="w-3 h-3 text-primary" />
                RTU Portal Reference Roles
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4 space-y-1">
              <p className="text-[10px] text-muted-foreground"><span className="font-bold">Dean Academic:</span> dean.academic@rtu.ac.in</p>
              <p className="text-[10px] text-muted-foreground"><span className="font-bold">BoS Convenor:</span> convenor@rtu.ac.in</p>
              <p className="text-[10px] text-muted-foreground"><span className="font-bold">System Admin:</span> admin@rtu.ac.in</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
          <Card className="w-full max-w-md shadow-2xl border-primary/10">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center font-headline">Secure Access</CardTitle>
              <CardDescription className="text-center">
                Authorized Faculty & Staff Only
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
                          placeholder="name@rtu.ac.in" 
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
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In to Portal"}
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
                      GitHub Auth
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
                      <Label htmlFor="reg-email">RTU Email</Label>
                      <Input 
                        id="reg-email" 
                        type="email" 
                        placeholder="name@rtu.ac.in" 
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
                          <SelectItem value="dean_academic">Dean Academic</SelectItem>
                          <SelectItem value="admin">System Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-11" 
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Request Access"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              <div className="text-center text-sm text-muted-foreground pt-6">
                Institutional access restricted to authorized personnel.
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

function FeatureCheck({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-2">{icon}</div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}