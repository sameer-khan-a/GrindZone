import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Mock list of potential players
const mockUsers = [
  { id: "u1", name: "AceHunter", status: "Online" },
  { id: "u2", name: "BlazeShot", status: "Offline" },
  { id: "u3", name: "MysticStorm", status: "In Game" },
  { id: "u4", name: "DarkKnight", status: "Online" },
];

const InvitePlayersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [invited, setInvited] = useState<string[]>([]);
  const navigate = useNavigate();

  const filteredUsers = mockUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInvite = (id: string) => {
    if (!invited.includes(id)) {
      setInvited([...invited, id]);
    }
  };

  return (
    <div className="min-h-screen bg-grindzone-dark text-white">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <PageTitle title="Invite Players" subtitle="Search and invite players to your squad" />
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        <div className="mb-6">
          <Input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search players by name"
            className="w-full max-w-md bg-grindzone-card text-white placeholder-gray-400"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(user => (
            <Card key={user.id} className="bg-grindzone-card border border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{user.name}</h4>
                  <p className={`text-sm mt-1 ${
                    user.status === "Online"
                      ? "text-green-500"
                      : user.status === "Offline"
                      ? "text-gray-400"
                      : "text-yellow-500"
                  }`}>
                    {user.status}
                  </p>
                </div>
                <Button 
                  onClick={() => handleInvite(user.id)} 
                  disabled={invited.includes(user.id)}
                  className={`${
                    invited.includes(user.id)
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-grindzone-blue hover:bg-grindzone-blue-light"
                  }`}
                >
                  {invited.includes(user.id) ? "Invited" : "Invite"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <p className="text-center text-muted-foreground mt-8">No players found.</p>
        )}
      </div>
    </div>
  );
};

export default InvitePlayersPage;
