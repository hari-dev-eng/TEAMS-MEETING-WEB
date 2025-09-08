import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import { useMsal } from "@azure/msal-react";
import * as microsoftTeams from "@microsoft/teams-js";

// Helper: Detect if running inside Teams iFrame
function isRunningInTeams() {
  try {
    return window.self !== window.top && window.parent && window.parent !== window;
  } catch {
    return false;
  }
}

// Predefined rooms with emails
const rooms = [
  { name: "Ground Floor Meeting Room", email: "gfmeeting@conservesolution.com" },
  { name: "1st Floor Meeting Room", email: "ffmeeting@conservesolution.com" },
  { name: "3rd Floor Meeting Room", email: "sfmeeting@conservesolution.com" },
  { name: "Conference Room", email: "contconference@conservesolution.com" },
];

const API_BASE_URL = "https://teamsbackendapi-production.up.railway.app";

// --- RecurringEventModal Component ---
const RecurringEventModal = ({ show, onClose, eventData, handleChange, account }) => {
  const WEEKDAY_CODES = useMemo(() => Object.freeze(["SU", "MO", "TU", "WE", "TH", "FR", "SA"]), []);
  const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const startDateObj = useMemo(() => (eventData.startDate ? new Date(`${eventData.startDate}T00:00:00`) : null), [eventData.startDate]);
  const startWeekdayIndex = startDateObj ? startDateObj.getDay() : 0;
  const [recurrenceData, setRecurrenceData] = useState({
    frequency: "weekly",
    interval: 1,
    endOption: "never",
    endDate: "",
    occurrences: 10,
    byWeekdays: startDateObj ? [WEEKDAY_CODES[startWeekdayIndex]] : []
  });
  useEffect(() => {
    if (eventData.recurrence) {
      setRecurrenceData((prev) => ({
        frequency: eventData.recurrence.frequency || "weekly",
        interval: eventData.recurrence.interval ?? 1,
        endOption: eventData.recurrence.endOption || "never",
        endDate: eventData.recurrence.endDate || "",
        occurrences: eventData.recurrence.occurrences ?? 10,
        byWeekdays: eventData.recurrence.byWeekdays || prev.byWeekdays || []
      }));
    } else {
      if (startDateObj) {
        setRecurrenceData((p) => ({
          ...p,
          byWeekdays: [WEEKDAY_CODES[startWeekdayIndex]]
        }));
      }
    }
  }, [eventData, show, startDateObj, startWeekdayIndex, WEEKDAY_CODES]);
  const handleRecurrenceChange = (e) => {
    const { name, value } = e.target;
    setRecurrenceData(prev => {
      if (name === "interval") {
        const n = Math.max(1, Math.min(30, Number(value) || 1));
        return { ...prev, interval: n };
      }
      if (name === "occurrences") {
        const n = Math.max(1, Math.min(100, Number(value) || 1));
        return { ...prev, occurrences: n };
      }
      if (name === "frequency") {
        if (value === "weekly" && (!prev.byWeekdays || prev.byWeekdays.length === 0)) {
          return { ...prev, frequency: value, byWeekdays: [WEEKDAY_CODES[startWeekdayIndex]] };
        }
      }
      if (name === "endOption") {
        if (value === "never") return { ...prev, endOption: value, endDate: "" };
        if (value === "date") return { ...prev, endOption: value };
        if (value === "after") return { ...prev, endOption: value, endDate: "" };
      }
      return { ...prev, [name]: value };
    });
  };
  const toggleWeekday = (idx) => {
    if (recurrenceData.frequency !== "weekly") return;
    const code = WEEKDAY_CODES[idx];
    setRecurrenceData((prev) => {
      const set = new Set(prev.byWeekdays || []);
      if (set.has(code)) set.delete(code); else set.add(code);
      if (set.size === 0) set.add(WEEKDAY_CODES[startWeekdayIndex]);
      return { ...prev, byWeekdays: Array.from(set).sort((a, b) => WEEKDAY_CODES.indexOf(a) - WEEKDAY_CODES.indexOf(b)) };
    });
  };
  useEffect(() => {
    if (eventData.startDate && recurrenceData.endOption === 'date') {
      const startDate = new Date(eventData.startDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 3);
      const formattedDate = endDate.toISOString().split('T')[0];
      if (!recurrenceData.endDate) {
        setRecurrenceData(prev => ({ ...prev, endDate: formattedDate }));
      }
    }
  }, [eventData.startDate, recurrenceData.endOption, recurrenceData.endDate]);
  useEffect(() => {
    if (eventData.startTime && !eventData.endTime && !eventData.isAllDay) {
      const startTime = new Date(`2000-01-01T${eventData.startTime}`);
      startTime.setMinutes(startTime.getMinutes() + 30);
      const hours = startTime.getHours().toString().padStart(2, '0');
      const minutes = startTime.getMinutes().toString().padStart(2, '0');
      handleChange({ target: { name: 'endTime', value: `${hours}:${minutes}` } });
    }
  }, [eventData.startTime, eventData.isAllDay, eventData.endTime, handleChange]);
  const rrule = useMemo(() => {
    if (!eventData.startDate) return "";
    const parts = [];
    const FREQ = recurrenceData.frequency.toUpperCase();
    parts.push(`FREQ=${FREQ}`);
    parts.push(`INTERVAL=${recurrenceData.interval || 1}`);
    if (recurrenceData.frequency === "weekly" && recurrenceData.byWeekdays?.length) {
      parts.push(`BYDAY=${recurrenceData.byWeekdays.join(",")}`);
    }
    if (recurrenceData.frequency === "monthly") {
      const d = new Date(`${eventData.startDate}T00:00:00`);
      parts.push(`BYMONTHDAY=${d.getDate()}`);
    }
    if (recurrenceData.frequency === "yearly") {
      const d = new Date(`${eventData.startDate}T00:00:00`);
      parts.push(`BYMONTH=${d.getMonth() + 1}`);
      parts.push(`BYMONTHDAY=${d.getDate()}`);
    }
    if (recurrenceData.endOption === "date" && recurrenceData.endDate) {
      const until = new Date(`${recurrenceData.endDate}T23:59:59Z`);
      const y = until.getUTCFullYear();
      const m = String(until.getUTCMonth() + 1).padStart(2, "0");
      const d = String(until.getUTCDate()).padStart(2, "0");
      const hh = String(until.getUTCHours()).padStart(2, "0");
      const mm = String(until.getUTCMinutes()).padStart(2, "0");
      const ss = String(until.getUTCSeconds()).padStart(2, "0");
      parts.push(`UNTIL=${y}${m}${d}T${hh}${mm}${ss}Z`);
    } else if (recurrenceData.endOption === "after" && recurrenceData.occurrences) {
      parts.push(`COUNT=${recurrenceData.occurrences}`);
    }
    return parts.join(";");
  }, [eventData.startDate, recurrenceData]);
  const summary = useMemo(() => {
    if (!eventData.startDate) return "";
    const d = new Date(`${eventData.startDate}T00:00:00`);
    const interval = recurrenceData.interval || 1;
    const longDay = d.toLocaleDateString(undefined, { weekday: "long" });
    let when = "";
    if (recurrenceData.frequency === "daily") {
      when = interval === 1 ? "every day" : `every ${interval} days`;
    } else if (recurrenceData.frequency === "weekly") {
      const names = (recurrenceData.byWeekdays || []).map(code => {
        const i = WEEKDAY_CODES.indexOf(code);
        return new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: "long" });
      });
      const list = names.length <= 1 ? names[0] :
        (names.length === 2 ? `${names[0]} and ${names[1]}` :
          `${names.slice(0, -1).join(", ")} and ${names.slice(-1)}`);
      when = interval === 1 ? `every ${list}` : `every ${interval} weeks on ${list}`;
      if (interval === 1 && (recurrenceData.byWeekdays || []).length === 1) {
        when = `every ${longDay}`;
      }
    } else if (recurrenceData.frequency === "monthly") {
      when = interval === 1 ? `monthly on day ${d.getDate()}` : `every ${interval} months on day ${d.getDate()}`;
    } else {
      const md = d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
      when = interval === 1 ? `every year on ${md}` : `every ${interval} years on ${md}`;
    }
    let endText = "";
    if (recurrenceData.endOption === "date" && recurrenceData.endDate) {
      endText = ` until ${new Date(`${recurrenceData.endDate}T00:00:00`).toLocaleDateString()}`;
    } else if (recurrenceData.endOption === "after") {
      endText = ` for ${recurrenceData.occurrences} occurrence${recurrenceData.occurrences > 1 ? "s" : ""}`;
    }
    return `Occurs ${when}${endText}.`;
  }, [eventData.startDate, recurrenceData, WEEKDAY_CODES]);
  const toDaysMask = (codesArr) =>
    (codesArr || []).reduce((mask, code) => {
      const idx = WEEKDAY_CODES.indexOf(code);
      return idx >= 0 ? mask | (1 << idx) : mask;
    }, 0);
  const buildRecurrencePattern = () => {
    const { frequency, interval, endOption, endDate, occurrences, byWeekdays } = recurrenceData;
    const dayOfMonth = startDateObj ? startDateObj.getDate() : undefined;
    const month = startDateObj ? startDateObj.getMonth() + 1 : undefined;
    const daysMask = toDaysMask(byWeekdays);
    const range =
      endOption === "never"
        ? { Type: "noEnd" }
        : endOption === "date"
          ? { Type: "endDate", EndDate: new Date(`${endDate}T00:00:00`) }
          : { Type: "numbered", NumberOfOccurrences: Math.max(1, occurrences || 1) };
    return {
      PatternType: frequency,
      Interval: Math.max(1, interval || 1),
      DayOfMonth: dayOfMonth,
      Month: month,
      DaysOfWeek: daysMask,
      Range: range
    };
  };
  const handleSaveRecurrence = () => {
    const rp = buildRecurrencePattern();
    handleChange({ target: { name: 'RecurrencePattern', value: rp } });
    handleChange({
      target: {
        name: 'recurrence',
        value: { ...recurrenceData, rrule, summaryText: summary }
      }
    });
    onClose();
  };
  if (!show) return null;
  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000, width: "auto", height: "auto"
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white', borderRadius: '8px', padding: '20px', width: '420px',
        maxWidth: '90vw', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ marginTop: 0, color: '#2D3748' }}>Repeat</h3>
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ marginRight: '10px', color: '#4A5568' }}>Start</span>
            <span style={{ color: '#2D3748', fontWeight: '500' }}>
              {eventData.startDate ? new Date(eventData.startDate).toLocaleDateString() : 'Select date'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <label style={{ marginRight: '10px', color: '#4A5568', minWidth: '80px' }}>Repeat every</label>
            <input type="number" min="1" max="30" className="form-control"
              style={{ width: '60px', marginRight: '10px', borderRadius: '4px', padding: '4px 8px', border: '1px solid #CBD5E0' }}
              name="interval" value={recurrenceData.interval} onChange={handleRecurrenceChange} />
            <select className="form-control"
              style={{ borderRadius: '4px', padding: '4px 8px', border: '1px solid #CBD5E0' }}
              name="frequency" value={recurrenceData.frequency} onChange={handleRecurrenceChange}>
              <option value="daily">day</option>
              <option value="weekly">week</option>
              <option value="monthly">month</option>
              <option value="yearly">year</option>
            </select>
          </div>
          <div style={{ marginBottom: '15px', opacity: recurrenceData.frequency === 'weekly' ? 1 : 0.5 }}>
            <div style={{ marginBottom: '8px', color: '#4A5568' }}>Occurs on</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {WEEKDAY_LABELS.map((label, index) => {
                const active = recurrenceData.frequency === 'weekly' &&
                  (recurrenceData.byWeekdays || []).includes(WEEKDAY_CODES[index]);
                return (
                  <button key={label} type="button" onClick={() => toggleWeekday(index)}
                    disabled={recurrenceData.frequency !== 'weekly'}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid #CBD5E0',
                      backgroundColor: active ? '#2563EB' : 'transparent',
                      color: active ? 'white' : '#4A5568',
                      cursor: 'pointer', fontWeight: 600, fontSize: 12
                    }}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ marginBottom: '8px', color: '#4A5568' }}>Ends</div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: 8 }}>
                <input type="radio" id="endNever" name="endOption" value="never"
                  checked={recurrenceData.endOption === 'never'}
                  onChange={handleRecurrenceChange} />
                <span style={{ color: '#4A5568' }}>Never</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: 8 }}>
                <input type="radio" id="endDate" name="endOption" value="date"
                  checked={recurrenceData.endOption === 'date'}
                  onChange={handleRecurrenceChange} />
                <span style={{ color: '#4A5568' }}>On</span>
                <input type="date" className="form-control"
                  style={{ borderRadius: '4px', padding: '4px 8px', border: '1px solid #CBD5E0', width: '160px' }}
                  name="endDate" value={recurrenceData.endDate} onChange={handleRecurrenceChange}
                  min={eventData.startDate}
                  disabled={recurrenceData.endOption !== 'date'} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="radio" id="endAfter" name="endOption" value="after"
                  checked={recurrenceData.endOption === 'after'}
                  onChange={handleRecurrenceChange} />
                <span style={{ color: '#4A5568' }}>After</span>
                <input type="number" min="1" max="100"
                  className="form-control"
                  style={{ width: '60px', borderRadius: '4px', padding: '4px 8px', border: '1px solid #CBD5E0' }}
                  name="occurrences"
                  value={recurrenceData.occurrences}
                  onChange={handleRecurrenceChange}
                  disabled={recurrenceData.endOption !== 'after'}
                />
                <span style={{ color: '#4A5568' }}>occurrence(s)</span>
              </label>
            </div>
          </div>
          {summary && (
            <div style={{ color: '#4A5568', fontSize: 13, marginTop: 6 }}>
              {summary}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: '1px solid #CBD5E0',
            backgroundColor: 'white',
            color: '#4A5568',
            cursor: 'pointer'
          }}>Discard</button>
          <button onClick={handleSaveRecurrence} style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#3182CE',
            color: 'white',
            cursor: 'pointer'
          }}>Save</button>
        </div>
      </div>
    </div>
  );
};

