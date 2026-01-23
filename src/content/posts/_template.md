---
# TEMPLATE: Copy this file and rename it to create a new post
# File name becomes the URL: my-post-title.md → /posts/my-post-title

title: "Your Post Title Here"
subtitle: "Optional subtitle (delete if not needed)"
date: 2026-01-21  # Publication date (YYYY-MM-DD)
tags: ["tag1", "tag2"]  # For filtering/organization
categories: ["blog"]  # Options: blog, research, tutorial, news
---

Write your introduction paragraph here. This first paragraph often appears as a preview/excerpt on the posts listing page.

## Main Section Heading

Regular paragraphs go here. You can use **bold**, *italics*, and `inline code`.

### Subsection

Here's a bullet list:
- First item
- Second item
- Third item

Here's a numbered list:
1. First step
2. Second step
3. Third step

## Adding Links and Images

Link to external sites: [Link text](https://example.com)

Link to internal pages: [Publications](/publications) or [Dashboard](/dashboard)

Add an image (place image files in `public/media/`):
![Alt text description](/media/your-image.jpg)

## Code Blocks

Inline code: `variable_name`

Code block with syntax highlighting:

```r
# R code example
library(tidyverse)
data %>%
  filter(year > 2020) %>%
  summarize(mean = mean(value))
```

```python
# Python code example
import pandas as pd
df = pd.read_csv("data.csv")
print(df.head())
```

## Block Quotes

> This is a block quote. Use it for citations or to highlight
> important passages from other sources.

## Tables

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

---

## Checklist Before Publishing

- [ ] Update the `title` in frontmatter
- [ ] Set the correct `date`
- [ ] Add relevant `tags`
- [ ] Rename file from `_template.md` to `your-post-slug.md`
- [ ] Delete this checklist section
- [ ] Delete any unused example sections above

---

*Delete everything from "Checklist" down before publishing!*
