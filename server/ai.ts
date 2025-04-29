import OpenAI from "openai";
import type {Evaluation, Team} from "@shared/schema";
import dotenv from "dotenv";

dotenv.config();

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateAIFeedback(
  evaluations: Evaluation[],
  team: Team
): Promise<{
  strengths: string[];
  improvements: string[];
  overallScore: number;
}> {
  try {
    // Prepare the evaluations data for the AI
    const evaluationPrompt = evaluations.map((evaluation) => `
Technical Content: ${evaluation.technicalContent}/10
Presentation Skills: ${evaluation.presentationSkills}/10
Project Demo: ${evaluation.projectDemo}/10
Positive Points: ${evaluation.positivePoints || "None provided"}
Areas for Improvement: ${evaluation.negativePoints || "None provided"}
`).join("\n---\n");

    // Calculate average scores
    const avgTechnicalContent = evaluations.reduce((sum, e) => sum + e.technicalContent, 0) / evaluations.length;
    const avgPresentationSkills = evaluations.reduce((sum, e) => sum + e.presentationSkills, 0) / evaluations.length;
    const avgProjectDemo = evaluations.reduce((sum, e) => sum + e.projectDemo, 0) / evaluations.length;
    const avgOverall = Math.round((avgTechnicalContent + avgPresentationSkills + avgProjectDemo) / 3 * 10);

    const prompt = `
You are a helpful presentation feedback analyzer. Below are peer evaluations for a team presentation.
Team: ${team.name}
Project: ${team.projectTitle}
Team Members: ${team.members.map(m => `${m.name} (${m.usn})`).join(", ")}

Average Scores:
- Technical Content: ${avgTechnicalContent.toFixed(1)}/10
- Presentation Skills: ${avgPresentationSkills.toFixed(1)}/10
- Project Demo: ${avgProjectDemo.toFixed(1)}/10
- Overall: ${(avgOverall / 10).toFixed(1)}/10

Individual Peer Evaluations:
${evaluationPrompt}

Based on these evaluations, generate a concise, constructive feedback summary in JSON format with the following structure:
{
  "strengths": [list of 3-5 key strengths mentioned by multiple evaluators],
  "improvements": [list of 3-5 key areas for improvement mentioned by multiple evaluators]
}

Each point should be a complete, specific, and actionable sentence. Focus on patterns across multiple evaluations.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert presentation evaluator who provides constructive feedback."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{"strengths":[],"improvements":[]}');

    return {
      strengths: result.strengths,
      improvements: result.improvements,
      overallScore: avgOverall
    };
  } catch (error) {
    console.error("AI feedback generation error:", error);
    
    // Fallback to basic feedback if AI fails
    return {
      strengths: [
        "The presentation demonstrated good technical understanding.",
        "The team communicated their ideas clearly.",
        "The project demo showed practical application of concepts."
      ],
      improvements: [
        "Consider adding more visual elements to enhance engagement.",
        "Practice time management to cover all key points.",
        "Provide more context about the problem being solved."
      ],
      overallScore: Math.round(
        evaluations.reduce(
          (sum, e) => sum + (e.technicalContent + e.presentationSkills + e.projectDemo) / 3, 
          0
        ) / evaluations.length * 10
      )
    };
  }
}
