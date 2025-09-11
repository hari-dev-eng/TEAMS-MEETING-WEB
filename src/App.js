import React, { useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import BookingComponent from "./components/BookingComponent";
import MeetingsDashboard from "./components/MeetingsDashboard";

function App() {
  const [view, setView] = useState("dashboard"); 

  return (
    <div style={{ padding: 20 }}>
      <Header onScheduleClick={() => setView("booking")} />
      <main style={{ marginTop: 20 }}>
        {view === "dashboard" && <MeetingsDashboard />}
        {view === "booking" && <BookingComponent />}
      </main>
    </div>
  );
}

function Header({ onScheduleClick }) {
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
}

export default App;
