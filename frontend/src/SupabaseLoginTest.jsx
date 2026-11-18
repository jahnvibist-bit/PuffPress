
import { useState } from "react";
import { signInUser, signOutUser } from "./supabase.js";

export default function SupabaseLoginTest() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            const data = await signInUser(email, password);

            if (!data.session) {
                throw new Error("No session returned");
            }

            setMessage("✅ Supabase login successful!");
            await signOutUser();
        } catch (error) {
            setMessage(error.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: 380, margin: "60px auto", padding: 24 }}>
            <h2>🐡 Supabase Login Test</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                />
                <button type="submit" disabled={loading}>
                    {loading ? "Testing..." : "Test Login"}
                </button>
            </form>
            <p role="status">{message}</p>
        </div>
    );
}
