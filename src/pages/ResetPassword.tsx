import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { Briefcase, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("Please enter a new password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.updateUser({
        password: password
      });

      if (authError) {
        throw new Error(authError.message);
      }

      toast.success("Password updated successfully");
      navigate("/");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      toast.error("Password update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm p-8 shadow-2xl border-border relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
        
        <div className="flex flex-col items-center mb-6 gap-2 text-center">
          <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg text-primary-foreground mb-4 rotate-3 hover:rotate-0 transition-transform duration-300">
            <Briefcase className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Reset Password</h1>
          <p className="text-sm text-muted-foreground font-medium">Enter your new password below</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
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
            className="w-full bg-primary hover:bg-primary-hover font-bold text-base h-12 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] mt-2" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
