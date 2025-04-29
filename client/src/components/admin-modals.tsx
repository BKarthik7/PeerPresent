import { useState, useEffect, useRef } from "react";
import { usePresentation } from "@/contexts/presentation-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TeamForm } from "@/components/forms/team-form";
import { X, Download, Play, Pause, RefreshCw, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Team } from "@shared/schema";

interface AdminModalsProps {
  teamUploadOpen: boolean;
  setTeamUploadOpen: (open: boolean) => void;
  presentationControlOpen: boolean;
  setPresentationControlOpen: (open: boolean) => void;
  feedbackSummaryOpen: boolean;
  setFeedbackSummaryOpen: (open: boolean) => void;
}

export function AdminModals({
  teamUploadOpen,
  setTeamUploadOpen,
  presentationControlOpen,
  setPresentationControlOpen,
  feedbackSummaryOpen,
  setFeedbackSummaryOpen,
}: AdminModalsProps) {
  return (
    <>
      <TeamUploadModal open={teamUploadOpen} setOpen={setTeamUploadOpen} />
      <PresentationControlModal open={presentationControlOpen} setOpen={setPresentationControlOpen} />
      <FeedbackSummaryModal open={feedbackSummaryOpen} setOpen={setFeedbackSummaryOpen} />
    </>
  );
}

