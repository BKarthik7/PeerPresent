import { usePresentation } from "@/contexts/presentation-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { MonitorUp, MonitorOff } from "lucide-react";

export function ScreenSharePanel() {
  const { isScreenSharing, startScreenShare, stopScreenShare, peers } = usePresentation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const handleStartScreenShare = async () => {
    try {
      await startScreenShare();
    } catch (error) {
      console.error("Screen sharing error:", error);
      toast({
        title: "Screen sharing failed",
        description: error instanceof Error ? error.message : "Failed to start screen sharing",
        variant: "destructive",
      });
    }
  };
  
  const handleStopScreenShare = () => {
    stopScreenShare();
  };
  
  // Only admins can share screen
  if (!user?.isAdmin) {
    return null;
  }
  
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">Screen Sharing</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Status:</span>
            <span className={`text-sm font-medium ${isScreenSharing ? 'text-green-500' : 'text-muted-foreground'}`}>
              {isScreenSharing ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Connected peers:</span>
            <span className="text-sm font-medium">{peers.length}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              variant="default"
              onClick={handleStartScreenShare}
              disabled={isScreenSharing}
              className={isScreenSharing ? 'opacity-50' : ''}
            >
              <MonitorUp className="h-4 w-4 mr-2" />
              Start Sharing
            </Button>
            <Button
              variant="outline"
              onClick={handleStopScreenShare}
              disabled={!isScreenSharing}
            >
              <MonitorOff className="h-4 w-4 mr-2" />
              Stop Sharing
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground pt-2">
            {isScreenSharing
              ? "Your screen is being shared with all connected peers"
              : "Share your screen with all connected peers"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}