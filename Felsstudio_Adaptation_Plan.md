# Felsstudio Adaptation Plan

This document outlines the architecture and necessary steps to adapt the **Felsstudio** application to integrate seamlessly with the newly decoupled backend API, **Felslager**.

## 1. Context & Motivation

Historically, crag data (JSON, images, GLB models) was stored directly inside the `Felsverzeichnis` repository. To update the data, Felsstudio users had to manually download a generated `.json` file and commit it to Git.

We have now moved the data storage to a remote API named **Felslager** (`fels-api`). This API acts as a centralized, agnostic file-system wrapper, eliminating the need for manual downloads and local file modifications.

**Felsstudio** must be refactored to act as a direct consumer of this API. It needs to read its data directly from Felslager and, most importantly, **push (Save) modifications back to the server securely**.

---

## 2. Felslager API Overview

Felslager is a lightweight Node.js/Express backend running on the VPS (`100.85.95.46`). It wraps the remote file system where the data is stored.

**Base URL:** `http://100.85.95.46:3001/api/fs` (or the equivalent domain once the reverse proxy is set up).

### Endpoints

*   **`GET /api/fs/<path>`**
    *   **Directory:** Returns a JSON array of contents (`{ name, path, type: 'file' | 'dir' }`). Pass `?recursive=true` to get a flat list of all sub-contents.
    *   **File:** Returns the raw file contents (JSON, GLB, JPG, etc.).
    *   *No authentication required.*

*   **`PUT /api/fs/<path>`**
    *   Uploads or overwrites the file at the specified `<path>`.
    *   Automatically creates missing parent directories.
    *   Accepts raw binary data, `multipart/form-data`, or JSON strings.
    *   **Authentication:** Requires **Basic Auth** (`Authorization: Basic <base64(user:pass)>`).

*   **`DELETE /api/fs/<path>`**
    *   Deletes a file or directory.
    *   **Authentication:** Requires **Basic Auth**.

---

## 3. Required Changes in Felsstudio

### A. Authentication UI
Since `PUT` and `DELETE` requests are protected by Basic Auth, Felsstudio must provide a way for the user (admin) to authenticate.
1.  **Add a settings/login modal** where the user can enter the `API_USER` and `API_PASSWORD`.
2.  Store these credentials securely in browser `localStorage` or `sessionStorage` (or memory, depending on security preference).
3.  Implement an API client utility that automatically attaches the `Authorization: Basic ...` header to outgoing `PUT` and `DELETE` requests.

### B. Replace Local File Loading with API Fetching
If Felsstudio currently loads its initial crag data from a local JSON file or a hardcoded list, it must be updated to fetch data directly from Felslager.
1.  On initialization, call `GET /api/fs/entries?recursive=true` to build the file tree.
2.  Dynamically fetch specific crag `.json` definitions using `GET /api/fs/entries/<path-to-crag.json>`.
3.  Update asset URLs (images, 3D models) to point to the Felslager API (e.g., `http://100.85.95.46:3001/api/fs/entries/...`).

### C. Implement the "Save to Felslager" Feature
The core requirement is to replace the "Download JSON" flow with a direct "Save" button.
1.  **UI Update:** Replace the "Download" button with a "Save Changes" button.
2.  **Save Logic:** When the user clicks "Save":
    *   Serialize the updated crag data into a JSON string.
    *   Send a `PUT` request to `/api/fs/entries/<path-to-crag.json>` with the JSON string as the request body.
    *   Include the `Authorization` header.
3.  **Feedback:** Show a loading spinner during the request and a success/error toast notification based on the response (`200 OK` vs. `403 Forbidden` / `500 Error`).

### D. Asset Uploading (Optional but Recommended)
If Felsstudio allows users to upload new topo images or 3D models:
1.  Capture the file via an `<input type="file">`.
2.  Send a `PUT /api/fs/entries/<path-to-asset>` with the raw file as the body (using a `Blob` or `ArrayBuffer`).

---

## 4. Next Steps for the Next Agent

1.  **Navigate to the Felsstudio Repository:** Change the working directory to `C:\Users\Robin\IdeaProjects\Felsstudio`.
2.  **Analyze the Codebase:** Find where the current "Save/Download" logic resides (likely in a central store or a main UI component).
3.  **Implement the API Client:** Create a generic wrapper around `fetch()` that handles the Basic Auth headers and points to the Felslager URL.
4.  **Refactor the Save Flow:** Replace the manual download logic with a `PUT` request to the API.
5.  **Test:** Run Felsstudio locally, point it to the remote VPS API, and verify that saving data successfully updates the live server!
