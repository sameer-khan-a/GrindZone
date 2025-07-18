import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Crown, UserPlus } from "lucide-react";

// Mock squad members
const mockMembers = [
  { id: "1", name: "ProGamer123", role: "Captain" },
  { id: "2", name: "NinjaWarrior", role: "Member" },
  { id: "3", name: "ShadowSniper", role: "Member" }
];

const ManageSquadPage: React.FC = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState(mockMembers);

  const handleRemove = (id: string) => {
    setMembers(prev => prev.filter(member => member.id !== id));
  };

  const handlePromote = (id: string) => {
    setMembers(prev =>
      prev.map(member => ({
        ...member,
        role: member.id === id ? "Captain" : "Member"
      }))
    );
  };

  return (
    <div className="min-h-screen bg-grindzone-dark text-white">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <PageTitle title="Manage Squad" subtitle="Update squad members and roles" />
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        <div className="mb-6 max-w-md">
          <Input 
            placeholder="Invite player by username or email"
            className="bg-grindzone-card text-white placeholder-gray-400"
          />
          <Button className="mt-2 bg-grindzone-blue hover:bg-grindzone-blue-light flex items-center gap-2">
            <UserPlus size={16} />
            Send Invite
          </Button>
        </div>

        <h3 className="text-lg font-semibold mb-4">Current Members</h3>
        <div className="space-y-4">
          {members.map(member => (
            <Card key={member.id} className="bg-grindzone-card border border-border">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
                <div className="flex gap-2">
                  {member.role !== "Captain" && (
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handlePromote(member.id)}
                      title="Promote to Captain"
                    >
                      <Crown className="text-yellow-500" size={18} />
                    </Button>
                  )}
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => handleRemove(member.id)}
                    title="Remove Member"
                  >
                    <Trash2 className="text-red-500" size={18} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {members.length === 0 && (
          <p className="text-muted-foreground mt-8 text-center">No members left in the squad.</p>
        )}
      </div>
    </div>
  );
};

export default ManageSquadPage;
