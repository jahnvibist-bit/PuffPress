
// import { useState, useEffect, useRef, useCallback } from "react";
// import {
//   getDevices,
//   getFiles,
//   getstorage,
//   deleteFile,
//   uploadFile,
//   loginOwner,
//   checkOwnerSession,
// } from "./api.js";
// import "./App.css";

// const API_BASE = "/api";
// function formatStorage(gb) {
//   const value = Number(gb) || 0;

//   if (value <= 0) return "0 MB";

//   if (value < 0.01) {
//     return `${(value * 1024).toFixed(2)} MB`;
//   }

//   return `${value.toFixed(2)} GB`;
// }

// function formatFileSize(bytes) {
//   const value = Number(bytes) || 0;

//   if (value < 1024) return `${value} B`;
//   if (value < 1024 * 1024) {
//     return `${(value / 1024).toFixed(2)} KB`;
//   }

//   return `${(value / (1024 * 1024)).toFixed(2)} MB`;
// }

// function App() {
//   const [activePage, setActivePage] = useState("home");
//   const [pairing, setPairing] = useState(null);
//   const [pairingLoading, setPairingLoading] = useState(false);
//   const [pairingError, setPairingError] = useState("");

//   const [user, setUser] = useState(
//     () => localStorage.getItem("puffpress_name") || ""
//   );
//   const [name, setName] = useState("");

//   const [storage, setStorage] = useState(null);
//   const [devices, setDevices] = useState([]);
//   const [files, setFiles] = useState([]);

//   const [activeModal, setActiveModal] = useState(null);
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [isUploading, setIsUploading] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(null);
//   const [removingDeviceId, setRemovingDeviceId] = useState(null);
//   const [error, setError] = useState("");
//   const [authenticated, setAuthenticated] = useState(false);
//   const [checkingAuth, setCheckingAuth] = useState(true);
//   const [password, setPassword] = useState("");
//   const [loginError, setLoginError] = useState("");
//   const inputRef = useRef(null);
//   useEffect(() => {
//   checkOwnerSession()
//     .then(setAuthenticated)
//     .catch(() => setAuthenticated(false))
//     .finally(() => setCheckingAuth(false));
//   }, []);
//   const loadData = useCallback(async () => {
//     try {
//       const [storageData, deviceData, fileData] =
//         await Promise.all([
//           getstorage(),
//           getDevices(),
//           getFiles(),
//         ]);

//       setStorage(storageData);
//       setDevices(deviceData.devices || []);
//       setFiles(fileData.files || []);
//       setError("");
//     } catch (err) {
//       console.error("Loading error:", err);
//       setError("Could not connect to PuffPress backend.");
//     }
//   }, []);

//   useEffect(() => {
//     if (!user || !authenticated) return;

//     loadData();

//     const interval = setInterval(loadData, 15000);

//     const refreshOnFocus = () => {
//       loadData();
//     };

//     window.addEventListener("focus", refreshOnFocus);

//     return () => {
//       clearInterval(interval);
//       window.removeEventListener("focus", refreshOnFocus);
//     };
//   }, [user, authenticated, loadData]);
//   async function handleOwnerLogin(event) {
//     event.preventDefault();
//     setLoginError("");

//     try {
//       await loginOwner(password);
//       setAuthenticated(true);
//       setPassword("");
//     } catch (err) {
//       setLoginError(err.message || "Login failed");
//     }
//   }
//   function enterApp(event) {
//     event.preventDefault();

//     if (!name.trim()) return;

//     const cleanName = name.trim();
//     localStorage.setItem("puffpress_name", cleanName);
//     setUser(cleanName);
//   }

//   function logout() {
//     localStorage.removeItem("puffpress_name");
//     setUser("");
//     setActiveModal(null);
//   }

//   async function handleUpload() {
//     if (!selectedFile) {
//       alert("Please select a file first.");
//       return;
//     }

//     // Temporary safety limit until large-file
//     // streaming support is implemented.
//     if (selectedFile.size >= 5 * 1024 * 1024) {
//       alert("File must be smaller than 5 MB.");
//       return;
//     }

//     try {
//       setIsUploading(true);

//       const result = await uploadFile(selectedFile);

//       if (result.message !== "File uploaded successfully") {
//         throw new Error(result.detail || "Upload failed");
//       }

//       await loadData();
//       setSelectedFile(null);

//       if (inputRef.current) {
//         inputRef.current.value = "";
//       }

//       setActiveModal(null);
//     } catch (err) {
//       console.error("Upload error:", err);
//       alert(err.message || "Upload failed");
//     } finally {
//       setIsUploading(false);
//     }
//   }

//   async function handleCreatePairing() {
//     setPairingLoading(true);
//     setPairingError("");

//     try {
//       const response = await fetch(
//         `${API_BASE}/pairing/create`,
//         { method: "POST" }
//       );

//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.detail || "Pairing failed");
//       }

//       setPairing(data);
//       setActiveModal("pair");
//     } catch (err) {
//       setPairingError(err.message);
//       alert(err.message);
//     } finally {
//       setPairingLoading(false);
//     }
//   }

