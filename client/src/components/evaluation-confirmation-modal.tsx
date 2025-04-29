import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

interface EvaluationConfirmationModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  evaluation: {
    technicalContent: number;
    presentationSkills: number;
    projectDemo: number;
  } | null;
}

export function EvaluationConfirmationModal({
  open,
  setOpen,
  evaluation,
}: EvaluationConfirmationModalProps) {
  if (!evaluation) return null;

  const overallScore = (
    (evaluation.technicalContent + evaluation.presentationSkills + evaluation.projectDemo) / 3
  ).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center text-center">
            <div className="text-5xl mb-4">✅</div>
            <DialogTitle className="text-xl">Evaluation Submitted</DialogTitle>
            <DialogDescription>
              Thank you for your feedback! Your evaluation has been recorded.
            </DialogDescription>
          </div>
        </DialogHeader>

        <Card className="bg-background my-4">
          <CardContent className="pt-6">
            <h3 className="font-medium mb-2">Your Ratings</h3>
            <div className="grid grid-cols-2 gap-1 text-sm">
              <div>Technical Content:</div>
              <div className="font-medium">{evaluation.technicalContent}/10</div>
              <div>Presentation Skills:</div>
              <div className="font-medium">{evaluation.presentationSkills}/10</div>
              <div>Project Demo:</div>
              <div className="font-medium">{evaluation.projectDemo}/10</div>
              <div className="font-medium pt-1">Overall Score:</div>
              <div className="font-medium pt-1">{overallScore}/10</div>
            </div>
          </CardContent>
        </Card>

        <DialogFooter className="sm:justify-center">
          <Button onClick={() => setOpen(false)}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
