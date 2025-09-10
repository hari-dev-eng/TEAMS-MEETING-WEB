import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useMsal } from "@azure/msal-react";

// Predefined rooms with emails
const rooms = [
  { name: "Ground Floor Meeting Room", email: "gfmeeting@conservesolution.com" },
  { name: "1st Floor Meeting Room", email: "ffmeeting@conservesolution.com" },
  { name: "3rd Floor Meeting Room", email: "sfmeeting@conservesolution.com" },
  { name: "Conference Room", email: "contconference@conservesolution.com" },
];

// Define API_BASE_URL at the top level
const API_BASE_URL = "https://teamsbackendapi-production.up.railway.app";

// --- RecurringEventModal Component ---
const RecurringEventModal = ({ show, onClose, eventData, handleChange, account }) => {
  const [recurrenceData, setRecurrenceData] = useState({
    frequency: 'weekly',
    interval: 1,
    endOption: 'never',
    endDate: '',
    occurrences: 10
  });

  // Initialize modal with existing event data
  useEffect(() => {
    if (eventData.recurrence) {
      setRecurrenceData({
        frequency: eventData.recurrence.frequency || 'weekly',
        interval: eventData.recurrence.interval || 1,
        endOption: eventData.recurrence.endOption || 'never',
        endDate: eventData.recurrence.endDate || '',
        occurrences: eventData.recurrence.occurrences || 10
      });
    }
  }, [eventData, show]);

  // Handle recurrence option changes
  const handleRecurrenceChange = (e) => {
    const { name, value } = e.target;
    setRecurrenceData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save recurrence settings
  const handleSaveRecurrence = () => {
    handleChange({
      target: {
        name: 'recurrence',
        value: recurrenceData
      }
    });
    onClose();
  };

  // Calculate default end date (3 months from start)
  useEffect(() => {
    if (eventData.startDate && recurrenceData.endOption === 'date') {
      const startDate = new Date(eventData.startDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 3);

      const formattedDate = endDate.toISOString().split('T')[0];
      if (!recurrenceData.endDate) {
        setRecurrenceData(prev => ({
          ...prev,
          endDate: formattedDate
        }));
      }
    }
  }, [eventData.startDate, recurrenceData.endOption, recurrenceData.endDate]);

  // Auto-adjust end time when start time changes
  useEffect(() => {
    if (eventData.startTime && !eventData.endTime && !eventData.isAllDay) {
      const startTime = new Date(`2000-01-01T${eventData.startTime}`);
      startTime.setMinutes(startTime.getMinutes() + 30);

      const hours = startTime.getHours().toString().padStart(2, '0');
      const minutes = startTime.getMinutes().toString().padStart(2, '0');
      const newEndTime = `${hours}:${minutes}`;

      handleChange({
        target: {
          name: 'endTime',
          value: newEndTime
        }
      });
    }
  }, [eventData.startTime, eventData.isAllDay, eventData.endTime, handleChange]);

  if (!show) return null;

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      width: "Auto",
      height: "Auto"
    }}>
      <div className="modal-content-make-reccuring" style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        width: '400px',
        maxWidth: '90vw',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
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
            <input
              type="number"
              min="1"
              max="30"
              className="form-control"
              style={{
                width: '60px',
                marginRight: '10px',
                borderRadius: '4px',
                padding: '4px 8px',
                border: '1px solid #CBD5E0'
              }}
              name="interval"
              value={recurrenceData.interval}
              onChange={handleRecurrenceChange}
            />
            <select
              className="form-control"
              style={{
                borderRadius: '4px',
                padding: '4px 8px',
                border: '1px solid #CBD5E0'
              }}
              name="frequency"
              value={recurrenceData.frequency}
              onChange={handleRecurrenceChange}
            >
              <option value="daily">day(s)</option>
              <option value="weekly">week(s)</option>
              <option value="monthly">month(s)</option>
              <option value="yearly">year(s)</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ marginBottom: '8px', color: '#4A5568' }}>Occurs on</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, index) => (
                <div
                  key={day}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: recurrenceData.frequency === 'weekly' && index === 4 ? '#3182CE' : 'transparent',
                    color: recurrenceData.frequency === 'weekly' && index === 4 ? 'white' : '#4A5568',
                    border: '1px solid #CBD5E0',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ marginBottom: '8px', color: '#4A5568' }}>Ends</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <input
                  type="radio"
                  id="endNever"
                  name="endOption"
                  value="never"
                  checked={recurrenceData.endOption === 'never'}
                  onChange={handleRecurrenceChange}
                  style={{ marginRight: '8px' }}
                />
                <label htmlFor="endNever" style={{ color: '#4A5568' }}>Never</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <input
                  type="radio"
                  id="endDate"
                  name="endOption"
                  value="date"
                  checked={recurrenceData.endOption === 'date'}
                  onChange={handleRecurrenceChange}
                  style={{ marginRight: '8px' }}
                />
                <label htmlFor="endDate" style={{ color: '#4A5568', marginRight: '8px' }}>On</label>
                <input
                  type="date"
                  className="form-control"
                  style={{
                    borderRadius: '4px',
                    padding: '4px 8px',
                    border: '1px solid #CBD5E0',
                    width: '140px'
                  }}
                  name="endDate"
                  value={recurrenceData.endDate}
                  onChange={handleRecurrenceChange}
                  min={eventData.startDate}
                  disabled={recurrenceData.endOption !== 'date'}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="radio"
                  id="endAfter"
                  name="endOption"
                  value="after"
                  checked={recurrenceData.endOption === 'after'}
                  onChange={handleRecurrenceChange}
                  style={{ marginRight: '8px' }}
                />
                <label htmlFor="endAfter" style={{ color: '#4A5568', marginRight: '8px' }}>After</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="form-control"
                  style={{
                    width: '60px',
                    marginRight: '8px',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    border: '1px solid #CBD5E0'
                  }}
                  name="occurrences"
                  value={recurrenceData.occurrences}
                  onChange={handleRecurrenceChange}
                  disabled={recurrenceData.endOption !== 'after'}
                />
                <span style={{ color: '#4A5568' }}>occurrences</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #CBD5E0',
              backgroundColor: 'white',
              color: '#4A5568',
              cursor: 'pointer'
            }}
          >
            Discard
          </button>
          <button
            onClick={handleSaveRecurrence}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#3182CE',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// --- BookingComponent Component ---
