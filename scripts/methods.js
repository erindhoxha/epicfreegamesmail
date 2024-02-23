// Ensure this script runs after the Supabase client has been initialized
async function insertEmail() {
  const { error } = await supabase
    .from("subscribers")
    .insert({ email_address: "erind.cbh@gmail.com" });
}
