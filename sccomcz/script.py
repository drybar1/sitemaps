import re

# Read sitemap file
with open("sccom_sitemap_cleaned.xml", "r", encoding="utf-8") as f:
    content = f.read()

# Match product and category <url> blocks
product_pattern = re.compile(
    r"<url>\s*<loc>(https:\/\/www\.sccom\.cz\/[^<]*-d\d+)<\/loc>\s*<\/url>",
    re.MULTILINE
)
category_pattern = re.compile(
    r"<url>\s*<loc>(https:\/\/www\.sccom\.cz\/[^<]*-k\d+(?:\?.*?)?)<\/loc>\s*<\/url>",
    re.MULTILINE
)

products = product_pattern.findall(content)
categories = category_pattern.findall(content)

# --- Filter categories ---
clean_categories = {}
for url in categories:
    # Strip query parameters (?something=...)
    clean_url = url.split("?")[0]
    # Only keep one version of each clean URL
    clean_categories[clean_url] = True

# --- Remove query URLs that don't have a clean version ---
final_categories = list(clean_categories.keys())

# --- Write output files ---
with open("products.xml", "w", encoding="utf-8") as f:
    f.write("<urlset>\n")
    for url in products:
        f.write(f"  <url><loc>{url}</loc></url>\n")
    f.write("</urlset>")

with open("categories.xml", "w", encoding="utf-8") as f:
    f.write("<urlset>\n")
    for url in final_categories:
        f.write(f"  <url><loc>{url}</loc></url>\n")
    f.write("</urlset>")

print(f"Extracted {len(products)} products and {len(final_categories)} unique clean categories.")
