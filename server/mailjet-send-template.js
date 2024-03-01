const Mailjet = require("node-mailjet");
require("dotenv").config();
const axios = require("axios");
const { format, formatRelative, subDays } = require("date-fns");

const TEMPLATE_ID_2_COLUMNS = 5723859;
const TEMPLATE_ID_3_COLUMNS = 5743120;

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

let data;

response
  .then((res) => {
    data = res.data.data.Catalog.searchStore;
    let template;

    if (data.elements.length === 2) {
      template = TEMPLATE_ID_2_COLUMNS;
    } else if (data.elements.length === 3) {
      template = TEMPLATE_ID_3_COLUMNS;
    } else {
      console.log("Error, no template found");
    }

    let variables = [];

    for (let i = 0; i < data.elements.length; i++) {
      let endDates =
        data.elements[i].promotions?.promotionalOffers[0]?.promotionalOffers[0]
          .endDate;

      let endDateFormatted = endDates ? new Date(endDates) : undefined;

      const endDate = endDateFormatted
        ? format(endDateFormatted, "do 'of' MMMM 'at' h:mma")
        : undefined;
      let images = data.elements[i].keyImages[0].url;
      let title = data.elements[i].title;
      let description = endDate ? `Free now until ${endDate}` : "Coming soon";
      let download_url = endDate
        ? `https://store.epicgames.com/en-US/p/${data.elements[i].urlSlug}`
        : undefined;

      variables.push({
        [`title_${i + 1}`]: title,
        [`description_${i + 1}`]: description,
        [`image_${i + 1}`]: images,
        [`download_url_${i + 1}`]: download_url,
      });
    }
    sendRequest(template, Object.assign({}, ...variables));
  })
  .catch((err) => console.log(err));

const sendRequest = (templateId, variables) => {
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
          ...variables,
        },
        TemplateErrorReporting: {
          Email: "erind.cbh@gmail.com",
          Name: "Erind",
        },
        TemplateID: templateId,
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
};
