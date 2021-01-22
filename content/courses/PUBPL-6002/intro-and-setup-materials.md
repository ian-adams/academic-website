---
title: Intro and Setup Materials
author: Ian Adams
date: '2020-12-28'
slug: intro-and-setup-materials
categories: []
tags: []
linktitle: Intro and Setup Materials
summary: ~
lastmod: '2020-12-28T13:37:37-07:00'
toc: yes
type: docs
menu:
  example:
    name: Getting Set Up
    weight: 2
---

If you are still not sure how to get started with R, Rstudio, and tidyverse, see if the following information helps. It was written by [Dr. Jennifer (Jenny) Bryan](https://jennybryan.org/) for her [STAT 545 class](https://stat545.com/), and in addition to the following start-up information, you may want to bookmark her class page as a reference throughout the rest of the semester!


## R and RStudio

* Install [R, a free software environment for statistical computing and graphics](https://www.r-project.org/) from [CRAN](https://cran.r-project.org/), the Comprehensive R Archive Network. I __highly recommend__ you install a precompiled binary distribution for your operating system -- use the links up at the top of the CRAN page linked above!

* Install RStudio's IDE (stands for _integrated development environment_), a powerful user interface for R. Get the Open Source Edition of RStudio Desktop.

  - I __highly recommend__ you run the [Preview version](https://rstudio.com/products/rstudio/download/preview/). I find these quite stable and you'll get the cool new features! Update to new Preview versions often.
  - Of course, there are also official releases available [here](https://rstudio.com/products/rstudio/download/).
  - RStudio comes with a __text editor__, so there is no immediate need to install a separate stand-alone editor.
  - RStudio can __interface with Git(Hub)__. However, you must do all the Git(Hub) set up [described elsewhere][https://happygitwithr.com/] before you can take advantage of this.
    
If you have a pre-existing installation of R and/or RStudio, we __highly recommend__ that you reinstall both and get as current as possible. It can be considerably harder to run old software than new.

* If you upgrade R, you will need to update any packages you have installed. The command below should get you started, though you may need to specify more arguments if, e.g., you have been using a non-default library for your packages.

    ``` r
    update.packages(ask = FALSE, checkBuilt = TRUE)
    ```

  __Note:__ this will only look for updates on CRAN. So if you use a package that lives *only* on GitHub or if you want a development version from GitHub, you will need to  update manually, e.g. via `devtools::install_github()`.

## Testing testing

* Do whatever is appropriate for your OS to launch RStudio. You should get a window similar to the screenshot you see [here](https://d33wubrfki0l68.cloudfront.net/baf6318c88cf5c4052fe84246c78b556b0e19885/ff5d5/wp-content/uploads/2014/04/rstudio-ubuntu.png), but yours will be more boring because you haven't written any code or made any figures yet!

* Put your cursor in the pane labelled Console, which is where you interact with the live R process. Create a simple object with code like `x <- 2 * 4` (followed by enter or return). Then inspect the `x` object by typing `x` followed by enter or return. You should see the value 8 print to screen. If yes, you've succeeded in installing R and RStudio.

## Add-on packages

R is an extensible system and many people share useful code they have developed as a _package_ via CRAN and GitHub. To install a package from CRAN, for example the [dplyr](https://cran.r-project.org/web/packages/dplyr/index.html) package for data manipulation, here is one way to do it in the R console (there are others).

```r
install.packages("dplyr", dependencies = TRUE)
```

By including `dependencies = TRUE`, we are being explicit and extra-careful to install any additional packages the target package, dplyr in the example above, needs to have around.

You could use the above method to install the following packages, all of which we will use:

* [tidyr package webpage](https://tidyr.tidyverse.org/)
* [ggplot2 package webpage](https://ggplot2-book.org/)

Note that if you install the tidyverse, it includes many of the other packages above! 

```r
install.packages('tidyverse', dependencies = TRUE)
```

## Further resources

The above will get your basic setup ready but here are some links if you are interested in reading a bit further.

* [How to Use RStudio](https://support.rstudio.com/hc/en-us)
* [RStudio's leads for learning R](https://support.rstudio.com/hc/en-us/articles/200552336-Getting-Help-with-R)
* [R FAQ](https://cran.r-project.org/doc/FAQ/R-FAQ.html)
* [R Installation and Administration](https://cran.r-project.org/doc/manuals/r-release/R-admin.html)
* [More about add-on packages in the R Installation and Administration Manual](https://cran.r-project.org/doc/manuals/r-release/R-admin.html#Add_002don-packages)