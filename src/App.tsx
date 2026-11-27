import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import DataPage from "./pages/DataPage";
import ExplorePage from "./pages/ExplorePage";
import ImportPage from "./pages/ImportPage";
import ListDetailPage from "./pages/ListDetailPage";
import ListsPage from "./pages/ListsPage";
import LogPage from "./pages/LogPage";
import NotFoundPage from "./pages/NotFoundPage";
import PeakDetailPage from "./pages/PeakDetailPage";
import PeaksPage from "./pages/PeaksPage";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/SettingsPage";
import SignInPage from "./pages/SignInPage";
import { RecordProvider } from "./state/RecordContext";

export function AppRoutes() {
  return (
    <RecordProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<ExplorePage />} />
          <Route path="peaks" element={<PeaksPage />} />
          <Route path="peaks/:slug" element={<PeakDetailPage />} />
          <Route path="lists" element={<ListsPage />} />
          <Route path="lists/:slug" element={<ListDetailPage />} />
          <Route path="log" element={<LogPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="signin" element={<SignInPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="about/data" element={<DataPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </RecordProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
