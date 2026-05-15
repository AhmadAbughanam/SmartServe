# Diagram Notes

These notes are derived from the supplied architecture and activity diagrams and are now reflected in the environment scaffold.

## High-Level Architecture

- client surfaces:
  customer web app, staff app, admin dashboard
- core backend:
  auth, order management, menu and pricing, payments, analytics
- realtime:
  websocket server over an event broker or queue
- intelligence:
  recommendations, forecasting, dynamic pricing, anomaly detection
- storage:
  PostgreSQL, Redis, object storage
- external dependencies:
  payment gateways and notification services

## Activity-Level Implications

- customer flow:
  QR entry, browse, customize, pay, receive realtime updates, feedback
- staff flow:
  dashboard auth, queue handling, table assignment, billing, delivery confirmation
- admin flow:
  menu, users, permissions, reports, integrations, configuration
- chatbot:
  answer when confident, escalate to staff when needed, keep logs
- recommendations:
  track browsing, display suggestions, learn from feedback

## What Changed in the Scaffold

- added local object storage via MinIO to `docker-compose.yml`
- added API module shells for the backend domains shown in the diagrams
- added adapter contracts for payments, notifications, eventing, storage, and AI
- added shared domain event types for realtime-oriented design