//   async function handleDelete(fileId) {
//     if (!window.confirm("Delete this file permanently?")) {
//       return;
//     }

//     try {
//       setIsDeleting(fileId);

//       const result = await deleteFile(fileId);

//       if (
//         result.message !==
//         "File and all distributed chunks deleted successfully"
//       ) {
//         throw new Error(result.detail || "Deletion failed");
//       }

//       await loadData();
//     } catch (err) {
//       console.error("Delete error:", err);
//       alert(err.message || "Could not delete file.");
//       await loadData();
//     } finally {
//       setIsDeleting(null);
//     }
//   }

//   async function handleRemoveDevice(device) {
//     const confirmed = window.confirm(
//       `Remove "${device.name}" from PuffPress?\n\n` +
//       "Removal is blocked if this device still holds file chunks."
//     );
//     if (!confirmed) return;

//     setRemovingDeviceId(device.id);
//     try {
//       const response = await fetch(
//         `${API_BASE}/devices/${encodeURIComponent(device.id)}`,
//         { method: "DELETE" }
//       );
//       const result = await response.json().catch(() => ({}));
//       if (!response.ok) {
//         throw new Error(result.detail || "Could not remove device.");
//       }
//       await loadData();
//     } catch (err) {
//       console.error("Remove device error:", err);
//       alert(err.message || "Device removal failed.");
//       await loadData();
//     } finally {
//       setRemovingDeviceId(null);
//     }
//   }

//   const total = Number(storage?.total_storage) || 0;
//   const used = Number(storage?.used_storage) || 0;
//   const free = Number(storage?.free_storage) || 0;

//   const percent =
//     total > 0
//       ? Math.min(100, Math.max(0, (used / total) * 100))
//       : 0;

//   // Show a minimum visible fill when storage is used.
//   // Actual storage percentage remains unchanged.
//   const visualPercent =
//     used > 0 ? Math.max(percent, 3) : 0;

//   const onlineDevices = devices.filter(
//     (device) =>
//       String(device.status).toLowerCase() === "online"
//   ).length;
//   if (checkingAuth) {
//   return <p>Checking PuffPress session...</p>;
// }

// if (!authenticated) {
//   return (
//     <div className="ocean-page welcome-page">
//       <section className="welcome-card sketch-card">
//         <div className="tape" />
//         <div className="mascot">🐡</div>
//         <h1>PuffPress</h1>
//         <p className="tagline">Your Files, Your Devices, Your Cloud.</p>

//         <h2>Welcome back!</h2>
//         <p>Enter your password to unlock your cloud.</p>

//         <form onSubmit={handleOwnerLogin}>
//           <label htmlFor="owner-password">Password</label>
//           <input
//             id="owner-password"
//             type="password"
//             value={password}
//             onChange={(event) => setPassword(event.target.value)}
//             placeholder="Enter your password"
//             required
//           />

//           {loginError && <p role="alert">{loginError}</p>}

//           <button className="primary-btn" type="submit">
//             Unlock PuffPress →
//           </button>
//         </form>
//       </section>
//     </div>
//   );
// }
//   if (!user) {
//     return (
//       <div className="ocean-page welcome-page">
//         <section className="welcome-card sketch-card">
//           <div className="tape" />

//           <div className="mascot">🐡</div>
//           <h1>PuffPress</h1>

//           <p className="tagline">
//             Your Files, Your Devices, Your Cloud.
//           </p>

//           <div className="sketch-wave">﹏﹏﹏﹏﹏</div>

//           <h2>Welcome aboard!</h2>
//           <p>Your little cloud is waiting for you.</p>

//           <form onSubmit={enterApp}>
//             <label htmlFor="username">
//               What should we call you?
//             </label>

//             <input
//               id="username"
//               type="text"
//               placeholder="Enter your name"
//               value={name}
//               onChange={(event) =>
//                 setName(event.target.value)
//               }
//               maxLength={40}
//               required
//             />

//             <button
//               className="primary-btn"
//               type="submit"
//             >
//               Enter My PuffPress →
//             </button>
//           </form>

//           <p className="tiny-note">
//             This is a display-name screen,
//             not secure authentication.
//           </p>
//         </section>

//         <span className="doodle doodle-one">✧</span>
//         <span className="doodle doodle-two">◌</span>
//         <span className="doodle doodle-three">✳</span>

//         <div className="ocean-floor">
//           ﹏﹏﹏﹏﹏﹏﹏﹏
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="ocean-page dashboard">
//       <aside className="notebook-sidebar">
//         <div className="spiral-binding" aria-hidden="true">
//           {Array.from({ length: 7 }, (_, index) => (
//             <span key={index} />
//           ))}
//         </div>

//         <div className="sidebar-brand">
//           <span>🐡</span>
//           <strong>PuffPress</strong>
//           <small>Your little cloud ☁</small>
//         </div>

