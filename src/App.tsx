import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import AdventureDetailPage from "./pages/AdventureDetailPage";
import AtlasPage from "./pages/AtlasPage";
import ExplorePage from "./pages/ExplorePage";
import GoalsPage from "./pages/GoalsPage";
import JournalPage from "./pages/JournalPage";
import ListsPage from "./pages/ListsPage";
import NotFoundPage from "./pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<ExplorePage />} />
        <Route path="atlas" element={<AtlasPage />} />
        <Route path="atlas/:adventureId" element={<AdventureDetailPage />} />
        <Route path="lists" element={<ListsPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="journal" element={<JournalPage />} />
        {/* Old routes from the peak-only foundation. */}
        <Route path="peaks" element={<Navigate to="/atlas" replace />} />
        <Route path="peaks/:peakId" element={<Navigate to="/atlas" replace />} />
        <Route path="progress" element={<Navigate to="/journal" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
