import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import 'bootstrap/dist/css/bootstrap.min.css';

// Constants
const PAGE_SIZE = 10;
const api = axios.create({ baseURL: "https://teamsbackendapi-production.up.railway.app" });
const floorHeaders = ["Ground Floor", "1st Floor", "Conference Room", "3rd Floor"];

// Card gradients for different statuses - same for all floors
const statusGradients = {
  upcoming: "linear-gradient(105deg, #56baecbb 30%, #c5e5f5cc 100%)", // Light green to blue
  Live: "linear-gradient(105deg, #4cd964bb 30%, #c5e5f5cc 100%)",  // Brighter green to blue
  completed: "linear-gradient(105deg, #d1d1d1bb 30%, #e5e5e5cc 100%)" // Light gray
};

// DatePicker component
const DatePickerComponent = ({ selectedDate, setSelectedDate, label }) => {
  const formattedDate = selectedDate.toISOString().split('T')[0];
  return (
    <div className="d-flex align-items-center gap-2">
      {label && <label className="d-none d-md-block">{label}:</label>}
      <input
        type="date"
        value={formattedDate}
        onChange={(e) => setSelectedDate(new Date(e.target.value))}
        className="form-control"
        style={{ minWidth: "140px" }}
      />
    </div>
  );
};

// Function to determine meeting status
const getMeetingStatus = (startTime, endTime) => {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  if (now > end) return "completed";
  if (now >= start && now <= end) return "Live";
  return "upcoming";
};

// Function to format time only (without date)
const formatTimeOnly = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-IN", { 
    timeZone: "Asia/Kolkata",
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Helper function to get attendees count from meeting object
const getAttendeesCount = (meeting) => {
  // Try different possible property names
  return meeting.attendeesCount || meeting.attendeeCount || meeting.AttendeeCount || 0;
};

// Blinking Red Dot Component for Live Meetings
const LiveIndicator = () => {
  return (
    <span 
      className="blinking-dot me-1"
      style={{
        display: 'inline-block',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: '#ff0000',
      }}
    />
  );
};

const calculateStats = (meetings) => {
  const now = new Date();
  
  // Currently active meetings
  const activeMeetings = meetings.filter(meeting => {
    const start = new Date(meeting.startTime);
    const end = new Date(meeting.endTime);
    return now >= start && now <= end;
  });

  // Total attendees across all meetings
  const totalAttendees = meetings.reduce((total, meeting) => {
    return total + getAttendeesCount(meeting);
  }, 0);

  // Average duration per meeting in minutes
  const avgDuration = meetings.length > 0 
    ? meetings.reduce((total, meeting) => {
        const start = new Date(meeting.startTime);
        const end = new Date(meeting.endTime);
        return total + (end - start) / (1000 * 60);
      }, 0) / meetings.length
    : 0;

  // Room utilization percentage (assuming 8 working hours)
  const totalPossibleMinutes = 8 * 60; // 8 hours in minutes
  const totalUsedMinutes = meetings.reduce((total, meeting) => {
    const start = new Date(meeting.startTime);
    const end = new Date(meeting.endTime);
    return total + (end - start) / (1000 * 60);
  }, 0);
  
  const roomUtilization = totalPossibleMinutes > 0 
    ? Math.min(100, (totalUsedMinutes / totalPossibleMinutes) * 100)
    : 0;

  return {
    activeMeetings: activeMeetings.length,
    totalAttendees,
    avgDuration: Math.round(avgDuration),
    roomUtilization: Math.round(roomUtilization)
  };
};

// Loading Component
const LoadingIndicator = () => {
  return (
    <div className="d-flex justify-content-center align-items-center p-3">
      <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      <span>Loading meetings...</span>
    </div>
  );
};

