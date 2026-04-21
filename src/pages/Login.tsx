import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { USERS, useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Briefcase } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState(USERS[0].id);

  const handleLogin = () => {
    const user = USERS.find((u) => u.id === selectedUser);
    if (user) {
      login(user);
      navigate("/");
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/30">
      <Card className="w-full max-w-sm p-6 shadow-xl border-border">
        <div className="flex flex-col items-center mb-8 gap-2 text-center">
          <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shadow-lg text-primary-foreground mb-2">
            <Briefcase className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">CreativeMark</h1>
          <p className="text-sm text-muted-foreground">Log in to your workspace</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Select Demo Account</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {USERS.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full bg-primary hover:bg-primary-hover font-bold" size="lg" onClick={handleLogin}>
            Sign In
          </Button>
        </div>
      </Card>
    </div>
  );
}
