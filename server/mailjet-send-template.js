const Mailjet = require("node-mailjet");
require("dotenv").config();
const axios = require("axios");

const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE,
);

const response = axios.get(
  "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions",
  {
    params: { locale: "en-gb", includeAll: "true" },
    headers: { "Access-Control-Allow-Origin": "*" },
  },
);

response.then((res) => console.log(res));

const request = mailjet.post("send", { version: "v3.1" }).request({
  Messages: [
    {
      From: {
        Email: "epicfreegamesmail@gmail.com",
        Name: "Epic Free Games Mail",
      },
      To: [
        {
          Email: "erind.cbh@gmail.com",
        },
      ],
      Variables: {
        firstName: "Erind",
        download_url: "https://www.epicgames.com/store/en-US/free-games",
      },
      TemplateErrorReporting: {
        Email: "erind.cbh@gmail.com",
        Name: "Erind",
      },
      TemplateID: 5723859,
      TemplateLanguage: true,
      Subject: `Epic Free Games - ${new Date().toDateString()}`,
    },
  ],
});
request
  .then((result) => {
    console.log(result.body);
  })
  .catch((err) => {
    console.log(err.statusCode);
  });
