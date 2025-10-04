// src/components/cards/TournamentCard.tsx
import React from "react";

interface ParticipantsObj {
  current?: number;
  max?: number;
  currentPlayers?: number;
  maxPlayers?: number;
}

interface TournamentProps {
  id: string;
  name: string;
  game?: string;
  date?: string;
  tier?: string;
  participants?: string | ParticipantsObj;
  image?: string;
  isFull?: boolean;
  status?: string;
  prizePool?: string;
  entryFee?: string;
  description?: string;
  rules?: string;
}

const parseParticipants = (p?: string | ParticipantsObj): { current: number; max: number } | null => {
  if (!p) return null;

  if (typeof p === "string") {
    const match = p.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!match) return null;
    const current = Number(match[1]);
    const max = Number(match[2]);
    return { current: Number.isNaN(current) ? 0 : current, max: Number.isNaN(max) ? 0 : max };
  }

  if (typeof p === "object") {
    const current = Number(p.current ?? p.currentPlayers ?? 0);
    const max = Number(p.max ?? p.maxPlayers ?? 0);
    return { current: Number.isNaN(current) ? 0 : current, max: Number.isNaN(max) ? 0 : max };
  }

  return null;
};

const checkIfFull = (participants?: string | ParticipantsObj): boolean => {
  const parsed = parseParticipants(participants);
  if (!parsed) return false;
  const { current, max } = parsed;
  if (!max) return false;
  return current >= max;
};

const participantDisplay = (participants?: string | ParticipantsObj): string => {
  const parsed = parseParticipants(participants);
  if (parsed) return `${parsed.current}/${parsed.max}`;
  // fallback: if it's a raw string (malformed), show it; otherwise unknown
  return typeof participants === "string" ? participants : "N/A";
};

const TournamentCard: React.FC<TournamentProps> = (props) => {
  const {
    name,
    game,
    date,
    tier,
    participants,
    image,
    prizePool,
    entryFee,
    status,
  } = props;

  const full = checkIfFull(participants);

  return (
    <div className="bg-grindzone-card rounded-lg overflow-hidden shadow-md">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gray-800 flex items-center justify-center text-sm text-gray-400">
          No image
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{name}</h3>
            <div className="text-sm text-muted-foreground">{game} • {tier}</div>
          </div>

          <div className="text-right">
            <div className={`text-xs font-medium px-2 py-1 rounded ${status === "Ongoing" ? "bg-green-600" : status === "Registration" ? "bg-yellow-600" : "bg-gray-700"} text-white`}>
              {status ?? "Upcoming"}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-gray-300">
          <div>
            <div>Participants</div>
            <div className={`font-semibold ${full ? "text-red-400" : "text-green-300"}`}>
              {participantDisplay(participants)}
            </div>
          </div>

          <div className="text-right">
            <div>Prize</div>
            <div className="font-semibold">{prizePool ?? "TBD"}</div>

            <div className="mt-2 text-xs text-muted-foreground">Entry {entryFee ?? "Free"}</div>
            <div className="mt-1 text-xs text-muted-foreground">{date ? new Date(date).toLocaleString() : "Date TBA"}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentCard;
