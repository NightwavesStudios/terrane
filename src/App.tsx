import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ExplorePage from "./pages/ExplorePage";
import ListsPage from "./pages/ListsPage";
import NotFoundPage from "./pages/NotFoundPage";
import PeakDetailPage from "./pages/PeakDetailPage";
import PeaksPage from "./pages/PeaksPage";
import ProgressPage from "./pages/ProgressPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<ExplorePage />} />
        <Route path="peaks" element={<PeaksPage />} />
        <Route path="peaks/:peakId" element={<PeakDetailPage />} />
        <Route path="lists" element={<ListsPage />} />
        <Route path="progress" element={<ProgressPage />} />
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
