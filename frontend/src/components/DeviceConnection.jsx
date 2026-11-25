import { useEffect, useId, useRef, useState } from "react";
import "./DeviceConnection.css";
import "./DeviceConnectionGuide.css";

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

  const helpId = useId();
  const guideKey = paired ? "puffpress-connect-guide:" + device.id : null;
  const [dismissedHere, setDismissedHere] = useState(null);
  const [, refreshGuide] = useState(0);
  useEffect(() => {
    function syncGuide(event) {
      if (event.key === guideKey || event.key === null) refreshGuide(value => value + 1);
    }
    window.addEventListener("storage", syncGuide);
    return () => window.removeEventListener("storage", syncGuide);
  }, [guideKey]);

  const showGuide = guideKey && !elsewhere && dismissedHere !== guideKey &&
    localStorage.getItem(guideKey) !== "seen";
  function dismissGuide() {
    setDismissedHere(guideKey);
    try {
      localStorage.setItem(guideKey, "seen");
    } catch {
      // The current visit still remembers dismissal if storage is full.
    }
    switchRef.current?.focus();
  }
  const switchRef = useRef(null);
  const reminder = elsewhere ? "This device is already connected in another tab." :
    paired && !running && !showGuide ? "This device is disconnected. Tap the switch to reconnect." : "";

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
  return <div className="pp-switch-guide-wrap">
    <button ref={switchRef} aria-describedby={showGuide || reminder ? helpId : undefined}
      type="button" className="pp-mini-switch" role="switch"
      aria-label={"This device connection. " + hint} title={hint} aria-checked={connected}
      disabled={elsewhere || pairingLoading} onClick={toggle}>
      <span className="pp-mini-dot" aria-hidden="true" />
      {connected ? "Connected" : connecting ? "Connecting…" : "Disconnected"}
    </button>
    {showGuide && <div className="pp-switch-guide">
      <p id={helpId}>Connect your device here. Turn this switch on to share storage, or off to disconnect.</p>
      <button type="button" onClick={dismissGuide}>Got it</button>
    </div>}
    {reminder && <p className="pp-switch-reminder" role="status" id={helpId}>{reminder}</p>}
    {running && <iframe hidden ref={frame} src="/device.html" title="Device connection" />}
  </div>;
}
