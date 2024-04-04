const Mailjet = require("node-mailjet");
require("dotenv").config({ path: "../.env" });
const axios = require("axios");
const { format } = require("date-fns");

const TEMPLATE_ID_2_COLUMNS = 5723859;
const TEMPLATE_ID_3_COLUMNS = 5743120;
const TEMPLATE_AUTOMATED = 5785337;
const TEMPLATE_ONE_ROW = 5789055;

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

    const sortedData = data.elements.sort((a, b) => {
      if (a.promotions?.promotionalOffers.length > 0) {
        return -1;
      }
    });

    const filteredData = sortedData.filter((game) => {
      return game.promotions;
    });

    template = TEMPLATE_ONE_ROW;

    // if (filteredData.length === 2) {
    //   template = TEMPLATE_ID_2_COLUMNS;
    // } else if (filteredData.length === 3) {
    //   template = TEMPLATE_ID_3_COLUMNS;
    // } else {
    //   console.log("Error, no template found");
    // }

    const variables = [];

    for (let i = 0; i < filteredData.length; i++) {
      const unfilteredDate =
        filteredData[i].promotions?.promotionalOffers[0]?.promotionalOffers[0]
          .endDate;
      const formattedDate = unfilteredDate
        ? new Date(unfilteredDate)
        : undefined;
      const endDate = formattedDate
        ? format(formattedDate, "do 'of' MMMM, h a")
        : undefined;

      const image =
        filteredData[i].keyImages.find((img) => img.type === "OfferImageWide")
          .url ||
        filteredData[i].keyImages[2]?.url ||
        filteredData[i]?.keyImages[0]?.url ||
        filteredData[i]?.keyImages[1]?.url;

      const title = filteredData[i].title;

      const description = filteredData[i].description;

      const upcomingDate =
        filteredData[i].promotions?.upcomingPromotionalOffers[0]
          ?.promotionalOffers[0].startDate;

      const upcomingDateFormatted = upcomingDate
        ? `from ${format(new Date(upcomingDate), "do 'of' MMMM, h a")} GMT`
        : "";

      const price = endDate
        ? filteredData[i].price?.totalPrice?.fmtPrice.originalPrice || ""
        : "";

      const description_2 = endDate
        ? `Free now until ${endDate} GMT`
        : `Coming soon ${upcomingDateFormatted}`;

      const download_url = endDate
        ? `https://store.epicgames.com/en-US/p/${filteredData[i].catalogNs.mappings[0].pageSlug}`
        : "";

      variables.push({
        [`title`]: title,
        [`description`]: description,
        [`description_2`]: description_2,
        [`image`]: image,
        [`download_url`]: download_url,
        [`price`]: price,
      });
      console.log(variables);
    }
    // sendRequest(template, Object.assign({}, variables));
    sendTestRequest(template, Object.assign({}, variables));
  })
  .catch((err) => console.log(err));

const sendRequest = async (templateId, variables) => {
  let offset = 0;
  const limit = 50;

  while (true) {
    const contacts = await mailjet
      .get(`contact?ContactsList=10422731?limit=${limit}?offset=${offset}`)
      .request();

    if (contacts.body.Data.length === 0) {
      break;
    }

    const recipients = contacts.body.Data.map((contact) => ({
      Email: contact.Email,
    }));

    const request = mailjet.post("send", { version: "v3.1" }).request({
      Messages: recipients.map((recipient) => {
        return {
          From: {
            Email: "hello@epicfreegamesmail.com",
            Name: "EFGM Newsletter",
          },
          To: [recipient],
          Variables: {
            items: variables,
          },
          TemplateErrorReporting: {
            Email: "erind.cbh@gmail.com",
            Name: "Erind",
          },
          TemplateID: templateId,
          TemplateLanguage: true,
          Subject: `Free games this week - ${new Date().toDateString()}`,
        };
      }),
    });

    request
      .then((result) => {
        console.log(result.body);
      })
      .catch((err) => {
        console.log(err);
      });

    offset += limit;

    await new Promise((resolve) => setTimeout(resolve, 11000));
  }
};

const sendTestRequest = (templateId, variables) => {
  const recipients = [
    {
      Email: "erind.cbh@gmail.com",
    },
  ];

  const request = mailjet.post("send", { version: "v3.1" }).request({
    Messages: recipients.map((recipient) => {
      return {
        From: {
          Email: "hello@epicfreegamesmail.com",
          Name: "EFGM Newsletter",
        },
        To: [recipient],
        Variables: {
          items: variables,
        },
        TemplateErrorReporting: {
          Email: "erind.cbh@gmail.com",
          Name: "Erind",
        },
        TemplateID: templateId,
        TemplateLanguage: true,
        Subject: `Free games this week - ${new Date().toDateString()}`,
      };
    }),
  });

  request
    .then((result) => {
      console.log(result.body);
    })
    .catch((err) => {
      console.log(err);
    });
};
