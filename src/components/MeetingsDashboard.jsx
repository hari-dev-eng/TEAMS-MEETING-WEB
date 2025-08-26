import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import logoImage from "../image.png";

// These are custom icon components created from SVG to replace react-icons
const CalendarIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM5 20V9h14v11zM8 7h8v2H8z" />
  </svg>
);

const TrendingUpIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.3L22 12V6h-6z" />
  </svg>
);

const UsersIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M16.5 16.5c-2.47 0-4.5 2.03-4.5 4.5s2.03 4.5 4.5 4.5 4.5-2.03 4.5-4.5-2.03-4.5-4.5-4.5zm-4.5-5.5a4.5 4.5 0 01-9 0c0-2.47 2.03-4.5 4.5-4.5s4.5 2.03 4.5 4.5zm0-10a4.5 4.5 0 014.5-4.5h-9a4.5 4.5 0 014.5 4.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
  </svg>
);

const ClockIcon = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.13.8-.71-4.4-2.61V7h-.1z" />
  </svg>
);

/** ─────────────────────────────
 * Config / constants
 * ────────────────────────────*/
const PAGE_SIZE = 10;

// API URL - hardcoded for browser compatibility
const API_BASE_URL = "https://teamsbackendapi-production.up.railway.app";

// Ensure arrays serialize as repeated keys: userEmails=a&userEmails=b (ASP.NET-friendly)
const api = axios.create({
  baseURL: API_BASE_URL,
  paramsSerializer: (params) => {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (Array.isArray(val)) {
        val.forEach((v) => usp.append(key, v));
      } else if (val !== undefined && val !== null) {
        usp.append(key, val);
      }
    });
    return usp.toString();
  },
});

const floorHeaders = ["Ground Floor", "1st Floor", "Conference Room", "3rd Floor"];

const statusGradients = {
  upcoming: "linear-gradient(105deg, #56baecbb 30%, #c5e5f5cc 100%)",
  Live: "linear-gradient(105deg, #4cd964bb 30%, #c5e5f5cc 100%)",
  completed: "linear-gradient(105deg, #d1d1d1bb 30%, #e5e5e5cc 100%)",
};

/** ─────────────────────────────
 * Small helpers / components
 * ────────────────────────────*/