// Team Upload Modal
function TeamUploadModal({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const { toast } = useToast();
  const { uploadTeams } = usePresentation();
  const [csvContent, setCsvContent] = useState<string>("");
  const [manualEntry, setManualEntry] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    try {
      setIsUploading(true);
      
      let teams: Omit<Team, "id" | "createdBy">[] = [];
      
      // Process CSV content if available
      if (csvContent) {
        const lines = csvContent.trim().split('\n');
        // Skip header if it exists
        const startLine = lines[0].includes("Name") || lines[0].includes("USN") ? 1 : 0;
        
        // Group by team
        const teamMap = new Map<string, any>();
        
        for (let i = startLine; i < lines.length; i++) {
          const line = lines[i];
          const columns = line.split(',').map(col => col.trim());
          
          if (columns.length < 4) continue; // Skip invalid lines
          
          const name = columns[0];
          const usn = columns[1];
          const teamNumber = columns[2];
          const projectTitle = columns[3];
          
          if (!teamMap.has(teamNumber)) {
            teamMap.set(teamNumber, {
              name: `Team ${teamNumber}`,
              projectTitle,
              members: []
            });
          }
          
          const team = teamMap.get(teamNumber);
          team.members.push({ name, usn });
        }
        
        teams = Array.from(teamMap.values());
      }
      
      // Process manual entry if available and CSV is not
      if (manualEntry && !csvContent) {
        const lines = manualEntry.trim().split('\n');
        
        for (const line of lines) {
          // Format: Team 1: ProjectTitle, Name1 (USN1), Name2 (USN2)...
          const teamMatch = line.match(/^Team\s+(\d+):\s+([^,]+),\s*(.+)$/);
          
          if (teamMatch) {
            const teamNumber = teamMatch[1];
            const projectTitle = teamMatch[2].trim();
            const membersText = teamMatch[3].trim();
            
            const memberRegex = /([^()]+)\s+\(([^()]+)\)/g;
            const members = [];
            let match;
            
            while ((match = memberRegex.exec(membersText)) !== null) {
              members.push({
                name: match[1].trim(),
                usn: match[2].trim()
              });
            }
            
            if (members.length > 0) {
              teams.push({
                name: `Team ${teamNumber}`,
                projectTitle,
                members
              });
            }
          }
        }
      }
      
      if (teams.length === 0) {
        throw new Error("No valid teams found in the provided data");
      }
      
      await uploadTeams(teams);
      setOpen(false);
      setCsvContent("");
      setManualEntry("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      toast({
        title: "Teams uploaded successfully",
        description: `${teams.length} teams have been added to the system.`,
      });
    } catch (error) {
      console.error("Team upload error:", error);
      toast({
        title: "Failed to upload teams",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const [activeTab, setActiveTab] = useState<"csv" | "text" | "form">("csv");
  
  const handleTeamFormSubmit = async (team: Omit<Team, "id" | "createdBy">) => {
    try {
      setIsUploading(true);
      await uploadTeams([team]);
      
      setOpen(false);
      setCsvContent("");
      setManualEntry("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      toast({
        title: "Team created successfully",
        description: `Team ${team.name} has been added to the system.`,
      });
    } catch (error) {
      console.error("Team creation error:", error);
      toast({
        title: "Failed to create team",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload Team Details</DialogTitle>
          <DialogDescription>
            Upload team information via CSV file or create teams manually
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 my-2">
          {/* Tab selection */}
          <div className="flex space-x-2 border-b">
            <button 
              className={`px-4 py-2 text-sm font-medium ${activeTab === "csv" ? "border-b-2 border-primary" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("csv")}
            >
              Upload CSV
            </button>
            <button 
              className={`px-4 py-2 text-sm font-medium ${activeTab === "text" ? "border-b-2 border-primary" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("text")}
            >
              Text Format
            </button>
            <button 
              className={`px-4 py-2 text-sm font-medium ${activeTab === "form" ? "border-b-2 border-primary" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("form")}
            >
              Create Team
            </button>
          </div>
          
          {/* CSV Upload Tab */}
          {activeTab === "csv" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">CSV File</label>
              <Input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef}
                onChange={handleFileChange} 
              />
              <p className="text-xs text-muted-foreground">
                Upload a CSV file with team details (Name, USN, Team Number, Project Title)
              </p>
              
              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleUpload}
                  disabled={isUploading || !csvContent}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {isUploading ? "Uploading..." : "Upload CSV"}
                </Button>
              </div>
            </div>
          )}
          
          {/* Text Entry Tab */}
          {activeTab === "text" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Enter Team Details as Text</label>
              <Textarea 
                placeholder="Team 1: ProjectTitle, Name1 (USN1), Name2 (USN2)..." 
                className="h-32 resize-none"
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value)} 
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Format each team on a new line as follows:</p>
                <p><code className="bg-muted px-1 py-0.5 rounded">Team [Number]: [Project Title], [Name1] ([USN1]), [Name2] ([USN2]), ...</code></p>
                <p>Example: <code className="bg-muted px-1 py-0.5 rounded">Team 1: Smart Home Automation, John Doe (1MS22CS001), Jane Smith (1MS22CS002)</code></p>
              </div>
              
              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleUpload}
                  disabled={isUploading || !manualEntry}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {isUploading ? "Uploading..." : "Upload Teams"}
                </Button>
              </div>
            </div>
          )}
          
          {/* Form Entry Tab */}
          {activeTab === "form" && (
            <TeamForm onSubmit={handleTeamFormSubmit} />
          )}
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Presentation Control Modal
function PresentationControlModal({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const { toast } = useToast();
  const { 
    startPresentation, 
    endPresentation, 
    activeSession, 
    activeTeam,
    evaluations, 
    startTimer,
    pauseTimer,
    resetTimer,
    timerSeconds,
    isTimerRunning,
    averageScores,
    peers,
    startScreenShare,
    stopScreenShare,
    isScreenSharing
  } = usePresentation();
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Format timer as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Fetch teams when modal opens
  useEffect(() => {
    if (open) {
      fetchTeams();
    }
  }, [open]);
  
  // Update selected team when active team changes
  useEffect(() => {
    if (activeTeam) {
      setSelectedTeamId(activeTeam.id.toString());
    } else {
      setSelectedTeamId("");
    }
  }, [activeTeam]);
  
  const fetchTeams = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/teams");
      if (!res.ok) {
        throw new Error("Failed to fetch teams");
      }
      const data = await res.json();
      setTeams(data);
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast({
        title: "Could not fetch teams",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPresentation = async () => {
    if (!selectedTeamId) {
      toast({
        title: "No team selected",
        description: "Please select a team to start the presentation",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      await startPresentation(Number(selectedTeamId));
      toast({
        title: "Presentation started",
        description: "The presentation session has been started",
      });
    } catch (error) {
      console.error("Start presentation error:", error);
      toast({
        title: "Failed to start presentation",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEndPresentation = async () => {
    if (!activeSession) {
      toast({
        title: "No active presentation",
        description: "There is no active presentation to end",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      await endPresentation();
      toast({
        title: "Presentation ended",
        description: "The presentation session has been ended",
      });
    } catch (error) {
      console.error("End presentation error:", error);
      toast({
        title: "Failed to end presentation",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownloadResults = () => {
    // Create a CSV with evaluation results
    const headers = [
      "Team", 
      "Peer", 
      "Technical Content", 
      "Presentation Skills", 
      "Project Demo", 
      "Overall", 
      "Positive Points", 
      "Negative Points"
    ];
    
    const rows = evaluations.map(evaluation => [
      activeTeam?.name || "",
      `Peer ${evaluation.peerId}`, // Using ID as we don't store peer names with evaluations
      evaluation.technicalContent.toString(),
      evaluation.presentationSkills.toString(),
      evaluation.projectDemo.toString(),
      ((evaluation.technicalContent + evaluation.presentationSkills + evaluation.projectDemo) / 3).toFixed(1),
      `"${evaluation.positivePoints || ""}"`,
      `"${evaluation.negativePoints || ""}"`
    ]);
    
    // Add average row
    if (averageScores) {
      rows.push([
        activeTeam?.name || "",
        "AVERAGE",
        averageScores.technicalContent.toFixed(1),
        averageScores.presentationSkills.toFixed(1),
        averageScores.projectDemo.toFixed(1),
        averageScores.overall.toFixed(1),
        "",
        ""
      ]);
    }
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    // Create a download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeTeam?.name}_evaluation_results.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Control Presentation</DialogTitle>
          <DialogDescription>
            Manage the current presentation session
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 my-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Team</label>
            <Select
              value={selectedTeamId}
              onValueChange={setSelectedTeamId}
              disabled={isLoading || !!activeSession}
            >
              <SelectTrigger>
                <SelectValue placeholder="-- Select a team --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder" disabled>-- Select a team --</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.name}: {team.projectTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Presentation Timer</label>
            <div className="flex items-center">
              <Button 
                variant="default" 
                size="sm" 
                className="bg-secondary text-white hover:bg-secondary/90 mr-2"
                onClick={startTimer}
                disabled={!activeSession || isTimerRunning}
              >
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="mr-2"
                onClick={pauseTimer}
                disabled={!activeSession || !isTimerRunning}
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="mr-4"
                onClick={resetTimer}
                disabled={!activeSession}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <span className="font-mono text-lg">{formatTime(timerSeconds)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommended time: 15 minutes per presentation
            </p>
          </div>
          
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium mb-2">Connected Peers</h3>
            {peers.length > 0 ? (
              <div className="mb-3">
                <ul className="text-sm list-disc pl-6">
                  {peers.map(peer => (
                    <li key={peer.id}>{peer.name}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground mb-3 italic">
                No peers connected at the moment. Waiting for participants...
              </div>
            )}
          </div>
          
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium mb-2">Evaluation Status</h3>
            <div className="flex justify-between text-sm">
              <span>Evaluations received:</span>
              <span className="font-medium">{evaluations.length}</span>
            </div>
            <Progress value={evaluations.length ? 100 : 0} className="h-2 mt-2" />
          </div>
          
          {activeSession && averageScores && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium mb-2">Quick Results (Current Team)</h3>
              <div className="text-sm grid grid-cols-2 gap-2">
                <div>Technical Content:</div>
                <div className="font-medium">{averageScores.technicalContent.toFixed(1)}/10</div>
                <div>Presentation Skills:</div>
                <div className="font-medium">{averageScores.presentationSkills.toFixed(1)}/10</div>
                <div>Project Demo:</div>
                <div className="font-medium">{averageScores.projectDemo.toFixed(1)}/10</div>
                <div>Overall Average:</div>
                <div className="font-medium">{averageScores.overall.toFixed(1)}/10</div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4">
            {activeSession ? (
              <>
                <Button 
                  variant="destructive"
                  onClick={handleEndPresentation}
                  disabled={isLoading}
                >
                  End Presentation
                </Button>
                <Button
                  variant="default"
                  onClick={handleDownloadResults}
                  disabled={evaluations.length === 0}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download Results
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                onClick={handleStartPresentation}
                disabled={isLoading || !selectedTeamId}
              >
                Start Presentation
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Feedback Summary Modal
function FeedbackSummaryModal({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const { activeTeam, feedback } = usePresentation();
  
  const handleDownloadPDF = () => {
    // In a real implementation, this would generate a PDF file
    // For this demo, we'll just show a message
    alert("In a production environment, this would generate a PDF with the feedback summary.");
  };
  
  if (!activeTeam || !feedback) {
    return null;
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI-Generated Feedback Summary</DialogTitle>
          <DialogDescription>
            Synthesized feedback based on peer evaluations
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 my-2">
          <Card className="bg-background">
            <CardHeader>
              <CardTitle>{activeTeam.name}: {activeTeam.projectTitle}</CardTitle>
              <div className="mb-2">
                <span className="text-sm font-medium">Overall Score: </span>
                <span className="text-lg font-medium">{feedback.overallScore / 10}/10</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-secondary mb-1">Strengths</h4>
                <ul className="list-disc pl-6 mb-4 text-sm">
                  {feedback.strengths.map((strength, index) => (
                    <li key={index}>{strength}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-accent mb-1">Areas for Improvement</h4>
                <ul className="list-disc pl-6 text-sm">
                  {feedback.improvements.map((improvement, index) => (
                    <li key={index}>{improvement}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
