import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import Step1PersonalInfo from './pages/registration/Step1PersonalInfo';
import Step2DataTreatment from './pages/registration/Step2DataTreatment';
import Step3Sociodemographic from './pages/registration/Step3Sociodemographic';
import Step4Consent from './pages/registration/Step4Consent';
import ChatPage from './pages/ChatPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Registration flow */}
        <Route path="/registro" element={<Step1PersonalInfo />} />
        <Route path="/registro/tratamiento-datos" element={<Step2DataTreatment />} />
        <Route path="/registro/sociodemografico" element={<Step3Sociodemographic />} />
        <Route path="/registro/consentimiento" element={<Step4Consent />} />

        {/* Protected chat */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
