const Mailjet = require("node-mailjet");
require("dotenv").config();
const axios = require("axios");
const { format } = require("date-fns");

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

response
  .then((res) => {
    const data = res.data.data.Catalog.searchStore;
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
      const endDates =
        data.elements[i].promotions?.promotionalOffers[0]?.promotionalOffers[0]
          .endDate;
      const endDateFormatted = endDates ? new Date(endDates) : undefined;
      const endDate = endDateFormatted
        ? format(endDateFormatted, "do 'of' MMMM 'at' h:mma")
        : undefined;
      const image = data.elements[i].keyImages[2].url;
      const title = data.elements[i].title;
      const description = endDate ? `Free now until ${endDate}` : "Coming soon";
      const download_url = endDate
        ? `https://store.epicgames.com/en-US/p/${data.elements[i].productSlug}`
        : undefined;

      variables.push({
        [`title_${i + 1}`]: title,
        [`description_${i + 1}`]: description,
        [`image_${i + 1}`]: image,
        [`download_url_${i + 1}`]: download_url,
      });
    }
    sendRequest(template, Object.assign({}, ...variables));
  })
  .catch((err) => console.log(err));

const sendRequest = async (templateId, variables) => {
  const contacts = await mailjet.get("contact").request();
  const recipients = contacts.body.Data.map((contact) => ({
    Email: contact.Email,
  }));

  const request = mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: "epicfreegamesmail@gmail.com",
          Name: "Epic Free Games Mail",
        },
        To: recipients,
        Variables: {
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
