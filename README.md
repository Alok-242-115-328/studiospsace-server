# StudioSpace — Backend Server

This is the backend REST API for the **StudioSpace** platform, built with Node.js, Express.js, and MongoDB. It handles user authentication, studio CRUD operations, and the studio booking system.

## 🚀 Key Features
1. **Authentication:** Secure user registration and login using JWT (JSON Web Tokens) stored in HTTPOnly Cookies. Includes Real Google OAuth integration.
2. **Studio Management:** Full CRUD API for adding, fetching, updating, and deleting studio listings.
3. **Advanced Booking System:** Handles booking creation with default "Pending" status and allows status updates (Confirm/Cancel).
4. **Time Overlap Prevention (Challenge 2):** 
   - Verifies time overlap against existing "Confirmed" bookings in MongoDB.
   - Rejects overlapping reservations with a clear error message.
   - Automatically cancels conflicting pending bookings if someone else confirms the same slot first.
5. **Image Support:** Handles base64/image URL data from the frontend (ImgBB integration).

## 🛠️ Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB Atlas (Official MongoDB Node.js Driver)
- **Authentication:** JWT, bcryptjs, cookie-parser
- **Google Auth:** google-auth-library

## 💻 Local Setup Steps

### 1. Clone the repository
```bash
git clone https://github.com/Alok-242-115-328/studiospsace-server.git
cd studiospsace-server
