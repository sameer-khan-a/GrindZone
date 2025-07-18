import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { CalendarIcon } from "lucide-react";

interface TournamentCardProps {
  id: string;
  name: string;
  game: string;
  date: string;
  tier: string;
  participants: string;
  image?: string;
  isFull?: boolean;
  status?: string;
}

const TournamentCard: React.FC<TournamentCardProps> = ({
  id,
  name,
  game,
  date,
  tier,
  participants,
  image,
  isFull = false,
  status,
}) => {
  const navigate = useNavigate();

  const handleTournamentClick = () => navigate(`/tournaments/${id}`);
  const handleViewDetailsClick = () => navigate(`/tournaments/${id}`);

  const checkIfFull = (): boolean => {
    if (isFull) return true;
    const match = participants.match(/(\d+)\/(\d+)/);
    if (match && match.length >= 3) {
      const current = parseInt(match[1]);
      const max = parseInt(match[2]);
      return current >= max;
    }
    return false;
  };

  const tournamentIsFull = checkIfFull();

  const renderStatusBadge = () => {
    if (!status) return null;
    const statusStyles: Record<string, string> = {
      Ongoing: "bg-green-500/20 text-green-400",
      Upcoming: "bg-blue-500/20 text-blue-400",
      Registration: "bg-purple-500/20 text-purple-400",
      Completed: "bg-zinc-500/20 text-zinc-400",
    };

    return (
      <span
        className={`text-xs px-2 py-1 rounded absolute top-3 right-3 ${
          statusStyles[status] || "bg-zinc-500/20 text-zinc-400"
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="bg-grindzone-card rounded-xl overflow-hidden card-glow border border-border relative transition-shadow hover:shadow-lg">
      {renderStatusBadge()}

      {/* Header Image / Icon */}
      <div className="bg-indigo-500/30 h-32 flex items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
          {image ? (
            <img
              src={image}
              alt={game || "Tournament image"}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="text-2xl font-bold text-white">
              {game?.substring(0, 2).toUpperCase() || "NA"}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-1">{name}</h3>
        <p className="text-sm text-muted-foreground mb-3">{game}</p>

        <div className="flex items-center text-sm text-muted-foreground mb-4">
          <CalendarIcon size={16} className="mr-1" />
          <span>{date}</span>
        </div>

        <div className="flex justify-between items-center mb-4">
          <span className="text-xs bg-grindzone-darker px-3 py-1 rounded-full border border-border">
            {tier}
          </span>
          <span className="text-xs text-muted-foreground">{participants}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {tournamentIsFull ? (
            <Button
              disabled
              title="Tournament is full"
              className="w-1/2 bg-gray-600 hover:bg-gray-600 cursor-not-allowed"
            >
              Full
            </Button>
          ) : (
            <Button
              onClick={handleTournamentClick}
              className="w-1/2 bg-grindzone-blue hover:bg-grindzone-blue-light"
            >
              Join
            </Button>
          )}
          <Button variant="outline" className="w-1/2" onClick={handleViewDetailsClick}>
            View
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TournamentCard;
