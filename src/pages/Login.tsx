import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { Briefcase, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        toast.error(authError.message);
      } else {
        toast.success("Welcome back!");
        navigate("/");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email) {
      toast.error("Please enter your email to reset password");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) throw error;
      toast.success("Password reset email sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm p-8 shadow-2xl border-border relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
        
        <div className="flex flex-col items-center mb-8 gap-2 text-center">
          <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg text-primary-foreground mb-4 rotate-3 hover:rotate-0 transition-transform duration-300">
            <Briefcase className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">CREATIVE MARK</h1>
          <p className="text-sm text-muted-foreground font-medium">Enterprise CRM Workspace</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email"
              type="email" 
              placeholder="admin@creativemark.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="bg-muted/30 focus-visible:bg-background h-11"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button type="button" onClick={handleForgot} className="text-[11px] text-primary hover:underline font-bold">Forgot?</button>
            </div>
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

          <Button 
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover font-bold text-base h-12 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
          
          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline font-semibold">
                Sign Up
              </Link>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Internal access only. Unauthorized entry is prohibited.
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

