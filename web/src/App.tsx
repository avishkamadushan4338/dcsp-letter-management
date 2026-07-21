import { Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard.js";
import { Login } from "./pages/Login.js";
import { NewLetter } from "./pages/NewLetter.js";
import { PrintNumbers } from "./pages/PrintNumbers.js";
import { RelevantOfficerLink } from "./pages/RelevantOfficerLink.js";
import { SubjectOfficerDashboard } from "./pages/SubjectOfficerDashboard.js";
import { SubjectOfficerLink } from "./pages/SubjectOfficerLink.js";
import { SubjectOfficerNewLetter } from "./pages/SubjectOfficerNewLetter.js";

// Route map (old page -> new route):
//   index.html                      -> /
//   dashboard.html                  -> /dashboard
//   new-letter.html                 -> /new-letter
//   subject-officer-dashboard.html  -> /subject-officer-dashboard
//   subject-officer-new-letter.html -> /subject-officer-new-letter
//   subject-officer.html?token=     -> /subject-officer?token=
//   relevant-officer.html?token=    -> /relevant-officer?token=
//   print-numbers.html              -> /print-numbers
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/new-letter" element={<NewLetter />} />
      <Route path="/subject-officer-dashboard" element={<SubjectOfficerDashboard />} />
      <Route path="/subject-officer-new-letter" element={<SubjectOfficerNewLetter />} />
      <Route path="/subject-officer" element={<SubjectOfficerLink />} />
      <Route path="/relevant-officer" element={<RelevantOfficerLink />} />
      <Route path="/print-numbers" element={<PrintNumbers />} />
    </Routes>
  );
}
