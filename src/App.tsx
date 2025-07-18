
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import TournamentsPage from "./pages/TournamentsPage";
import TournamentDetailsPage from "./pages/TournamentDetailsPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import SquadPage from "./pages/SquadPage";
import CreateSquadPage from "./pages/CreateSquadPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import AddTournamentPage from "./pages/AddTournamentPage";
import NotFound from "./pages/NotFound";
import InvitePlayersPage from "./pages/InvitePlayersPage";
import ViewMatchesPage from "./pages/ViewMatchesPage";
import ManageSquadPage from "./pages/ManageSquadPage";
import MatchDetailPage from "./pages/MatchDetailPage";

// Create a QueryClient instance
const queryClient = new QueryClient();

const App = () => {
  // Check if user is authenticated
  const isAuthenticated = () => {
    return localStorage.getItem("userRole") !== null;
  };

  // Check if user is admin
  const isAdmin = () => {
    return localStorage.getItem("userRole") === "admin";
  };

  // Protected route component
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    return isAuthenticated() ? <>{children}</> : <Navigate to="/" />;
  };

  // Admin route component
  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    return isAdmin() ? <>{children}</> : <Navigate to="/" />;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route 
              path="/tournaments" 
              element={
                <ProtectedRoute>
                  <TournamentsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tournaments/:id" 
              element={
                <ProtectedRoute>
                  <TournamentDetailsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/leaderboard" 
              element={
                <ProtectedRoute>
                  <LeaderboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/squad" 
              element={
                <ProtectedRoute>
                  <SquadPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/create-squad" 
              element={
                <ProtectedRoute>
                  <CreateSquadPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              } 
            />
            <Route 
              path="/add-tournament" 
              element={
                <AdminRoute>
                  <AddTournamentPage />
                </AdminRoute>
              } 
            />
            <Route path="/invite-players" element={<InvitePlayersPage />} />
            <Route path="/view-matches" element={<ViewMatchesPage />} />
            <Route path="/match-details" element={<MatchDetailPage />} />
            
<Route path="/manage-squad" element={<ManageSquadPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
