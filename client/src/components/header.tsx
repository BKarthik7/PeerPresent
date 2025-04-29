import { useAuth } from "@/contexts/auth-context";
import { usePresentation } from "@/contexts/presentation-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, PlayCircle, MonitorPlay, LogOut } from "lucide-react";

type HeaderProps = {
  onUploadTeams: () => void;
};

export function Header({ onUploadTeams }: HeaderProps) {
  const { user, logout } = useAuth();
  const { activeSession } = usePresentation();

  return (
    <header className="bg-white border-b border-border py-2 px-4 shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-google-sans font-semibold text-foreground">Peer Evaluation System</h1>
          {activeSession && (
            <Badge variant="secondary" className="bg-secondary">Active Session</Badge>
          )}
        </div>
        
        {/* Admin Controls (Only visible to admins) */}
        {user?.isAdmin && (
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm"
              className="border-primary text-primary"
              onClick={onUploadTeams}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Teams
            </Button>
          </div>
        )}
        
        {/* User Info */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            {user?.isAdmin 
              ? "Admin" 
              : `${user?.name} (${user?.usn})`}
          </span>
          <Button variant="ghost" size="sm" className="text-accent" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
