// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { Actor } from "apify";
// Axios - Promise based HTTP client for the browser and node.js (Read more at https://axios-http.com/docs/intro).
import axios from "axios";
// Cheerio - The fast, flexible & elegant library for parsing and manipulating HTML and XML (Read more at https://cheerio.js.org.).
import * as cheerio from "cheerio";

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init().
await Actor.init();

interface Input {
  url: string;
}

interface Flag {
  code: string;
  title: string;
  color: string;
  showInDetail: boolean;
  showInCategory: boolean;
}

interface Product {
  title: string;
  image: string;
  description: string;
  manufacturer: string;
  url: string;
  isAvailable: boolean;
  price: number | null;
  ean: string;
  product_id: string;
  stock: number;
  flags: Flag[];
  category_title: string;
  custom: {
    availability_text: string;
  };
  scrapedAt: string;
}

// Structure of input is defined in input_schema.json
const input = await Actor.getInput<Input>();
if (!input) throw new Error("Input is missing!");
const { url } = input;

// Fetch the HTML content of the page.
const response = await axios.get(url);

// Parse the downloaded HTML with Cheerio to enable data extraction.
const $ = cheerio.load(response.data);

// Initialize product object
const product: Product = {
  title: "",
  image: "",
  description: "",
  manufacturer: "",
  url: url,
  isAvailable: false,
  price: null,
  ean: "",
  flags: [],
  product_id: "",
  stock: 0,
  category_title: "",
  custom: {
    availability_text: "",
  },
  scrapedAt: new Date().toISOString(),
};

// Extract JSON-LD structured data
const jsonLdScript = $('script[type="application/ld+json"]').html();
if (jsonLdScript) {
  try {
    const jsonLdData = JSON.parse(jsonLdScript);

    // Extract fields from JSON-LD
    product.title = jsonLdData.name || "";
    product.image = jsonLdData.image || "";
    product.description = jsonLdData.description || "";
    product.manufacturer = jsonLdData.manufacturer || "";
    product.url = jsonLdData.url || url;

    // Check availability
    if (jsonLdData.offers) {
      const availability = jsonLdData.offers.availability || "";
      product.isAvailable = availability === "http://schema.org/InStock";
      product.price = jsonLdData.offers.price || null;
    }
  } catch (error) {
    console.error("Error parsing JSON-LD:", error);
  }
}

// Extract EAN and Product Code from properties
$(".properties ul li").each((_i, element) => {
  const text = $(element).text().trim();

  // Extract EAN
  if (text.includes("EAN:")) {
    const eanValue = $(element).find("strong").text().trim();
    product.ean = eanValue;
  }

  // Extract Product Code (Kód)
  if (text.includes("Kód:")) {
    const productIdValue = $(element).find("strong").text().trim();
    product.product_id = productIdValue;
  }
});

// Extract category breadcrumbs
const categoryParts: string[] = [];

$(".breadcrumbs a").each((_i, element) => {
  const categoryText = $(element).text().trim();
  // Skip the home link (contains icon)
  if (categoryText && !$(element).find("i.fa-home").length) {
    categoryParts.push(categoryText);
  }
});

// Get the last breadcrumb item (current page text, not a link)
const lastBreadcrumbText = $(".breadcrumbs")
  .contents()
  .filter(function () {
    return this.type === "text";
  })
  .last()
  .text()
  .trim();

if (lastBreadcrumbText) {
  categoryParts.push(lastBreadcrumbText);
}

product.category_title = categoryParts.join(" > ");

// Extract stock information
let totalStock = 0;
let firstAvailabilityText = "";

$(".stock.stock--detail").each((index, element) => {
  const stockText = $(element).clone().children().remove().end().text().trim();

  // Get the first availability text
  if (index === 0) {
    firstAvailabilityText = stockText;
  }

  // Extract number before "ks"
  const stockMatch = stockText.match(/(\d+)\s*ks/);
  if (stockMatch) {
    const stockAmount = parseInt(stockMatch[1], 10);
    totalStock += stockAmount;
  }
});

product.stock = totalStock;
product.custom.availability_text = firstAvailabilityText;

// Extract flags from bonus section
const flags: Flag[] = [];

$(".bonus .tag-list .tag").each((_i, element) => {
  // Get the text content, but only the direct text (not nested tooltip content)
  const $tag = $(element);

  // Clone the element and remove tooltip spans to get clean text
  const $clone = $tag.clone();
  $clone.find(".tooltip").remove();

  const title = $clone.text().trim();

  if (title) {
    // Generate code by removing spaces, converting to lowercase, and removing special characters
    const code = title
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");

    flags.push({
      code: code,
      title: title,
      color: "",
      showInDetail: true,
      showInCategory: true,
    });
  }
});

product.flags = flags;

// Log the complete product object
console.log("Complete Product Object:", JSON.stringify(product, null, 2));

// Validate that we got essential data
const essentialFields: (keyof Product)[] = ["title", "price", "product_id"];
const missingFields = essentialFields.filter((field) => {
  const value = product[field];
  return !value && value !== 0; // Allow 0 as valid value
});

if (missingFields.length > 0) {
  console.warn("Warning: Missing essential fields:", missingFields);
}

// Save the complete product data
await Actor.pushData([product]);

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit().
await Actor.exit();
