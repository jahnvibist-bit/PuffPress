import HelpBot from "./components/HelpBot.jsx";
import { useState, useEffect, useRef, useCallback } from "react";
import "./PopupLayout.css";
import {
  getDevices,
  getFiles,
  getstorage,
  deleteFile, restoreFile, purgeFile,
  uploadFile,
  loginOwner,
  checkOwnerSession,
  createPairing,
  removeDevice,
  downloadFile,
  setDevicePriority,
  updateDeviceDetails,
  testBinaryStorage
} from "./api.js";
import { signUpUser, signOutUser, supabase } from "./supabase.js";
import DeviceConnection from "./components/DeviceConnection.jsx";
import "./App.css";
import PairCode from "./components/PairCode.jsx";
import "./components/PairingLayout.css";
import "./FormControls.css";
import FileList from "./components/FileList.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
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

  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
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
  const [qrFailed, setQrFailed] = useState(false);

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
  const [folders, setFolders] = useState([]);
  const [fileJobs, setFileJobs] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const jobIds = useRef(new Set());
  const [releaseNotice, setReleaseNotice] = useState("");
  const [removingDeviceId, setRemovingDeviceId] = useState(null);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupMode, setSignupMode] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [priorityBusy, setPriorityBusy] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("laptop");
  const [editBusy, setEditBusy] = useState(false);
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
        setReleaseNotice("");
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
      setFolders(fileData.folders || []);
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
        alert("📩 Check your email!\n\nWe've sent you a verification link. Please confirm your email before signing in.");
        setLoginError("");
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

  async function runFileJob(file, kind) {
    if (jobIds.current.has(file.id)) return;
    jobIds.current.add(file.id);
    const progress = percent => setFileJobs(jobs => ({...jobs, [file.id]: {kind, percent}}));
    progress(null);
    setFileErrors(errors => ({...errors, [file.id]: ""}));
    try {
      if (kind === "delete") {
        await deleteFile(file.id);
      } else if (kind === "restore") {
        await restoreFile(file.id);
      } else if (kind === "purge") {
        await purgeFile(file.id);
      } else {
        const blob = await downloadFile(file.id, progress);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name || "download.bin";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      setFileErrors(errors => ({...errors, [file.id]: err.message}));
    } finally {
      try {
        if (kind !== "download") await loadData();
      } finally {
        jobIds.current.delete(file.id);
        setFileJobs(jobs => {
          const next = {...jobs};
          delete next[file.id];
          return next;
        });
      }
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
  function openDeviceEdit(device) {
  setEditingDevice(device);
  setEditName(device.name);
  setEditType(
    device.device_type === "unknown" || !device.device_type
      ? "laptop"
      : device.device_type
  );
  setActiveModal("editDevice");
}

async function handleDeviceEdit() {
  if (!editingDevice || !editName.trim() || editBusy) return;

  setEditBusy(true);

  try {
    await updateDeviceDetails(
      editingDevice.id,
      editName.trim(),
      editType
    );

    await loadData();
    setActiveModal(null);
  } catch (err) {
    alert(err.message || "Device update failed");
  } finally {
    setEditBusy(false);
  }
}

  async function handleUpload() {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }

    if (selectedFile.size > Math.floor(availableStorage * 1024 ** 3)) {
      alert("This file exceeds the remaining shared space on your online devices.");
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
    setQrFailed(false);

    try {
      const data = await createPairing();

      if (!data?.pairing_id) {
        throw new Error("Backend did not return a pairing ID.");
      }
      setPairing(data);
      setActiveModal("pair");
    } catch (err) {
      setPairingError(err.message || "Could not generate pairing QR");
      alert(err.message || "Could not generate pairing QR");
    } finally {
      setPairingLoading(false);
    }
  }

  async function handleRemoveDevice(device) {
    const confirmed = window.confirm(
      `Remove "${device.name}" from PuffPress?\n\n` +
      "Removal is blocked if this device still holds file chunks."
    );
    if (!confirmed) return;

    setReleaseNotice("");
    setRemovingDeviceId(device.id);
    try {
      const result = await removeDevice(device.id);
      setReleaseNotice(`${result.name} removed. ${formatFileSize(result.released_allocation_bytes)} of shared capacity released. Stored file data at removal: 0 B.`);
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
  const availableStorage = devices
  .filter(device => device.status === "online")
  .reduce(
    (sum, device) =>
      sum + Math.max(0, Number(device.free_gb) || 0),
    0
  );
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
          <button className="auth-mode-button" type="button" onClick={() => { setSignupMode(!signupMode); setLoginError(""); }}>
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
        <div className="pp-profile-tools">
          <DeviceConnection device={devices.find(item => item.id === localStorage.getItem("puffpress-device-id"))}
            onPair={handleCreatePairing} pairingLoading={pairingLoading} />
        <button
          className="profile" aria-label={`Open profile for ${user}`}
          type="button"
          onClick={() => setActiveModal("profile")}
        >
          <span className="avatar">{user.charAt(0).toUpperCase()}</span>
          <span className="pp-profile-name">{user}</span>
        </button>
        </div>
      </header>

      <main className="dashboard-content">
        {!activeModal && <HelpBot page={activePage} />}
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
              <span className="file-count">{files.filter(file => file.status === "ready").length} files</span>
            </div>

            <FileList files={files} folders={folders} devices={devices} jobs={fileJobs}
              errors={fileErrors} runJob={runFileJob} reload={loadData} formatSize={formatFileSize} />
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
              Priority 1 is highest. For each new upload, the highest-ranked online device with enough space keeps every part. If no single device has room, the file is split across available devices. Changing priority applies to future uploads.
            </p>
            {releaseNotice && <p role="status">{releaseNotice}</p>}
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
                      {device.device_type === "laptop"
                    ? "💻"
                    : device.device_type === "phone"
                    ? "📱"
                    : device.device_type === "tablet"
                    ? "📲"
                    : "🖥️"}
                    </span>
                    <div>
                      <strong>{device.name}</strong>
                      <small>
                        {device.status} · Shared capacity: {formatFileSize(Math.round(device.total_gb * 1024 ** 3))}
                      </small>
                      <small>
                        File data stored: {formatFileSize(device.used_bytes)} · Unused allocation: {formatFileSize(Math.max(0, Math.round(device.total_gb * 1024 ** 3) - device.used_bytes))}
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
                          <option key={n} value={n}>{n === 1 ? "1 · Highest" : n === 5 ? "5 · Lowest" : n}</option>
                        ))}
                      </select>
                    </label>
                    <button
                    type="button"
                    className="icon-button"
                    title="Edit device"
                    aria-label={`Edit ${device.name}`}
                    onClick={() => openDeviceEdit(device)}
                    >
                    ✎
                    </button>
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
            <h2>How PuffPress works</h2>
            <ol className="pp-help-steps">
              <li><i aria-hidden="true">📱 ▦</i><strong>Pair a device</strong><small>Open Add Device and scan the QR code on the device sharing space.</small></li>
              <li><i aria-hidden="true">🟢 💻</i><strong>Switch ON</strong><small>Use the switch beside your name on the paired device. Keep its connected tab open.</small></li>
              <li><i aria-hidden="true">📄 → 💻</i><strong>Upload a file</strong><small>PuffPress splits it into parts and saves them on your connected devices.</small></li>
            </ol>
            <details><summary>How do I get my file back?</summary><p>Open My Files and choose Download. Devices holding the required parts must be online.</p></details>
            <details><summary>What happens when I switch OFF?</summary><p>This tab stops sharing storage. Its saved parts stay in this browser until deleted. Clearing site data can erase them.</p></details>
            <details><summary>How do I remove a device?</summary><p>Open Devices. You can remove a device once it no longer holds file parts.</p></details>
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
                    Available storage: {formatStorage(availableStorage)}
                  </small>
                  <small>Upload limit: {formatStorage(availableStorage)} remaining on online devices</small>
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
            {activeModal === "editDevice" && (
  <div className="edit-device-fields">
    <h2>✎ Edit Device</h2>

    <label htmlFor="edit-device-name">Device Name</label>
    <input id="edit-device-name"
      type="text"
      value={editName}
      maxLength={50}
      onChange={(e) => setEditName(e.target.value)}
    />

    <label htmlFor="edit-device-type">Device Type</label>
    <select id="edit-device-type"
      value={editType}
      onChange={(e) => setEditType(e.target.value)}
    >
      <option value="laptop">Laptop / PC</option>
      <option value="phone">Phone</option>
      <option value="tablet">Tablet</option>
    </select>

    <button className="primary-btn"
      type="button"
      disabled={editBusy || !editName.trim()}
      onClick={handleDeviceEdit}
    >
      {editBusy ? "Saving..." : "Save Changes"}
    </button>
  </div>
)}

            {activeModal === "pair" && (
              <>
                <h2>🐡 Pair a Device</h2>

                <p>
                  Scan the QR code on another device or open the pairing page on this device.
                </p>

{pairing?.pairing_id && (
  <div style={{ textAlign: "center", margin: "16px auto" }}>
    {pairing.qr_image ? (
      <img
        src={pairing.qr_image}
        alt="Device pairing QR"
        onLoad={() => setQrFailed(false)}
        onError={() => setQrFailed(true)}
        style={{
          width: 210,
          height: 210,
          display: "block",
          margin: "0 auto",
          background: "white",
          padding: 10,
          borderRadius: 14,
        }}
      />
    ) : (
      <p role="alert" style={{ color: "#b84c58" }}>
        QR image missing from backend response.
      </p>
    )}

    {qrFailed && (
      <p role="alert" style={{ color: "#b84c58" }}>
        QR image failed to load.
      </p>
    )}

    <PairCode key={pairing.pairing_id} code={pairing.passcode} />
    <a
      href={`/pair.html#pairing_id=${encodeURIComponent(pairing.pairing_id)}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        marginTop: 16,
        color: "#6366f1",
        textDecoration: "underline",
        fontWeight: 600,
      }}
    >
    Pair This Device
    </a>
  </div>
)}

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
