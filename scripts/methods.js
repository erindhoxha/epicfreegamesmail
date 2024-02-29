async function insertEmail(email) {
  const { error } = await supabase
    .from("subscribers")
    .insert({ email_address: email });

  return {
    error,
  };
}
