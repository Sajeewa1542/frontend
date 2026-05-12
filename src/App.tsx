import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import WelcomePage from "./pages/WelcomePage";
import UploadPage from "./pages/UploadPage";
import ChatPage from "./pages/ChatPage";
import ProposalPage from "./pages/ProposalPage";
import SessionsPage from "./pages/SessionsPage";
import "./index.css";

function App() {
  return (
    <AppProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/chat/:projectId/:sessionId" element={<ChatPage />} />
            <Route path="/chat/:sessionId" element={<ChatPage />} />
            <Route path="/proposal/:projectId/:variationId" element={<ProposalPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App;
