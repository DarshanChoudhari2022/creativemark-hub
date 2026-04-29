import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("Employee");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (authData.user) {
        // 2. Add to employees table
        const { error: dbError } = await supabase.from('employees').insert([
          {
            id: authData.user.id,
            email: email,
            name: name,
            role: role,
            status: 'Active'
          }
        ]);

        if (dbError) {
          // If inserting into employees fails (e.g. due to RLS), we still created the auth user
          console.error("Error adding employee record:", dbError);
          toast.warning("Account created, but could not add employee profile. Contact admin.");
        } else {
          toast.success("Account created successfully!");
        }
        navigate("/");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      toast.error("Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm p-8 shadow-2xl border-border relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
        
        <div className="flex flex-col items-center mb-6 gap-2 text-center">
          <div className="h-24 w-24 mb-2 flex items-center justify-center">
            <img 
              src="/logo-brand.png" 
              alt="Creative Mark" 
              className="w-full h-full object-contain animate-in zoom-in-50 duration-700" 
            />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Create Account</h1>
          <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase opacity-70">Join the Enterprise Workspace</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name"
              type="text" 
              placeholder="John Doe" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="bg-muted/30 focus-visible:bg-background h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email"
              type="email" 
              placeholder="john@creativemark.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="bg-muted/30 focus-visible:bg-background h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password"
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="bg-muted/30 focus-visible:bg-background h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select disabled={loading} value={role} onValueChange={setRole}>
              <SelectTrigger className="h-11 bg-muted/30 focus:bg-background">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Owner / Admin</SelectItem>
                <SelectItem value="Employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover font-bold text-base h-12 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] mt-2" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Sign Up"
            )}
          </Button>
          
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline font-semibold">
                Sign In
              </Link>
            </p>
          </div>
        </form>
      </Card>
      
      <div className="fixed bottom-8 text-[11px] text-muted-foreground font-medium tracking-widest uppercase">
        © 2026 CreativeMark Hub · v2.0.4
      </div>
    </div>
  );
}
