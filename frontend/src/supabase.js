// import { createClient } from "@supabase/supabase-js";

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// export const supabase = createClient(supabaseUrl, supabaseKey);

// export async function signUpUser(email, password) {
//     const { data, error } = await supabase.auth.signUp({
//         email,
//         password,
//     });

//     if (error) {
//         throw error;
//     }

//     return data;
// }

// export async function signInUser(email, password) {
//     const { data, error } = await supabase.auth.signInWithPassword({
//         email,
//         password,
//     });

//     if (error) {
//         throw error;
//     }

//     return data;
// }

// export async function signOutUser() {
//     const { error } = await supabase.auth.signOut();

//     if (error) {
//         throw error;
//     }
// }

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

export async function signInUser(email, password) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) throw error;
  return data;
}

export async function signUpUser(email, password) {
  const { data, error } =
    await supabase.auth.signUp({
      email,
      password,
    });

  if (error) throw error;
  return data;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
