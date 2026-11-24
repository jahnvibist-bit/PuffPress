import { useRef, useState } from "react";
import "./ResponsiveHelp.css";
import "./FishAndFolders.css";

const topics = [
  ["How do I pair a phone?", ["pair", "qr", "scan", "add device", "jodu"], "Open Add Device, scan the QR on the device sharing storage, then enter its name and allocation. For local testing, open the laptop’s Wi-Fi address on both devices."],
  ["Why am I disconnected?", ["disconnect", "offline", "connect", "tab", "toggle"], "Use the connection switch on the paired device and keep its dashboard open. If it says another tab is connected, close that tab before connecting here."],
  ["Can I use mobile data?", ["mobile data", "network", "wifi", "wi fi", "hotspot", "localhost"], "A local laptop address is reachable on the same Wi-Fi. Across networks, both devices need access to the same publicly reachable PuffPress backend."],
  ["What does priority mean?", ["priority", "backup", "replica", "highest"], "Priority 1 is highest. For a new upload, the highest-ranked online device with enough room can hold all parts. Changing priority affects future uploads."],
  ["Where is my file stored?", ["where", "stored", "storage", "space", "chunk", "jagah"], "In My Files, expand Where is this file stored? to see the devices holding its parts. My Devices shows each device’s shared capacity and usage."],
  ["How do I upload?", ["upload", "limit", "size", "large"], "Open Upload on Home, choose a file within the limit shown there, and keep devices with enough shared capacity connected until the upload completes."],
  ["Why won't my file download?", ["download", "retrieve", "missing part"], "Open My Files and check where the file is stored. Reconnect devices holding the required parts, then retry Download."],
  ["How do I manage folders?", ["folder", "rename", "organize", "edit folder"], "Open My Files and click a folder to browse it. Use ⋯ on a folder to rename or delete it. Use ⋯ beside a file and choose Move to folder. Removing a folder returns its files to My Files."],
  ["Can I recover a deleted file?", ["restore", "recover", "trash", "recently deleted", "accidentally"], "If your My Files screen has Recently Deleted, open it, choose the file and select Restore. Permanently deleted files cannot be restored there."],
  ["How do I remove a device?", ["remove device", "delete device", "release"], "Open My Devices. A device holding chunks must be emptied before removal. Removing an empty device takes its shared allocation out of the pool."],
  ["How do I find a file?", ["find", "search", "dhundu"], "Open My Files and search by file or folder name. Each matching file shows its location. Check Recently Deleted if you moved it there."],
  ["How do I sign in?", ["login", "sign in", "account", "sign up"], "Use the email and password for your PuffPress account. New users can choose Sign up on the welcome screen."]
];

function answer(question) {
  const words = question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
  const phrase = words.join(" ");
  let best = null;
  let score = 0;
  for (const [, keys, reply] of topics) {
    const hits = keys.reduce((sum, key) => sum + (key.includes(" ") ?
      (phrase.includes(key) ? 3 : 0) : (words.some(word => word.startsWith(key)) ? 1 : 0)), 0);
    if (hits > score) { best = reply; score = hits; }
  }
  return best || "I don’t have a guide for that question yet. Try pairing, connection, folders, storage, uploads, downloads or recovery.";
}

export default function HelpBot({page}) {
  const trigger = useRef(null);
  const [seen, setSeen] = useState(false);
  const suggested = ({files:[7,10,8], devices:[1,3,4], help:[0,5,8]})[page] || [0,5,4];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  function ask(value) { setQuery(value); setReply(answer(value)); }
  function close() { setOpen(false); trigger.current?.focus(); }
  return <aside className="pp-guide pp-floating" onKeyDown={e => {if (open && e.key === "Escape") close();}}>
    <button ref={trigger} className="pp-fish" type="button" aria-expanded={open}
      title={open ? "Close help" : "Ask PuffPress"} aria-label={open ? "Close help" : "Ask PuffPress"}
      onClick={() => {setSeen(true); open ? close() : setOpen(true);}}><span aria-hidden="true">🐡</span>{!seen && <small>Ask PuffPress</small>}</button>
    {open && <section aria-label="PuffPress help"><strong>Ask PuffPress</strong>
      <form onSubmit={e => { e.preventDefault(); if (query.trim()) ask(query); }}>
        <label>Ask about PuffPress<input autoFocus value={query} onChange={e => setQuery(e.target.value)} /></label>
        <button disabled={!query.trim()}>Ask</button>
      </form>
      <div>{suggested.map(index => topics[index]).map(([title]) => <button key={title} onClick={() => ask(title)}>{title}</button>)}</div>
      <p role="status">{reply}</p>
    </section>}
  </aside>;
}