//         <nav className="sidebar-links" aria-label="Main navigation">
//           {[
//             ["home", "⌂", "Home"],
//             ["files", "▤", "My Files"],
//             ["devices", "⌁", "Devices"],
//             ["help", "♡", "Help"],
//           ].map(([page, icon, label]) => (
//             <button
//               key={page}
//               type="button"
//               className={`sidebar-link ${activePage === page ? "active" : ""}`}
//               aria-current={activePage === page ? "page" : undefined}
//               onClick={() => setActivePage(page)}
//             >
//               <span aria-hidden="true">{icon}</span>
//               {label}
//             </button>
//           ))}
//         </nav>

//         <div className="sidebar-ocean" aria-hidden="true">
//           🐚 ﹏ 🪸
//         </div>
//       </aside>

//       <header className="topbar">
//         <div className="brand brand-with-greeting">
//           <span className="brand-fish">🐡</span>
//           <div className="brand-copy">
//             <span>PuffPress</span>
//             {activePage === "home" && (
//               <small>Hi, {user}! 👋 Your files, your devices, your cloud.</small>
//             )}
//           </div>
//         </div>
//         <button
//           className="profile"
//           type="button"
//           onClick={() => setActiveModal("profile")}
//         >
//           <span className="avatar">{user.charAt(0).toUpperCase()}</span>
//           {user}
//         </button>
//       </header>

//       <main className="dashboard-content">
//         {error && (
//           <p role="alert" style={{ color: "#b84c58" }}>
//             {error}
//           </p>
//         )}

//         {activePage === "home" && (
//           <>
//             <section className="overview-grid">
//               <div className="sketch-card storage-card">
//                 <div className="tape" />
//                 <div className="card-heading">
//                   <h2>▤ Your Storage</h2>
//                   <span className="storage-value">
//                     {formatStorage(used)} / {formatStorage(total)}
//                   </span>
//                 </div>
//                 <div className="progress-track">
//                   <div
//                     className="progress-fill"
//                     style={{
//                       width: `${visualPercent}%`,
//                       background: "#59B7D9",
//                       height: "100%",
//                       borderRadius: "999px",
//                       transition: "width 0.4s ease",
//                     }}
//                   />
//                 </div>
//                 <div className="storage-labels">
//                   <span>{formatStorage(used)} used</span>
//                   <span>{formatStorage(free)} free</span>
//                 </div>
//               </div>

//               <button
//                 type="button"
//                 className="sketch-card devices-summary"
//                 onClick={() => setActivePage("devices")}
//               >
//                 <span className="device-symbol">⌁</span>
//                 <span>
//                   <strong>Connected Devices</strong>
//                   <small>{onlineDevices} online right now</small>
//                 </span>
//                 <span className="device-count">{devices.length}</span>
//               </button>
//             </section>

//             <section className="bubble-section">
//               <p className="section-caption">What would you like to do?</p>
//               <div className="bubble-actions">
//                 <button
//                   type="button"
//                   className="action-bubble bubble-blue"
//                   onClick={() => setActiveModal("upload")}
//                 >
//                   <span className="bubble-icon">☁</span>
//                   <strong>Upload</strong>
//                   <small>Add a file</small>
//                 </button>

//                 <button
//                   type="button"
//                   className="action-bubble bubble-lavender"
//                   onClick={() => setActivePage("files")}
//                 >
//                   <span className="bubble-icon">▱</span>
//                   <strong>My Files</strong>
//                   <small>View files</small>
//                 </button>

//                 <button
//                   type="button"
//                   className="action-bubble bubble-mint"
//                   onClick={handleCreatePairing}
//                   disabled={pairingLoading}
//                 >
//                   <span className="bubble-icon">▦</span>
//                   <strong>Add Device</strong>
//                   <small>{pairingLoading ? "Generating..." : "Pair with QR"}</small>
//                 </button>
//               </div>
//             </section>
//           </>
//         )}

//         {activePage === "files" && (
//           <section id="my-files" className="sketch-card files-card">
//             <div className="tape tape-right" />
//             <div className="card-heading">
//               <h2>📁 My Files</h2>
//               <span className="file-count">{files.length} files</span>
//             </div>

//             {files.length === 0 ? (
//               <div className="empty-state">
//                 <span>🐚</span>
//                 <p>No files yet. Upload your first one from Home!</p>
//               </div>
//             ) : (
//               <div className="file-list">
//                 {files.map((file) => {
//                   const downloadUrl =
//                     `${API_BASE}/files/${encodeURIComponent(file.id)}/download`;
//                   return (
//                     <div className="file-row" key={file.id}>
//                       <span className="file-icon">📄</span>
//                       <div className="file-info">
//                         <strong>{file.name}</strong>
//                         <small>{formatFileSize(file.size)}</small>
//                       </div>
//                       <a
//                         className="icon-button"
//                         href={downloadUrl}
//                         title="Download"
//                         aria-label={`Download ${file.name}`}
//                         style={{
//                           display: "grid",
//                           placeItems: "center",
//                           textDecoration: "none",
//                         }}
//                       >
//                         ↓
//                       </a>
//                       <button
//                         type="button"
//                         className="icon-button delete-button"
//                         title="Delete"
//                         aria-label={`Delete ${file.name}`}
//                         disabled={isDeleting === file.id}
//                         onClick={() => handleDelete(file.id)}
//                       >
//                         {isDeleting === file.id ? "..." : "×"}
//                       </button>
//                     </div>
//                   );
//                 })}
//               </div>
//             )}
//           </section>
//         )}

