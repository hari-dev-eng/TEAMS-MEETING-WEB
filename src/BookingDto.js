class BookingDto {
  constructor(data) {
    this.title = data.title || "";
    this.description = data.description || "";
    this.startTime = data.startTime || new Date();
    this.endTime = data.endTime || new Date();
    this.location = data.location || "";
    this.attendees = data.attendees || [];
    this.userEmail = data.userEmail || "";
    this.roomEmail = data.roomEmail || "";
    this.category = data.category || "";
    this.reminder = data.reminder || 0;
    this.isAllDay = data.isAllDay || false;
    this.isRecurring = data.isRecurring || false;
  }
}