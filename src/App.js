import React, { useState } from "react";
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
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h2 style={{ margin: 0 }}>Meetings</h2>
      <button className="btn btn-primary" onClick={onScheduleClick}>
        Schedule
      </button>
    </header>
  );
}

export default App;