//         {activePage === "devices" && (
//           <section className="sketch-card files-card">
//             <div className="tape" />
//             <div className="card-heading">
//               <h2>⌁ My Devices</h2>
//               <span className="file-count">{onlineDevices} online / {devices.length} total</span>
//             </div>
//             <p style={{ color: "#688ba0" }}>
//               Your connected storage team. A device with stored file chunks cannot be removed.
//             </p>
//             {devices.length === 0 ? (
//               <div className="empty-state">
//                 <span>🐚</span>
//                 <p>No devices yet. Use the mint Add Device bubble on Home.</p>
//               </div>
//             ) : (
//               <div className="device-page-list">
//                 {devices.map((device) => (
//                   <div className="modal-device" key={device.id}>
//                     <span aria-hidden="true">
//                       {device.url?.startsWith("browser://") ? "📱" : "💻"}
//                     </span>
//                     <div>
//                       <strong>{device.name}</strong>
//                       <small>
//                         {device.status} · {formatStorage(device.used_gb)} / {formatStorage(device.total_gb)}
//                       </small>
//                     </div>
//                     <button
//                       type="button"
//                       className="icon-button delete-button device-remove-button"
//                       title={`Remove ${device.name}`}
//                       aria-label={`Remove ${device.name}`}
//                       disabled={removingDeviceId !== null}
//                       onClick={() => handleRemoveDevice(device)}
//                     >
//                       {removingDeviceId === device.id ? "…" : "×"}
//                     </button>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </section>
//         )}

//         {activePage === "help" && (
//           <section className="sketch-card files-card help-page">
//             <div className="tape tape-right" />
//             <h2>♡ Help & How It Works</h2>
//             <p>🐡 Your files. Your devices. Your cloud.</p>
//             <h3>How do I add a device?</h3>
//             <p>
//               Go to Home, tap the mint Add Device bubble and scan its QR code on your phone.
//               The pairing code expires after five minutes.
//             </p>
//             <h3>How do I access my files?</h3>
//             <p>Open My Files to download or delete files stored across your devices.</p>
//             <h3>Can I remove a device?</h3>
//             <p>
//               Yes, from Devices. Removal is blocked when a device still holds file chunks,
//               so your stored data is not silently discarded.
//             </p>
//             <h3>Can devices connect over different networks?</h3>
//             <p>
//               Local pairing works with the current reachable backend. Secure remote access
//               across networks will require a publicly reachable HTTPS/WSS coordinator.
//             </p>
//           </section>
//         )}

//         <div className="bottom-doodles" aria-hidden="true">
//           <span>﹏﹏﹏</span>
//           <span>🐚 ◌ ✧ 🪸</span>
//           <span>﹏﹏﹏</span>
//         </div>
//       </main>

//       <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
//         {[
//           ["home", "⌂", "Home"],
//           ["files", "▤", "My Files"],
//           ["devices", "⌁", "Devices"],
//           ["help", "♡", "Help"],
//         ].map(([page, icon, label]) => (
//           <button
//             key={page}
//             type="button"
//             className={activePage === page ? "active" : ""}
//             aria-current={activePage === page ? "page" : undefined}
//             onClick={() => setActivePage(page)}
//           >
//             <span aria-hidden="true">{icon}</span>
//             <small>{label}</small>
//           </button>
//         ))}
//       </nav>

//       {activeModal && (
//         <div
//           className="modal-backdrop"
//           onClick={() => setActiveModal(null)}
//         >
//           <section
//             className="sketch-card modal-card"
//             role="dialog"
//             aria-modal="true"
//             aria-label="PuffPress dialog"
//             onClick={(event) =>
//               event.stopPropagation()
//             }
//           >
//             <button
//               className="modal-close"
//               onClick={() =>
//                 setActiveModal(null)
//               }
//               aria-label="Close"
//             >
//               ×
//             </button>

//             <div className="tape" />

//             {activeModal === "upload" && (
//               <>
//                 <h2>☁ Upload a File</h2>
//                 <p>
//                   Add something to your little cloud.
//                 </p>

//                 <label className="upload-zone">
//                   <span>☁ ↑</span>

//                   <strong>
//                     {selectedFile
//                       ? selectedFile.name
//                       : "Choose your file"}
//                   </strong>

//                   <small>
//                     Maximum file size: under 5 MB
//                   </small>

//                   <input
//                     type="file"
//                     ref={inputRef}
//                     onChange={(event) =>
//                       setSelectedFile(
//                         event.target.files?.[0] ||
//                           null
//                       )
//                     }
//                   />
//                 </label>

//                 <button
//                   className="primary-btn"
//                   onClick={handleUpload}
//                   disabled={isUploading}
//                 >
//                   {isUploading
//                     ? "Uploading..."
//                     : "Upload File"}
//                 </button>
//               </>
//             )}

//             {activeModal === "pair" && (
//               <>
//                 <h2>🐡 Pair a Device</h2>

//                 <p>
//                   Scan this QR code using your
//                   second device.
//                 </p>

