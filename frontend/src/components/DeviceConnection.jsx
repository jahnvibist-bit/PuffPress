import { useEffect, useRef, useState } from "react";
import "./DeviceConnection.css";

export default function DeviceConnection({device, onPair, pairingLoading}) {
  const frame = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [status, setStatus] = useState("");
  const paired = Boolean(device && localStorage.getItem("puffpress-device-token"));
  const running = paired && activeId === device.id;
  const elsewhere = paired && !running && device.status === "online";
  const connected = elsewhere || (running && status.startsWith("Connected!"));
  const connecting = running && status === "Connecting…";
  const hint = !paired ? "Pair this device" : elsewhere ? "Connected in another tab. Disconnect there." :
    running ? (status + " · Click to disconnect") : "Connect this device";

  useEffect(() => {
    function receive(event) {
      if (frame.current && event.origin === location.origin &&
          event.source === frame.current.contentWindow && event.data?.type === "puffpress-device-status") {
        setStatus(event.data.message === "Connecting..." ? "Connecting…" : event.data.message);
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  function toggle() {
    if (!paired) return onPair();
    setStatus("Connecting…");
    setActiveId(running ? null : device.id);
  }
  return <>
    <button type="button" className="pp-mini-switch" role="switch"
      aria-label={"This device connection. " + hint} title={hint} aria-checked={connected}
      disabled={elsewhere || pairingLoading} onClick={toggle}>
      <span className="pp-mini-dot" aria-hidden="true" />
      {connected ? "Connected" : connecting ? "Connecting…" : "Disconnected"}
    </button>
    {running && <iframe hidden ref={frame} src="/device.html" title="Device connection" />}
  </>;
}
