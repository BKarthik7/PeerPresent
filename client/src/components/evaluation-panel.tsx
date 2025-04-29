import { useState } from "react";
import { usePresentation } from "@/contexts/presentation-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { evaluationFormSchema } from "@shared/schema";
import { z } from "zod";

type EvaluationFormValues = z.infer<typeof evaluationFormSchema>;

export function EvaluationPanel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    activeTeam, 
    activeSession, 
    submitEvaluation, 
    hasSubmittedEvaluation 
  } = usePresentation();
  
  const [selectedRatings, setSelectedRatings] = useState({
    technicalContent: 0,
    presentationSkills: 0,
    projectDemo: 0
  });

  const form = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationFormSchema),
    defaultValues: {
      technicalContent: 0,
      presentationSkills: 0,
      projectDemo: 0,
      positivePoints: "",
      negativePoints: ""
    }
  });

  const handleRatingClick = (category: keyof typeof selectedRatings, value: number) => {
    setSelectedRatings((prev) => ({ ...prev, [category]: value }));
    form.setValue(category, value, { shouldValidate: true });
  };

  const onSubmit = async (data: EvaluationFormValues) => {
    if (!activeSession) {
      toast({
        title: "Error",
        description: "No active presentation to evaluate",
        variant: "destructive"
      });
      return;
    }
    
    await submitEvaluation(data);
  };

  if (!activeTeam || !activeSession) {
    return (
      <div className="w-full md:w-96 bg-white border-l border-light-gray overflow-y-auto p-4 flex items-center justify-center text-center">
        <div className="p-4">
          <h2 className="text-lg font-google-sans font-semibold mb-2">No Active Presentation</h2>
          <p className="text-sm text-muted-foreground">
            Wait for the admin to start a presentation to provide evaluation.
          </p>
        </div>
      </div>
    );
  }

  if (hasSubmittedEvaluation) {
    return (
      <div className="w-full md:w-96 bg-white border-l border-light-gray overflow-y-auto p-4">
        <div className="p-4 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-lg font-google-sans font-semibold mb-2">Evaluation Submitted</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Thank you for your feedback! Your evaluation has been recorded.
          </p>
          <p className="text-sm text-muted-foreground">
            Please wait for the next presentation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-96 bg-white border-l border-light-gray overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-google-sans font-semibold mb-4">Evaluation Form</h2>
        
        {/* Team Info */}
        <div className="bg-background rounded-lg p-3 mb-4">
          <h3 className="font-medium">{activeTeam.name}: {activeTeam.projectTitle}</h3>
          <div className="text-sm text-muted-foreground mt-1">
            {activeTeam.members.map((member, idx) => (
              <span key={idx}>
                {member.name} ({member.usn})
                {idx < activeTeam.members.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        </div>
        
        {/* Evaluation Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Technical Content (1-10) */}
            <FormField
              control={form.control}
              name="technicalContent"
              render={() => (
                <FormItem>
                  <FormLabel>Technical Content (1-10)</FormLabel>
                  <div className="flex justify-between gap-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((rating) => (
                      <div
                        key={rating}
                        className={`rating-circle w-8 h-8 rounded-full flex items-center justify-center border-2 
                          ${selectedRatings.technicalContent === rating 
                            ? 'bg-primary text-white border-primary' 
                            : 'border-primary text-foreground'
                          }`}
                        onClick={() => handleRatingClick('technicalContent', rating)}
                      >
                        <span className="text-sm">{rating}</span>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Presentation Skills (1-10) */}
            <FormField
              control={form.control}
              name="presentationSkills"
              render={() => (
                <FormItem>
                  <FormLabel>Presentation Skills (1-10)</FormLabel>
                  <div className="flex justify-between gap-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((rating) => (
                      <div
                        key={rating}
                        className={`rating-circle w-8 h-8 rounded-full flex items-center justify-center border-2 
                          ${selectedRatings.presentationSkills === rating 
                            ? 'bg-primary text-white border-primary' 
                            : 'border-primary text-foreground'
                          }`}
                        onClick={() => handleRatingClick('presentationSkills', rating)}
                      >
                        <span className="text-sm">{rating}</span>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Project Demo (1-10) */}
            <FormField
              control={form.control}
              name="projectDemo"
              render={() => (
                <FormItem>
                  <FormLabel>Project Demo (1-10)</FormLabel>
                  <div className="flex justify-between gap-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((rating) => (
                      <div
                        key={rating}
                        className={`rating-circle w-8 h-8 rounded-full flex items-center justify-center border-2 
                          ${selectedRatings.projectDemo === rating 
                            ? 'bg-primary text-white border-primary' 
                            : 'border-primary text-foreground'
                          }`}
                        onClick={() => handleRatingClick('projectDemo', rating)}
                      >
                        <span className="text-sm">{rating}</span>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Comments */}
            <FormField
              control={form.control}
              name="positivePoints"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Positive Points</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What did they do well?" 
                      className="resize-none h-20"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="negativePoints"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Areas for Improvement</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What could be improved?" 
                      className="resize-none h-20"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={
                !form.formState.isValid || 
                form.formState.isSubmitting || 
                !selectedRatings.technicalContent || 
                !selectedRatings.presentationSkills || 
                !selectedRatings.projectDemo
              }
            >
              Submit Evaluation
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
