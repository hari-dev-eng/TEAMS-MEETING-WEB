class BookingDto {
  constructor(data) {
    this.title = data.title || "";
    this.description = data.description || "";
    this.startTime = data.startTime || new Date();
    this.endTime = data.endTime || new Date();
    this.location = data.location || "";
    this.attendees = data.attendees || [];
    this.UserEmail = data.UserEmail || "";
    this.RoomEmail = data.RoomEmail || "";
    this.category = data.category || "";
    this.reminder = data.reminder || "",
    this.isallday = data.isallday || "",
    this.isrecurring = data.isrecurring || ""
  }
}
