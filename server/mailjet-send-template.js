const Mailjet = require("node-mailjet");
require("dotenv").config();

const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE,
);

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
      TemplateID: 5723859,
      TemplateLanguage: true,
      Subject: "Your email flight plan!",
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