//                 {pairing?.pairing_id && (
//                   <img
//                     src={`${API_BASE}/pairing/qr/${encodeURIComponent(pairing.pairing_id)}`}
//                     alt="Device pairing QR"
//                     style={{
//                       width: 210,
//                       height: 210,
//                       maxWidth: "100%",
//                       margin: "20px auto",
//                       display: "block",
//                       background: "white",
//                       padding: 10,
//                       borderRadius: 14,
//                     }}
//                   />
//                 )}

//                 <p>Your pairing code:</p>

//                 <div className="pair-code">
//                   {pairing?.passcode ??
//                     "Code unavailable"}
//                 </div>

//                 <p>
//                   Code expires after 5 minutes.
//                 </p>

//                 <button
//                   className="primary-btn"
//                   onClick={handleCreatePairing}
//                   disabled={pairingLoading}
//                 >
//                   {pairingLoading
//                     ? "Generating..."
//                     : "Generate New Code"}
//                 </button>

//                 {pairingError && (
//                   <p role="alert">
//                     {pairingError}
//                   </p>
//                 )}
//               </>
//             )}

//             {activeModal === "profile" && (
//               <>
//                 <div className="mascot">🐡</div>

//                 <h2>Hello, {user}!</h2>

//                 <p>
//                   Welcome to your little cloud.
//                 </p>

//                 <button
//                   className="primary-btn"
//                   onClick={logout}
//                 >
//                   Leave Dashboard
//                 </button>
//               </>
//             )}
//           </section>
//         </div>
//       )}
//     </div>
//   );
// }

// export default App;

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getDevices,
  getFiles,
  getstorage,
  deleteFile,
  uploadFile,
  loginOwner,
  checkOwnerSession,
  createPairing,
  removeDevice,
  downloadFile,
  setDevicePriority,
  testBinaryStorage
} from "./api.js";
import { signUpUser, signOutUser, supabase } from "./supabase.js";
import "./App.css";

const API_BASE = "";
function formatStorage(gb) {
  const value = Number(gb) || 0;

  if (value <= 0) return "0 MB";

  if (value < 0.01) {
    return `${(value * 1024).toFixed(2)} MB`;
  }

  return `${value.toFixed(2)} GB`;
}

