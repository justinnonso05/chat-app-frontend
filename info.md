# Project Master Document: PWA Local File Share & Chat Workspace
**Version:** 2.0 (Local-Only Pivot)
**Positioning:** The zero-install, cross-platform, browser-based alternative to Xender.

## 1. Executive Summary
This project is a lightweight Progressive Web Application (PWA) designed to facilitate high-speed, offline file sharing and real-time chat between users in the same physical space. It operates entirely over local Wi-Fi networks or mobile hotspots. By utilizing WebRTC, it completely bypasses cloud storage, saving 100% of mobile data. It requires zero app store installations and works seamlessly across iOS, Android, and desktop operating systems.

---

## 2. Core Competitive Advantages
* **Zero-Download Tax:** Operates entirely within the mobile browser (Safari/Chrome). No app store visits or massive downloads required to receive a file.
* **Cross-Platform Bridge:** Natively connects iPhones, Androids, and laptops without OS restrictions (solving the AirDrop limitation).
* **Collaborative Workspace:** Integrates a functional 3-person chat room alongside the file transfer, acting as a high-speed temporary Slack channel for local teams.
* **Premium & Ad-Free:** A sleek, developer-tool aesthetic (Tailwind CSS) free of the bloatware, push notifications, and video ads found in native apps like Xender.
* **Sandboxed Privacy:** Zero access to the user's broader device file system or contact book. 

---

## 3. System Architecture



The system operates strictly as a decentralized mesh network, using a central server only for the initial handshake.

* **Layer 1: The Matchmaker (FastAPI Signaling Server)**
  * Acts purely as a temporary switchboard. It holds WebSocket connections in RAM, groups users by Wi-Fi network/Room ID, and exchanges their WebRTC tokens. Once connected, the server is ignored.
* **Layer 2: The Data Bridge (WebRTC `RTCDataChannel`)**
  * The direct, horizontal connection between devices over the local router. Both JSON text strings (chat) and binary `ArrayBuffers` (files) travel through this single bidirectional pipe.
* **Layer 3: NAT Traversal (Google STUN)**
  * A micro-integration with `stun:stun.l.google.com:19302` allowing devices to discover their own local routing coordinates to establish the WebRTC bridge.

---

## 4. Technology Stack
* **Frontend:** Next.js (React), Tailwind CSS, configured as a Progressive Web App (PWA).
* **Backend (Signaling):** Python + FastAPI, `websockets`.
* **Networking:** Native JavaScript `WebSocket` and `WebRTC` APIs.
* **Storage:** Ephemeral. `localStorage` for text chat survival; temporary RAM (Blob) for file chunks.
* **Deployment:** Vercel (Frontend), Render or Railway (Backend).

---

## 5. Feature Specifications

### 5.1. Progressive Web App (PWA) Offline UI
* Users can "Add to Home Screen" to install the UI like a native app.
* Service Workers cache the HTML/CSS so the app interface loads instantly even if the user has their mobile data completely turned off.

### 5.2. Frictionless Onboarding & QR Pairing
* 100% anonymous usage. The browser generates a UUID; the user provides a temporary display name.
* **QR Code Joining:** The host creates a room, generating a large QR code on their screen. Friends scan it with their default phone camera to instantly open the web app and join the specific WebSocket room.

### 5.3. The 3-Person Sandbox (Rate Limiting & Stability)
* The FastAPI backend strictly caps rooms at a maximum of 3 active WebSocket connections.
* If a 4th person attempts to join via QR code or IP matching, the server rejects the connection to prevent mobile browser memory exhaustion.

### 5.4. High-Speed File Chunking & UI Feedback
* Next.js utilizes `FileReader` and `Blob.slice()` to chop heavy files into 64KB chunks for rapid WebRTC transit.
* **Speed Metrics:** The UI calculates and displays real-time transfer speeds (MB/s) and a dynamic progress bar.
* **Desktop Drag-and-Drop:** The UI includes a massive dropzone for laptop users to easily share bulk files to connected phones.

---

## 6. Security Protocol

* **End-to-End Encryption (E2EE):** All local data (files and text) is natively encrypted by WebRTC via DTLS/SRTP protocols.
* **Secure Context:** The Next.js frontend is served over standard HTTPS, which is a strict requirement for modern browsers to unlock camera access (QR scanning) and WebRTC data channels.
* **Ephemeral Memory:** No files or chat logs are ever saved to a cloud server. Once the browser tab is explicitly closed, the `localStorage` can be wiped, leaving zero trace of the session.

---

## 7. Lean Development Timeline (Estimated 4-5 Weeks)

### Phase 1: The Signaling Engine (Week 1)
* Initialize FastAPI and Next.js repositories.
* Build the Python `ConnectionManager` to handle WebSockets, group users by Room ID, and strictly enforce the 3-user maximum rule.

### Phase 2: WebRTC & Chat UI (Week 2)
* Write the JavaScript logic to exchange WebRTC SDP Offers and ICE candidates through the FastAPI server.
* Build the chat interface and route text JSON payloads through the `RTCDataChannel`.
* Implement `localStorage` to save text history against accidental page refreshes.

### Phase 3: P2P File Chunking (Week 3)
* Implement the file slicing algorithm.
* Transmit binary chunks over WebRTC and reassemble them on the receiver's end into downloadable Blobs.
* Add real-time MB/s speed calculations to the UI.

### Phase 4: PWA & QR Code Polish (Week 4)
* Configure Next.js as a PWA with a web manifest and offline service workers.
* Integrate a lightweight QR code generator library for the host, and a scanner for the joining peers.
* Final deployment and real-world hotspot testing.3