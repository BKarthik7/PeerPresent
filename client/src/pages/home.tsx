import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { LoginModal } from "@/components/login-modal";
import { Header } from "@/components/header";
import { PresentationViewer } from "@/components/presentation-viewer";
import { EvaluationPanel } from "@/components/evaluation-panel";
import { AdminModals } from "@/components/admin-modals";
import { EvaluationConfirmationModal } from "@/components/evaluation-confirmation-modal";

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
      
      {/* Admin Modals */}
      <AdminModals 
        teamUploadOpen={teamUploadOpen}
        setTeamUploadOpen={setTeamUploadOpen}
        presentationControlOpen={presentationControlOpen}
        setPresentationControlOpen={setPresentationControlOpen}
        feedbackSummaryOpen={feedbackSummaryOpen}
        setFeedbackSummaryOpen={setFeedbackSummaryOpen}
      />
      
      {/* Evaluation Confirmation Modal */}
      <EvaluationConfirmationModal 
        open={confirmationOpen}
        setOpen={setConfirmationOpen}
        evaluation={submittedEvaluation}
      />
    </div>
  );
}