// Main Component
const MeetingsDashboard = () => {
  const staticEmail = "";
  const [date, setDate] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState({
    activeMeetings: 0,
    totalAttendees: 0,
    avgDuration: 0,
    roomUtilization: 0
  });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  // Fetch meetings
  const fetchMeetings = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsManualRefresh(true);
    }
    
    setLoading(true);
    try {
      const res = await api.get("/api/Meetings", {
        params: { userEmail: staticEmail, date: date.toISOString().split("T")[0] }
      });
      
      const meetingsData = res.data?.meetings || [];
      
      // Log for debugging
      console.log("Meetings data:", meetingsData);
      if (meetingsData.length > 0) {
        console.log("First meeting properties:", Object.keys(meetingsData[0]));
      }
      
      setMeetings(meetingsData);
      setStats(calculateStats(meetingsData)); // Calculate stats
      setPage(1);

      // Hide error modal if fetch succeeds
      setShowErrorModal(false);
      setErrorMessage("");
    } catch (err) {
      setMeetings([]);
      setStats(calculateStats([])); // Reset stats on error
      setErrorMessage(
        err.response?.data?.message || err.message || "Failed to fetch meetings. Please try again."
      );
      setShowErrorModal(true);
      console.error(err);
    }
    setLoading(false);
    
    if (isManual) {
      // Reset manual refresh flag after a short delay
      setTimeout(() => setIsManualRefresh(false), 500);
    }
  }, [staticEmail, date]);

  // Initial fetch & whenever date changes
  useEffect(() => {
    fetchMeetings(false);
  }, [fetchMeetings]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchMeetings(false), 30000);
    return () => clearInterval(interval);
  }, [fetchMeetings]);

  const meetingsByFloor = floorHeaders.reduce((acc, floor) => {
    acc[floor] = meetings.filter((m) =>
      m.location?.toLowerCase().includes(floor.toLowerCase())
    );
    return acc;
  }, {});

  const totalPages = Math.ceil(
    Math.max(...floorHeaders.map(floor => meetingsByFloor[floor]?.length || 0)) / PAGE_SIZE
  );

  const pagedMeetings = floorHeaders.reduce((acc, floor) => {
    const all = meetingsByFloor[floor] || [];
    acc[floor] = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return acc;
  }, {});

  return (
    <div className="container-fluid px-2 px-md-3 px-lg-4 px-xl-5 my-3 my-md-4">
      {/* Add CSS for blinking animation */}
      <style>
        {`
          @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
          }
          .blinking-dot {
            animation: blink 1.5s infinite;
          }
        `}
      </style>
      
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 gap-md-0 mb-3 mb-md-4 p-2 p-md-3" style={{ background: "#2c3e50", color: "#fff", borderRadius: "12px" }}>
        <h2 className="fs-3 fs-md-2 mb-2 mb-md-0">Meetly Dashboard</h2>
        <div className="d-flex flex-column flex-sm-row align-items-start align-items-md-center gap-2">
          <DatePickerComponent selectedDate={date} setSelectedDate={setDate} />
          <button className="btn btn-primary" onClick={() => fetchMeetings(true)} disabled={loading}>
            {loading && isManualRefresh ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Loading...
              </>
            ) : (
              "Fetch Meetings"
            )}
          </button>
        </div>
      </div>

      {/* Show loading indicator only for manual refresh */}
      {loading && isManualRefresh && <LoadingIndicator />}

      {/* Total Meeting summary*/}
      <div className="row mb-3 mb-md-4">
        <div className="col-12">
          <div className="p-2 p-md-3 rounded" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid #e0e0e0" }}>
            <h4 className="mb-2 mb-md-3 fs-5 fs-md-4">{date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
            
            <div className="row text-center">
              <div className="col-6 col-md-3 mb-2 mb-md-3">
                <div className="p-2 p-md-3 rounded" style={{ background: "rgba(240, 248, 255, 0.7)" }}>
                  <h5 className="text-muted fs-6 fs-md-5">Today's Meetings</h5>
                  <h3 className="fw-bold fs-5 fs-md-4">{meetings.length}</h3>
                  <small className="text-muted d-none d-md-block">
                    {stats.activeMeetings} currently active
                  </small>
                  <small className="text-muted d-md-none">
                    {stats.activeMeetings} active
                  </small>
                </div>
              </div>
              
              <div className="col-6 col-md-3 mb-2 mb-md-3">
                <div className="p-2 p-md-3 rounded" style={{ background: "rgba(240, 248, 255, 0.7)" }}>
                  <h5 className="text-muted fs-6 fs-md-5">Total Attendees</h5>
                  <h3 className="fw-bold fs-5 fs-md-4">{stats.totalAttendees}</h3>
                  <small className="text-muted d-none d-md-block">
                    Across all meetings
                  </small>
                </div>
              </div>
              
              <div className="col-6 col-md-3 mb-2 mb-md-3">
                <div className="p-2 p-md-3 rounded" style={{ background: "rgba(240, 248, 255, 0.7)" }}>
                  <h5 className="text-muted fs-6 fs-md-5">Avg Duration</h5>
                  <h3 className="fw-bold fs-5 fs-md-4">{stats.avgDuration}m</h3>
                  <small className="text-muted d-none d-md-block">
                    Per meeting
                  </small>
                </div>
              </div>
              
              <div className="col-6 col-md-3 mb-2 mb-md-3">
                <div className="p-2 p-md-3 rounded" style={{ background: "rgba(240, 248, 255, 0.7)" }}>
                  <h5 className="text-muted fs-6 fs-md-5">Room Utilization</h5>
                  <h3 className="fw-bold fs-5 fs-md-4">{stats.roomUtilization}%</h3>
                  <small className="text-muted d-none d-md-block">
                    Today's usage
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meetings Grid */}
      {!loading || !isManualRefresh ? (
        <div className="row g-2 g-md-3 g-lg-4">
          {floorHeaders.map((floor, colIdx) => (
            <div key={colIdx} className="col-12 col-sm-6 col-xl-3">
              <div
                className="card h-100 shadow-sm"
                style={{ borderRadius: "16px", background: "rgba(255,255,255,0.5)" }}
              >
                <div
                  className="card-header text-white text-center fw-bold py-2 py-md-3"
                  style={{
                    background: "linear-gradient(90deg,#65799b,#5e2563 60%)",
                    borderTopLeftRadius: "16px",
                    borderTopRightRadius: "16px",
                    fontSize: "clamp(0.9rem, 1.5vw, 1.1rem)"
                  }}
                >
                  {floor}
                </div>
                <div className="card-body p-2 p-md-3" style={{ minHeight: "280px" }}>
                  <AnimatePresence>
                    {pagedMeetings[floor]?.length > 0 ? (
                      pagedMeetings[floor].map((meeting, idx) => {
                        const status = getMeetingStatus(meeting.startTime, meeting.endTime);
                        const attendeesCount = getAttendeesCount(meeting);
                        
                        return (
                          <motion.div
                            key={meeting.id || idx}
                            initial={{ opacity: 0, y: 60 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 60 }}
                            transition={{ 
                              duration: 0.6, 
                              ease: "easeOut", 
                              delay: idx * 0.1
                            }}
                            className="p-2 p-md-3 mb-2 mb-md-3 rounded shadow-sm"
                            style={{
                              background: statusGradients[status],
                              borderLeft: `4px solid ${
                                status === "completed" ? "#95a5a6" : 
                                status === "Live" ? "#06d373ff" : "#3498db"
                              }`,
                              minHeight: "80px",
                              fontWeight: 700,
                              opacity: status === "completed" ? 0.8 : 1
                            }}
                          >
                            <div style={{ fontSize: "clamp(0.85rem, 1.8vw, 1rem)", color: "#2c3e50" }} className="text-truncate">{meeting.subject}</div>
                            <div className="d-flex justify-content-between align-items-center mt-1">
                              <div style={{ fontSize: "clamp(0.7rem, 1.6vw, 0.85rem)", color: "#444" }} className="text-truncate">👤 {meeting.organizer}</div>
                              <div style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#555" }}>
                                🙎🏻‍♂️ {attendeesCount}
                              </div>
                            </div>
                            <div style={{ fontSize: "clamp(0.75rem, 1.7vw, 0.9rem)", color: "#555" }}>
                              {formatTimeOnly(meeting.startTime)} - {formatTimeOnly(meeting.endTime)}
                            </div>
                            
                            <div style={{ 
                              fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", 
                              color: status === "completed" ? "#7f8c8d" : 
                                     status === "upcoming" ? "rgba(25, 0, 255, 1)" :
                                     status === "Live" ? "#ff0000ff" : "",
                              fontWeight: "bold",
                              textAlign: "right",
                              textTransform: "uppercase",
                              marginTop: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end"
                            }}>
                              {status === "Live" && <LiveIndicator />}
                              {status}
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div
                        className="text-center text-muted fw-semibold p-3"
                        style={{
                          background: "rgba(255,255,255,0.8)",
                          borderRadius: "12px",
                          minHeight: "80px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "clamp(0.9rem, 2vw, 1rem)"
                        }}
                      >
                        No meetings
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <nav className="d-flex justify-content-center mt-3 mt-md-4">
          <ul className="pagination pagination-sm">
            <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage(page - 1)}>Previous</button>
            </li>
            {Array.from({ length: totalPages }, (_, i) => (
              <li key={i} className={`page-item ${page === i + 1 ? "active" : ""}`}>
                <button className="page-link" onClick={() => setPage(i + 1)}>{i + 1}</button>
              </li>
            ))}
            <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
              <button className="page-link" onClick={() => setPage(page + 1)}>Next</button>
            </li>
          </ul>
        </nav>
      )}

      {/* Error Modal */}
      <div className={`modal ${showErrorModal ? "d-block" : ""}`} tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-danger text-white">
              <h5 className="modal-title">Error</h5>
              <button type="button" className="btn-close" onClick={() => setShowErrorModal(false)}></button>
            </div>
            <div className="modal-body">
              <p>{errorMessage}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowErrorModal(false)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingsDashboard;