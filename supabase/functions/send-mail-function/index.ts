import axios from "https://cdn.skypack.dev/axios@^1.6.7";

Deno.serve(async (req) => {
  const response = axios.get(
    "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions",
    {
      params: { locale: "en-gb", includeAll: "true" },
      headers: { "Access-Control-Allow-Origin": "*" },
    },
  );

  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" },
  });
});
