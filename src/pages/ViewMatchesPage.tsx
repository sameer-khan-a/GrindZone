import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/navigation/Navbar";
import PageTitle from "@/components/ui/PageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Mock match data
const matches = [
  {
    id: "m1",
    opponent: "Storm Bringers",
    date: "July 12, 2025",
    result: "Win",
    score: "16-10",
  },
  {
    id: "m2",
    opponent: "Rogue Elites",
    date: "July 5, 2025",
    result: "Loss",
    score: "12-16",
  },
  {
    id: "m3",
    opponent: "Silent Shadows",
    date: "June 28, 2025",
    result: "Win",
    score: "18-8",
  },
];

const ViewMatchesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-grindzone-dark text-white">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <PageTitle title="Match History" subtitle="Review past squad matches and scores" />
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((match) => (
            <Card key={match.id} className="bg-grindzone-card border border-border">
              <CardHeader className="pb-2">
                <h3 className="text-lg font-semibold">{match.opponent}</h3>
                <p className="text-sm text-muted-foreground">{match.date}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Result</div>
                  <div className={`font-bold ${
                    match.result === "Win" ? "text-green-500" : "text-red-500"
                  }`}>
                    {match.result}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm text-muted-foreground">Score</div>
                  <div className="font-bold text-purple-400">{match.score}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {matches.length === 0 && (
          <p className="text-center text-muted-foreground mt-8">No matches found.</p>
        )}
      </div>
    </div>
  );
};

export default ViewMatchesPage;
