
// // this is for practicing fetch
// // fetch will send HTTP requests
// // .json() converts response data into a JavaScript object

// // Automatically use the same hostname as the frontend
// const API_BASE = "";
// export async function loginOwner(password) {
//   const res = await fetch(`${API_BASE}/auth/login`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     credentials: "same-origin",
//     body: JSON.stringify({ password }),
//   });

//   const data = await res.json();

//   if (!res.ok) {
//     throw new Error(data.detail || "Login failed");
//   }

//   return data;
// }

// export async function checkOwnerSession() {
//   const res = await fetch(`${API_BASE}/auth/check`, {
//     credentials: "same-origin",
//   });

//   return res.ok;
// }
// // Register a device
// export async function registerDevice(deviceName, deviceUrl, allocatedGb) {
//   const response = await fetch(`${API_BASE}/devices/register`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       id: crypto.randomUUID(),
//       name: deviceName,
//       url: deviceUrl,
//       total_gb: Number(allocatedGb),
//     }),
//   });

//   const data = await response.json();

//   if (!response.ok) {
//     throw new Error(
//       typeof data.detail === "string"
//         ? data.detail
//         : "Device registration failed"
//     );
//   }

//   return data;
// }

// // Get dashboard storage
// export async function getstorage() {
//   const res = await fetch(`${API_BASE}/storage`);
//   const data = await res.json();
//   return data;
// }

// // Get registered devices
// export async function getDevices() {
//   const res = await fetch(`${API_BASE}/devices`);
//   const data = await res.json();
//   return data;
// }

// // Get all files
// export async function getFiles() {
//   const res = await fetch(`${API_BASE}/files`);
//   const data = await res.json();
//   return data;
// }

// // Delete a file
// export async function deleteFile(fileId) {
//   const res = await fetch(`${API_BASE}/files/${fileId}`, {
//     method: "DELETE",
//   });

//   const data = await res.json();
//   return data;
// }

// // Upload a file
// export async function uploadFile(selectedFile) {
//   const formData = new FormData();
//   formData.append("file", selectedFile);

//   const res = await fetch(`${API_BASE}/upload`, {
//     method: "POST",
//     body: formData,
//   });

//   const data = await res.json();

//   if (!res.ok) {
//     throw new Error(data.detail);
//   }

//   return data;
// }

import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function apiFetch(path, options = {}) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Please sign in");
  }

  const headers = new Headers(options.headers || {});

  headers.set(
    "Authorization",
    `Bearer ${session.access_token}`
  );

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `Request failed (${res.status})`
    );
  }

  return data;
}

export async function loginOwner(email, password) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) throw error;

  return { message: "Login successful" };
}

export async function checkOwnerSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return !!session?.access_token;
}

export async function registerDevice(
  deviceName,
  deviceUrl,
  allocatedGb
) {
  return apiFetch("/devices/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      name: deviceName,
      url: deviceUrl,
      total_gb: Number(allocatedGb),
    }),
  });
}
export const testBinaryStorage = (deviceId) =>
  apiFetch(`/test-binary-storage/${encodeURIComponent(deviceId)}`, {
    method: "POST",
  });

export const getstorage = () => apiFetch("/storage");

export const getDevices = () => apiFetch("/devices");

export const getFiles = () => apiFetch("/files");

export const deleteFile = (fileId) =>
  apiFetch(`/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });

export async function uploadFile(selectedFile) {
  const formData = new FormData();
  formData.append("file", selectedFile);

  return apiFetch("/upload", {
    method: "POST",
    body: formData,
  });
}

export const createPairing = () =>
  apiFetch("/pairing/create", {
    method: "POST",
  });

export const removeDevice = (id) =>
  apiFetch(`/devices/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export const setDevicePriority = (id, priority) =>
  apiFetch(
    `/devices/${encodeURIComponent(id)}/priority`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ priority }),
    }
  );

export async function downloadFile(fileId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Please sign in");
  }

  const res = await fetch(
    `${API_BASE}/files/${encodeURIComponent(fileId)}/download`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }

  return res.blob();
}
