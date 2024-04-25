const Mailjet = require("node-mailjet");
require("dotenv").config({ path: "../.env" });
const axios = require("axios");
const { format } = require("date-fns");

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
    let template = TEMPLATE_ONE_ROW;

    const sortedData = data.elements
      .map((element, index) => ({ ...element, originalIndex: index })) // add original index to each element
      .sort((a, b) => {
        const aDiscount =
          a.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0]
            ?.discountSetting?.discountPercentage;
        const bDiscount =
          b.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0]
            ?.discountSetting?.discountPercentage;

        if (aDiscount === 0 && bDiscount !== 0) {
          return -1;
        }
        if (bDiscount === undefined) {
          return -1;
        }
        if (aDiscount !== 0 && bDiscount > 0) {
          return 1;
        }
        return a.originalIndex - b.originalIndex;
      });

    const filteredData = sortedData.filter((game) => {
      return game.promotions;
    });

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

      const isFree =
        filteredData[i].promotions?.promotionalOffers?.[0]
          ?.promotionalOffers?.[0]?.discountSetting?.discountPercentage === 0;

      const isDiscount =
        filteredData[i].promotions?.promotionalOffers?.[0]
          ?.promotionalOffers?.[0]?.discountSetting?.discountPercentage > 0;

      const price =
        isFree || isDiscount
          ? filteredData[i].price?.totalPrice?.fmtPrice.originalPrice
          : "";

      let discountedPrice = "";
      if (isDiscount) {
        discountedPrice =
          filteredData[i].price?.totalPrice?.fmtPrice.discountPrice;
      }

      const getDescription = () => {
        if (isFree) {
          return `Free now until ${endDate} GMT`;
        }
        if (isDiscount) {
          return `Discounted now until ${endDate} GMT`;
        }
        return `Coming soon ${upcomingDateFormatted}`;
      };

      const description_2 = getDescription();

      console.log(filteredData[i]);

      const slugInner =
        filteredData[i].offerType === "BASE_GAME" ? "p" : "bundles";

      const pageSlug =
        filteredData[i].catalogNs.mappings?.[0].pageSlug ||
        filteredData[i].urlSlug;

      const download_url =
        isFree || isDiscount
          ? `https://store.epicgames.com/en-US/${slugInner}/${pageSlug}`
          : "";

      variables.push({
        [`title`]: title,
        [`description`]: description === title ? "" : description,
        [`description_2`]: description_2,
        [`image`]: image,
        [`download_url`]: download_url,
        [`price`]: price === "0" ? "" : price,
        [`discountedPrice`]: discountedPrice || "",
      });
    }

    console.log(variables);

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
