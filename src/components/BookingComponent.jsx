import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useMsal } from "@azure/msal-react";

// Predefined rooms with emails
const rooms = [
  { name: "Ground floor meeting room", email: "gfmeeting@conservesolution.com" },
  { name: "First floor meeting room", email: "ffmeeting@conservesolution.com" },
  { name: "Third floor meeting room", email: "sfmeeting@conservesolution.com" },
  { name: "Conference meeting room", email: "contconference@conservesolution.com" },
];

const BookingComponent = ({ onClose, onSave }) => {
  const { instance: msalInstance, accounts } = useMsal();
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
    reminder: "15 minutes before",
    description: ""
  });

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
      const response = await fetch("https://teamsbackendapi-production.up.railway.app/api/Bookings/GetAccessToken");
      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.status}`);
      }
      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error("Error getting access token:", error);
      showAlertMessage("Failed to authenticate with Azure AD", "danger");
      return null;
    }
  }, [showAlertMessage]);

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
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (availabilityTimeoutRef.current) {
        clearTimeout(availabilityTimeoutRef.current);
      }
    };
  }, []);

  const login = async () => {
    try {
      const loginRequest = {
        scopes: ["User.Read", "Calendars.ReadWrite"],
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
        mainWindowRedirectUri: "/", // you can change this to "/login" or homepage
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "reminder") {
      setEventData(prev => ({
        ...prev,
        [name]: parseInt(value) // Convert string to integer
      }));
    } else if (name === "attendees") {
      setAttendeeSearchTerm(value);
      debouncedUserSearch(value, true);
    } else if (name === "description") {
      setEventData(prev => ({
        ...prev,
        [name]: value
      }));
    } else {
      setEventData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

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
    const API_URL = "https://localhost:7141/api/Bookings";

    try {
      setIsLoading(true);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data;

    } finally {
      setIsLoading(false);
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

    if (!eventData.title.trim()) return showAlertMessage("Event title is required", "danger");
    if (!eventData.startDate) return showAlertMessage("Start date is required", "danger");
    if (!eventData.userEmail) return showAlertMessage("User email is required", "danger");
    if (!eventData.roomEmail) return showAlertMessage("Please select a room", "danger");

    // Check if selected room is available
    const selectedRoomStatus = roomAvailability[eventData.roomEmail];
    if (selectedRoomStatus === "busy") {
      return showAlertMessage("The selected room is not available at the chosen time. Please select a different time or room.", "danger");
    }

    const emailDomainRegex = /^[a-zA-Z0-9._%+-]+@conservesolution\.com$/;
    if (!emailDomainRegex.test(eventData.userEmail)) {
      return showAlertMessage("Please use a valid @conservesolution.com email address.", "danger");
    }

    const attendeeEmails = attendeeList.map(a => a.mail);
    const invalidAttendees = attendeeEmails.filter(a => !emailDomainRegex.test(a));

    if (invalidAttendees.length > 0) {
      return showAlertMessage(`These attendee emails are invalid: ${invalidAttendees.join(", ")}`, "danger");
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
      };
      try {
        const apiResponse = await makeApiCall(requestBody);
        showAlertMessage(
          `Booking for "${eventData.title}" on ${eventData.startDate} at ${eventData.startTime} has been confirmed successfully.`,
          "success"
        );
        onSave({ ...eventData, apiResponse });

      }
      catch (apiError) {
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
    }
  };

  // Function to get availability badge
  const getAvailabilityBadge = (roomEmail) => {
    const status = roomAvailability[roomEmail];

    if (status === "available") {
      return <span className="badge bg-success">Available</span>;
    } else if (status === "busy") {
      return <span className="badge bg-danger">Busy</span>;
    } else if (status === "unknown") {
      return <span className="badge bg-warning">Unknown</span>;
    } else {
      return <span className="badge bg-secondary">Checking...</span>;
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

          <div className="modal-body" style={{ padding: "1.5rem" }}>
            <form onSubmit={handleSubmit}>
              {/* User Email with login button */}
              <div className="mb-4 position-relative">
                <label className="form-label fw-bold" style={{ color: "#4a5568" }}>Your Email <span className="text-danger">*</span></label>
                {account ? (
                  <div className="d-flex align-items-center">
                    <input
                      type="email"
                      className="form-control"
                      value={eventData.userEmail}
                      readOnly
                      style={{
                        borderRadius: "8px",
                        padding: "0.75rem",
                        border: "1px solid #cbd5e0",
                        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                        backgroundColor: "#f8f9fa",
                        marginRight: "10px"
                      }}
                    />

                    <button type="button"
                      onClick={handleAuthAction}
                      className={`btn btn-sm ${account ? "btn-outline-danger" : "btn-success"}`}
                      style={{
                        borderRadius: "8px",
                        padding: "0.6rem 1.2rem",
                        fontWeight: "500"
                      }}
                    >
                      {account ? "Remove" : "Sign In with Microsoft"}
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={login}
                      style={{
                        borderRadius: "8px",
                        padding: "0.75rem 1.5rem",
                        fontWeight: "500"
                      }}
                    >
                      Sign In with Microsoft
                    </button>
                    <div className="form-text text-muted mt-2">
                      Only Conserve Solution domain will be allowed
                    </div>
                    <div className="form-text text-muted mt-1">
                      If you encounter issues, please try refreshing the page or contact R&D Conserve.
                    </div>
                  </div>
                )}
                {!isValidEmail && (
                  <div className="text-danger mt-2">
                    Please sign in with a valid @conservesolution.com account
                  </div>
                )}
              </div>

              {/* Event title */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568" }}>Add a title <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Teams meeting"
                  name="title"
                  value={eventData.title}
                  onChange={handleChange}
                  required
                  style={{
                    borderRadius: "8px",
                    padding: "0.75rem",
                    border: "1px solid #cbd5e0",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                    transition: "all 0.2s ease"
                  }}
                />
              </div>

              {/* Additional attendees with suggestions and "chip" display */}
              <div className="mb-4 position-relative">
                <label className="form-label fw-bold" style={{ color: "#4a5568" }}>Additional attendees</label>
                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  padding: "0.75rem",
                  border: "1px solid #cbd5e0",
                  borderRadius: "8px",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                  background: "white"
                }}>
                  {attendeeList.map((attendee) => (
                    <span key={attendee.mail} className="badge bg-primary d-flex align-items-center fs 12" style={{ padding: "0.5em 0.8em", fontSize: '14px', borderRadius: "16px", fontWeight: "400" }}>
                      {attendee.displayName}
                      <button type="button" className="btn-close btn-close-white ms-2" onClick={() => removeAttendee(attendee.mail)} style={{ fontSize: "0.6rem" }}></button>
                    </span>
                  ))}
                  <input
                    type="text"
                    className="form-control flex-grow-1"
                    placeholder="Start typing to search users..."
                    name="attendees"
                    value={attendeeSearchTerm}
                    onChange={handleChange}
                    onClick={(e) => e.stopPropagation()}
                    disabled={!account} // Disable if not signed in
                    style={{
                      border: "none",
                      boxShadow: "none",
                      background: "transparent",
                      padding: "0",
                      flex: "1",
                      minWidth: "150px"
                    }}
                  />
                </div>
                {attendeeSuggestions.length > 0 && (
                  <div className="position-absolute w-100" style={{ zIndex: 10, maxHeight: "200px", overflowY: "auto" }}>
                    <div className="list-group" style={{ borderRadius: "8px", border: "1px solid #cbd5e0", marginTop: "2px" }}>
                      {attendeeSuggestions.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          className="list-group-item list-group-item-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectUser(user, true);
                          }}
                          style={{ fontSize: "0.9rem", padding: "0.5rem 0.75rem" }}
                        >
                          <div className="fw-bold">{user.displayName}</div>
                          <div className="text-muted">{user.mail}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {isFetchingUsers && (
                  <div className="position-absolute" style={{ right: "10px", top: "40px" }}>
                    <div className="spinner-border spinner-border-sm" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                )}
                {!account && (
                  <>
                    <div className="form-text text-muted mt-2">
                      Only @conservesolution.com accounts are allowed
                    </div>
                    <div className="form-text text-muted mt-1">
                      If you encounter issues, please try refreshing the page or contact support.
                    </div>
                  </>
                )}
              </div>

              {/* Date and time */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568" }}>Date & Time <span className="text-danger">*</span></label>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <input
                    type="date"
                    className="form-control"
                    style={{
                      width: "140px",
                      borderRadius: "8px",
                      padding: "0.5rem",
                      border: "1px solid #cbd5e0",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)"
                    }}
                    name="startDate"
                    value={eventData.startDate}
                    onChange={handleChange}
                    required
                    disabled={!account} // Disable if not signed in
                  />
                  <input
                    type="time"
                    className="form-control"
                    style={{
                      width: "100px",
                      borderRadius: "8px",
                      padding: "0.5rem",
                      border: "1px solid #cbd5e0",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)"
                    }}
                    name="startTime"
                    value={eventData.startTime}
                    onChange={handleChange}
                    disabled={eventData.isAllDay || !account} // Disable if not signed in
                  />
                  <span style={{ color: "#718096" }}>to</span>
                  <input
                    type="time"
                    className="form-control"
                    style={{
                      width: "100px",
                      borderRadius: "8px",
                      padding: "0.5rem",
                      border: "1px solid #cbd5e0",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)"
                    }}
                    name="endTime"
                    value={eventData.endTime}
                    onChange={handleChange}
                    disabled={eventData.isAllDay || !account} // Disable if not signed in
                  />
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="isRecurring"
                      checked={eventData.isRecurring}
                      onChange={handleChange}
                      id="recurringCheck"
                      disabled={!account} // Disable if not signed in
                      style={{
                        width: "1.1em",
                        height: "1.1em",
                        marginTop: "0.2em"
                      }}
                    />
                    <label className="form-check-label" htmlFor="recurringCheck" style={{ color: "#4a5568" }}>
                      Make recurring
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="isAllDay"
                      checked={eventData.isAllDay}
                      onChange={handleChange}
                      id="allDayCheck"
                      disabled={!account} // Disable if not signed in
                      style={{
                        width: "1.1em",
                        height: "1.1em",
                        marginTop: "0.2em"
                      }}
                    />
                    <label className="form-check-label" htmlFor="allDayCheck" style={{ color: "#4a5568" }}>
                      All day
                    </label>
                  </div>
                </div>
                {isCheckingAvailability && (
                  <div className="mt-2 text-muted">
                    <small>Checking room availability...</small>
                  </div>
                )}
              </div>

              {/* Room selection */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568" }}>
                  Select a room <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  value={eventData.location}
                  onChange={handleRoomSelect}
                  required
                  disabled={!account || isCheckingAvailability}
                  style={{
                    borderRadius: "8px",
                    padding: "0.75rem",
                    border: "1px solid #cbd5e0",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                    background: "white"
                  }}
                >
                  <option value="">Select a room</option>
                  {rooms.map(room => {
                    const status = roomAvailability[room.email] || "checking";

                    let statusText = "";
                    let statusColor = "";
                    if (status === "available") {
                      statusText = "Available";
                      statusColor = "🟢"; 
                    } else if (status === "busy") {
                      statusText = "Busy";
                      statusColor = "🔴"; 
                    } else if (status === "unknown") {
                      statusText = "Unknown";
                      statusColor = "⚪"; 
                    } else {
                      statusText = "Checking...";
                      statusColor = "🔄"; 
                    }

                    return (
                      <option key={room.email} value={room.name}>
                        {statusColor} {room.name} – {statusText}
                      </option>
                    );
                  })}

                </select>
                <div className="mt-2">
                  <small className="text-muted">
                    Availability is based on the selected date and time
                  </small>
                </div>
              </div>

              {/* Response options */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568" }}>Response options</label>
                <div className="d-flex flex-wrap gap-2">
                  <select
                    className="form-select"
                    style={{
                      width: "120px",
                      borderRadius: "8px",
                      padding: "0.5rem",
                      border: "1px solid #cbd5e0",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                      background: "white"
                    }}
                    name="category"
                    value={eventData.category}
                    onChange={handleChange}
                    disabled={!account} // Disable if not signed in
                  >
                    <option value="Busy">Busy</option>
                    <option value="Free">Free</option>
                    <option value="Tentative">Tentative</option>
                    <option value="Out Of Office">Out of office</option>
                  </select>
                  <select
                    className="form-select"
                    style={{
                      width: "160px",
                      borderRadius: "8px",
                      padding: "0.5rem",
                      border: "1px solid #cbd5e0",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                      background: "white"
                    }}
                    name="reminder"
                    value={eventData.reminder}
                    onChange={handleChange}
                    disabled={!account}
                  >
                    <option value="0">None</option>
                    <option value="5">5 minutes before</option>
                    <option value="10">10 minutes before</option>
                    <option value="15">15 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="form-label fw-bold" style={{ color: "#4a5568" }}>Description</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Type / to insert files and more"
                  name="description"
                  value={eventData.description}
                  onChange={handleChange}
                  style={{
                    borderRadius: "8px",
                    padding: "0.75rem",
                    border: "1px solid #cbd5e0",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                    transition: "all 0.2s ease"
                  }}
                  disabled={!account} // Disable if not signed in
                ></textarea>
              </div>
            </form>
          </div>
          <div className="modal-footer" style={{
            borderTop: "1px solid #e2e8f0",
            padding: "1.2rem 1.5rem"
          }}>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={isLoading}
              style={{
                background: "linear-gradient(135deg, #edf2f7 0%, #e2e8f0 100%)",
                color: "#4a5568",
                border: "none",
                borderRadius: "8px",
                padding: "0.6rem 1.2rem",
                fontWeight: "500",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                opacity: isLoading ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn text-white"
              onClick={handleSubmit}
              disabled={isLoading || !account} // Disable if not signed in
              style={{
                background: isLoading || !account
                  ? "linear-gradient(135deg, #a0aec0 0%, #718096 100%)"
                  : "linear-gradient(90deg, #0074bdff, rgb(118, 176, 66))",
                border: "none",
                borderRadius: "8px",
                padding: "0.6rem 1.2rem",
                fontWeight: "500",
                boxShadow: "0 4px 6px rgba(102, 126, 234, 0.4)",
                position: "relative"
              }}
            >
              {isLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                    style={{
                      marginRight: "8px"
                    }}
                  ></span>
                  Scheduling...
                </>
              ) : (
                account ? "Schedule" : "Please Sign In"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingComponent;