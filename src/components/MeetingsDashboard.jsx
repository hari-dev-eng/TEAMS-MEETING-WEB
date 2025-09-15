// MeetingsDashboard.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import logoImage from "../image.png";
import backGroundImage from "../team.png";
import WebFont from "webfontloader";
import BookingComponent from "./BookingComponent";
import { useMsal } from "@azure/msal-react";

/* ========= Icons ========= */
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
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 7h1.5v4.9l3.6 2.26-.8.71L11 12V7z" />
  </svg>
);
const PencilIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
  </svg>
);
const TrashIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);
const PlusIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z" />
  </svg>
);

/* ========= Config / API ========= */
const PAGE_SIZE = 10;
const API_BASE_URL = process.env.REACT_APP_API_URL || "https://teamsbackendapi-production.up.railway.app";
const ORG_DOMAIN = "conservesolution.com";
/* Static super-admins who can edit/delete ANY meeting */
const ADMIN_EMAILS = [
  "hariprasath.c@conservesolution.com",
  "madhanraj@conservesolution.com",
];

const api = axios.create({
  baseURL: API_BASE_URL,
  paramsSerializer: (params) => {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (Array.isArray(val)) val.forEach((v) => usp.append(key, v));
      else if (val !== undefined && val !== null) usp.append(key, val);
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

/** ---- LOCAL DATE HELPERS (fixes UTC shift) ---- */
const formatYMDLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
/** --------------------------------------------- */

const DatePickerComponent = ({ selectedDate, setSelectedDate, label }) => {
  const [localError, setLocalError] = useState("");
  const formattedDate = formatYMDLocal(selectedDate);

  const handleDateChange = (e) => {
    const inputValue = e.target.value;
    const [yStr, mStr, dStr] = inputValue.split("-");
    const y = Number(yStr), m = Number(mStr), d = Number(dStr);
    if (!y || !m || !d) { setLocalError("Please enter a valid date."); return; }
    const newDate = new Date();
    newDate.setFullYear(y, m - 1, d);
    newDate.setHours(0, 0, 0, 0);
    if (newDate.getFullYear() !== y || newDate.getMonth() + 1 !== m || newDate.getDate() !== d) {
      setLocalError("Invalid date. This month doesn't have that many days.");
      return;
    }
    setLocalError("");
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
          className={`form-control ${localError ? "is-invalid" : ""}`}
          style={{ minWidth: "140px" }}
        />
      </div>
      {localError && <div className="invalid-feedback d-block">{localError}</div>}
    </div>
  );
};

const getMeetingStatus = (start, end) => {
  const now = new Date();
  const s = new Date(start), e = new Date(end);
  if (now > e) return "completed";
  if (now >= s && now <= e) return "Live";
  return "upcoming";
};

const formatTimeOnly = (dateStr) =>
  new Date(dateStr).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

const getAttendeesCount = (m) => m.attendeesCount || m.attendeeCount || m.AttendeeCount || 0;

const LiveIndicator = () => (
  <span className="blinking-dot me-1" style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ff0000" }} />
);

/* ===================== MULTI-ROOM HELPERS ===================== */
const getOrganizerId = (m) => (m.organizerEmail || m.organizer || "").toLowerCase().trim();
const multiKeyFor = (m) =>
  m.iCalUId ||
  `${(m.subject || "").trim()}|${new Date(m.startTime).toISOString()}|${new Date(m.endTime).toISOString()}|${getOrganizerId(m)}`;

const annotateMultiRoom = (list = []) => {
  const provided = list.some((m) => Array.isArray(m.multiRooms));
  if (provided) {
    return list.map((m) => ({
      ...m,
      multiRoom: Array.isArray(m.multiRooms) && m.multiRooms.length > 1,
      multiRoomCount: Array.isArray(m.multiRooms) ? m.multiRooms.length : 0,
    }));
  }
  const groups = new Map();
  list.forEach((m) => {
    const k = multiKeyFor(m);
    const entry = groups.get(k) || { rooms: new Set(), items: [] };
    entry.rooms.add(m.location || "Unknown");
    entry.items.push(m);
    groups.set(k, entry);
  });
  return list.map((m) => {
    const g = groups.get(multiKeyFor(m));
    const rooms = Array.from(g.rooms).sort();
    return { ...m, multiRoom: rooms.length > 1, multiRoomCount: rooms.length, multiRooms: rooms };
  });
};

const dedupeByGroup = (list = []) => {
  const seen = new Set();
  return list.filter((m) => {
    const k = multiKeyFor(m);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
/* ============================================================= */

const calculateStats = (meetings, floors = 4, hoursPerFloor = 8) => {
  const now = new Date();
  const groupMap = new Map();
  for (const m of meetings) {
    const k = multiKeyFor(m);
    if (!groupMap.has(k)) groupMap.set(k, []);
    groupMap.get(k).push(m);
  }
  const uniques = Array.from(groupMap.values()).map((items) => items[0]);

  let activeUnique = 0, totalAttendeesUnique = 0, totalDurationUnique = 0;
  for (const m of uniques) {
    const s = new Date(m.startTime), e = new Date(m.endTime);
    if (now >= s && now <= e) activeUnique++;
    totalAttendeesUnique += getAttendeesCount(m);
    totalDurationUnique += (e - s) / 60000;
  }
  const avgDuration = uniques.length ? Math.round(totalDurationUnique / uniques.length) : 0;

  let usedMinutesPerRoom = 0;
  for (const m of meetings) {
    const s = new Date(m.startTime), e = new Date(m.endTime);
    usedMinutesPerRoom += (e - s) / 60000;
  }
  const totalPossibleMinutes = floors * hoursPerFloor * 60;
  const roomUtilization = totalPossibleMinutes ? Math.min(100, Math.round((usedMinutesPerRoom / totalPossibleMinutes) * 100)) : 0;

  return { totalMeetings: uniques.length, activeMeetings: activeUnique, totalAttendees: totalAttendeesUnique, avgDuration, roomUtilization };
};

const LoadingIndicator = () => (
  <div className="d-flex justify-content-center align-items-center p-3">
    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"><span className="visually-hidden">Loading...</span></div>
    <span>Loading meetings...</span>
  </div>
);

const PanelOverlaySpinner = ({ show, text = "Refreshing…" }) =>
  show ? (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-start", justifyContent: "center", pointerEvents: "none" }}>
      <div className="mt-2 d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill"
        style={{ background: "rgba(255,255,255,0.88)", border: "1px solid #e5e7eb" }}>
        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        <span style={{ fontSize: 13, color: "#334155" }}>{text}</span>
      </div>
    </div>
  ) : null;

const ensureParticlesOnce = () => {
  WebFont.load({ google: { families: ["stylus bt", "Montserrat:600"] } });
  const scriptId = "particles-js-lib";
  let script = document.getElementById(scriptId);
  if (!script) {
    script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js";
    script.async = true;
    document.head.appendChild(script);
  }
  const tryInit = () => {
    if (window.particlesJS && !window.__particlesInit) {
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
          modes: { grab: { distance: 400, line_linked: { opacity: 1 } }, bubble: { distance: 400, size: 40, duration: 2, opacity: 8, speed: 3 }, repulse: { distance: 200, duration: 0.4 }, push: { particles_nb: 4 }, remove: { particles_nb: 2 } },
        },
        retina_detect: true,
      });
      window.__particlesInit = true;
    }
  };
  if (script && !window.__particlesInit) script.addEventListener("load", tryInit, { once: true });
  tryInit();
};

const ParticlesBackground = () => {
  useEffect(() => {
    ensureParticlesOnce();
    return () => {
      try {
        if (window.pJSDom && window.pJSDom.length) {
          window.pJSDom.forEach((p) => p?.pJS?.fn?.vendors?.destroypJS && p.pJS.fn.vendors.destroypJS());
          window.pJSDom = [];
          window.__particlesInit = false;
        }
      } catch (_) { }
    };
  }, []);
  return (
    <div id="particles-js" style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1,
      backgroundImage: `url(${backGroundImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat"
    }} />
  );
};

const SIDE_PANEL_WIDTH = 520;
const SIDE_PANEL_MIN_WIDTH = 340;
const SIDE_PANEL_MAX_WIDTH = 560;

/* ============ Component ============ */
const MeetingsDashboard = () => {
  const [date, setDate] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState({ totalMeetings: 0, activeMeetings: 0, totalAttendees: 0, avgDuration: 0, roomUtilization: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const [showSidePanel, setShowSidePanel] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState("list");
  const [alertModal, setAlertModal] = useState({ show: false, title: "", message: "" });

  const [deleteStep, setDeleteStep] = useState(1);
  const [selectedMeetingKey, setSelectedMeetingKey] = useState(null);

  const [panelDate, setPanelDate] = useState(new Date());
  const [panelMeetings, setPanelMeetings] = useState([]);
  const [panelLoading, setPanelLoading] = useState(false);

  const [editMeetingKey, setEditMeetingKey] = useState(null);
  const [editSubject, setEditSubject] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const { instance, accounts } = useMsal();
  const signedInEmail = (accounts?.[0]?.username || "").toLowerCase();
  const isAuthenticated = !!(accounts && accounts.length > 0);
  const isAdmin = ADMIN_EMAILS.includes(signedInEmail);

  const getKey = useCallback((m) =>
    m.iCalUId || m.id || `${m.organizer || ""}|${m.subject || ""}|${m.startTime || ""}`
    , []);


  const listAbortRef = useRef(null);
  const panelAbortRef = useRef(null);
  const listInFlightRef = useRef(false);
  const panelInFlightRef = useRef(false);
 const subjectRef = useRef(null);
  const panelPollerRef = useRef(null);
  const panelOpenDelayRef = useRef(null);
  const panelDebounceRef = useRef(null);
  const mainPollerRef = useRef(null);

  const showAlert = (message, title = "Notice") => setAlertModal({ show: true, message, title });

  const handleCloseBookingModal = () => setShowBookingModal(false);
  const handleSaveMeeting = () => {
    setShowBookingModal(false);
    fetchMeetings();
    if (showSidePanel) fetchPanelMeetings();
    showAlert("Meeting created successfully!", "Done");
  };
  const openBookingFromPanel = useCallback(() => {
    setShowSidePanel(false);
    setTimeout(() => setShowBookingModal(true), 260);
  }, []);

  /* -------- FETCHERS ---------- */
  const fetchPanelMeetings = useCallback(async () => {
    if (panelInFlightRef.current) return;
    panelInFlightRef.current = true;

    if (panelAbortRef.current) panelAbortRef.current.abort();
    const ctrl = new AbortController();
    panelAbortRef.current = ctrl;

    setPanelLoading(true);
    try {
      const formattedDate = formatYMDLocal(panelDate);
      const userEmails = [
        "ffmeeting@conservesolution.com",
        "gfmeeting@conservesolution.com",
        "sfmeeting@conservesolution.com",
        "contconference@conservesolution.com",
      ];
      const res = await api.get("/api/Meetings", {
        params: { userEmails, date: formattedDate },
        signal: ctrl.signal,
      });
      const raw = res.data?.meetings || [];
      const annotated = annotateMultiRoom(raw);

      const filtered = annotated.filter(
        (m) => {
          const status = getMeetingStatus(m.startTime, m.endTime);
          return status === "upcoming" || status === "Live";
        }
      );

      setPanelMeetings(dedupeByGroup(filtered));
    } catch (err) {
      if (!axios.isCancel?.(err) && err?.name !== "CanceledError") {
        console.error("[panel] fetch error:", err);
      }
    } finally {
      setPanelLoading(false);
      panelInFlightRef.current = false;
    }
  }, [panelDate]);


  const fetchMeetings = useCallback(async () => {
    if (listInFlightRef.current) return;
    listInFlightRef.current = true;

    if (listAbortRef.current) listAbortRef.current.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;

    setLoading(true);
    try {
      const formattedDate = formatYMDLocal(date);
      const userEmails = [
        "ffmeeting@conservesolution.com",
        "gfmeeting@conservesolution.com",
        "sfmeeting@conservesolution.com",
        "contconference@conservesolution.com",
      ];
      const res = await api.get("/api/Meetings", { params: { userEmails, date: formattedDate }, signal: ctrl.signal });
      const meetingsRaw = res.data?.meetings || [];
      const meetingsData = annotateMultiRoom(meetingsRaw);
      setMeetings(meetingsData);
      setStats(calculateStats(meetingsData));
      setPage(1);
    } catch (err) {
      if (!axios.isCancel?.(err) && err?.name !== "CanceledError") {
        console.error("[grid] fetch error:", err);
        const serverMsg =
          err.response?.data?.message ||
          (typeof err.response?.data === "string" ? err.response.data : "") ||
          err.message ||
          "Failed to fetch meetings. Please try again.";
        showAlert(serverMsg, "Error");
      }
    } finally {
      setLoading(false);
      listInFlightRef.current = false;
    }
  }, [date]);
  /* ---------------------------- */

  /* Filter: in side panel, only show meetings that the user can delete.
     - Admins: see ALL meetings
     - Non-admins: only meetings they ORGANIZE *and* whose status is 'upcoming'  */
  const deletablePanelMeetings = useMemo(() => {
    if (!isAuthenticated) return [];
    if (isAdmin) return panelMeetings;
    const you = signedInEmail;
    return panelMeetings.filter((m) => {
      const organizer = (m.organizerEmail || m.organizer || "").toLowerCase();
      return organizer === you && getMeetingStatus(m.startTime, m.endTime) === "upcoming";
    });
  }, [isAuthenticated, isAdmin, panelMeetings, signedInEmail]);

  /* Delete with admin override */
  const deleteSingleMeeting = useCallback(async (meeting) => {
    const organizerEmail = (meeting.organizerEmail || "").trim().toLowerCase();
    const userEmail = (signedInEmail || "").trim().toLowerCase();
    if (!userEmail) { showAlert("You must be signed in to cancel this meeting.", "Access Denied"); return; }

    const userDomainOk = userEmail.endsWith(`@${ORG_DOMAIN}`);
    if (!userDomainOk && !isAdmin) {
      showAlert(`Please sign in with your @${ORG_DOMAIN} email to manage meetings.`, "Access Denied");
      return;
    }

    const status = getMeetingStatus(meeting.startTime, meeting.endTime);
    if (status !== "upcoming" && !isAdmin) {
      showAlert("Only admins can delete live or completed meetings.", "Blocked");
      return;
    }

    const isOrganizer =
      (meeting.organizer || "").toLowerCase() === userEmail ||
      (meeting.organizerEmail || "").toLowerCase() === userEmail;

    if (!isOrganizer && !isAdmin) {
      showAlert(`Only the organizer or an admin can cancel this meeting.\n\nOrganizer: ${organizerEmail}\nYou: ${userEmail}`, "Access Denied");
      return;
    }

    if (!meeting.iCalUId) { showAlert("Meeting cannot be deleted because iCalUId is missing.", "Error"); return; }
    if (!organizerEmail) { showAlert("Meeting cannot be deleted because organizer email is missing.", "Error"); return; }

    try {
      const token = await instance.acquireTokenSilent({ scopes: ["Calendars.ReadWrite"], account: accounts[0] });
      const url = `${API_BASE_URL}/api/Meetings/by-ical/${encodeURIComponent(meeting.iCalUId)}`;
      await api.delete(url, {
        params: { organizerEmail },
        headers: { Authorization: `Bearer ${token.accessToken}` }
      });

      setPanelMeetings((prev) => prev.filter((m) => getKey(m) !== getKey(meeting)));
      setMeetings((prev) => prev.filter((m) => getKey(m) !== getKey(meeting)));
      fetchMeetings();
      if (showSidePanel) fetchPanelMeetings();
      showAlert("Meeting deleted successfully!", "Success");
    } catch (err) {
      if (!axios.isCancel?.(err) && err?.name !== "CanceledError") {
        console.error("[Delete] Error:", err);
        const msg = err?.response?.data?.message || err?.message || "Failed to delete meeting.";
        showAlert(msg, "Error");
      }
    }
 }, [accounts, instance, signedInEmail, fetchMeetings, fetchPanelMeetings, showSidePanel, getKey, isAdmin]);


  // helper
 const toLocalDateTimeInput = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};


  /* Edit (subject-only quick edit) with admin override */
  const openEdit = useCallback((m) => {
  setEditMeetingKey(m.iCalUId || m.id || `${m.organizer || ""}|${m.subject || ""}|${m.startTime || ""}`);
  setEditSubject(m.subject || "");
  setEditStart(toLocalDateTimeInput(m.startTime));
  setEditEnd(toLocalDateTimeInput(m.endTime));
  setTimeout(() => subjectRef.current?.focus(), 0);
}, []);




  const closeEdit = useCallback(() => {
    setEditMeetingKey(null);
    setEditSubject("");
    setEditStart("");
    setEditEnd("");
  }, []);

  const toGraphDateTime = (val) => {
  if (!val) return "";
  const d = new Date(val);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}:00`;
};


  const saveEdit = useCallback(async () => {
    const meeting = panelMeetings.find((m) => (m.iCalUId || m.id) === editMeetingKey);
    if (!meeting) return;

    const organizerEmail = (meeting.organizerEmail || "").trim().toLowerCase();
    const userEmail = (signedInEmail || "").trim().toLowerCase();

    if (!userEmail) {
      showAlert("You must be signed in to edit this meeting.", "Access Denied");
      return;
    }
    if (!editSubject || editSubject.trim().length < 3) {
      showAlert("Please enter a subject (at least 3 characters).", "Validation");
      return;
    }

    try {
      const token = await instance.acquireTokenSilent({ scopes: ["Calendars.ReadWrite"], account: accounts[0] });
      const url = `${API_BASE_URL}/api/Meetings/by-ical/${encodeURIComponent(meeting.iCalUId)}`;
      await api.patch(url, {
        subject: editSubject,
        StartTime: toGraphDateTime(editStart),
        EndTime: toGraphDateTime(editEnd),
        organizerEmail,
      }, { headers: { Authorization: `Bearer ${token.accessToken}` } });
      closeEdit();
      fetchMeetings();
      if (showSidePanel) fetchPanelMeetings();
      showAlert("Meeting updated successfully!", "Success");
    } catch (err) {
      console.error("[Edit] Error:", err);
      showAlert(err?.response?.data?.message || err?.message || "Failed to update meeting.", "Error");
    }
  }, [
    accounts, instance,
    editMeetingKey, editSubject, editStart, editEnd,
    panelMeetings, showSidePanel,
    fetchMeetings, fetchPanelMeetings,
    signedInEmail, closeEdit
  ]);


  const closeSidePanel = useCallback(() => {
    setShowSidePanel(false);
    setDeleteStep(1);
    setSelectedMeetingKey(null);
    setSidePanelTab("list");
  }, []);

  /* Side panel lifecycle */
  useEffect(() => {
    if (!showSidePanel) {
      clearInterval(panelPollerRef.current);
      clearTimeout(panelOpenDelayRef.current);
      clearTimeout(panelDebounceRef.current);
      panelPollerRef.current = null;
      panelOpenDelayRef.current = null;
      panelDebounceRef.current = null;
      if (panelAbortRef.current) panelAbortRef.current.abort();
      return;
    }
    panelOpenDelayRef.current = setTimeout(() => { fetchPanelMeetings(); }, 250);
    panelPollerRef.current = setInterval(() => { fetchPanelMeetings(); }, 30000);
    return () => {
      clearInterval(panelPollerRef.current);
      clearTimeout(panelOpenDelayRef.current);
    };
  }, [showSidePanel, fetchPanelMeetings]);

  useEffect(() => {
    if (!showSidePanel) return;
    clearTimeout(panelDebounceRef.current);
    panelDebounceRef.current = setTimeout(() => { fetchPanelMeetings(); }, 250);
    return () => clearTimeout(panelDebounceRef.current);
  }, [panelDate, showSidePanel, fetchPanelMeetings]);

  useEffect(() => { fetchMeetings(); }, [date, fetchMeetings]);

  /* Polling while tab visible */
  useEffect(() => {
    const startPoll = () => {
      if (mainPollerRef.current) return;
      mainPollerRef.current = setInterval(() => fetchMeetings(), 30000);
    };
    const stopPoll = () => {
      clearInterval(mainPollerRef.current);
      mainPollerRef.current = null;
    };
    const onVisibility = () => (document.hidden ? stopPoll() : startPoll());
    startPoll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPoll();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchMeetings]);

  const sortedMeetings = useMemo(() => {
    const copy = [...meetings];
    const order = { Live: 3, upcoming: 2, completed: 1 };
    copy.sort((a, b) => order[getMeetingStatus(b.startTime, b.endTime)] - order[getMeetingStatus(a.startTime, a.endTime)]);
    return copy;
  }, [meetings]);

  const meetingsByFloor = useMemo(() => {
    return floorHeaders.reduce((acc, floor) => {
      acc[floor] = sortedMeetings.filter((m) => (m.location || "").toLowerCase().includes(floor.toLowerCase()));
      return acc;
    }, {});
  }, [sortedMeetings]);

  const totalPages = Math.ceil((Math.max(...floorHeaders.map((f) => meetingsByFloor[f]?.length || 0)) || 1) / PAGE_SIZE);
  const pagedMeetings = useMemo(() => {
    return floorHeaders.reduce((acc, floor) => {
      const all = meetingsByFloor[floor] || [];
      acc[floor] = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      return acc;
    }, {});
  }, [meetingsByFloor, page]);

  const selectedMeeting = useMemo(
    () => panelMeetings.find((m) => getKey(m) === selectedMeetingKey) || null,
    [panelMeetings, selectedMeetingKey, getKey]
  );

  const openDeleteConfirm = useCallback((m) => {
    setSelectedMeetingKey(getKey(m));
    setDeleteStep(2);
    setSidePanelTab("delete");
  }, [getKey]);

  const closeSidePanelToList = useCallback(() => {
    setSidePanelTab("list");
    setDeleteStep(1);
    setSelectedMeetingKey(null);
  }, []);

  /* ====== Side Panel UI ====== */
  const SidePanel = () => {
    const { instance: msalInstance } = useMsal();
    const signedInEmailLocal = signedInEmail;

    const NewMeetingButton = ({ compact = false }) => (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={openBookingFromPanel}
        title="Create a new meeting"
        className="d-inline-flex align-items-center"
        style={{
          border: "none",
          outline: "none",
          cursor: "pointer",
          opacity: 1,
          padding: compact ? "8px 12px" : "10px 14px",
          borderRadius: 10,
          fontWeight: 800,
          letterSpacing: 0.2,
          boxShadow: "0 6px 20px rgba(0,118,255,0.18)",
          background: "linear-gradient(90deg,#0074BD,#78b042)",
          color: "#fff",
          fontSize: compact ? 13.5 : 14.5,
          whiteSpace: "nowrap"
        }}
      >
        <PlusIcon style={{ width: compact ? 16 : 18, height: compact ? 16 : 18, marginRight: 8 }} />
        New Meeting
      </motion.button>
    );

    /* Pretty action buttons */
    const ActionBtn = ({ kind, onClick, title, disabled }) => {
      const base = {
        border: "1px solid transparent",
        padding: "6px 12px",
        borderRadius: 10,
        fontWeight: 800,
        letterSpacing: 0.2,
        fontSize: 13.5,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
        transition: "transform .05s ease",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1
      };
      const styles = {
        edit: { background: "linear-gradient(90deg,#eef2ff,#e0e7ff)", color: "#1e3a8a" },
        delete: { background: "linear-gradient(90deg,#ffe4e6,#fecaca)", color: "#7f1d1d" }
      };
      const Icon = kind === "edit" ? PencilIcon : TrashIcon;
      return (
        <button
          className="btn btn-sm"
          onClick={disabled ? undefined : onClick}
          title={title}
          style={{ ...base, ...styles[kind] }}
          disabled={disabled}
        >
          <Icon style={{ width: 16, height: 16 }} />
          {kind === "edit" ? "Edit" : "Delete"}
        </button>
      );
    };

    return (
      <AnimatePresence initial={false}>
        {showSidePanel && (
          <>
            <motion.div
              key="panel-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ position: "fixed", inset: 0, background: "#000", zIndex: 1200, height: "auto", width: "auto" }}
              onClick={closeSidePanel}
            />
            <motion.div
              key="side-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              style={{
                position: "fixed",
                top: 0, right: 0,
                height: "190vh",
                width: SIDE_PANEL_WIDTH,
                minWidth: SIDE_PANEL_MIN_WIDTH,
                maxWidth: SIDE_PANEL_MAX_WIDTH,
                background: "rgba(233, 230, 230, 0.5)",
                backdropFilter: "blur(10px) saturate(1.2)",
                boxShadow: "-8px 0 28px 0 rgba(33,55,95,0.11)",
                zIndex: 1202,
                display: "flex", flexDirection: "column",
                borderBottomLeftRadius: 24,
                borderLeft: "1.5px solid #e6e8ec",
                willChange: "transform"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky Header / Toolbar */}
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 14px",
                  borderBottom: "1.5px solid #e5e7eb",
                  background: "linear-gradient(180deg, rgba(229,237,250,0.95), rgba(229,237,250,0.6))",
                  position: "sticky", top: 0, zIndex: 3
                }}
              >
                <div style={{ fontWeight: 900, fontSize: "1.05rem", color: "#1346a8", letterSpacing: 0.2, flex: 1 }}>
                  Manage Meetings
                </div>
                <div className="d-none d-sm-block" style={{ minWidth: 170 }}>
                  <DatePickerComponent selectedDate={panelDate} setSelectedDate={setPanelDate} label={null} />
                </div>
                <div>
                  <NewMeetingButton compact />
                </div>
                <button className="btn-close ms-1" style={{ fontSize: 18, color: "#e60f0fff", borderRadius: 8 }} onClick={closeSidePanel} />
              </div>

              {/* Small-screen date picker */}
              <div className="d-sm-none" style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f7" }}>
                <DatePickerComponent selectedDate={panelDate} setSelectedDate={setPanelDate} label={null} />
              </div>

              {/* Content */}
              <div style={{ position: "relative", padding: "14px", overflowY: "auto", flex: 1, minHeight: 0 }}>
                {/* ======= AUTH GATE ======= */}
                {!isAuthenticated ? (
                  <div
                    className="p-4 text-center"
                    style={{
                      border: "1px dashed #c7d2fe",
                      background: "linear-gradient(180deg,#f8fbff,#f1f5ff)",
                      borderRadius: 16,
                      color: "#334155"
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>
                      Please sign in with your organizational email to delete or edit meetings
                    </div>
                    <div style={{ fontSize: 14, marginTop: 8 }}>
                      Only <b>@{ORG_DOMAIN}</b> accounts are allowed. Admins can manage all meetings.
                    </div>
                    <button
                      className="btn mt-3"
                      style={{
                        background: "linear-gradient(90deg,#0074BD,#78b042)",
                        color: "#fff",
                        fontWeight: 800,
                        borderRadius: 10,
                        padding: "10px 16px",
                        boxShadow: "0 8px 24px rgba(0,116,189,0.25)"
                      }}
                      onClick={() => msalInstance.loginPopup?.().catch(() => { })}
                    >
                      Sign in
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Organizer-only (or admin) list: deletablePanelMeetings */}
                    {deletablePanelMeetings.length === 0 && !panelLoading ? (
                      <div
                        className="text-center p-4"
                        style={{
                          background: "linear-gradient(180deg,#f8fbff,#f1f5ff)",
                          borderRadius: 16,
                          border: "1px dashed #c7d2fe",
                          color: "#4b5563"
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: 18, color: "#1f2937" }}>
                          {isAdmin ? "No meetings today." : "No deletable meetings for you today."}
                        </div>
                        <div style={{ fontSize: 14, margin: "8px 0 14px" }}>
                          {isAdmin ? "Create a new meeting or pick another day." : "Only your upcoming meetings appear here."}
                        </div>
                      </div>
                    ) : (
                      deletablePanelMeetings.map((meeting) => {
                        const status = getMeetingStatus(meeting.startTime, meeting.endTime);
                        const isOrganizer =
                          (meeting.organizer || "").toLowerCase() === signedInEmailLocal ||
                          (meeting.organizerEmail || "").toLowerCase() === signedInEmailLocal;

                        const userDomainOk = signedInEmailLocal.endsWith(`@${ORG_DOMAIN}`);
                        const canManage = isAuthenticated && userDomainOk && (isOrganizer || isAdmin);

                        const canEdit = canManage && status !== "completed";
                        const canDelete = canManage && (status === "upcoming" || isAdmin);

                        return (
                          <motion.div
                            key={getKey(meeting)}
                            initial={false}
                            animate={{ opacity: status === "completed" && !isAdmin ? 0.54 : 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.2 }}
                            className="mb-2"
                          >
                            <div
                              style={{
                                background: statusGradients[status],
                                borderLeft: `5px solid ${status === "completed" ? "#b2bec3" : status === "Live" ? "#38df6c" : "#3498db"}`,
                                padding: "14px 12px 14px 16px", borderRadius: 15,
                                display: "flex", flexDirection: "column", boxShadow: "0 2px 6px #deeefc3a",
                                position: "relative", marginBottom: 4,
                              }}
                            >
                              {meeting.multiRoom && (
                                <span className="badge-multiroom" title={(meeting.multiRooms || []).join(" • ")}>
                                  MULTI-ROOM ×{meeting.multiRoomCount}
                                </span>
                              )}

                              <div style={{ fontWeight: 800, fontSize: 16, color: "#1f2937", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>
                                {meeting.subject || "Untitled"}
                              </div>

                              <div style={{ fontSize: 13.9, color: "#374151", margin: "2px 0" }}>
                                <b>Room{meeting.multiRoom ? "s" : ""}:</b>{" "}
                                {meeting.multiRoom ? (meeting.multiRooms || []).join(" • ") : (meeting.location || "Unassigned")}
                              </div>

                              <div style={{ fontSize: 13.4, color: "#374151" }}>
                                <b>Time:</b> {formatTimeOnly(meeting.startTime)} – {formatTimeOnly(meeting.endTime)}
                              </div>
                              <div style={{ fontSize: 12.6, color: "#6b7280", marginTop: 2 }}>
                                <b>Organizer:</b> {meeting.organizer || meeting.organizerEmail || "Unknown"}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", marginTop: 10, gap: 8 }}>
                                <span style={{ background: "#eef2ff", color: "#4338ca", fontWeight: 700, borderRadius: 8, fontSize: 12.8, padding: "2px 9px" }}>
                                  {status.toUpperCase()}
                                </span>
                                <span style={{ color: "#555", fontSize: 12.6 }}>
                                  🙎🏻‍♂️ {getAttendeesCount(meeting)}
                                </span>

                                <div className="ms-auto d-flex gap-2">
                                  <ActionBtn
                                    kind="edit"
                                    title={canEdit ? "Edit meeting title" : "Only organizer/admin can edit"}
                                    onClick={() => openEdit(meeting)}
                                    disabled={!canEdit}
                                  />
                                  <ActionBtn
                                    kind="delete"
                                    title={canDelete ? "Delete meeting" : (!isAuthenticated ? "Sign in" : "Only organizer/admin can delete")}
                                    onClick={() => openDeleteConfirm(meeting)}
                                    disabled={!canDelete}
                                  />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}

                    <PanelOverlaySpinner show={panelLoading} text="Refreshing…" />

                    {sidePanelTab === "delete" && deleteStep === 2 && selectedMeeting && (
                      <div style={{ position: "sticky", bottom: 0, marginTop: 12 }}>
                        <div className="mb-2" style={{ fontWeight: 900, fontSize: 18 }}>Confirm Deletion</div>
                        <div className="p-3 mb-2 rounded" style={{ background: "#f8fbff", fontSize: 15, border: "1px solid #e2e8f0" }}>
                          <div><b>Subject:</b> {selectedMeeting.subject || "Untitled"} </div>
                          <div><b>Organizer:</b> {selectedMeeting.organizer || selectedMeeting.organizerEmail || "Unknown"}</div>
                          <div><b>Room{selectedMeeting.multiRoom ? "s" : ""}:</b> {selectedMeeting.multiRoom ? (selectedMeeting.multiRooms || []).join(" • ") : (selectedMeeting.location || "Unassigned")}</div>
                          <div><b>Time:</b> {formatTimeOnly(selectedMeeting.startTime)} – {formatTimeOnly(selectedMeeting.endTime)}</div>
                        </div>
                        <div className="d-flex gap-2 justify-content-end">
                          <button className="btn btn-light" onClick={closeSidePanelToList} style={{ border: "1px solid #e2e8f0", borderRadius: 10, fontWeight: 700 }}>Cancel</button>
                          <button
                            className="btn"
                            onClick={async () => { await deleteSingleMeeting(selectedMeeting); closeSidePanelToList(); }}
                            style={{ borderRadius: 10, fontWeight: 900, minWidth: 140, background: "linear-gradient(90deg,#ef4444,#f97316)", color: "#fff" }}
                          >
                            Yes, Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Edit Sheet*/}

                    {editMeetingKey && (
                      <motion.div
                        key="quick-edit-form"
                        initial={false}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 30, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          position: "sticky",
                          bottom: 0,
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 14,
                          padding: 14,
                          boxShadow: "0 -8px 28px rgba(2,6,23,0.08)",
                          marginTop: 12,
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>
                          Quick Edit
                        </div>

                        <div className="d-flex flex-column gap-3">
                          <div>
                            <label className="form-label fw-semibold">Subject</label>
                            <input
                              ref={subjectRef}
                              className="form-control"
                              placeholder="Enter meeting subject"
                              value={editSubject}
                              onChange={(e) => setEditSubject(e.target.value)}
                              autoFocus
                            />
                          </div>

                          <div>
                            <label className="form-label fw-semibold">Start Time</label>
                            <input
                              type="datetime-local"
                              className="form-control"
                              value={editStart || ""}
                              onChange={(e) => setEditStart(e.target.value)}
                            />
                          </div>

                          <div>
                            <label className="form-label fw-semibold">End Time</label>
                            <input
                              type="datetime-local"
                              className="form-control"
                              value={editEnd || ""}
                              onChange={(e) => setEditEnd(e.target.value)}
                            />
                          </div>

                          <div className="d-flex justify-content-end gap-2 mt-2">
                            <button className="btn btn-light" onClick={closeEdit}>
                              Cancel
                            </button>
                            <button
                              className="btn"
                              onClick={saveEdit}
                              style={{
                                background: "linear-gradient(90deg,#10b981,#22c55e)",
                                color: "#fff",
                                fontWeight: 800,
                              }}
                            >
                              Save
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>
                          Admins can edit any meeting.
                        </div>
                      </motion.div>
                    )}
                  </>
                )}
              </div>

              {/* Spacer / layout footer */}
              {sidePanelTab === "list" && (
                <div style={{ position: "sticky", bottom: 14, display: "flex", justifyContent: "flex-end", padding: "0 14px 12px" }}>
                  {/* <NewMeetingButton /> */}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  };

  const AlertModal = () => (
    <AnimatePresence initial={false}>
      {alertModal.show && (
        <motion.div
          key="alert-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            width: "auto",
            height: "auto",
            zIndex: 2500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            padding: "20px",
            boxSizing: "border-box",
          }}
          onClick={() => setAlertModal({ ...alertModal, show: false })}
        >
          <motion.div
            initial={{ scale: 0.86, y: -40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 40 }}
            transition={{ type: "spring", stiffness: 280, damping: 23 }}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 32,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              width: "auto",
              maxWidth: "90%",
              height: "auto",
              maxHeight: "80vh",
              overflowY: "auto",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>
              {alertModal.title || "Notice"}
            </div>
            <div
              style={{
                fontSize: 16,
                color: "#444",
                whiteSpace: "pre-wrap",
                marginBottom: 28,
              }}
            >
              {alertModal.message}
            </div>
            <button
              className="btn btn-primary"
              style={{ fontWeight: 700, padding: "8px 18px", borderRadius: 8 }}
              onClick={() => setAlertModal({ ...alertModal, show: false })}
            >
              OK
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );



  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" crossOrigin="anonymous" />
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
          .badge-multiroom{
            position: absolute;
            top: 6px;
            right: 6px;
            padding: 2px 8px;
            border-radius: 999px;
            font-weight: 700;
            font-size: 11.5px;
            color: #fff;
            background: linear-gradient(90deg,#7C3AED,#EC4899);
            box-shadow: 0 2px 6px rgba(124,58,237,0.25);
            letter-spacing: .2px
          }
        `}
      </style>

      <div className="scaling-container">
        <div className="container-fluid px-2 px-md-3 px-lg-4 px-xl-5 my-3 my-md-4" style={{ position: "relative", zIndex: 1 }}>
          <div className="card h-100 shadow-sm p-2 p-md-3 mb-3 mb-md-4" style={{ borderRadius: 15, backgroundColor: "rgba(233, 230, 230, 0.5)" }}>
            <div className="header-container">
              <div className="header-left">
                <img src={logoImage} alt="R&D Conserve Logo" className="rounded shadow-sm" style={{ width: 60, height: 65 }} />
                <h2 className="fs-3 fs-md-2 mb-0 fw-bold" style={{ background: "linear-gradient(90deg, #0074BD, #76B042)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Meetly Dashboard
                </h2>
              </div>
              <div className="header-center">
                <h2 className="fs-4 fs-md-3 mb-0 fw-bolder" style={{ background: "linear-gradient(90deg, #20498a, #20498a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontFamily: "stylus bt", margin: 0 }}>
                  WE ADD VALUE TO YOUR VISION...
                </h2>
              </div>
              <div className="header-right">
                <div className="d-flex align-items-center gap-2">
                  <DatePickerComponent selectedDate={date} setSelectedDate={setDate} />
                </div>
                <button
                  className="btn-custom"
                  style={{ fontFamily: "calibri", fontSize: 16, color: "#fff", backgroundImage: "linear-gradient(to right, #0074bd, #78b042)", borderRadius: 6, cursor: "pointer" }}
                  onClick={() => setShowSidePanel(true)}
                >
                  Manage Meetings
                </button>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <h4 className="text-muted fw-bold" style={{ fontFamily: "calibri", paddingLeft: 10, fontSize: 32, color: "#333" }}>
              {date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </h4>
          </div>

          {loading && <LoadingIndicator />}

          <div className="card mb-4" style={{ borderRadius: 20, backgroundColor: "rgba(233, 230, 230, 0.5)" }}>
            <div className="card-body">
              <div className="dashboard-container">
                <div className="dashboard-card card-meetings-color">
                  <div className="card-header-main"><p>Today's Meetings</p><CalendarIcon className="card-icon" /></div>
                  <div className="card-body-main"><p className="card-value">{stats.totalMeetings}</p><p className="card-subtext">{stats.activeMeetings} currently active</p></div>
                </div>
                <div className="dashboard-card card-attendees-color">
                  <div className="card-header-main"><p>Total Attendees</p><UsersIcon className="card-icon" /></div>
                  <div className="card-body-main"><p className="card-value">{stats.totalAttendees}</p><p className="card-subtext">Across unique meetings</p></div>
                </div>
                <div className="dashboard-card card-duration-color">
                  <div className="card-header-main"><p>Avg Duration</p><ClockIcon className="card-icon" /></div>
                  <div className="card-body-main"><p className="card-value">{stats.avgDuration}m</p><p className="card-subtext">Per unique meeting</p></div>
                </div>
                <div className="dashboard-card card-utilization-color">
                  <div className="card-header-main"><p>Room Utilization</p><TrendingUpIcon className="card-icon utilization-icon" /></div>
                  <div className="card-body-main"><p className="card-value">{stats.roomUtilization}%</p><p className="card-subtext">Today's usage</p></div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-2 g-md-3 g-lg-4">
            {floorHeaders.map((floor) => (
              <div key={floor} className="col-12 col-sm-6 col-xl-3">
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
                    <AnimatePresence initial={false}>
                      {pagedMeetings[floor]?.length > 0 ? (
                        pagedMeetings[floor].map((meeting) => {
                          const status = getMeetingStatus(meeting.startTime, meeting.endTime);
                          const attendeesCount = getAttendeesCount(meeting);
                          return (
                            <motion.div
                              key={getKey(meeting)}
                              initial={false}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 40 }}
                              transition={{ duration: 0.2 }}
                              className="p-2 p-md-3 mb-2 mb-md-3 rounded shadow-sm"
                              style={{
                                background: statusGradients[status],
                                borderLeft: `4px solid ${status === "completed" ? "#95a5a6" : status === "Live" ? "#06d373ff" : "#3498db"}`,
                                minHeight: 80,
                                fontWeight: 700,
                                position: "relative",
                              }}
                            >
                              {meeting.multiRoom && (
                                <span className="badge-multiroom" title={(meeting.multiRooms || []).join(" • ")}>
                                  ×{meeting.multiRoomCount} ROOMS
                                </span>
                              )}

                              <div style={{ fontSize: "clamp(0.85rem, 1.8vw, 1rem)", color: "#2c3e50" }} className="text-truncate" title={meeting.subject}>
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

          <div style={{ position: "fixed", bottom: "1rem", right: "1rem", opacity: 0.9, fontSize: "0.85rem", color: "#ffffff", zIndex: 100 }}>
            Powered by R&D Conserve
          </div>
        </div>

        <SidePanel />
        <AlertModal />
      </div>

      {/* Booking modal */}
      {showBookingModal && (
        <BookingComponent onClose={handleCloseBookingModal} onSave={handleSaveMeeting} />)}
    </>
  );
};
export default MeetingsDashboard;
