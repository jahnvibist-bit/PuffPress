import { useState } from "react";
import { deleteFolder, renameFolder } from "../api.js";

export default function FolderActions({folder, reload, onRemove}) {
  const [mode, setMode] = useState("");
  const [name, setName] = useState(folder.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "rename") await renameFolder(folder.id, name.trim());
      else await deleteFolder(folder.id);
      await reload();
      if (mode === "delete") onRemove();
      setMode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!mode) return <div className="pp-folder-actions">
    <button type="button" onClick={() => { setName(folder.name); setMode("rename"); }}>Rename folder</button>
    <button type="button" onClick={() => setMode("delete")}>Delete folder</button>
  </div>;
  return <form className="pp-folder-actions" onSubmit={submit}>
    {mode === "rename" ? <label>Folder name <input autoFocus required maxLength={80} value={name}
      onChange={event => setName(event.target.value)} /></label> :
      <p>Delete “{folder.name}”? Its files will stay in My Files without a folder.</p>}
    <button disabled={busy || (mode === "rename" && !name.trim())}>
      {busy ? "Saving…" : mode === "rename" ? "Save name" : "Confirm delete"}
    </button>
    <button type="button" disabled={busy} onClick={() => {setMode(""); setError("");}}>Cancel</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