function formatFileSize(bytes) {
  const value = Number(bytes) || 0;

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(2)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function App() {
  const [activePage, setActivePage] = useState("home");
  const [pairing, setPairing] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState("");

  const [user, setUser] = useState(
    () => localStorage.getItem("puffpress_name") || ""
  );
  const [name, setName] = useState("");

  const [storage, setStorage] = useState(null);
  const [devices, setDevices] = useState([]);
  const [files, setFiles] = useState([]);

  const [activeModal, setActiveModal] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [removingDeviceId, setRemovingDeviceId] = useState(null);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupMode, setSignupMode] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [priorityBusy, setPriorityBusy] = useState(null);
  const [loginError, setLoginError] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    checkOwnerSession()
      .then(setAuthenticated)
      .catch(() => setAuthenticated(false))
      .finally(() => setCheckingAuth(false));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session?.access_token));
      if (!session) {
        setStorage(null);
        setDevices([]);
        setFiles([]);
        setPairing(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const loadData = useCallback(async () => {
    try {
      const [storageData, deviceData, fileData] =
        await Promise.all([
          getstorage(),
          getDevices(),
          getFiles(),
        ]);

      setStorage(storageData);
      setDevices(deviceData.devices || []);
      setFiles(fileData.files || []);
      setError("");
    } catch (err) {
      console.error("Loading error:", err);
      setError("Could not connect to PuffPress backend.");
    }
  }, []);

  useEffect(() => {
    if (!user || !authenticated) return;

    loadData();

    const interval = setInterval(loadData, 15000);

    const refreshOnFocus = () => {
      loadData();
    };

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [user, authenticated, loadData]);
  async function handleOwnerLogin(event) {
    event.preventDefault();
    setLoginError("");

    setAuthBusy(true);
    try {
      if (signupMode) {
        const result = await signUpUser(email.trim(), password);
        if (!result.session) {
          setLoginError("Account created. Confirm your email, then sign in.");
          setSignupMode(false);
          return;
        }
      } else {
        await loginOwner(email.trim(), password);
      }
      setAuthenticated(true);
      setPassword("");
    } catch (err) {
      setLoginError(err.message || "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  }
  function enterApp(event) {
    event.preventDefault();

    if (!name.trim()) return;

    const cleanName = name.trim();
    localStorage.setItem("puffpress_name", cleanName);
    setUser(cleanName);
  }

  async function logout() {
    try {
      await signOutUser();
      localStorage.removeItem("puffpress_name");
      setUser("");
      setAuthenticated(false);
      setStorage(null);
      setDevices([]);
      setFiles([]);
      setActiveModal(null);
    } catch (err) {
      alert(err.message || "Sign out failed");
    }
  }

  async function handleDownload(file) {
    try {
      const blob = await downloadFile(file.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name || "download.bin";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(err.message || "Download failed");
    }
  }

  async function handlePriority(deviceId, priority) {
    setPriorityBusy(deviceId);
    try {
      await setDevicePriority(deviceId, Number(priority));
      await loadData();
    } catch (err) {
      alert(err.message || "Could not update priority");
    } finally {
      setPriorityBusy(null);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }

    // Temporary safety limit until large-file
    // streaming support is implemented.
    if (selectedFile.size >= 5 * 1024 * 1024) {
      alert("File must be smaller than 5 MB.");
      return;
    }

    try {
      setIsUploading(true);

      const result = await uploadFile(selectedFile);

      if (result.message !== "File uploaded successfully") {
        throw new Error(result.detail || "Upload failed");
      }

      await loadData();
      setSelectedFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      setActiveModal(null);
    } catch (err) {
      console.error("Upload error:", err);
      alert(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCreatePairing() {
    setPairingLoading(true);
    setPairingError("");

    try {
      const data = await createPairing();

      setPairing(data);
      setActiveModal("pair");
    } catch (err) {
      setPairingError(err.message);
      alert(err.message);
    } finally {
      setPairingLoading(false);
    }
  }

  async function handleDelete(fileId) {
    if (!window.confirm("Delete this file permanently?")) {
      return;
    }

    try {
      setIsDeleting(fileId);

      const result = await deleteFile(fileId);

      if (
        result.message !==
        "File and all distributed chunks deleted successfully"
      ) {
        throw new Error(result.detail || "Deletion failed");
      }

      await loadData();
    } catch (err) {
      console.error("Delete error:", err);
      alert(err.message || "Could not delete file.");
      await loadData();
    } finally {
      setIsDeleting(null);
    }
  }

  async function handleRemoveDevice(device) {
    const confirmed = window.confirm(
      `Remove "${device.name}" from PuffPress?\n\n` +
      "Removal is blocked if this device still holds file chunks."
    );
    if (!confirmed) return;

    setRemovingDeviceId(device.id);
    try {
      await removeDevice(device.id);
      await loadData();
    } catch (err) {
      console.error("Remove device error:", err);
      alert(err.message || "Device removal failed.");
      await loadData();
    } finally {
      setRemovingDeviceId(null);
    }
  }

  const total = Number(storage?.total_storage) || 0;
  const used = Number(storage?.used_storage) || 0;
  const free = Number(storage?.free_storage) || 0;

  const percent =
    total > 0
      ? Math.min(100, Math.max(0, (used / total) * 100))
      : 0;

  // Show a minimum visible fill when storage is used.
  // Actual storage percentage remains unchanged.
  const visualPercent =
    used > 0 ? Math.max(percent, 3) : 0;

  const onlineDevices = devices.filter(
    (device) =>
      String(device.status).toLowerCase() === "online"
  ).length;
  if (checkingAuth) {
  return <p>Checking PuffPress session...</p>;
}

if (!authenticated) {
  return (
    <div className="ocean-page welcome-page">
      <section className="welcome-card sketch-card">
        <div className="tape" />
        <div className="mascot">🐡</div>
        <h1>PuffPress</h1>
        <p className="tagline">Your Files, Your Devices, Your Cloud.</p>

        <h2>Welcome back!</h2>
        <p>{signupMode ? "Create your account" : "Sign in to your cloud"}</p>

        <form onSubmit={handleOwnerLogin}>
          <label htmlFor="account-email">Email</label>
          <input
            id="account-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <label htmlFor="owner-password">Password</label>
          <input
            id="owner-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />

          {loginError && <p role="alert">{loginError}</p>}

          <button className="primary-btn" type="submit" disabled={authBusy}>
            {authBusy ? "Please wait..." : signupMode ? "Create Account →" : "Sign In →"}
          </button>
          <button type="button" onClick={() => { setSignupMode(!signupMode); setLoginError(""); }}>
            {signupMode ? "Already have an account? Sign in" : "New here? Sign up"}
          </button>
        </form>
      </section>
    </div>
  );
}
  if (!user) {
    return (
      <div className="ocean-page welcome-page">
        <section className="welcome-card sketch-card">
          <div className="tape" />

          <div className="mascot">🐡</div>
          <h1>PuffPress</h1>

          <p className="tagline">
            Your Files, Your Devices, Your Cloud.
          </p>

          <div className="sketch-wave">﹏﹏﹏﹏﹏</div>

          <h2>Welcome aboard!</h2>
          <p>Your little cloud is waiting for you.</p>

          <form onSubmit={enterApp}>
            <label htmlFor="username">
              What should we call you?
            </label>

            <input
              id="username"
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              maxLength={40}
              required
            />

            <button
              className="primary-btn"
              type="submit"
            >
              Enter My PuffPress →
            </button>
          </form>

          <p className="tiny-note">
            This is a display-name screen,
            not secure authentication.
          </p>
        </section>

        <span className="doodle doodle-one">✧</span>
        <span className="doodle doodle-two">◌</span>
        <span className="doodle doodle-three">✳</span>

        <div className="ocean-floor">
          ﹏﹏﹏﹏﹏﹏﹏﹏
        </div>
      </div>
    );
  }

  return (
    <div className="ocean-page dashboard">
      <aside className="notebook-sidebar">
        <div className="spiral-binding" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} />
          ))}
        </div>

        <div className="sidebar-brand">
          <span>🐡</span>
          <strong>PuffPress</strong>
          <small>Your little cloud ☁</small>
        </div>

        <nav className="sidebar-links" aria-label="Main navigation">
          {[
            ["home", "⌂", "Home"],
            ["files", "▤", "My Files"],
            ["devices", "⌁", "Devices"],
            ["help", "♡", "Help"],
          ].map(([page, icon, label]) => (
            <button
              key={page}
              type="button"
              className={`sidebar-link ${activePage === page ? "active" : ""}`}
              aria-current={activePage === page ? "page" : undefined}
              onClick={() => setActivePage(page)}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-ocean" aria-hidden="true">
          🐚 ﹏ 🪸
        </div>
      </aside>

      <header className="topbar">
        <div className="brand brand-with-greeting">
          <span className="brand-fish">🐡</span>
          <div className="brand-copy">
            <span>PuffPress</span>
            {activePage === "home" && (
              <small>Hi, {user}! 👋 Your files, your devices, your cloud.</small>
            )}
          </div>
        </div>
        <button
          className="profile"
          type="button"
          onClick={() => setActiveModal("profile")}
        >
          <span className="avatar">{user.charAt(0).toUpperCase()}</span>
          {user}
        </button>
      </header>

      <main className="dashboard-content">
        {error && (
          <p role="alert" style={{ color: "#b84c58" }}>
            {error}
          </p>
        )}

        {activePage === "home" && (
          <>
            <section className="overview-grid">
              <div className="sketch-card storage-card">
                <div className="tape" />
                <div className="card-heading">
                  <h2>▤ Your Storage</h2>
                  <span className="storage-value">
                    {formatStorage(used)} / {formatStorage(total)}
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${visualPercent}%`,
                      background: "#59B7D9",
                      height: "100%",
                      borderRadius: "999px",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                <div className="storage-labels">
                  <span>{formatStorage(used)} used</span>
                  <span>{formatStorage(free)} free</span>
                </div>
              </div>

              <button
                type="button"
                className="sketch-card devices-summary"
                onClick={() => setActivePage("devices")}
              >
                <span className="device-symbol">⌁</span>
                <span>
                  <strong>Connected Devices</strong>
                  <small>{onlineDevices} online right now</small>
                </span>
                <span className="device-count">{devices.length}</span>
              </button>
            </section>
            <section className="bubble-section">
              <p className="section-caption">What would you like to do?</p>
              <div className="bubble-actions">
                <button
                  type="button"
                  className="action-bubble bubble-blue"
                  onClick={() => setActiveModal("upload")}
                >
                  <span className="bubble-icon">☁</span>
                  <strong>Upload</strong>
                  <small>Add a file</small>
                </button>

                <button
                  type="button"
                  className="action-bubble bubble-lavender"
                  onClick={() => setActivePage("files")}
                >
                  <span className="bubble-icon">▱</span>
                  <strong>My Files</strong>
                  <small>View files</small>
                </button>

                <button
                  type="button"
                  className="action-bubble bubble-mint"
                  onClick={handleCreatePairing}
                  disabled={pairingLoading}
                >
                  <span className="bubble-icon">▦</span>
                  <strong>Add Device</strong>
                  <small>{pairingLoading ? "Generating..." : "Pair with QR"}</small>
                </button>
              </div>
            </section>
          </>
        )}

        {activePage === "files" && (
          <section id="my-files" className="sketch-card files-card">
            <div className="tape tape-right" />
            <div className="card-heading">
              <h2>📁 My Files</h2>
              <span className="file-count">{files.length} files</span>
            </div>

            {files.length === 0 ? (
              <div className="empty-state">
                <span>🐚</span>
                <p>No files yet. Upload your first one from Home!</p>
              </div>
            ) : (
              <div className="file-list">
                {files.map((file) => {
                  return (
                    <div className="file-row" key={file.id}>
                      <span className="file-icon">📄</span>
                      <div className="file-info">
                        <strong>{file.name}</strong>
                        <small>{formatFileSize(file.size)}</small>
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        title="Download"
                        aria-label={`Download ${file.name}`}
                        onClick={() => handleDownload(file)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="icon-button delete-button"
                        title="Delete"
                        aria-label={`Delete ${file.name}`}
                        disabled={isDeleting === file.id}
                        onClick={() => handleDelete(file.id)}
                      >
                        {isDeleting === file.id ? "..." : "×"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activePage === "devices" && (
          <section className="sketch-card files-card">
            <div className="tape" />
            <div className="card-heading">
              <h2>⌁ My Devices</h2>
              <span className="file-count">{onlineDevices} online / {devices.length} total</span>
            </div>
            <p style={{ color: "#688ba0" }}>
              Your connected storage team. A device with stored file chunks cannot be removed.
            </p>
            {devices.length === 0 ? (
              <div className="empty-state">
                <span>🐚</span>
                <p>No devices yet. Use the mint Add Device bubble on Home.</p>
              </div>
            ) : (
              <div className="device-page-list">
                {devices.map((device) => (
                  <div className="modal-device" key={device.id}>
                    <span aria-hidden="true">
                      {device.url?.startsWith("browser://") ? "📱" : "💻"}
                    </span>
                    <div>
                      <strong>{device.name}</strong>
                      <small>
                        {device.status} · {formatStorage(device.used_gb)} / {formatStorage(device.total_gb)}
                      </small>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <small>Priority</small>
                      <select
                        aria-label={`Priority for ${device.name}`}
                        value={device.priority ?? 2}
                        disabled={priorityBusy === device.id}
                        onChange={(event) => handlePriority(device.id, event.target.value)}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="icon-button delete-button device-remove-button"
                      title={`Remove ${device.name}`}
                      aria-label={`Remove ${device.name}`}
                      disabled={removingDeviceId !== null}
                      onClick={() => handleRemoveDevice(device)}
                    >
                      {removingDeviceId === device.id ? "…" : "×"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activePage === "help" && (
          <section className="sketch-card files-card help-page">
            <div className="tape tape-right" />
            <h2>♡ Help & How It Works</h2>
            <p>🐡 Your files. Your devices. Your cloud.</p>
            <h3>How do I add a device?</h3>
            <p>
              Go to Home, tap the mint Add Device bubble and scan its QR code on your phone.
              The pairing code expires after five minutes.
            </p>
            <h3>How do I access my files?</h3>
            <p>Open My Files to download or delete files stored across your devices.</p>
            <h3>Can I remove a device?</h3>
            <p>
              Yes, from Devices. Removal is blocked when a device still holds file chunks,
              so your stored data is not silently discarded.
            </p>
            <h3>Can devices connect over different networks?</h3>
            <p>
              Local pairing works with the current reachable backend. Secure remote access
              across networks will require a publicly reachable HTTPS/WSS coordinator.
            </p>
          </section>
        )}

        <div className="bottom-doodles" aria-hidden="true">
          <span>﹏﹏﹏</span>
          <span>🐚 ◌ ✧ 🪸</span>
          <span>﹏﹏﹏</span>
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {[
          ["home", "⌂", "Home"],
          ["files", "▤", "My Files"],
          ["devices", "⌁", "Devices"],
          ["help", "♡", "Help"],
        ].map(([page, icon, label]) => (
          <button
            key={page}
            type="button"
            className={activePage === page ? "active" : ""}
            aria-current={activePage === page ? "page" : undefined}
            onClick={() => setActivePage(page)}
          >
            <span aria-hidden="true">{icon}</span>
            <small>{label}</small>
          </button>
        ))}
      </nav>

      {activeModal && (
        <div
          className="modal-backdrop"
          onClick={() => setActiveModal(null)}
        >
          <section
            className="sketch-card modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="PuffPress dialog"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="modal-close"
              onClick={() =>
                setActiveModal(null)
              }
              aria-label="Close"
            >
              ×
            </button>

            <div className="tape" />

            {activeModal === "upload" && (
              <>
                <h2>☁ Upload a File</h2>
                <p>
                  Add something to your little cloud.
                </p>

                <label className="upload-zone">
                  <span>☁ ↑</span>

                  <strong>
                    {selectedFile
                      ? selectedFile.name
                      : "Choose your file"}
                  </strong>

                  <small>
                    Maximum file size: under 5 MB
                  </small>

                  <input
                    type="file"
                    ref={inputRef}
                    onChange={(event) =>
                      setSelectedFile(
                        event.target.files?.[0] ||
                          null
                      )
                    }
                  />
                </label>

                <button
                  className="primary-btn"
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading
                    ? "Uploading..."
                    : "Upload File"}
                </button>
              </>
            )}

            {activeModal === "pair" && (
              <>
                <h2>🐡 Pair a Device</h2>

                <p>
                  Scan this QR code using your
                  second device.
                </p>

                {pairing?.pairing_id && (
                  <img
                    src={`${API_BASE}/pairing/qr/${encodeURIComponent(pairing.pairing_id)}`}
                    alt="Device pairing QR"
                    style={{
                      width: 210,
                      height: 210,
                      maxWidth: "100%",
                      margin: "20px auto",
                      display: "block",
                      background: "white",
                      padding: 10,
                      borderRadius: 14,
                    }}
                  />
                )}

                <p>Your pairing code:</p>

                <div className="pair-code">
                  {pairing?.passcode ??
                    "Code unavailable"}
                </div>

                <p>
                  Code expires after 5 minutes.
                </p>

                <button
                  className="primary-btn"
                  onClick={handleCreatePairing}
                  disabled={pairingLoading}
                >
                  {pairingLoading
                    ? "Generating..."
                    : "Generate New Code"}
                </button>

                {pairingError && (
                  <p role="alert">
                    {pairingError}
                  </p>
                )}
              </>
            )}

            {activeModal === "profile" && (
              <>
                <div className="mascot">🐡</div>

                <h2>Hello, {user}!</h2>

                <p>
                  Welcome to your little cloud.
                </p>

                <button
                  className="primary-btn"
                  onClick={logout}
                >
                  Leave Dashboard
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
