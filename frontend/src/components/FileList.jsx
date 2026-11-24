import FolderActions from "./FolderActions.jsx";
import {useState} from "react";
import {createFolder, moveFile} from "../api.js";
import "./FileList.css";
import "./FileViews.css";

export default function FileList({files, folders, devices, jobs, errors, runJob, reload, formatSize}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [newName, setNewName] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [view, setView] = useState("My Files");
  const trash = view === "Recently Deleted";
  const inTrash = file => file.status === "trashed" || file.status === "deleting";
  const term = query.trim().toLocaleLowerCase();
  const currentFolder = folders.find(folder => folder.id === group);
  const folderList = view === "Folders" && !currentFolder;
  const searchLabel = trash ? "Search recently deleted files" : folderList ? "Search folders" : currentFolder ? "Search this folder" : "Search all files";
  const matches = name => name.toLocaleLowerCase().includes(term);
  const shownFolders = !trash && !currentFolder
    ? folders.filter(folder => matches(folder.name)) : [];
  const visible = files.filter(file => inTrash(file) === trash && matches(file.name) &&
    (trash || !currentFolder || file.folder_id === currentFolder.id));

  function browse(id) {
    setGroup(id);

    setQuery("");
    setNewName(null);
    setConfirmId(null);
    setMessage("");
  }

  async function addFolder(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const folder = await createFolder(newName.trim());
      await reload();
      browse("all");
      setMessage("Created “" + folder.name + "”.");
      setNewName(null);
    } catch (err) { setMessage(err.message); }
    finally { setSaving(false); }
  }

  async function assign(file, target) {
    setMessage("");
    try {
      await moveFile(file.id, target || null);
      await reload();
    } catch (err) { setMessage(err.message); }
  }

  return <div className="pp-files">
    <nav className="pp-view-row" aria-label="File views">
      {["My Files", "Folders", "Recently Deleted"].map(label =>
        <button type="button" key={label} aria-pressed={view === label}
          onClick={() => {browse("all"); setView(label);}}>{label}</button>)}
    </nav>
    {currentFolder && <p><button type="button" onClick={() => browse("all")}>Folders</button> › {currentFolder.name}</p>}
    <div className="pp-file-tools">
      <input type="search" aria-label={searchLabel} placeholder={searchLabel + "…"} value={query}
        onChange={e => setQuery(e.target.value)} />
    </div>
    {trash && <p>Restore files, or delete them permanently to release storage.</p>}
    {message && <p role="alert">{message}</p>}
    {!folderList && <>
    <h3>{trash ? "Deleted files" : term ? "Matching files" : currentFolder ? "Files" : "All files"}</h3>
    {!visible.length && <p>{term ? "No matching files." : trash ? "Recently Deleted is empty." :
      currentFolder ? "This folder is empty. Choose Move to folder on a file to add it here." : "No files yet."}</p>}
    <div className="file-list">
      {visible.map(file => {
        const job = jobs[file.id];
        const paused = file.status === "deleting";
        const confirming = confirmId === file.id;
        return <article className="pp-file-entry" key={file.id}>
          <strong>{file.name}</strong>
          {!currentFolder && !trash && file.folder_id && <small>My Files{file.folder_id && " › " + (folders.find(f => f.id === file.folder_id)?.name || "Folder")}</small>}
          <small>{formatSize(file.original_bytes ?? file.size)}{file.original_bytes == null ? " stored" : ""} · {
            file.uploaded_at ? new Date(file.uploaded_at).toLocaleDateString(undefined,
              {year:"numeric",month:"short",day:"numeric"}) : "Upload date unavailable"}</small>
          {file.locations?.length > 0 && <details className="file-locations">
            <summary>Where is this file stored?</summary><ul>
              {file.locations.map(loc => <li key={loc.device_id}><strong>{loc.name}</strong>
                {" · "}{devices.find(d => d.id === loc.device_id)?.status || "Status unknown"}
                <div>{formatSize(loc.stored_bytes)} used · {loc.parts} of {loc.total_parts} parts</div>
                {loc.replica_parts > 0 && <div>Backup parts: {loc.replica_parts}</div>}
                {loc.parts === loc.total_parts && <div>Complete file on this device</div>}
              </li>)}
            </ul></details>}
          <div className="pp-file-tools">
            {!trash && <label>Move to folder <select aria-label={`Folder for ${file.name}`} value={file.folder_id || ""}
              disabled={Boolean(job) || paused} onChange={e => assign(file, e.target.value)}>
              <option value="">My Files</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select></label>}
            <button disabled={Boolean(job) || paused || confirming} onClick={() => runJob(file,trash ? "restore" : "download")}>{trash ? "Restore" : "Download"}</button>
            <button disabled={Boolean(job) || confirming} onClick={() => setConfirmId(file.id)}>
              {paused ? "Retry delete" : trash ? "Delete permanently" : "Delete"}</button>
          </div>
          {confirming && <div className="pp-file-confirm" role="group" aria-label="Confirm file deletion">
            <p>{trash ? "Permanently delete" : "Move"} <strong>{file.name}</strong>{trash ? " and its stored parts? This cannot be undone." : " to Recently Deleted?"}</p>
            <button autoFocus onClick={() => setConfirmId(null)}>Cancel</button>
            <button onClick={() => { setConfirmId(null); runJob(file,trash ? "purge" : "delete"); }}>{trash ? "Yes, delete permanently" : "Move to Recently Deleted"}</button>
          </div>}
          {job && <div role="status">{job.kind === "purge" ? "Deleting stored parts…" : job.kind === "restore" ? "Restoring…" : job.kind === "delete" ? "Moving to Recently Deleted…" :
            job.percent == null ? "Preparing download…" : `Downloading · ${job.percent}%`}
            <progress aria-label={job.kind + " progress"} max="100" value={job.percent ?? undefined} /></div>}
          {!job && errors[file.id] && <p role="alert">{errors[file.id]}</p>}
          {!job && paused && <small>Deletion is incomplete. Reconnect the storage devices and choose Retry delete.</small>}
        </article>;
      })}
    </div>
    </>}
    {folderList && <section aria-label="Folders">
      <div className="pp-file-tools"><h3>Folders</h3><button type="button" onClick={() => setNewName("")}>+ New folder</button></div>
    {newName !== null && <form onSubmit={addFolder} className="pp-file-tools">
      <input aria-label="Folder name" autoFocus placeholder="Folder name" maxLength={80}
        value={newName} onChange={e => setNewName(e.target.value)} />
      <button disabled={saving || !newName.trim()}>Create</button>
      <button type="button" disabled={saving} onClick={() => setNewName(null)}>Cancel</button>
    </form>}

      {shownFolders.length ? <div className="pp-folder-grid">{shownFolders.map(folder =>
        <article key={folder.id}>
          <button className="pp-open-folder" onClick={() => browse(folder.id)}>
            <span aria-hidden="true">📁</span>{folder.name}
          </button>
          <details><summary aria-label={`Options for ${folder.name}`}>⋯</summary>
            <FolderActions folder={folder} reload={reload} onRemove={() => browse("all")} />
          </details>
        </article>)}</div> : <p>{term ? "No matching folders." : "Create your first folder with + New folder."}</p>}
    </section>}
  </div>;
}