// --- BookingComponent Component ---
const BookingComponent = ({ onClose, onSave }) => {
  const { instance: msalInstance, accounts } = useMsal();
 const [isTeams] = useState(isRunningInTeams());
  const [teamsContext, setTeamsContext] = useState(null);
  const [account, setAccount] = useState(null);
  const [eventData, setEventData] = useState({
    title: "",
    startDate: new Date().toISOString().split('T')[0],
    startTime: "09:00",
    endTime: "09:30",
    isAllDay: false,
    isRecurring: false,
    location: "",
    roomEmail: "",
    userEmail: "",
    category: "Busy",
    reminder: "15",
    description: "",
    recurrence: null,
    RecurrencePattern: null
  });
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("danger");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [attendeeSuggestions, setAttendeeSuggestions] = useState([]);
  const [attendeeSearchTerm, setAttendeeSearchTerm] = useState("");
  const [attendeeList, setAttendeeList] = useState([]);
  const [isValidEmail, setIsValidEmail] = useState(true);
const [roomAvailability] = useState({});
  const [isCheckingAvailability] = useState(false);
  const debounceTimeoutRef = useRef(null);
  const availabilityTimeoutRef = useRef(null);

  const showAlertMessage = useCallback((message, type) => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 5000);
  }, []);

  const isWorkSchoolAccount = useCallback((email) => {
    return email && email.toLowerCase().endsWith('@conservesolution.com');
  }, []);

  // --- SSO: Teams SSO if in Teams tab, MSAL SSO otherwise ---
  const getAccessToken = useCallback(async () => {
    if (isTeams) {
      return new Promise((resolve, reject) => {
        microsoftTeams.app.initialize().then(() => {
          microsoftTeams.authentication.getAuthToken({
            successCallback: (token) => {
              resolve(token);
            },
            failureCallback: (err) => {
              console.error("Teams SSO error:", err);
              reject(err);
            },
            resources: ["https://graph.microsoft.com"],
          });
        }).catch((err) => {
          console.error("Teams SDK init error:", err);
          reject(err);
        });
      });
    } else {
      try {
        const response = await fetch(`${API_BASE_URL}/api/Bookings/GetAccessToken`);
        if (!response.ok) throw new Error(`Failed to get token: ${response.status}`);
        const data = await response.json();
        return data.access_token || data.accessToken;
      } catch (error) {
        console.error("Web SSO error:", error);
        return null;
      }
    }
  }, [isTeams]);

  useEffect(() => {
    if (isTeams) {
      microsoftTeams.app.initialize().then(() => {
        microsoftTeams.app.getContext().then((context) => {
          setTeamsContext(context);
        });
      });
    }
  }, [isTeams]);

  // --- MSAL Auth (web) ---
  useEffect(() => {
    if (!isTeams && accounts.length > 0) {
      const activeAccount = accounts[0];
      const userEmail = activeAccount.username ||
        activeAccount.userName ||
        (activeAccount.idTokenClaims && activeAccount.idTokenClaims.email) ||
        (activeAccount.idTokenClaims && activeAccount.idTokenClaims.preferred_username);
      if (userEmail && isWorkSchoolAccount(userEmail)) {
        setAccount(activeAccount);
        setEventData(prev => ({ ...prev, userEmail }));
        setIsValidEmail(true);
      } else {
        showAlertMessage("Please login with your official @conservesolution.com account.", "danger");
        setIsValidEmail(false);
      }
    } else if (!isTeams) {
      setAccount(null);
      setIsValidEmail(true);
    }
  }, [accounts, isTeams, isWorkSchoolAccount, showAlertMessage]);

  // --- Teams Auth (in Teams) ---
  useEffect(() => {
    if (isTeams && teamsContext?.user) {
      const userEmail = teamsContext.user.userPrincipalName || teamsContext.user.email || "";
      if (userEmail && isWorkSchoolAccount(userEmail)) {
        setAccount({ name: teamsContext.user.displayName || "Teams User", username: userEmail });
        setEventData(prev => ({ ...prev, userEmail }));
        setIsValidEmail(true);
      } else {
        setAccount(null);
        setIsValidEmail(false);
        showAlertMessage("Please login with your official @conservesolution.com account.", "danger");
      }
    }
  }, [isTeams, teamsContext, isWorkSchoolAccount, showAlertMessage]);

  useEffect(() => {
    const currentDebounceTimeout = debounceTimeoutRef.current;
    const currentAvailabilityTimeout = availabilityTimeoutRef.current;
    return () => {
      if (currentDebounceTimeout) clearTimeout(currentDebounceTimeout);
      if (currentAvailabilityTimeout) clearTimeout(currentAvailabilityTimeout);
    };
  }, []);

  const login = async () => {
    try {
      const loginRequest = { scopes: ["User.Read", "Calendars.ReadWrite"], prompt: "select_account" };
      const loginResponse = await msalInstance.loginPopup(loginRequest);
      if (!loginResponse.account) {
        showAlertMessage("Login failed. No account information returned.", "danger");
        return;
      }
      const activeAccount = loginResponse.account;
      const userEmail = activeAccount.username ||
        activeAccount.userName ||
        (activeAccount.idTokenClaims && activeAccount.idTokenClaims.email) ||
        (activeAccount.idTokenClaims && activeAccount.idTokenClaims.preferred_username);
      if (!userEmail || !isWorkSchoolAccount(userEmail)) {
        showAlertMessage("Please login with your official @conservesolution.com account.", "danger");
        setIsValidEmail(false);
        msalInstance.logoutPopup();
        return;
      }
      msalInstance.setActiveAccount(activeAccount);
      setAccount(activeAccount);
      setEventData(prev => ({ ...prev, userEmail }));
      setIsValidEmail(true);
      showAlertMessage(`Welcome ${activeAccount.name}`, "success");
    } catch (err) {
      console.error("Login error:", err);
      if (err.errorCode === "user_cancelled") showAlertMessage("Login was cancelled", "warning");
      else if (err.errorCode === "login_failed") showAlertMessage("Login failed. Please check your credentials and try again.", "danger");
      else showAlertMessage("Login failed. Please try again or contact support if the issue persists.", "danger");
    }
  };

  const logout = async () => {
    try {
      await msalInstance.logoutPopup({ mainWindowRedirectUri: "/" });
      setAccount(null);
      setEventData(prev => ({ ...prev, userEmail: "" }));
      showAlertMessage("You have been signed out successfully.", "success");
    } catch (err) {
      console.error("Logout error:", err);
      showAlertMessage("Failed to sign out. Please try again.", "danger");
    }
  };

  const handleRoomSelect = (e) => {
    const selectedRoomName = e.target.value;
    const selectedRoom = rooms.find(room => room.name === selectedRoomName);
    setEventData(prev => ({
      ...prev,
      location: selectedRoomName,
      roomEmail: selectedRoom ? selectedRoom.email : ""
    }));
  };
