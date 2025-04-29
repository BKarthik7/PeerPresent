import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";
import type { Team } from "@shared/schema";

type MemberType = {
  name: string;
  usn: string;
};

interface TeamFormProps {
  onSubmit: (team: Omit<Team, "id" | "createdBy">) => void;
}

export function TeamForm({ onSubmit }: TeamFormProps) {
  const [teamNumber, setTeamNumber] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [members, setMembers] = useState<MemberType[]>([{ name: "", usn: "" }]);

  const addMember = () => {
    setMembers([...members, { name: "", usn: "" }]);
  };

  const removeMember = (index: number) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  const updateMember = (index: number, field: keyof MemberType, value: string) => {
    const updatedMembers = [...members];
    updatedMembers[index][field] = value;
    setMembers(updatedMembers);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!teamNumber || !projectTitle || members.some(m => !m.name || !m.usn)) {
      return;
    }
    
    const team: Omit<Team, "id" | "createdBy"> = {
      name: `Team ${teamNumber}`,
      projectTitle,
      members
    };
    
    onSubmit(team);
    
    // Reset form
    setTeamNumber("");
    setProjectTitle("");
    setMembers([{ name: "", usn: "" }]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Team Number</label>
          <Input
            placeholder="e.g., 1"
            value={teamNumber}
            onChange={(e) => setTeamNumber(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Project Title</label>
          <Input
            placeholder="e.g., Smart Home Automation"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Team Members</label>
          <Button 
            type="button" 
            size="sm" 
            variant="outline" 
            onClick={addMember}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Member
          </Button>
        </div>

        {members.map((member, index) => (
          <div key={index} className="flex space-x-3 items-center">
            <div className="flex-1">
              <Input
                placeholder="Name"
                value={member.name}
                onChange={(e) => updateMember(index, "name", e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="USN"
                value={member.usn}
                onChange={(e) => updateMember(index, "usn", e.target.value)}
                required
              />
            </div>
            {members.length > 1 && (
              <Button 
                type="button" 
                size="icon" 
                variant="ghost" 
                onClick={() => removeMember(index)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove</span>
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit">Create Team</Button>
      </div>
    </form>
  );
}