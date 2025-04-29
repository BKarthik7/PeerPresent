import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { LoginModal } from "@/components/login-modal";
import { Header } from "@/components/header";
import { PresentationViewer } from "@/components/presentation-viewer";
import { EvaluationPanel } from "@/components/evaluation-panel";
import { AdminModals } from "@/components/admin-modals";
import { EvaluationConfirmationModal } from "@/components/evaluation-confirmation-modal";
import { PeerList } from "@/components/peer-list";
import { ScreenSharePanel } from "@/components/screen-share-panel";

export default function Home() {
  const { user, isLoading } = useAuth();
  
  const [teamUploadOpen, setTeamUploadOpen] = useState(false);
  const [presentationControlOpen, setPresentationControlOpen] = useState(false);
  const [feedbackSummaryOpen, setFeedbackSummaryOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [submittedEvaluation, setSubmittedEvaluation] = useState<{
    technicalContent: number;
    presentationSkills: number;
    projectDemo: number;
  } | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not logged in, show login modal
  if (!user) {
    return <LoginModal />;
  }

  // Render different layouts for admin vs peer
  if (user.isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header 
          onUploadTeams={() => setTeamUploadOpen(true)}
          onControlPresentation={() => setPresentationControlOpen(true)}
        />
        
        <main className="flex-grow flex flex-col p-6">
          <div className="flex flex-col space-y-6 max-w-4xl mx-auto w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <div className="bg-card rounded-lg border shadow-sm p-6 h-full">
                  <h2 className="text-xl font-semibold mb-4">Presentation Control Panel</h2>
                  <p className="text-muted-foreground mb-6">
                    As an administrator, you can manage team information, control presentations, and view feedback.
                    Use the buttons below to access these functions.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button 
                      onClick={() => setTeamUploadOpen(true)}
                      className="flex flex-col items-center justify-center bg-muted hover:bg-muted/80 rounded-lg p-6 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      <span className="font-medium">Manage Teams</span>
                    </button>
                    
                    <button 
                      onClick={() => setPresentationControlOpen(true)}
                      className="flex flex-col items-center justify-center bg-muted hover:bg-muted/80 rounded-lg p-6 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                      </svg>
                      <span className="font-medium">Control Presentation</span>
                    </button>
                    
                    <button 
                      onClick={() => setFeedbackSummaryOpen(true)}
                      className="flex flex-col items-center justify-center bg-muted hover:bg-muted/80 rounded-lg p-6 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      <span className="font-medium">View Feedback</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="md:col-span-1 space-y-6">
                <PeerList />
                <ScreenSharePanel />
              </div>
            </div>
          </div>
        </main>
        
        {/* Admin Modals */}
        <AdminModals 
          teamUploadOpen={teamUploadOpen}
          setTeamUploadOpen={setTeamUploadOpen}
          presentationControlOpen={presentationControlOpen}
          setPresentationControlOpen={setPresentationControlOpen}
          feedbackSummaryOpen={feedbackSummaryOpen}
          setFeedbackSummaryOpen={setFeedbackSummaryOpen}
        />
      </div>
    );
  }
  
  // Peer view
  return (
    <div className="min-h-screen flex flex-col">
      <Header 
        onUploadTeams={() => setTeamUploadOpen(true)}
        onControlPresentation={() => setPresentationControlOpen(true)}
      />
      
      <main className="flex-grow flex flex-col md:flex-row">
        <PresentationViewer />
        <EvaluationPanel />
      </main>
      
      {/* Evaluation Confirmation Modal */}
      <EvaluationConfirmationModal 
        open={confirmationOpen}
        setOpen={setConfirmationOpen}
        evaluation={submittedEvaluation}
      />
    </div>
  );
}
