import { useRef, useState } from "react";

export default function PairCode({code}) {
  const input = useRef(null);
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(String(code));
      setMessage("Code copied.");
    } catch {
      input.current.focus();
      input.current.select();
      setMessage("Code selected. Choose Copy, or copy it manually.");
    }
  }
  return <div className="pp-copy-code">
    <p>Copy this code before opening the pairing page. On another device, enter the code shown here.</p>
    <input aria-label="Pairing code" ref={input} value={code ?? ""} readOnly onFocus={e => e.target.select()} />
    <button type="button" onClick={copy} disabled={!code}>Copy code</button>
    <small role="status">{message}</small>
  </div>;
}
