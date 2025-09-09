import React, { useState } from "react"; 
import BookingComponent from "./components/BookingComponent";
 import MeetingsDashboard from "./components/MeetingsDashboard";
 
 function App() { const [view, setView] = useState("dashboard");
  return ( <div style={{ padding: 20 }}>
     <Header onScheduleClick={() => setView("booking")} />
       <main style={{ marginTop: 20 }}> 
        {view === "dashboard" && <MeetingsDashboard />}
 {view === "booking" && <BookingComponent />}
  </main> </div> ); }
   function Header({ onScheduleClick }) 
   { return null; } export default App;