import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import logoImage from "../image.png";
import backGroundImage from "../team.png";
import WebFont from "webfontloader";
import BookingComponent from "./BookingComponent";
import { useMsal } from "@azure/msal-react";
import { getApiAccessToken } from "../msalConfig";


const CalendarIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM5 20V9h14v11zM8 7h8v2H8z" />
  </svg>
);

const TrendingUpIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.3L22 12V6h-6z" />
  </svg>
);

const UsersIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M16.5 16.5c-2.47 0-4.5 2.03-4.5 4.5s2.03 4.5 4.5 4.5 4.5-2.03 4.5-4.5-2.03-4.5-4.5-4.5zm-4.5-5.5a4.5 4.5 0 01-9 0c0-2.47 2.03-4.5 4.5-4.5s4.5 2.03 4.5 4.5zm0-10a4.5 4.5 0 014.5-4.5h-9a4.5 4.5 0 014.5 4.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
  </svg>
);

const ClockIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.13.8-.71-4.4-2.61V7h-.1z" />
  </svg>
);

/** ─────────────────────────────
 * Config / constants
 * ────────────────────────────*/
const PAGE_SIZE = 10;
const API_BASE_URL =
  process.env.REACT_APP_API_URL || "https://teamsbackendapi-production.up.railway.app";

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
 * Helpers
 * ────────────────────────────*/
const DatePickerComponent = ({ selectedDate, setSelectedDate, label }) => {
  const [errorMessage, setErrorMessage] = useState("");
  const formattedDate = selectedDate.toISOString().split("T")[0];

  const handleDateChange = (e) => {
    const inputValue = e.target.value;
    const newDate = new Date(inputValue);

    if (isNaN(newDate.getTime())) {
      setErrorMessage("Please enter a valid date.");
      return;
    }

    const [year, month, day] = inputValue.split("-");
    if (
      newDate.getFullYear() !== Number(year) ||
      newDate.getMonth() + 1 !== Number(month) ||
      newDate.getDate() !== Number(day)
    ) {
      setErrorMessage("Invalid date. This month doesn’t have that many days.");
      return;
    }

    setErrorMessage("");
    setSelectedDate(newDate);
  };

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center gap-2">
        {label && <label className="d-none d-md-block">{label}:</label>}
        <input
          type="date"
          value={formattedDate}
          onChange={handleDateChange}
          className={`form-control ${errorMessage ? "is-invalid" : ""}`}
          style={{ minWidth: "140px" }}
        />
      </div>
      {errorMessage && <div className="invalid-feedback d-block">{errorMessage}</div>}
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
    style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", backgroundColor: "#ff0000" }}
  />
);

const calculateStats = (meetings, floors = 4, hoursPerFloor = 8) => {
  const now = new Date();
  let activeCount = 0;
  let totalAttendees = 0;
  let totalDuration = 0; // minutes
  let totalUsedMinutes = 0;

  for (const m of meetings) {
    const start = new Date(m.startTime);
    const end = new Date(m.endTime);
    if (now >= start && now <= end) activeCount++;
    totalAttendees += getAttendeesCount(m);
    const duration = (end - start) / (1000 * 60);
    totalDuration += duration;
    totalUsedMinutes += duration;
  }

  const avgDuration = meetings.length > 0 ? Math.round(totalDuration / meetings.length) : 0;
  const totalPossibleMinutes = floors * hoursPerFloor * 60;
  const roomUtilization =
    totalPossibleMinutes > 0 ? Math.min(100, Math.round((totalUsedMinutes / totalPossibleMinutes) * 100)) : 0;

  return { activeMeetings: activeCount, totalAttendees, avgDuration, roomUtilization };
};

const LoadingIndicator = () => (
  <div className="d-flex justify-content-center align-items-center p-3">
    <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
    <span>Loading meetings...</span>
  </div>
);