const DatePickerComponent = ({ selectedDate, setSelectedDate, label }) => {
  const formattedDate = selectedDate.toISOString().split("T")[0];
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

const getMeetingStatus = (startTime, endTime) => {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (now > end) return "completed";
  if (now >= start && now <= end) return "Live";
  return "upcoming";
};

const formatTimeOnly = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getAttendeesCount = (meeting) =>
  meeting.attendeesCount || meeting.attendeeCount || meeting.AttendeeCount || 0;

const LiveIndicator = () => (
  <span
    className="blinking-dot me-1"
    style={{
      display: "inline-block",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      backgroundColor: "#ff0000",
    }}
  />
);

const calculateStats = (meetings) => {
  const now = new Date();

  const activeMeetings = meetings.filter((m) => {
    const start = new Date(m.startTime);
    const end = new Date(m.endTime);
    return now >= start && now <= end;
  });

  const totalAttendees = meetings.reduce((sum, m) => sum + getAttendeesCount(m), 0);

  const avgDuration =
    meetings.length > 0
      ? Math.round(
          meetings.reduce((sum, m) => {
            const start = new Date(m.startTime);
            const end = new Date(m.endTime);
            return sum + (end - start) / (1000 * 60);
          }, 0) / meetings.length
        )
      : 0;

  const totalPossibleMinutes = 8 * 60; // Assuming an 8-hour workday
  const totalUsedMinutes = meetings.reduce((sum, m) => {
    const start = new Date(m.startTime);
    const end = new Date(m.endTime);
    return sum + (end - start) / (1000 * 60);
  }, 0);
  const roomUtilization =
    totalPossibleMinutes > 0
      ? Math.min(100, Math.round((totalUsedMinutes / totalPossibleMinutes) * 100))
      : 0;

  return {
    activeMeetings: activeMeetings.length,
    totalAttendees,
    avgDuration,
    roomUtilization,
  };
};

const LoadingIndicator = () => (
  <div className="d-flex justify-content-center align-items-center p-3">
    <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
    <span>Loading meetings...</span>
  </div>
);

// Particles Component
const ParticlesBackground = () => {
  useEffect(() => {
    // Load particles.js script
    const particlesScript = document.createElement('script');
    particlesScript.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js';
    particlesScript.async = true;
    
    // Load stats.js script
    const statsScript = document.createElement('script');
    statsScript.src = 'https://threejs.org/examples/js/libs/stats.min.js';
    statsScript.async = true;
    
    document.head.appendChild(particlesScript);
    document.head.appendChild(statsScript);
    
    particlesScript.onload = () => {
      // Initialize particles once the script is loaded
      if (window.particlesJS) {
        window.particlesJS("particles-js", {
          "particles": {
            "number": {
              "value": 125,
              "density": {
                "enable": true,
                "value_area": 800
              }
            },
            "color": {         
              "value": "#1b1616"
            },
            "shape": {
              "type": "circle",
              "stroke": {
                "width": 0,
                "color": "#000000"
              },
              "polygon": {
                "nb_sides": 5
              },
              "image": {
                "src": "img/github.svg",
                "width": 100,
                "height": 100
              }
            },
            "opacity": {
              "value": 0.37680183430339786,
              "random": true,
              "anim": {
                "enable": true,
                "speed": 2.273816194443766,
                "opacity_min": 0.45476323888875325,
                "sync": false
              }
            },
            "size": {
              "value": 2.5,
              "random": false,
              "anim": {
                "enable": true,
                "speed": 17.053621458328248,
                "size_min": 11.369080972218832,
                "sync": true
              }
            },
            "line_linked": {
              "enable": true,
              "distance": 160,
              "color": "#070606",
              "opacity": 0.4,
              "width": 1
            },
            "move": {
              "enable": true,
              "speed": 6,
              "direction": "none",
              "random": false,
              "straight": false,
              "out_mode": "out",
              "bounce": false,
              "attract": {
                "enable": false,
                "rotateX": 600,
                "rotateY": 1200
              }
            }
          },
          "interactivity": {
            "detect_on": "canvas",
            "events": {
              "onhover": {
                "enable": true,
                "mode": "repulse"
              },
              "onclick": {
                "enable": true,
                "mode": "push"
              },
              "resize": true
            },
            "modes": {
              "grab": {
                "distance": 400,
                "line_linked": {
                  "opacity": 1
                }
              },
              "bubble": {
                "distance": 400,
                "size": 40,
                "duration": 2,
                "opacity": 8,
                "speed": 3
              },
              "repulse": {
                "distance": 200,
                "duration": 0.4
              },
              "push": {
                "particles_nb": 4
              },
              "remove": {
                "particles_nb": 2
              }
            }
          },
          "retina_detect": true
        });
        
        // Initialize stats
        if (window.Stats) {
          const stats = new window.Stats();
          stats.setMode(0);
          stats.domElement.style.position = 'absolute';
          stats.domElement.style.left = '0px';
          stats.domElement.style.top = '0px';
          document.body.appendChild(stats.domElement);
          
          const countParticles = document.querySelector('.js-count-particles');
          const update = function() {
            stats.begin();
            stats.end();
            if (window.pJSDom && window.pJSDom[0] && window.pJSDom[0].pJS && window.pJSDom[0].pJS.particles && window.pJSDom[0].pJS.particles.array) {
              countParticles.innerText = window.pJSDom[0].pJS.particles.array.length;
            }
            requestAnimationFrame(update);
          };
          requestAnimationFrame(update);
        }
      }
    };
    
    return () => {
      // Clean up if needed
    };
  }, []);
  
  return (
    <>
      <div 
        id="particles-js" 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          backgroundColor: '#f2dfe0'
        }}
      ></div>
    </>
  );
};

/** ─────────────────────────────
 * Main component
 * ────────────────────────────*/
