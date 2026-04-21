# Digital Internship Logbook Management System

This project is a comprehensive management system for tracking student internships, daily logs, and supervisor evaluations.

## Features
- **Role-Based Access Control**: Student, Agency Supervisor, Academic Supervisor, and Admin.
- **Daily Logbook**: Students can submit daily activities.
- **Supervisor Review**: Supervisors can approve/reject logs and provide feedback.
- **Admin Management**: Full user and system administration.
- **Real-time Updates**: Mock API integration with Express backend.

## Tech Stack
- **Frontend**: React JS, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend**: Express.js (Simulating Django REST Framework).
- **Database**: In-memory mock database (Simulating MySQL).

## How to Run
1. The system starts automatically in the AI Studio preview.
2. Use the following credentials to log in:
   - **Student**: `john@example.com` / `password123`
   - **Agency Supervisor**: `smith@agency.com` / `password123`
   - **Academic Supervisor**: `academic@uni.edu` / `password123`
   - **Admin**: `admin@system.com` / `password123`

## Project Structure
- `/src/pages`: Main dashboard views for each role.
- `/src/components`: Reusable UI components and Layout.
- `/src/services`: API communication layer.
- `server.ts`: Express backend serving the React app and API.
