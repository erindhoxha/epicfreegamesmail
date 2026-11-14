// Builds the list of games for the email from the Epic free games feed.
// Same logic as server/mailjet-send-template.js, copied so importing it never sends anything.
const axios = require("axios");
const { format } = require("date-fns");

const SKIP_TITLES = new Set([
  "LISA: The Definitive Edition",
  "Ghostrunner 2",
  "Monument Valley",
  "Castlevania Anniversary Collection",
  "Eternal Threads",
  "Lost Castle: The Old Ones Awaken",
]);

const getActiveOffer = (game) => {
  const now = new Date();
  const offers = (game.promotions?.promotionalOffers || [])
    .flatMap((o) => o.promotionalOffers || [])
    .filter((o) => new Date(o.startDate) <= now && now < new Date(o.endDate));
  return offers.find((o) => o.discountSetting?.discountPercentage === 0) || offers[0];
};

const fmt = (date) => format(new Date(date), "do 'of' MMMM, h a");

const pickImage = (game) => {
  const byType = (type) => game.keyImages.find((img) => img.type === type)?.url;
  return (
    byType("DieselGameBoxWide") ||
    byType("DieselStoreFrontWide") ||
    byType("OfferImageWide") ||
    game.keyImages[2]?.url ||
    game.keyImages[0]?.url ||
    game.keyImages[1]?.url
  );
};

const sortFreeFirst = (elements) =>
  elements
    .map((element, originalIndex) => ({ ...element, originalIndex }))
    .sort((a, b) => {
      const aDiscount = getActiveOffer(a)?.discountSetting?.discountPercentage;
      const bDiscount = getActiveOffer(b)?.discountSetting?.discountPercentage;
      if (aDiscount === 0 && bDiscount !== 0) return -1;
      if (bDiscount === undefined) return -1;
      if (aDiscount !== 0 && bDiscount > 0) return 1;
      return a.originalIndex - b.originalIndex;
    });

function toItem(game) {
  const activeOffer = getActiveOffer(game);
  const endDate = activeOffer?.endDate ? fmt(activeOffer.endDate) : undefined;
  const upcomingDate = game.promotions?.upcomingPromotionalOffers[0]?.promotionalOffers[0].startDate;

  const isMystery = game.title.includes("Mystery Game");
  const title = isMystery ? "Mystery Game" : game.title;
  const description = isMystery || game.description === title ? "" : game.description;

  const isFree = activeOffer?.discountSetting?.discountPercentage === 0;
  const isDiscount = activeOffer?.discountSetting?.discountPercentage > 0;
  const price = isFree || isDiscount ? game.price?.totalPrice?.fmtPrice.originalPrice : "";
  const discountedPrice = isDiscount ? game.price?.totalPrice?.fmtPrice.discountPrice || "" : "";

  let status;
  if (isFree) status = `Free now until ${endDate} GMT`;
  else if (isDiscount && discountedPrice !== "0") status = `Discounted now until ${endDate} GMT`;
  else if (isMystery && upcomingDate) status = `Unlocking from ${fmt(upcomingDate)} GMT`;
  else status = `Coming soon${upcomingDate ? ` from ${fmt(upcomingDate)} GMT` : ""}`;

  const slugInner = game.offerType === "BUNDLE" ? "bundles" : "p";
  const pageSlug = game.pageSlug || game.catalogNs.mappings?.[0]?.pageSlug || game.productSlug;

  return {
    title,
    description,
    status,
    image: pickImage(game),
    url: isFree || isDiscount ? `https://store.epicgames.com/en-US/${slugInner}/${pageSlug}` : "",
    price: price === "0" ? "" : price || "",
    discountedPrice: discountedPrice !== "0" ? discountedPrice : "",
    isFree,
    isDiscount: isDiscount && discountedPrice !== "0",
  };
}

async function fetchItems() {
  const res = await axios.get("https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions", {
    params: { locale: "en-gb", includeAll: "true" },
  });
  return sortFreeFirst(res.data.data.Catalog.searchStore.elements)
    .filter((game) => game.promotions)
    .filter((game) => !SKIP_TITLES.has(game.title))
    .map(toItem);
}

module.exports = { fetchItems };