const MeetingsDashboard = () => {
  const [date, setDate] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState({
    activeMeetings: 0,
    totalAttendees: 0,
    avgDuration: 0,
    roomUtilization: 0,
  });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  // Fetch meetings
  const fetchMeetings = useCallback(
    async (isManual = false) => {
      if (isManual) setIsManualRefresh(true);
      setLoading(true);

      try {
        // API expects d-M-yyyy (as per your Swagger example)
        const formattedDate = date.toISOString().slice(0, 10);
        // Start with one email that you know returns data; add others as needed.
        const userEmails = [
          "ffmeeting@conservesolution.com",
          "gfmeeting@conservesolution.com",
          "sfmeeting@conservesolution.com",
          "contconference@conservesolution.com"
        ];

        const res = await api.get("/api/Meetings", {
          params: { userEmails, date: formattedDate },
        });

        const meetingsData = res.data?.meetings || [];
        console.log("Meetings data:", meetingsData);
        if (meetingsData.length > 0) {
          console.log("First meeting properties:", Object.keys(meetingsData[0]));
        }

        setMeetings(meetingsData);
        setStats(calculateStats(meetingsData));
        setPage(1);
        setShowErrorModal(false);
        setErrorMessage("");
      } catch (err) {
        console.error(err);
        setMeetings([]);
        setStats(calculateStats([]));

        const serverMsg =
          err.response?.data?.message ||
          (typeof err.response?.data === "string" ? err.response.data : "") ||
          err.message ||
          "Failed to fetch meetings. Please try again.";

        setErrorMessage(serverMsg);
        setShowErrorModal(true);
      } finally {
        setLoading(false);
        if (isManual) setTimeout(() => setIsManualRefresh(false), 500);
      }
    },
    [date]
  );

  useEffect(() => {
    fetchMeetings(false);
  }, [fetchMeetings]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => fetchMeetings(false), 30000);
    return () => clearInterval(interval);
  }, [fetchMeetings]);

  // Sort meetings: Live, then Upcoming, then Completed
  const sortedMeetings = meetings.sort((a, b) => {
    const statusA = getMeetingStatus(a.startTime, a.endTime);
    const statusB = getMeetingStatus(b.startTime, b.endTime);

    const statusOrder = { 'Live': 3, 'upcoming': 2, 'completed': 1 };

    return statusOrder[statusB] - statusOrder[statusA];
  });


  const meetingsByFloor = floorHeaders.reduce((acc, floor) => {
    acc[floor] = sortedMeetings.filter((m) => m.location?.toLowerCase().includes(floor.toLowerCase()));
    return acc;
  }, {});

  const totalPages = Math.ceil(
    Math.max(...floorHeaders.map((f) => meetingsByFloor[f]?.length || 0)) / PAGE_SIZE
  );

  const pagedMeetings = floorHeaders.reduce((acc, floor) => {
    const all = meetingsByFloor[floor] || [];
    acc[floor] = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return acc;
  }, {});

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
        xintegrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN"
        crossorigin="anonymous"
      />
      
      <ParticlesBackground />
      
      {/* Add particles.js styles */}
      <style>
        {`
          /* ---- reset ---- */ 
          body{ 
            margin:0; 
            font:normal 75% Arial, Helvetica, sans-serif; 
          } 
            .particles-js-canvas-el {
          /*background: linear-gradient(135deg, #fff8e6, #ffd1dc, #c8e7ff, #e6ffe6) !important;*/
            background: linear-gradient(135deg, #ecebebff) !important;
          }
          canvas{ 
            display: block; 
            vertical-align: bottom; 
          } 
          /* ---- particles.js container ---- */ 
          #particles-js{ 
            position: fixed;
            width: 100%; 
            height: 100%; 
            background-color: #ffffffff; 
            background-image: url(""); 
            background-repeat: no-repeat; 
            background-size: cover; 
            background-position: 50% 50%; 
          } 
          /* ---- stats.js ---- */ 
          .count-particles{ 
            background: #000022; 
            position: absolute; 
            top: 48px; 
            left: 0; 
            width: 80px; 
            color: #13E8E9; 
            font-size: .8em; 
            text-align: left; 
            text-indent: 4px; 
            line-height: 14px; 
            padding-bottom: 2px; 
            font-family: Helvetica, Arial, sans-serif; 
            font-weight: bold; 
          } 
          .js-count-particles{ 
            font-size: 1.1em; 
          } 
          #stats, .count-particles{ 
            -webkit-user-select: none; 
            margin-top: 5px; 
            margin-left: 5px; 
          } 
          #stats{ 
            border-radius: 3px 3px 0 0; 
            overflow: hidden; 
          } 
          .count-particles{ 
            border-radius: 0 0 3px 3px; 
          }
          
          @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
          }
            
          .blinking-dot { animation: blink 1.5s infinite; }

          /* Custom card styles from image */
          .dashboard-container {
            display: flex;
            gap: 20px;
            width: '800px';
            justify-content: center;
            padding: 20px;
            font-family: 'Inter', sans-serif;
            flex-wrap: wrap; 
          }
          
          .dashboard-card {
            flex: 1;
            min-width: 200px;
            max-width: 1090px;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          
          .card-header-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            font-size: 14px;
            color: #555;
            font-weight: bold;
          }
          
          .card-icon {
            width: 24px;
            height: 24px;
            color: #555;
          }
          
          .utilization-icon {
            color: orange;
          }
          
          .card-body-main .card-value {
            font-size: 32px;
            font-weight: bold;
            margin: 0;
            color: #333;
          }
           
          
          .card-body-main .card-subtext {
            font-size: 12px;
            color: #777;
            margin: 0;
          }
          
          /* Specific card color themes */
          .card-meetings-color {
            background-color: #deeafcff;
          }
          .card-attendees-color {
            background-color: #e0f9ee;
          }
          .card-duration-color {
            background-color: #f5e6ff;
          }
          .card-utilization-color {
            background-color: #fff8e6;
          }
        `}
      </style>

      <div className="container-fluid px-2 px-md-3 px-lg-4 px-xl-5 my-3 my-md-4" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div
          className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 gap-md-0 mb-3 mb-md-4 p-2 p-md-3"
          style={{ background: "linear-gradient(135deg, #fcecc1ff, #f28da4ff, #84a8c4ff, #a0f7a0ff)", color: "#fff", borderRadius: "12px" }}
        >
          <div className="d-flex align-items-center gap-2">
            <img src={logoImage} alt="R&D Conserve Logo" className="rounded shadow-sm" style={{ width: '60px', height: '65px' }} />
            <h2
                className="fs-3 fs-md-2 mb-2 mb-md-0 fw-bold"
                style={{
                    background: "linear-gradient(90deg, #0074BD, #76B042)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                }}
            >
                Meetly Dashboard
            </h2>
          </div>

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
        
        {/* Display Date from Image */}
        <div className="mb-3">
          <h4 className="text-muted fw-bold" style={{ fontFamily:"Verdana, Geneva, sans-serif", fontSize: "1.2rem", color: "#000" }}>
            {date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h4>
        </div>

        {/* Manual loading indicator only */}
        {loading && isManualRefresh && <LoadingIndicator />}

        {/* Summary cards (Updated section) */}
        <div className="card mb-4" style={{ borderRadius: "20px", backgroundColor: "rgba(233, 230, 230, 0.8)" }}>
          <div className="card-body">
            <div className="dashboard-container">
              {/* Today's Meetings Card */}
              <div className="dashboard-card card-meetings-color">
                <div className="card-header-main">
                  <p>Today's Meetings</p>
                  <CalendarIcon className="card-icon" />
                </div>
                <div className="card-body-main">
                  <p className="card-value">{meetings.length}</p>
                  <p className="card-subtext">{stats.activeMeetings} currently active</p>
                </div>
              </div>

              {/* Total Attendees Card */}
              <div className="dashboard-card card-attendees-color">
                <div className="card-header-main">
                  <p>Total Attendees</p>
                  <UsersIcon className="card-icon" />
                </div>
                <div className="card-body-main">
                  <p className="card-value">{stats.totalAttendees}</p>
                  <p className="card-subtext">Across all meetings</p>
                </div>
              </div>

              {/* Avg Duration Card */}
              <div className="dashboard-card card-duration-color">
                <div className="card-header-main">
                  <p>Avg Duration</p>
                  <ClockIcon className="card-icon" />
                </div>
                <div className="card-body-main">
                  <p className="card-value">{stats.avgDuration}m</p>
                  <p className="card-subtext">Per meeting</p>
                </div>
              </div>

              {/* Room Utilization Card */}
              <div className="dashboard-card card-utilization-color">
                <div className="card-header-main">
                  <p>Room Utilization</p>
                  <TrendingUpIcon className="card-icon utilization-icon" />
                </div>
                <div className="card-body-main">
                  <p className="card-value">{stats.roomUtilization}%</p>
                  <p className="card-subtext">Today's usage</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        {!loading || !isManualRefresh ? (
          <div className="row g-2 g-md-3 g-lg-4">
            {floorHeaders.map((floor, colIdx) => (
              <div key={colIdx} className="col-12 col-sm-6 col-xl-3">
                <div className="card h-100 shadow-sm" style={{ borderRadius: "16px", background: "rgba(225, 225, 225, 0.8)" }}>
                  <div
                    className="card-header text-white text-center fw-bold py-2 py-md-3"
                    style={{
                      background: "linear-gradient(90deg,#65799b,#5e2563 60%)",
                      borderTopLeftRadius: "16px",
                      borderTopRightRadius: "16px",
                      fontSize: "clamp(0.9rem, 1.5vw, 1.1rem)",
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
                                key={meeting.id || `${meeting.subject}-${idx}`}
                                initial={{ opacity: 0, y: 60 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 60 }}
                                transition={{ duration: 0.6, ease: "easeOut", delay: idx * 0.1 }}
                                className="p-2 p-md-3 mb-2 mb-md-3 rounded shadow-sm"
                                style={{
                                  background: statusGradients[status],
                                  borderLeft: `4px solid ${
                                    status === "completed" ? "#95a5a6" : status === "Live" ? "#06d373ff" : "#3498db"
                                  }`,
                                  minHeight: "80px",
                                  fontWeight: 700,
                                  opacity: status === "completed" ? 0.8 : 1,
                                }}
                            >
                              <div
                                style={{ fontSize: "clamp(0.85rem, 1.8vw, 1rem)", color: "#2c3e50" }}
                                className="text-truncate"
                                title={meeting.subject}
                              >
                                {status === "Live" && <LiveIndicator />}
                                {meeting.subject}
                              </div>

                              <div className="d-flex justify-content-between align-items-center mt-1">
                                <div
                                  style={{ fontSize: "clamp(0.7rem, 1.6vw, 0.85rem)", color: "#444" }}
                                  className="text-truncate"
                                  title={meeting.organizer}
                                >
                                  👤 {meeting.organizer}
                                </div>
                                <div style={{ fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)", color: "#555" }}>
                                  🙎🏻‍♂️ {attendeesCount}
                                </div>
                              </div>

                              <div style={{ fontSize: "clamp(0.75rem, 1.7vw, 0.9rem)", color: "#555" }}>
                                {formatTimeOnly(meeting.startTime)} - {formatTimeOnly(meeting.endTime)}
                              </div>

                              <div
                                style={{
                                  fontSize: "clamp(0.65rem, 1.5vw, 0.75rem)",
                                  color:
                                    status === "completed"
                                      ? "#7f8c8d"
                                      : status === "upcoming"
                                      ? "rgba(25, 0, 255, 1)"
                                      : status === "Live"
                                      ? "#ff0000ff"
                                      : "",
                                  fontWeight: "bold",
                                  textAlign: "right",
                                  textTransform: "uppercase",
                                  marginTop: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "flex-end",
                                }}
                              >
                                {status}
                              </div>
                            </motion.div>
                          );
                        })
                      ) : (
                        <div
                          className="text-center text-muted fw-semibold p-3"
                          style={{
                            //background: "rgba(255,255,255,0.8)",
                            borderRadius: "12px",
                            minHeight: "80px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "clamp(0.9rem, 2vw, 1rem)",
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
                <button className="page-link" onClick={() => setPage(page - 1)}>
                  Previous
                </button>
              </li>
              {Array.from({ length: totalPages }, (_, i) => (
                <li key={i} className={`page-item ${page === i + 1 ? "active" : ""}`}>
                  <button className="page-link" onClick={() => setPage(i + 1)}>
                    {i + 1}
                  </button>
                </li>
              ))}
              <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => setPage(page + 1)}>
                  Next
                </button>
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
                <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                  {errorMessage}
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowErrorModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Production Level Branding */}
        <div
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1rem",
            opacity: 0.7,
            fontSize: "0.75rem",
            color: "#6c757d",
            zIndex: 100,
          }}
        >
          Powered by R&D Conserve
        </div>
      </div>
    </>
  );
};

export default MeetingsDashboard;