const fetchUsers = useCallback(
  async (searchTerm = "", isAttendeeField = false) => {
    setIsFetchingUsers(true);
    setAttendeeSuggestions([]);
    if (!searchTerm.trim()) {
      setIsFetchingUsers(false);
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No access token available");
      const response = await axios.get(
        `${API_BASE_URL}/api/Bookings/SearchUsers`,
        {
          params: { query: searchTerm },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const users = response.data || [];
      setAttendeeSuggestions(users);
    } catch (err) {
      setAttendeeSuggestions([]);
      if (searchTerm.trim()) showAlertMessage("User search failed.", "danger");
    } finally {
      setIsFetchingUsers(false);
    }
  },
  [getAccessToken, showAlertMessage]
);

  const debouncedUserSearch = useCallback(
  (searchTerm, isAttendeeField) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      fetchUsers(searchTerm, isAttendeeField);
    }, 300);
  },
  [fetchUsers]
);

  const handleChange = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target;

      if (name === "reminder") {
        setEventData((prev) => ({ ...prev, [name]: parseInt(value, 10) }));
      } else if (name === "attendees") {
        setAttendeeSearchTerm(value);
        debouncedUserSearch(value, true);
      } else if (name === "description") {
        setEventData((prev) => ({ ...prev, [name]: value }));
      } else if (name === "recurrence" || name === "RecurrencePattern") {
        setEventData((prev) => ({ ...prev, [name]: value }));
      } else if (name === "startTime") {
        // Auto +30 mins
        const [hours, minutes] = value.split(":").map(Number);
        const startDate = new Date();
        startDate.setHours(hours, minutes);
        const endDate = new Date(startDate.getTime() + 30 * 60000);
        const endHours = String(endDate.getHours()).padStart(2, "0");
        const endMinutes = String(endDate.getMinutes()).padStart(2, "0");
        setEventData((prev) => ({ ...prev, startTime: value, endTime: `${endHours}:${endMinutes}` }));
      } else {
        setEventData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
      }
    },
    [setEventData, setAttendeeSearchTerm, debouncedUserSearch]
  );

  const selectUser = (user, isAttendeeField = false) => {
    if (isAttendeeField) {
      setAttendeeList(prev => [...prev, user]);
      setAttendeeSearchTerm("");
      setAttendeeSuggestions([]);
    } else {
      setEventData(prev => ({ ...prev, userEmail: user.mail }));
    }
  };

  const removeAttendee = (email) => {
    setAttendeeList(prev => prev.filter(attendee => attendee.mail !== email));
  };




  useEffect(() => {
    const handleClickOutside = () => setAttendeeSuggestions([]);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const makeApiCall = async (requestBody) => {
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No access token available");
      const response = await fetch(`${API_BASE_URL}/api/Bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      return await response.json();
    } catch (err) {
      console.error("API Error:", err);
      throw err;
    }
  };

  const handleAuthAction = () => {
    if (account) logout(); else login();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!eventData.title.trim()) { showAlertMessage("Event title is required", "danger"); setIsLoading(false); return; }
    if (!eventData.startDate) { showAlertMessage("Start date is required", "danger"); setIsLoading(false); return; }
    if (!eventData.userEmail) { showAlertMessage("User email is required", "danger"); setIsLoading(false); return; }
    if (!eventData.roomEmail) { showAlertMessage("Please select a room", "danger"); setIsLoading(false); return; }

    const selectedRoomStatus = roomAvailability[eventData.roomEmail];
    if (selectedRoomStatus === "busy") {
      showAlertMessage("The selected room is not available at the chosen time. Please select a different time or room.", "danger");
      setIsLoading(false);
      return;
    }

    const emailDomainRegex = /^[a-zA-Z0-9._%+-]+@conservesolution\.com$/;
    if (!emailDomainRegex.test(eventData.userEmail)) {
      showAlertMessage("Please use a valid @conservesolution.com email address.", "danger");
      setIsLoading(false);
      return;
    }
    const attendeeEmails = attendeeList.map(a => a.mail);
    const invalidAttendees = attendeeEmails.filter(a => !emailDomainRegex.test(a));
    if (invalidAttendees.length > 0) {
      showAlertMessage(`These attendee emails are invalid: ${invalidAttendees.join(", ")}`, "danger");
      setIsLoading(false);
      return;
    }

    try {
      // Build Start/End based on All day
      let startIso, endIso;
      if (eventData.isAllDay) {
        const start = new Date(`${eventData.startDate}T00:00:00`);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        startIso = start.toISOString();
        endIso = end.toISOString();
      } else {
        startIso = new Date(`${eventData.startDate}T${eventData.startTime}`).toISOString();
        endIso = new Date(`${eventData.startDate}T${eventData.endTime}`).toISOString();
      }

      const requestBody = {
        Title: eventData.title,
        Description: eventData.description || eventData.title,
        StartTime: startIso,
        EndTime: endIso,
        Location: eventData.location,
        UserEmail: eventData.userEmail,
        RoomEmail: eventData.roomEmail,
        Attendees: attendeeList.map(attendee => ({ Name: attendee.displayName, Email: attendee.mail })),
        Category: eventData.category,
        Reminder: eventData.reminder,
        IsAllDay: eventData.isAllDay,
        IsRecurring: eventData.isRecurring,
        // ⬇️ send the DTO that the backend expects
        RecurrencePattern: eventData.isRecurring ? eventData.RecurrencePattern : null
      };

      try {
        const apiResponse = await makeApiCall(requestBody);
        showAlertMessage(
          `Booking for "${eventData.title}" on ${eventData.startDate}${eventData.isAllDay ? " (All day)" : ` at ${eventData.startTime}`} has been confirmed successfully.`,
          "success"
        );
        onSave({ ...eventData, apiResponse });
      } catch (apiError) {
        console.error("API Error:", apiError);
        showAlertMessage(apiError.message || "Failed to schedule the event due to a server error. Please try again.", "danger");
      }
    } catch (error) {
      console.error("Unexpected Error:", error);
      showAlertMessage("An unexpected error occurred while scheduling the event. Please check your inputs and try again.", "danger");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal d-block" style={{
      backgroundColor: "rgba(0,0,0,0.7)",
      zIndex: 1050,
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content" style={{
          borderRadius: "12px",
          border: "none",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          overflow: "hidden",
          background: "linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%)"
        }}>
          {/* Alert Box */}
          {showAlert && (
            <div className={`alert alert-${alertType} alert-dismissible fade show m-3`} role="alert" style={{
              borderRadius: "8px",
              boxShadow: `0 4px 10px rgba(${alertType === 'danger' ? '220,53,69' : '40,167,69'},0.3)`,
              border: "none"
            }}>
              <strong>{alertType === 'danger' ? 'Error!' : 'Success!'}</strong> {alertMessage}
              <button type="button" className="btn-close" onClick={() => setShowAlert(false)}></button>
            </div>
          )}

          {/* Header */}
          <div className="modal-header text-white" style={{
            background: "linear-gradient(90deg, rgb(0, 116, 189), #76b042ff)",
            borderBottom: "none",
            padding: "1.2rem 1.5rem"
          }}>
            <h5 className="modal-title" style={{ fontWeight: "600", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>New Event Booking</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} style={{ filter: "brightness(0) invert(1)" }}></button>
          </div>

          <div className="modal-body" style={{ padding: "1.5rem" }}>
            <form onSubmit={handleSubmit}>
              {/* Organizer */}
              <div className="mb-4 position-relative">
                <label className="form-label fw-bold" style={{ color: "#4a5568", fontSize: "24px" }}>Organizer <span className="text-danger">*</span></label>
                {account ? (
                  <div className="d-flex align-items-center">
                    <input type="email" className="form-control" value={eventData.userEmail} readOnly
                      style={{ borderRadius: "8px", padding: "0.75rem", border: "1px solid #cbd5e0", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)", backgroundColor: "#e9ecef", color: "#6c757d", marginRight: "10px" }} />
                    <button type="button" onClick={handleAuthAction}
                      className={`btn btn-sm ${account ? "btn-outline-danger" : "btn-success"}`}
                      style={{ borderRadius: "8px", padding: "0.6rem 1.2rem", fontWeight: "500" }}>
                      {account ? "Remove" : "Sign In with Microsoft"}
                    </button>
                  </div>
                ) : (
                  <div>
                    <button type="button" className="btn btn-primary" onClick={login}
                      style={{ borderRadius: "8px", padding: "0.75rem 1.5rem", fontWeight: "500" }}>
                      Sign In with Microsoft
                    </button>
                    <div className="form-text text-muted mt-2">Only Conserve Solution domain will be allowed</div>
                    <div className="form-text text-muted mt-1">If you encounter issues, please try refreshing the page or contact R&D Conserve.</div>
                  </div>
                )}
                {!isValidEmail && (<div className="text-danger mt-2">Please sign in with a valid @conservesolution.com account</div>)}
              </div>

              {/* Make recurring & all day */}
              <div className="mb-4">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" name="isRecurring"
                    checked={eventData.isRecurring}
                    onChange={(e) => { handleChange(e); if (e.target.checked) setShowRecurrenceModal(true); }}
                    id="recurringCheck" disabled={!account}
                    style={{ width: "1.1em", height: "1.1em", marginTop: "0.2em" }} />
                  <label className="form-check-label" htmlFor="recurringCheck" style={{ color: "#4a5568" }}>
                    Make recurring
                  </label>
                </div>

                <div className="form-check">
                  <input className="form-check-input" type="checkbox" name="isAllDay"
                    checked={eventData.isAllDay} onChange={handleChange}
                    id="allDayCheck" disabled={!account}
                    style={{ width: "1.1em", height: "1.1em", marginTop: "0.2em" }} />
                  <label className="form-check-label" htmlFor="allDayCheck" style={{ color: "#4a5568" }}>
                    All day
                  </label>
                </div>
              </div>

              {/* Date and Time */}
              <div className="d-flex align-items-center gap-3 mb-4" style={{ flexWrap: "nowrap" }}>
                <div>
                  <input type="date" className="form-control" name="startDate"
                    value={eventData.startDate} onChange={handleChange} required disabled={!account}
                    min={new Date().toISOString().split("T")[0]} />
                </div>
                <div style={{ flex: "0.5" }}>
                  <input type="time" className="form-control" name="startTime"
                    value={eventData.startTime} onChange={handleChange}
                    disabled={eventData.isAllDay || !account} />
                </div>
                <span style={{ color: "#718096", whiteSpace: "nowrap" }}>to</span>
                <div style={{ flex: "0.5" }}>
                  <input type="time" className="form-control" name="endTime"
                    value={eventData.endTime} onChange={handleChange}
                    disabled={eventData.isAllDay || !account} />
                </div>
              </div>

              {/* Subject */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568", fontSize: "24px" }}>Subject <span className="text-danger">*</span></label>
                <input type="text" className="form-control" placeholder="Teams meeting" name="title"
                  value={eventData.title} onChange={handleChange} required
                  style={{ borderRadius: "8px", padding: "0.75rem", border: "1px solid #cbd5e0", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)", transition: "all 0.2s ease" }} />
              </div>

              {/* Room */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568", fontSize: "24px" }}>
                  Location <span className="text-danger">*</span>
                </label>
                <select className="form-select" name="location" value={eventData.location} onChange={handleRoomSelect}
                  required disabled={!account}
                  style={{ borderRadius: "8px", padding: "0.75rem", border: "1px solid #cbd5e0", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)" }}>
                  <option value="">Select a room</option>
                  {rooms.map((room) => {
                    const status = roomAvailability[room.email];
                    let color = "black"; let indicator = "";
                    if (status === "available") { color = "green"; indicator = "✅ "; }
                    else if (status === "busy") { color = "red"; indicator = "❌ "; }
                    else { color = "gray"; indicator = "⌛ "; }
                    return (<option key={room.email} value={room.name} style={{ color }}>{indicator} {room.name}</option>);
                  })}
                </select>
                {isCheckingAvailability ? (
                  <div className="text-info mt-2">Checking room availability...</div>
                ) : (
                  eventData.roomEmail && (
                    <div className={`mt-2 ${roomAvailability[eventData.roomEmail] === "available" ? "text-success" : "text-danger"}`}>
                      {roomAvailability[eventData.roomEmail] === "available" ? "✅ This room is available."
                        : roomAvailability[eventData.roomEmail] === "busy" ? "❌ This room is busy. Please select another time or room."
                          : "Status unknown. Please check your time."}
                    </div>
                  )
                )}
              </div>

              {/* Attendees */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568", fontSize: "24px" }}>Attendees</label>
                <div className="attendee-input-container position-relative">
                  <input type="text" className="form-control" placeholder="Search for attendees by name or email"
                    name="attendees" disabled={!account} value={attendeeSearchTerm} onChange={handleChange}
                    style={{ borderRadius: "8px", padding: "0.75rem", border: "1px solid #cbd5e0", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)" }} />
                  {isFetchingUsers && <div className="spinner-border spinner-border-sm text-primary position-absolute end-0 top-50 translate-middle-y me-3" role="status"></div>}
                  {attendeeSuggestions.length > 0 && (
                    <ul className="list-group position-absolute w-100 mt-1" style={{ zIndex: 999 }}>
                      {attendeeSuggestions.map(user => (
                        <li key={user.id} className="list-group-item list-group-item-action"
                          onClick={(e) => { e.stopPropagation(); selectUser(user, true); }}
                          style={{ cursor: "pointer" }}>
                          {user.displayName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="mt-2 d-flex flex-wrap gap-2">
                  {attendeeList.map(attendee => (
                    <span key={attendee.mail} className="badge bg-secondary d-flex align-items-center me-1" style={{ fontSize: "1.2em", padding: "0.8em 0.85em", backgroundColor: "#0074bdff" }}>
                      {attendee.displayName}
                      <button type="button" className="btn-close btn-close-white ms-2" onClick={() => removeAttendee(attendee.mail)} aria-label="Remove" style={{ filter: "brightness(0) invert(1)" }}></button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568", fontSize: "24px" }}>Category</label>
                <select className="form-select" name="category" value={eventData.category} disabled={!account} onChange={handleChange}
                  style={{ borderRadius: "8px", padding: "0.75rem", border: "1px solid #cbd5e0", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)" }}>
                  <option value="Busy">Busy</option>
                  <option value="Free">Free</option>
                  <option value="Tentative">Tentative</option>
                </select>
              </div>

              {/* Reminder */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568", fontSize: "24px" }}>Reminder</label>
                <select className="form-select" name="reminder" value={eventData.reminder} disabled={!account} onChange={handleChange}
                  style={{ borderRadius: "8px", padding: "0.75rem", border: "1px solid #cbd5e0", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)" }}>
                  <option value="0">None</option>
                  <option value="5">5 minutes before</option>
                  <option value="10">10 minutes before</option>
                  <option value="15">15 minutes before</option>
                  <option value="30">30 minutes before</option>
                  <option value="60">1 hour before</option>
                </select>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568", fontSize: "24px" }}>Description</label>
                <textarea className="form-control" placeholder="Add a description..." name="description"
                  value={eventData.description} onChange={handleChange}
                  style={{ borderRadius: "8px", padding: "0.75rem", border: "1px solid #cbd5e0", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)", minHeight: "100px" }}></textarea>
              </div>

              {/* Footer Buttons */}
              <div className="modal-footer" style={{ borderTop: "none", padding: "1.5rem 0 0" }}>
                <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isLoading || !account}
                  style={{ backgroundColor: "transparent", backgroundImage: "linear-gradient(to right, #0074bd, #78b042)", borderColor: "#3182CE", color: "white" }}>
                  {isLoading ? (<><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Scheduling...</>) : "Schedule Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Recurrence Modal */}
      <RecurringEventModal
        show={showRecurrenceModal}
        onClose={() => setShowRecurrenceModal(false)}
        eventData={eventData}
        handleChange={handleChange}
        account={account}
      />
    </div>
  );
};

export default BookingComponent;