// Particles
const ParticlesBackground = () => {
  useEffect(() => {
    WebFont.load({ google: { families: ["stylus bt", "Montserrat:600"] } });

    const particlesScript = document.createElement("script");
    particlesScript.src = "https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js";
    particlesScript.async = true;

    const statsScript = document.createElement("script");
    statsScript.src = "https://threejs.org/examples/js/libs/stats.min.js";
    statsScript.async = true;

    document.head.appendChild(particlesScript);
    document.head.appendChild(statsScript);

    particlesScript.onload = () => {
      if (window.particlesJS) {
        window.particlesJS("particles-js", {
          particles: {
            number: { value: 75, density: { enable: true, value_area: 800 } },
            color: { value: "#1b1616" },
            shape: { type: "circle", stroke: { width: 0, color: "#000000" }, polygon: { nb_sides: 5 } },
            opacity: { value: 0.3768, random: true, anim: { enable: true, speed: 2.27, opacity_min: 0.45, sync: false } },
            size: { value: 2.5, random: false, anim: { enable: true, speed: 17.05, size_min: 11.36, sync: true } },
            line_linked: { enable: true, distance: 160, color: "#070606", opacity: 0.4, width: 1 },
            move: { enable: true, speed: 2.5, direction: "none", random: false, straight: false, out_mode: "out", bounce: false },
          },
          interactivity: {
            detect_on: "canvas",
            events: { onhover: { enable: true, mode: "repulse" }, onclick: { enable: true, mode: "push" }, resize: true },
            modes: {
              grab: { distance: 400, line_linked: { opacity: 1 } },
              bubble: { distance: 400, size: 40, duration: 2, opacity: 8, speed: 3 },
              repulse: { distance: 200, duration: 0.4 },
              push: { particles_nb: 4 },
              remove: { particles_nb: 2 },
            },
          },
          retina_detect: true,
        });
      }
    };

    return () => { };
  }, []);

  return (
    <div
      id="particles-js"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        backgroundImage: `url(${backGroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
};

/** ─────────────────────────────
 * Main component
 * ────────────────────────────*/
const MeetingsDashboard = () => {
  const [date, setDate] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState({ activeMeetings: 0, totalAttendees: 0, avgDuration: 0, roomUtilization: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Auth gate (wire to your SSO/MSAL/etc)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const handleSignIn = async () => {
    // TODO: replace with your real auth; e.g., MSAL loginRedirect/loginPopup, then set true when token present.
    setIsAuthenticated(true);
  };

  // Delete flow state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1: pick, 2: confirm
  const [selectedMeetingKey, setSelectedMeetingKey] = useState(null);
  const [deleteSearch, setDeleteSearch] = useState("");

  const getKey = (m) => m.id ?? `${m.organizer || ""}|${m.subject || ""}|${m.startTime || ""}`;

  const handleScheduleMeeting = () => setShowBookingModal(true);

  const onDelete = () => {
    if (!isAuthenticated) {
      setErrorMessage("Please sign in to delete meetings.");
      setShowErrorModal(true);
      return;
    }
    if (!meetings || meetings.length === 0) {
      setErrorMessage("No meetings found for the selected date.");
      setShowErrorModal(true);
      return;
    }
    setDeleteStep(1);
    setSelectedMeetingKey(null);
    setDeleteSearch("");
    setShowDeleteModal(true);
  };

  const { instance, accounts } = useMsal();

const deleteSingleMeeting = async (meeting) => {
  try {
    const status = getMeetingStatus(meeting.startTime, meeting.endTime);
    if (status !== "upcoming") {
      setErrorMessage("Only upcoming meetings can be deleted.");
      setShowErrorModal(true);
      return;
    }

    const eventId = meeting.eventId || meeting.EventId;
    const calendarEmail = meeting.calendarEmail || meeting.CalendarEmail;

    const apiToken = accounts.length
      ? await getApiAccessToken(instance, accounts[0])
      : null;

    if (eventId && calendarEmail) {
      await api.delete(`/api/Meetings/${encodeURIComponent(eventId)}`, {
        params: { calendarEmail },
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      });
    } else {
      await api.post(
        "/api/Meetings/delete",
        {
          subject: meeting.subject,
          organizer: meeting.organizer,
          startTime: meeting.startTime,
          calendarEmail: calendarEmail || meeting.calendarEmail,
        },
        { headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {} }
      );
    }

    await fetchMeetings(false);
    setShowDeleteModal(false);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401) {
      setErrorMessage("Please sign in to delete meetings.");
    } else if (status === 403) {
      setErrorMessage(err?.response?.data?.message || "You are not allowed to delete this meeting.");
    } else if (status === 404) {
      setErrorMessage("Event not found. It may have already been deleted.");
    } else {
      setErrorMessage(err?.response?.data?.message || "Failed to delete the meeting. Please try again.");
    }
    setShowErrorModal(true);
  }
};

  const handleSaveMeeting = async () => {
    try {
      await fetchMeetings(false);
      setShowBookingModal(false);
    } catch (error) {
      console.error("Error handling saved meeting:", error);
    }
  };

  const handleCloseBookingModal = () => setShowBookingModal(false);

  // Fetch meetings
  const fetchMeetings = useCallback(
    async (isManual = false) => {
      if (isManual) setIsManualRefresh(true);
      setLoading(true);
      try {
        const formattedDate = date.toISOString().slice(0, 10);
        const userEmails = [
          "ffmeeting@conservesolution.com",
          "gfmeeting@conservesolution.com",
          "sfmeeting@conservesolution.com",
          "contconference@conservesolution.com",
        ];

        const res = await api.get("/api/Meetings", { params: { userEmails, date: formattedDate } });
        const meetingsData = res.data?.meetings || [];

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

  useEffect(() => {
    const interval = setInterval(() => fetchMeetings(false), 30000);
    return () => clearInterval(interval);
  }, [fetchMeetings]);

  // Sorted & grouped
  const sortedMeetings = useMemo(() => {
    const copy = [...meetings];
    const order = { Live: 3, upcoming: 2, completed: 1 };
    copy.sort((a, b) => {
      const statusA = getMeetingStatus(a.startTime, a.endTime);
      const statusB = getMeetingStatus(b.startTime, b.endTime);
      return order[statusB] - order[statusA];
    });
    return copy;
  }, [meetings]);

  const meetingsByFloor = useMemo(() => {
    return floorHeaders.reduce((acc, floor) => {
      acc[floor] = sortedMeetings.filter((m) =>
        m.location?.toLowerCase().includes(floor.toLowerCase())
      );
      return acc;
    }, {});
  }, [sortedMeetings]);

  const totalPages = Math.ceil(
    Math.max(...floorHeaders.map((f) => meetingsByFloor[f]?.length || 0)) / PAGE_SIZE
  );

  const pagedMeetings = useMemo(() => {
    return floorHeaders.reduce((acc, floor) => {
      const all = meetingsByFloor[floor] || [];
      acc[floor] = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      return acc;
    }, {});
  }, [meetingsByFloor, page]);

  // Delete: upcoming-only list + search
  const upcomingMeetings = useMemo(
    () => sortedMeetings.filter((m) => getMeetingStatus(m.startTime, m.endTime) === "upcoming"),
    [sortedMeetings]
  );

  const filteredUpcoming = useMemo(() => {
    const q = deleteSearch.trim().toLowerCase();
    if (!q) return upcomingMeetings;
    return upcomingMeetings.filter((m) => {
      const hay =
        `${m.subject || ""} ${m.organizer || ""} ${m.location || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [upcomingMeetings, deleteSearch]);

  const selectedMeeting = useMemo(
    () => filteredUpcoming.find((m) => getKey(m) === selectedMeetingKey) || null,
    [filteredUpcoming, selectedMeetingKey]
  );

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
        crossOrigin="anonymous"
      />

      <ParticlesBackground />

      <style>
        {`
          body{ margin:0; font:normal 75% Arial, Helvetica, sans-serif; }
          canvas{ display:block; vertical-align:bottom; }
          #particles-js{ position: fixed; width: 100%; height: 100%; background-color: #ffffffff; background-repeat: no-repeat; background-size: cover; background-position: 50% 50%; }
          @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
          .blinking-dot { animation: blink 1.5s infinite; }
          .dashboard-container { display:flex; gap:20px; justify-content:center; padding:20px; font-family: 'Inter', sans-serif; flex-wrap: wrap; }
          .dashboard-card { flex:1; min-width:200px; max-width:1090px; padding:20px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.1); display:flex; flex-direction:column; justify-content:space-between; }
          .card-header-main { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; font-size:14px; color:#555; font-weight:bold; }
          .card-icon { width:24px; height:24px; color:#555; }
          .utilization-icon { color: orange; }
          .card-body-main .card-value { font-size:32px; font-weight:bold; margin:0; color:#333; }
          .card-body-main .card-subtext { font-size:12px; color:#777; margin:0; }
          .card-meetings-color { background-color:#deeafcff; }
          .card-attendees-color { background-color:#e0f9ee; }
          .card-duration-color { background-color:#f5e6ff; }
          .card-utilization-color { background-color:#fff8e6; }

          .scaling-container { width:100%; }
          html { zoom: 0.75; }
          .header-container { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; width:100%; gap:15px; }
          .header-left { display:flex; align-items:center; gap:15px; flex:1; }
          .header-center { flex:1; text-align:center; min-width:200px; }
          .header-right { display:flex; align-items:center; gap:15px; flex:1; justify-content:flex-end; }
          @media (max-width: 992px) {
            .header-container { flex-direction:column; align-items:stretch; }
            .header-left, .header-center, .header-right { justify-content:center; text-align:center; }
            .header-right { flex-direction:column; }
          }
          .btn-custom { background-color:#0074bdff; border:none; color:white; font-size:16px; padding:0.8rem 1rem; border-radius:6px; cursor:pointer; }
          .btn-custom:disabled { opacity:0.6; cursor:not-allowed; }
          .schedule-section { position:relative; display:inline-block; }
          .schedule-section .dropdown-menu {
            display:none; position:absolute; top:100%; left:0; background:#fff; min-width:220px;
            box-shadow:0 8px 24px rgba(0,0,0,0.15); border-radius:10px; z-index:1000; overflow:hidden; padding:6px;
          }
          .schedule-section:hover .dropdown-menu { display:block; }
          .dropdown-item-plain {
            display:flex; align-items:center; gap:8px; width:100%; text-align:left; padding:10px 12px; border:none; background:transparent; cursor:pointer; font-family:calibri; font-size:15px; border-radius:8px;
          }
          .dropdown-item-plain:hover { background-color:#f3f4f6; }
          .dropdown-item-muted { color:#6b7280; }
          .chip {
            display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; background:#eef2ff; color:#3730a3; font-weight:600;
          }
          /* Delete modal advanced styles */
          .del-list { max-height: 360px; overflow:auto; border:1px solid #e5e7eb; border-radius:10px; padding:6px; background:#fafafa; }
          .del-card {
            display:flex; align-items: center; gap:12px; padding:10px 12px; border-radius:10px; background:white; border:1px solid #e5e7eb;
          }
          .del-card + .del-card { margin-top:8px; }
          .del-card:hover { border-color:#c7d2fe; box-shadow:0 4px 12px rgba(59,130,246,0.08); }
          .del-title { font-weight:700; margin:0; color:#111827; font-size:14px; }
          .del-sub { margin:0; color:#6b7280; font-size:12px; }
          .search-input {
            border:1px solid #e5e7eb; border-radius:10px; padding:20px 12px; width:100%;font-size: large
          }
          .modal-actions { display:flex; justify-content:flex-end; gap:10px; }
        `}
      </style>

      <div className="scaling-container">
        <div className="container-fluid px-2 px-md-3 px-lg-4 px-xl-5 my-3 my-md-4" style={{ position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div className="card h-100 shadow-sm p-2 p-md-3 mb-3 mb-md-4" style={{ borderRadius: 15, backgroundColor: "rgba(233, 230, 230, 0.5)" }}>
            <div className="header-container">
              {/* Left */}
              <div className="header-left">
                <img src={logoImage} alt="R&D Conserve Logo" className="rounded shadow-sm" style={{ width: 60, height: 65 }} />
                <h2
                  className="fs-3 fs-md-2 mb-0 fw-bold"
                  style={{ background: "linear-gradient(90deg, #0074BD, #76B042)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                >
                  Meetly Dashboard
                </h2>
              </div>

              {/* Center */}
              <div className="header-center">
                <h2
                  className="fs-4 fs-md-3 mb-0 fw-bolder"
                  style={{
                    background: "linear-gradient(90deg, #20498a, #20498a)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontFamily: "stylus bt",
                    margin: 0,
                  }}
                >
                  WE ADD VALUE TO YOUR VISION...
                </h2>
              </div>

              {/* Right */}
              <div className="header-right">
                <div className="d-flex align-items-center gap-2">
                  <DatePickerComponent selectedDate={date} setSelectedDate={setDate} />
                  <button className="btn-custom" onClick={() => fetchMeetings(true)} disabled={loading}>
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

                <div className="schedule-section">
                  <button
                    className="btn-custom"
                    style={{
                      fontFamily: "calibri",
                      fontSize: 16,
                      color: "#fff",
                      backgroundImage: "linear-gradient(to right, #0074bd, #78b042)",
                      padding: "revert-layer",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Manage Meetings ▾
                  </button>

                  <div className="dropdown-menu" role="menu" aria-label="Manage Meetings menu">
                    <button className="dropdown-item-plain" style={{ color: "#78b042" }} onClick={handleScheduleMeeting} role="menuitem">
                      ➕ Schedule New Meeting
                    </button>

                    {isAuthenticated ? (
                      <button className="dropdown-item-plain" style={{ color: "#b91c1c" }} onClick={onDelete} role="menuitem">
                        🗑️ Delete Meetings <span className="chip ms-2">Upcoming only</span>
                      </button>
                    ) : (
                      <button className="dropdown-item-plain dropdown-item-muted" onClick={handleSignIn} role="menuitem" title="Sign in required">
                        🔒 Sign in to delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="mb-3">
            <h4 className="text-muted fw-bold" style={{ fontFamily: "calibri", paddingLeft: 10, fontSize: 32, color: "#333" }}>
              {date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </h4>
          </div>

          {/* Manual loading indicator */}
          {loading && isManualRefresh && <LoadingIndicator />}

          {/* Summary cards */}
          <div className="card mb-4" style={{ borderRadius: 20, backgroundColor: "rgba(233, 230, 230, 0.5)" }}>
            <div className="card-body">
              <div className="dashboard-container">
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
                  <div className="card h-100 shadow-sm" style={{ borderRadius: 16, background: "rgba(225, 225, 225, 0.8)" }}>
                    <div
                      className="card-header text-white text-center fw-bold py-2 py-md-3"
                      style={{
                        background: "linear-gradient(90deg, #65799b, #5e2563 60%)",
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        fontSize: "clamp(0.9rem, 1.5vw, 1.1rem)",
                      }}
                    >
                      {floor}
                    </div>
                    <div className="card-body p-2 p-md-3" style={{ minHeight: 280 }}>
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
                                  borderLeft: `4px solid ${status === "completed" ? "#95a5a6" : status === "Live" ? "#06d373ff" : "#3498db"
                                    }`,
                                  minHeight: 80,
                                  fontWeight: 700,
                                  opacity: status === "completed" ? 0.8 : 1,
                                }}
                              >
                                <div
                                  style={{ fontSize: "clamp(0.85rem, 1.8vw, 1rem)", color: "#2c3e50" }}
                                  className="text-truncate"
                                  title={meeting.subject}
                                >
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
                                      getMeetingStatus(meeting.startTime, meeting.endTime) === "completed"
                                        ? "#7f8c8d"
                                        : getMeetingStatus(meeting.startTime, meeting.endTime) === "upcoming"
                                          ? "rgba(25, 0, 255, 1)"
                                          : "#ff0000ff",
                                    fontWeight: "bold",
                                    textAlign: "right",
                                    textTransform: "uppercase",
                                    marginTop: 4,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  {getMeetingStatus(meeting.startTime, meeting.endTime) === "Live" && <LiveIndicator />}{" "}
                                  {getMeetingStatus(meeting.startTime, meeting.endTime)}
                                </div>
                              </motion.div>
                            );
                          })
                        ) : (
                          <div
                            className="text-center text-muted fw-semibold p-3"
                            style={{
                              borderRadius: 12,
                              minHeight: 80,
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

          {/* Branding */}
          <div
            style={{
              position: "fixed",
              bottom: "1rem",
              right: "1rem",
              opacity: 0.9,
              fontSize: "0.85rem",
              color: "#ffffff",
              zIndex: 100,
            }}
          >
            Powered by R&D Conserve
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && <BookingComponent onClose={handleCloseBookingModal} onSave={handleSaveMeeting} />}

      {/* Delete Flow Modal (advanced UI, upcoming-only) */}
      {showDeleteModal && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
            width: "Auto",
            height: "Auto"
          }}
        >
          <div className="modal-content" style={{ background: "rgba(233, 230, 230, 0.8)", padding: 20, borderRadius: 19, width: 540, maxWidth: "94vw" }}>
            {deleteStep === 1 && (
              <>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h4 className="mb-0">Delete a Meeting</h4>
                  <span className="chip">Upcoming only</span>
                </div>
                <p className="text-muted mb-3" style={{ fontSize: "large" }}>
                  Showing meetings for <b>{date.toISOString().slice(0, 10)}</b>.{" "}
                  <strong>
                    Completed or live meetings{" "}
                    <span style={{ color: "#b91c1c" }}>cannot be deleted</span>
                  </strong>.
                </p>


                <input
                  className="search-input mb-3"
                  placeholder="Search by subject, organizer, or room..."
                  value={deleteSearch}
                  onChange={(e) => setDeleteSearch(e.target.value)}
                />

                {filteredUpcoming.length === 0 ? (
                  <div className="text-center text-muted py-4" style={{ border: "1px dashed #e5e7eb", borderRadius: 10 }}>
                    No upcoming meetings found.
                  </div>
                ) : (
                  <div className="del-list" style={{ background: "rgba(233, 230, 230, 0.8)" }}>
                    {filteredUpcoming.map((m) => {
                      const key = getKey(m);
                      return (
                        <label key={key} className="del-card" style={{ background: "rgba(233, 230, 230, 0.8)" }}>
                          <input
                            type="radio"
                            name="deleteMeeting"
                            className="form-check-input"
                            style={{ fontSize: "17px" }}
                            checked={selectedMeetingKey === key}
                            onChange={() => setSelectedMeetingKey(key)}
                          />
                          <div style={{ flex: 1 }}>
                            <p className="del-title mb-1 text-truncate">{m.subject || "Untitled meeting"}</p>
                            <p className="del-sub mb-1" style={{ fontSize: "13.5px" }}>
                              <b>Organizer:</b> {m.organizer || "Unknown"} &nbsp; • &nbsp; <b>Room:</b>{" "}
                              {m.location || "Unassigned"}
                            </p>
                            <p className="del-sub mb-0" style={{ fontSize: "13.5px" }}>
                              <b>Time:</b> {formatTimeOnly(m.startTime)} – {formatTimeOnly(m.endTime)}
                            </p>
                          </div>
                          <span className="chip">Upcoming</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="modal-actions mt-3">
                  <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => setDeleteStep(2)}
                    disabled={!selectedMeetingKey}
                  >
                    Next
                  </button>
                </div>
              </>
            )}

            {deleteStep === 2 && selectedMeeting && (
              <>
                <h4 className="mb-3">Confirm deletion</h4>
                <div className="p-3 rounded" style={{ border: "1px solid #e5e7eb", background: "transparent",fontSize:"large" }}>
                  <div className="mb-1">
                    <b>Subject:</b> {selectedMeeting.subject || "Untitled"}
                  </div>
                  <div className="mb-1">
                    <b>Organizer:</b> {selectedMeeting.organizer || "Unknown"}
                  </div>
                  <div className="mb-1">
                    <b>Time:</b> <strong>{formatTimeOnly(selectedMeeting.startTime)} – {formatTimeOnly(selectedMeeting.endTime)}</strong>
                  </div>
                  <div className="mb-0">
                    <b>Location:</b> {selectedMeeting.location || "No room"}
                  </div>
                </div>

                <div className="modal-actions mt-3">
                  <button className="btn btn-outline-secondary" onClick={() => setDeleteStep(1)}>
                    Back
                  </button>
                  <button className="btn btn-danger" onClick={() => deleteSingleMeeting(selectedMeeting)}>
                    Yes, delete
                  </button>
                </div>
              </>
            )}

            {deleteStep === 2 && !selectedMeeting && (
              <>
                <p className="text-muted">Selection lost—please pick a meeting again.</p>
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={() => setDeleteStep(1)}>
                    Go back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MeetingsDashboard;