const BookingComponent = ({ onClose, onSave }) => {
  const { instance: msalInstance, accounts } = useMsal();
  const [account, setAccount] = useState(null);
  const [ssoToken, setSsoToken] = useState(null);
  const [isInTeams, setIsInTeams] = useState(false);
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
    recurrence: null
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
  const [roomAvailability, setRoomAvailability] = useState({});
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const debounceTimeoutRef = useRef(null);
  const availabilityTimeoutRef = useRef(null);

  // Check if running in Teams
  useEffect(() => {
    const checkIfInTeams = () => {
      try {
        return (
          window.parent !== window.self ||
          window.name === "embedded-page-container" ||
          (window.location.ancestorOrigins &&
            window.location.ancestorOrigins[0] &&
            window.location.ancestorOrigins[0].includes("teams.microsoft.com"))
        );
      } catch (e) {
        return false;
      }
    };

    setIsInTeams(checkIfInTeams());
  }, []);

  // Get SSO token if in Teams
  useEffect(() => {
    const getSSOToken = async () => {
      if (!isInTeams) return;

      try {
        // This would typically use the Teams SDK to get the SSO token
        // For demonstration, we'll simulate this process
        const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setSsoToken(data.token);
        }
      } catch (error) {
        console.error("Failed to get SSO token:", error);
      }
    };

    if (isInTeams) {
      getSSOToken();
    }
  }, [isInTeams]);

  // Show alert message function
  const showAlertMessage = useCallback((message, type) => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 5000);
  }, []);

  // Check if account is from the correct domain
  const isWorkSchoolAccount = useCallback((email) => {
    return email && email.toLowerCase().endsWith('@conservesolution.com');
  }, []);

  const getAccessToken = useCallback(async () => {
    try {
      // If in Teams and we have an SSO token, use it
      if (isInTeams && ssoToken) {
        return ssoToken;
      }

      // Otherwise, use MSAL to get token
      if (account) {
        const silentRequest = {
          scopes: ["User.Read", "Calendars.ReadWrite", "People.Read", "Directory.Read.All"],
          account: account
        };

        try {
          const response = await msalInstance.acquireTokenSilent(silentRequest);
          return response.accessToken;
        } catch (silentError) {
          console.log("Silent token acquisition failed, using popup", silentError);
          const response = await msalInstance.acquireTokenPopup(silentRequest);
          return response.accessToken;
        }
      }

      // Fallback to backend token endpoint
      const response = await fetch(`${API_BASE_URL}/api/Bookings/GetAccessToken`);
      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.status}`);
      }
      const data = await response.json();
      return data.access_token || data.accessToken;
    } catch (error) {
      console.error("Error getting access token:", error);
      showAlertMessage("Failed to authenticate with Azure AD", "danger");
      return null;
    }
  }, [account, isInTeams, msalInstance, ssoToken, showAlertMessage]);

  // Function to check room availability
  const checkRoomAvailability = useCallback(async () => {
    if (!eventData.startDate || !eventData.startTime || !eventData.endTime) return;

    setIsCheckingAvailability(true);

    try {
      const token = await getAccessToken();
      if (!token) return;

      const startDateTime = new Date(`${eventData.startDate}T${eventData.startTime}`).toISOString();
      const endDateTime = new Date(`${eventData.startDate}T${eventData.endTime}`).toISOString();

      const availabilityResults = {};

      for (const room of rooms) {
        try {
          const response = await axios.get(
            `https://graph.microsoft.com/v1.0/users/${room.email}/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$select=id,subject,start,end`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          availabilityResults[room.email] = response.data.value.length > 0 ? "busy" : "available";
        } catch (err) {
          availabilityResults[room.email] = "unknown";
          console.error(`Error fetching ${room.email}:`, err);
        }
      }

      setRoomAvailability(availabilityResults);
    } catch (error) {
      console.error("Failed to fetch availability:", error);
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [eventData.startDate, eventData.startTime, eventData.endTime, getAccessToken]);

  useEffect(() => {
    if (eventData.startDate && eventData.startTime && eventData.endTime) {
      checkRoomAvailability();
    }
  }, [eventData.startDate, eventData.startTime, eventData.endTime, checkRoomAvailability]);

  // Function to fetch users from Azure AD
  const fetchUsers = useCallback(async (searchTerm = "", isAttendeeField = false) => {
    if (!searchTerm || searchTerm.length < 2) {
      if (isAttendeeField) {
        setAttendeeSuggestions([]);
      }
      return;
    }

    setIsFetchingUsers(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const encodedSearchTerm = encodeURIComponent(searchTerm);
      const filter = `startswith(mail,'${encodedSearchTerm}') or startswith(displayName,'${encodedSearchTerm}')`;
      const url = `https://graph.microsoft.com/v1.0/users?$filter=${filter}&$select=id,displayName,mail,userPrincipalName`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const users = response.data.value || [];

      if (isAttendeeField) {
        // Filter out users already added to the attendeeList
        const newSuggestions = users.filter(user =>
          !attendeeList.some(attendee => attendee.mail === user.mail)
        );
        setAttendeeSuggestions(newSuggestions);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
      }
      showAlertMessage("Failed to fetch users from directory", "danger");
    } finally {
      setIsFetchingUsers(false);
    }
  }, [getAccessToken, attendeeList, showAlertMessage]);

  const debouncedUserSearch = useCallback((searchTerm, isAttendeeField) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchUsers(searchTerm, isAttendeeField);
    }, 300);
  }, [fetchUsers]);

  // When MSAL context changes, sync account state
  useEffect(() => {
    if (accounts.length > 0) {
      const activeAccount = accounts[0];

      // Extract email from account - try multiple possible properties
      const userEmail = activeAccount.username ||
        activeAccount.userName ||
        (activeAccount.idTokenClaims && activeAccount.idTokenClaims.email) ||
        (activeAccount.idTokenClaims && activeAccount.idTokenClaims.preferred_username);

      if (userEmail && isWorkSchoolAccount(userEmail)) {
        setAccount(activeAccount);
        setEventData(prev => ({
          ...prev,
          userEmail: userEmail
        }));
        setIsValidEmail(true);
      } else {
        showAlertMessage("Please login with your official @conservesolution.com account.", "danger");
        setIsValidEmail(false);
      }
    } else {
      setAccount(null);
      setIsValidEmail(true);
    }
  }, [accounts, isWorkSchoolAccount, showAlertMessage]);

  useEffect(() => {
    const currentDebounceTimeout = debounceTimeoutRef.current;
    const currentAvailabilityTimeout = availabilityTimeoutRef.current;

    return () => {
      if (currentDebounceTimeout) {
        clearTimeout(currentDebounceTimeout);
      }
      if (currentAvailabilityTimeout) {
        clearTimeout(currentAvailabilityTimeout);
      }
    };
  }, []);

  const login = async () => {
    try {
      const loginRequest = {
        scopes: ["User.Read", "Calendars.ReadWrite", "People.Read", "Directory.Read.All"],
        prompt: "select_account"
      };

      console.log("Attempting login with MSAL");
      const loginResponse = await msalInstance.loginPopup(loginRequest);
      console.log("Login response received:", loginResponse);

      if (!loginResponse.account) {
        showAlertMessage("Login failed. No account information returned.", "danger");
        return;
      }

      const activeAccount = loginResponse.account;

      // Extract email from account - try multiple possible properties
      const userEmail = activeAccount.username ||
        activeAccount.userName ||
        (activeAccount.idTokenClaims && activeAccount.idTokenClaims.email) ||
        (activeAccount.idTokenClaims && activeAccount.idTokenClaims.preferred_username);

      if (!userEmail || !isWorkSchoolAccount(userEmail)) {
        showAlertMessage("Please login with your official @conservesolution.com account.", "danger");
        setIsValidEmail(false);
        // Sign out the non-work account
        msalInstance.logoutPopup();
        return;
      }

      // Set the active account
      msalInstance.setActiveAccount(activeAccount);
      setAccount(activeAccount);
      setEventData(prev => ({
        ...prev,
        userEmail: userEmail
      }));
      setIsValidEmail(true);
      showAlertMessage(`Welcome ${activeAccount.name}`, "success");
    } catch (err) {
      console.error("Login error:", err);

      if (err.errorCode === "user_cancelled") {
        showAlertMessage("Login was cancelled", "warning");
      } else if (err.errorCode === "login_failed") {
        showAlertMessage("Login failed. Please check your credentials and try again.", "danger");
      } else {
        showAlertMessage("Login failed. Please try again or contact support if the issue persists.", "danger");
      }
    }
  };

  //logout
  const logout = async () => {
    try {
      await msalInstance.logoutPopup({
        mainWindowRedirectUri: "/",
      });
      setAccount(null);
      setEventData(prev => ({
        ...prev,
        userEmail: ""
      }));
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

  const handleChange = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target;

      if (name === "reminder") {
        setEventData((prev) => ({
          ...prev,
          [name]: parseInt(value, 10),
        }));
      } else if (name === "attendees") {
        setAttendeeSearchTerm(value);
        debouncedUserSearch(value, true);
      } else if (name === "description") {
        setEventData((prev) => ({
          ...prev,
          [name]: value,
        }));
      } else if (name === "recurrence") {
        setEventData((prev) => ({
          ...prev,
          [name]: value,
        }));
      } else if (name === "startTime") {
        // Auto-update endTime +30 mins
        const [hours, minutes] = value.split(":").map(Number);
        const startDate = new Date();
        startDate.setHours(hours, minutes);

        const endDate = new Date(startDate.getTime() + 30 * 60000);
        const endHours = String(endDate.getHours()).padStart(2, "0");
        const endMinutes = String(endDate.getMinutes()).padStart(2, "0");

        setEventData((prev) => ({
          ...prev,
          startTime: value,
          endTime: `${endHours}:${endMinutes}`,
        }));
      } else {
        setEventData((prev) => ({
          ...prev,
          [name]: type === "checkbox" ? checked : value,
        }));
      }
    },
    [setEventData, setAttendeeSearchTerm, debouncedUserSearch]
  );

  const selectUser = (user, isAttendeeField = false) => {
    if (isAttendeeField) {
      // Add the selected user object to the attendeeList state
      setAttendeeList(prev => [...prev, user]);
      // Clear the search term and suggestions
      setAttendeeSearchTerm("");
      setAttendeeSuggestions([]);
    } else {
      setEventData(prev => ({
        ...prev,
        userEmail: user.mail
      }));
    }
  };

  const removeAttendee = (email) => {
    setAttendeeList(prev => prev.filter(attendee => attendee.mail !== email));
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setAttendeeSuggestions([]);
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // API call function
  const makeApiCall = async (requestBody) => {
    try {
      // Get access token for the API call
      const token = await getAccessToken();
      if (!token) {
        throw new Error("No access token available");
      }

      const response = await fetch(`${API_BASE_URL}/api/Bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  //single handle for signin and signout
  const handleAuthAction = () => {
    if (account) {
      logout();
    } else {
      login();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!eventData.title.trim()) {
      showAlertMessage("Event title is required", "danger");
      setIsLoading(false);
      return;
    }
    if (!eventData.startDate) {
      showAlertMessage("Start date is required", "danger");
      setIsLoading(false);
      return;
    }
    if (!eventData.userEmail) {
      showAlertMessage("User email is required", "danger");
      setIsLoading(false);
      return;
    }
    if (!eventData.roomEmail) {
      showAlertMessage("Please select a room", "danger");
      setIsLoading(false);
      return;
    }

    // Check if selected room is available
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
      const requestBody = {
        Title: eventData.title,
        Description: eventData.description || eventData.title,
        StartTime: new Date(`${eventData.startDate}T${eventData.startTime}`).toISOString(),
        EndTime: new Date(`${eventData.startDate}T${eventData.endTime}`).toISOString(),
        Location: eventData.location,
        UserEmail: eventData.userEmail,
        RoomEmail: eventData.roomEmail,
        Attendees: attendeeList.map(attendee => ({
          Name: attendee.displayName,
          Email: attendee.mail
        })),
        Category: eventData.category,
        Reminder: eventData.reminder,
        IsAllDay: eventData.isAllDay,
        IsRecurring: eventData.isRecurring,
        recurrence: eventData.isRecurring ? eventData.recurrence : null,
      };

      try {
        const apiResponse = await makeApiCall(requestBody);
        showAlertMessage(
          `Booking for "${eventData.title}" on ${eventData.startDate} at ${eventData.startTime} has been confirmed successfully.`,
          "success"
        );
        onSave({ ...eventData, apiResponse });
      } catch (apiError) {
        console.error("API Error:", apiError);
        showAlertMessage(
          apiError.message || "Failed to schedule the event due to a server error. Please try again.",
          "danger"
        );
      }
    } catch (error) {
      console.error("Unexpected Error:", error);
      showAlertMessage(
        "An unexpected error occurred while scheduling the event. Please check your inputs and try again.",
        "danger"
      );
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
          border: "none",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          overflow: "hidden",
          background: "transparent"
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

          {/* Header with Gradient */}
          <div className="modal-header text-white" style={{
            background: "linear-gradient(90deg, rgb(0, 116, 189), #76b042ff)",
            borderBottom: "none",
            padding: "1.2rem 1.5rem"
          }}>
            <h5 className="modal-title" style={{
              fontWeight: "600",
              textShadow: "0 1px 2px rgba(0,0,0,0.2)"
            }}>New Event Booking</h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              style={{ filter: "brightness(0) invert(1)" }}
            ></button>
          </div>
          <div
            className="modal-content"
            style={{
              background: "rgba(255, 255, 255, 1)", // semi-transparent white
              boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
              borderRadius: 0,
              border: "1.5px solid rgba(255,255,255,0.22)",
              backdropFilter: "blur(13px) saturate(140%)",
              WebkitBackdropFilter: "blur(13px) saturate(140%)",
              overflow: "hidden",
            }}
          >
            <div
              className="modal-body"
              style={{
                padding: "1.25rem 1.25rem 15px",
              }}
            >
              <form onSubmit={handleSubmit}>
                {/* ORGANIZER */}
                <div className="mb-3">
                  <label className="form-label fw-bold mb-1" style={{ color: "#193565ff", fontSize: "20px" }}>
                    Organizer <span className="text-danger">*</span>
                  </label>
                  {account ? (
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="email"
                        className="form-control"
                        value={eventData.userEmail}
                        readOnly
                        style={{
                          borderRadius: 8,
                          padding: "0.55rem 0.85rem",
                          //background: "#e9ecef",
                          color: "#6c757d",
                          fontSize: "15px",
                          border: "1px solid #e0e6ed",
                          minWidth: 0,
                          flex: 1,
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAuthAction}
                        className="btn btn-sm btn-outline-danger"
                        style={{ borderRadius: 7, padding: "0.5rem 1rem", fontWeight: 500, minWidth: 80 }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={login}
                        style={{
                          borderRadius: 17,
                          padding: "0.5rem 1.5rem",
                          fontWeight: 500,
                          fontSize: "16px"
                        }}
                      >
                        Sign In with Microsoft
                      </button>
                      <div
                        className="form-text mt-2"
                        style={{ fontSize: 15, marginBottom: 0, color: "#ff0000ff" }}
                      >
                        Only <strong>Conserve Solution</strong> domain will be allowed.
                      </div>

                      <div
                        className="form-text"
                        style={{ fontSize: 15, color: "#ff0000ff" }}
                      >
                        If you encounter issues, please try refreshing or contact{" "}
                        <strong>R&amp;D Conserve</strong>.
                      </div>

                    </div>
                  )}
                  {!isValidEmail && (
                    <div className="text-danger mt-1" style={{ fontSize: 14 }}>
                      Please sign in with a valid @conservesolution.com account
                    </div>
                  )}
                </div>

                {/* SUBJECT */}
                <div className="mb-3">
                  <label className="form-label fw-bold mb-1" style={{ color: "#193565ff", fontSize: "20px" }}>
                    Subject <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Teams meeting"
                    name="title"
                    value={eventData.title}
                    onChange={handleChange}
                    required
                    style={{
                      borderRadius: 8,
                      padding: "0.55rem 0.85rem",
                      fontSize: 15,
                      border: "5px solid #e0e6ed"
                    }}
                  />
                </div>

                {/* ATTENDEES */}
                <div className="mb-3">
                  <label className="form-label fw-bold mb-1" style={{ color: "#193565ff", fontSize: "20px" }}>
                    Attendees
                  </label>
                  <div className="attendee-input-container position-relative">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search for attendees by name or email"
                      name="attendees"
                      disabled={!account}
                      value={attendeeSearchTerm}
                      onChange={handleChange}
                      style={{
                        borderRadius: 8,
                        padding: "0.55rem 0.85rem",
                        fontSize: 15,
                        border: "5px solid #e0e6ed"
                      }}
                    />
                    {isFetchingUsers && <div className="spinner-border spinner-border-sm text-primary position-absolute end-0 top-50 translate-middle-y me-3"></div>}
                    {attendeeSuggestions.length > 0 && (
                      <ul className="list-group position-absolute w-100 mt-1" style={{ zIndex: 999 }}>
                        {attendeeSuggestions.map(user => (
                          <li
                            key={user.id}
                            className="list-group-item list-group-item-action"
                            onClick={e => {
                              e.stopPropagation();
                              selectUser(user, true);
                            }}
                            style={{ cursor: "pointer", fontSize: 15 }}
                          >
                            {user.displayName} ({user.mail})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mt-2 d-flex flex-wrap gap-2">
                    {attendeeList.map(attendee => (
                      <span key={attendee.mail} className="badge bg-secondary d-flex align-items-center me-1" style={{ fontSize: "0.95em", padding: "0.5em 0.75em" }}>
                        {attendee.displayName}
                        <button
                          type="button"
                          className="btn-close btn-close-white ms-2"
                          onClick={() => removeAttendee(attendee.mail)}
                          aria-label="Remove"
                          style={{ filter: "brightness(0) invert(1)" }}
                        ></button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* DATE & TIME */}
                <div className="mb-3">
                  <label className="form-label fw-bold mb-1" style={{ color: "#193565ff", fontSize: "20px" }}>
                    Date <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex align-items-center gap-3 flex-wrap" style={{ minHeight: 45, rowGap: 6 }}>
                    <input
                      type="date"
                      className="form-control"
                      name="startDate"
                      value={eventData.startDate}
                      onChange={handleChange}
                      required
                      disabled={!account}
                      min={new Date().toISOString().split("T")[0]}
                      style={{
                        borderRadius: 7,
                        padding: "0.45rem 0.7rem",
                        fontSize: 15,
                        border: "5px solid #e0e6ed",
                        width: 160
                      }}
                    />
                    <input
                      type="time"
                      className="form-control"
                      name="startTime"
                      value={eventData.startTime}
                      onChange={handleChange}
                      disabled={eventData.isAllDay || !account}
                      style={{
                        borderRadius: 7,
                        padding: "0.45rem 0.7rem",
                        fontSize: 15,
                        border: "5px solid #e0e6ed",
                        width: 110
                      }}
                    />
                    <span style={{ color: "#718096", fontSize: 16, minWidth: 20, textAlign: "center" }}>to</span>
                    <input
                      type="time"
                      className="form-control"
                      name="endTime"
                      value={eventData.endTime}
                      onChange={handleChange}
                      disabled={eventData.isAllDay || !account}
                      style={{
                        borderRadius: 7,
                        padding: "0.45rem 0.7rem",
                        fontSize: 15,
                        border: "5px solid #e0e6ed",
                        width: 110
                      }}
                    />
                    {/* Recurring/All Day */}
                    <div className="d-flex align-items-center gap-4 ms-3 flex-wrap">
                      <div className="form-check d-flex align-items-center mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          name="isRecurring"
                          checked={eventData.isRecurring}
                          onChange={e => {
                            handleChange(e);
                            if (e.target.checked) setShowRecurrenceModal(true);
                          }}
                          id="recurringCheck"
                          disabled={!account}
                          style={{
                            width: "1.7em",
                            height: "1.7em",
                            marginRight: "0.5em",
                            accentColor: "#78b042",
                          }}
                        />
                        <label className="form-check-label mb-0" htmlFor="recurringCheck" style={{ fontSize: 16, color: "#193565ff", fontWeight: 500 }}>
                          Make recurring
                        </label>
                      </div>
                      <div className="form-check d-flex align-items-center mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          name="isAllDay"
                          checked={eventData.isAllDay}
                          onChange={handleChange}
                          id="allDayCheck"
                          disabled={!account}
                          style={{
                            width: "1.7em",
                            height: "1.7em",
                            marginRight: "0.5em",
                            accentColor: "#0074bd",
                          }}
                        />
                        <label className="form-check-label mb-0" htmlFor="allDayCheck" style={{ fontSize: 16, color: "#193565ff", fontWeight: 500 }}>
                          All day
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* LOCATION */}
                <div className="mb-3">
                  <label className="form-label fw-bold mb-1" style={{ color: "#193565ff", fontSize: "20px" }}>
                    Location <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    name="location"
                    value={eventData.location}
                    onChange={handleRoomSelect}
                    required
                    disabled={!account}
                    style={{
                      borderRadius: 8,
                      padding: "0.6rem",
                      fontSize: 15,
                      border: "5px solid #e0e6ed"
                    }}
                  >
                    <option value="">Select a room</option>
                    {rooms.map(room => {
                      const status = roomAvailability[room.email];
                      let color = "black";
                      let indicator = "";
                      if (status === "available") { color = "green"; indicator = "✅ "; }
                      else if (status === "busy") { color = "red"; indicator = "❌ "; }
                      else { color = "gray"; indicator = "⌛ "; }
                      return (
                        <option key={room.email} value={room.name} style={{ color }}>
                          {indicator} {room.name}
                        </option>
                      );
                    })}
                  </select>
                  {isCheckingAvailability ? (
                    <div className="text-info mt-1" style={{ fontSize: 14 }}>Checking room availability...</div>
                  ) : eventData.roomEmail && (
                    <div
                      className={`mt-1 ${roomAvailability[eventData.roomEmail] === "available"
                        ? "text-success"
                        : "text-danger"
                        }`}
                      style={{ fontSize: 14 }}
                    >
                      {roomAvailability[eventData.roomEmail] === "available"
                        ? <>✅ This room is available.</>
                        : roomAvailability[eventData.roomEmail] === "busy"
                          ? <>❌ This room is busy. Please select another time or room.</>
                          : "Status unknown. Please check your time."}
                    </div>
                  )}
                </div>

                {/* CATEGORY */}
                <div className="mb-3">
                  <label className="form-label fw-bold mb-1" style={{ color: "#193565ff", fontSize: "20px" }}>
                    Response Option
                  </label>
                  <select
                    className="form-select"
                    name="category"
                    value={eventData.category}
                    disabled={!account}
                    onChange={handleChange}
                    style={{
                      borderRadius: 8,
                      padding: "0.6rem",
                      fontSize: 15,
                      border: "5px solid #e0e6ed"
                    }}
                  >
                    <option value="Busy">Busy</option>
                    <option value="Free">Free</option>
                    <option value="Tentative">Tentative</option>
                  </select>
                </div>

                {/* REMINDER */}
                <div className="mb-3">
                  <label className="form-label fw-bold mb-1" style={{ color: "#193565ff", fontSize: "20px" }}>
                    Reminder
                  </label>
                  <select
                    className="form-select"
                    name="reminder"
                    value={eventData.reminder}
                    disabled={!account}
                    onChange={handleChange}
                    style={{
                      borderRadius: 8,
                      padding: "0.6rem",
                      fontSize: 15,
                      border: "5px solid #e0e6ed"
                    }}
                  >
                    <option value="0">None</option>
                    <option value="5">5 minutes before</option>
                    <option value="10">10 minutes before</option>
                    <option value="15">15 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                  </select>
                </div>

                {/* DESCRIPTION */}
                <div className="mb-3">
                  <label className="form-label fw-bold mb-1" style={{ color: "#193565ff", fontSize: "20px" }}>
                    Description
                  </label>
                  <textarea
                    className="form-control"
                    placeholder="Add a description..."
                    name="description"
                    value={eventData.description}
                    onChange={handleChange}
                    style={{
                      borderRadius: 8,
                      padding: "0.75rem",
                      fontSize: 15,
                      border: "5px solid #e0e6ed",
                      minHeight: 95
                    }}
                  />
                </div>

                {/* BUTTONS */}
                <div
                  className="modal-footer px-0 pb-0 pt-3"
                  style={{ borderTop: "none",marginTop:"-20px", justifyContent: "flex-end" }}
                >
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn me-2"
                    style={{
                      borderRadius: 14,
                      minWidth: 90,
                      fontWeight: "bolder",
                      color: "#ff0000",
                      border: "4px solid rgba(255,0,0,1)",
                      background: "transparent",
                      pointerEvents: isLoading ? "none" : "auto",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.background = "transparent"; // prevent hover fill
                      e.target.style.color = "#ff0000";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.background = "transparent";
                      e.target.style.color = "#ff0000";
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary-2"
                    disabled={isLoading || !account}
                    style={{
                      borderRadius: 14,
                      minWidth: 140,
                      fontWeight: "bolder",
                      color: "rgba(13, 119, 25, 1)",
                      border: "4px solid rgba(13,119,25,1)",
                    }}
                  >
                    {isLoading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Scheduling...
                      </>
                    ) : (
                      "Schedule Event"
                    )}
                  </button>
                </div>
              </form>
            </div>
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