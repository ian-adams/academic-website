---
# Documentation: https://wowchemy.com/docs/managing-content/

title: "Git Marker"
subtitle: "Finally got the damned thing"
summary: ""
authors: []
tags: []
categories: []
date: 2021-01-21T20:36:17-07:00
lastmod: 2021-01-21T20:36:17-07:00
featured: false
draft: false

# Featured image
# To use, add an image named `featured.jpg/png` to your page's folder.
# Focal points: Smart, Center, TopLeft, Top, TopRight, Left, Right, BottomLeft, Bottom, BottomRight.
image:
  caption: ""
  focal_point: ""
  preview_only: false

# Projects (optional).
#   Associate this post with one or more of your projects.
#   Simply enter your project's folder or file name without extension.
#   E.g. `projects = ["internal-project"]` references `content/project/deep-learning/index.md`.
#   Otherwise, set `projects = []`.
projects: []
---

I've struggled *mightily* with Github over the years. I kind of got the idea, but the practice of it always left me frustrated, and the time-sink necessary to figure it all out was always just out of reach. 

I've always manually deployed this website through Netlify. That actually works just fine, but it's easy to lose a lot of time as you deploy --> find a mistake --> back to Rstudio to fix things --> deploy, and on and on. 

I have finally figured it out, at least enough to deploy consistently and safely. One of the big hangups I found was that Rstudio's git commit does **not** work well with bigger sized files. When dealing with `blogdown`, the "public" folder that gets built, and that you use to manually deploy, was a problem. Upon initial commit, it was hanging Rstudio and would not proceed. That would lead to a "lock" file in the git process, leaving me unable to proceed. It took a while to figure out that using the Github Desktop app actually works a lot smoother. For small commits I still use Rstudio, but if I'm forking over a larger respository and building a local public folder, I'll use Github Desktop to take care of the commit and push.

But really, this whole post is just a breadcrumb for myself to remember when I switched over to deploying the website from Github. It's such a nice quality of life improvement!