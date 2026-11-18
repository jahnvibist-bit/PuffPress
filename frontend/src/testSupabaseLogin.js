import { signInUser, signOutUser } from "./supabase.js";

export async function testSupabaseLogin(email, password) {
    const data = await signInUser(email, password);

    console.log("Supabase login successful:", {
        userId: data.user?.id,
        email: data.user?.email,
        hasAccessToken: Boolean(data.session?.access_token),
    });

    await signOutUser();

    return "Login test passed";
}