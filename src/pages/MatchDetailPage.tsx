import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Assuming react-router-dom is used
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/navigation/Navbar';

interface MatchDetail {
  opponent: string;
  result: string;
  score: string;
  date: string;
  matchId: string;
  // Add any other detailed properties you might fetch from an API
  kills?: number;
  deaths?: number;
  assists?: number;
  damageDealt?: number;
  map?: string;
  duration?: string;
}

const MatchDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // In a real app, you might fetch details based on a matchId from URL params
  // For this example, we assume match data is passed via state
  const match = location.state?.match as MatchDetail | undefined;

  if (!match) {
    return (
      <div className="min-h-screen bg-grindzone-dark text-white flex flex-col items-center justify-center">
        <Navbar />
        <p className="text-xl">Match details not found.</p>
        <button
          onClick={() => navigate('/profile')} // Navigate back to profile
          className="mt-4 bg-grindzone-blue text-white px-4 py-2 rounded hover:bg-grindzone-blue-dark"
        >
          Go Back to Profile
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grindzone-dark text-white">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-center">Match Details</h1>
        <Card className="bg-grindzone-card max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Match vs {match.opponent}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">
              <span className="font-semibold">Result:</span>{' '}
              <span className={match.result === 'Win' ? 'text-green-500' : 'text-red-500'}>
                {match.result}
              </span>
            </p>
            <p className="text-lg">
              <span className="font-semibold">Score:</span> {match.score}
            </p>
            <p className="text-lg">
              <span className="font-semibold">Date:</span> {match.date}
            </p>
            <p className="text-lg">
              <span className="font-semibold">Match ID:</span> {match.matchId}
            </p>
            {/* Additional simulated details */}
            {match.kills && <p className="text-lg"><span className="font-semibold">Kills:</span> {match.kills}</p>}
            {match.deaths && <p className="text-lg"><span className="font-semibold">Deaths:</span> {match.deaths}</p>}
            {match.assists && <p className="text-lg"><span className="font-semibold">Assists:</span> {match.assists}</p>}
            {match.damageDealt && <p className="text-lg"><span className="font-semibold">Damage Dealt:</span> {match.damageDealt}</p>}
            {match.map && <p className="text-lg"><span className="font-semibold">Map:</span> {match.map}</p>}
            {match.duration && <p className="text-lg"><span className="font-semibold">Duration:</span> {match.duration}</p>}

            <button
              onClick={() => navigate('/profile')}
              className="mt-6 bg-grindzone-blue text-white px-5 py-2 rounded hover:bg-grindzone-blue-dark transition-colors"
            >
              Back to Profile
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MatchDetailPage;